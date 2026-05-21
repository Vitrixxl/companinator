import { cors } from "@elysiajs/cors"
import { openapi } from "@elysiajs/openapi"
import { Elysia } from "elysia"
import { and, asc, desc, eq, gt, ilike, inArray, isNotNull, lt, or, sql } from "drizzle-orm"
import { mkdir, writeFile } from "node:fs/promises"
import { extname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { z } from "zod"

import { auth } from "./auth"
import { db } from "./db/client"
import {
  adminConversationAudits,
  companies,
  companyMemberships,
  communityComments,
  communityPosts,
  conversationParticipants,
  conversations,
  employeeEvents,
  employees,
  groupMembers,
  groups,
  messages,
} from "./db/schema"
import { env } from "./env"
import {
  HttpError,
  canAdminReadConversations,
  currentEmployee,
  jsonError,
  requireAdmin,
  requireMembership,
  requireOwner,
  requireSession,
} from "./http"
import { isAllowedWebOrigin } from "./origins"
import {
  serializeCandidate,
  serializeCompany,
  serializeConversation,
  serializeEmployee,
  serializeEvent,
  serializeGroup,
  serializeMessage,
  serializePost,
  employeeHandle,
} from "./serializers"
import { businessWindow, findFirstFreeSlot, formatLocalDate, parseLocalDate } from "./services/availability"
import { ensureCompanyEmployeeEmbeddings } from "./services/ai/embeddings"
import {
  LocalAiError,
  chatJson,
  chatStrict,
  checkOllama,
  embedText,
  embedTextStrict,
  ollamaSetupMessage,
  vectorLiteral,
} from "./services/ai/ollama"

const employeeInput = z.object({
  name: z.string().min(2),
  email: z.string().email().nullable().optional(),
  title: z.string().min(2),
  department: z.string().nullable().optional(),
  managerId: z.string().uuid().nullable().optional(),
  jobDescription: z.string().min(1).default(""),
})

const eventInput = z.object({
  title: z.string().min(2),
  description: z.string().nullable().optional(),
  type: z.enum(["meeting", "focus", "absence", "other"]).default("meeting"),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
})

const conversationInput = z.object({
  title: z.string().nullable().optional(),
  type: z.enum(["direct", "group"]).default("direct"),
  participantEmployeeIds: z.array(z.string().uuid()).min(1),
})

const messageInput = z.object({
  body: z.string().min(1),
})

const postInput = z.object({
  title: z.string().trim().optional().default(""),
  body: z.string().trim().optional().default(""),
  groupId: z.string().uuid().nullable().optional(),
})

const groupInput = z.object({
  name: z.string().min(2),
  description: z.string().nullable().optional(),
  memberEmployeeIds: z.array(z.string().uuid()).default([]),
})

const assistantInput = z.object({
  query: z.string().min(2),
})

const nullableString = z.preprocess((value) => {
  if (typeof value !== "string") {
    return null
  }
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}, z.string().nullable())

const stringArray = z.preprocess((value) => {
  if (typeof value === "string") {
    return value.trim() ? [value.trim()] : []
  }
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
  }
  return []
}, z.array(z.string()))

const intentType = z.preprocess((value) => {
  if (typeof value !== "string") {
    return "find_people"
  }
  const normalized = value.toLowerCase()
  if (normalized.includes("schedule") || normalized.includes("meeting") || normalized.includes("point")) {
    return "schedule_meeting"
  }
  if (normalized.includes("search") || normalized.includes("general")) {
    return "general_search"
  }
  return "find_people"
}, z.enum(["find_people", "schedule_meeting", "general_search"]))

const assistantIntentSchema = z.object({
  intent: intentType.default("find_people"),
  role: nullableString.default(null),
  skills: stringArray.default([]),
  departments: stringArray.default([]),
  date: z
    .preprocess((value) => (typeof value === "string" && value.trim() ? value.trim() : null), z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable())
    .default(null),
  durationMinutes: z.coerce.number().int().min(15).max(240).default(30),
  availabilityRequired: z.boolean().default(false),
  searchQuery: z.string().default(""),
})

type AssistantIntent = z.infer<typeof assistantIntentSchema>

const companySettingsInput = z.object({
  adminCanReadConversations: z.boolean(),
})

const COMMUNITY_STORAGE_DIR = fileURLToPath(new URL("../storage/community", import.meta.url))
const allowedCommunityImageTypes = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["image/gif", ".gif"],
  ["image/svg+xml", ".svg"],
])

function localPostTitle(body: string, fallback = "Publication") {
  const firstLine = body.split("\n").find((line) => line.trim())?.trim()
  if (!firstLine) {
    return fallback
  }
  return firstLine.length > 64 ? `${firstLine.slice(0, 61)}...` : firstLine
}

function communityImageContentType(fileName: string) {
  const extension = extname(fileName).toLowerCase()
  if (extension === ".jpg" || extension === ".jpeg") {
    return "image/jpeg"
  }
  if (extension === ".png") {
    return "image/png"
  }
  if (extension === ".webp") {
    return "image/webp"
  }
  if (extension === ".gif") {
    return "image/gif"
  }
  if (extension === ".svg") {
    return "image/svg+xml"
  }
  return "application/octet-stream"
}

async function saveCommunityImage(image: File | null) {
  if (!image || image.size === 0) {
    return null
  }

  if (image.size > 8 * 1024 * 1024) {
    throw new HttpError(400, "Image trop lourde, limite 8 Mo")
  }

  const extension = allowedCommunityImageTypes.get(image.type)
  if (!extension) {
    throw new HttpError(400, "Format image non supporte")
  }

  await mkdir(COMMUNITY_STORAGE_DIR, { recursive: true })
  const fileName = `${crypto.randomUUID()}${extension}`
  await writeFile(join(COMMUNITY_STORAGE_DIR, fileName), Buffer.from(await image.arrayBuffer()))
  return `/api/uploads/community/${fileName}`
}

async function parsePostRequest(request: Request, body: unknown) {
  const contentType = request.headers.get("content-type") ?? ""
  if (!contentType.includes("multipart/form-data")) {
    return { ...parseBody(postInput, body), imageUrl: null }
  }

  const form = body && typeof body === "object" ? (body as Record<string, unknown>) : {}
  const imageValue = form.image
  const input = parseBody(postInput, {
    title: String(form.title ?? ""),
    body: String(form.body ?? ""),
    groupId: form.groupId ? String(form.groupId) : null,
  })

  return {
    ...input,
    imageUrl: await saveCommunityImage(imageValue instanceof File ? imageValue : null),
  }
}

function expandAssistantIntent(intent: AssistantIntent, query: string): AssistantIntent {
  const normalized = `${query} ${intent.searchQuery}`.toLowerCase()
  const skills = new Set(intent.skills)
  const departments = new Set(intent.departments)
  let role = intent.role?.split(/[|,;]/)[0]?.trim() || null
  const expansions: string[] = []

  if (/\b(dev|developpeur|developer|frontend|backend|fullstack|react|elysia|api)\b/.test(normalized)) {
    role = "developpeur"
    departments.add("Engineering")
    expansions.push("developpeur logiciel engineering frontend backend fullstack React Elysia API")
  }

  if (/\b(design|designer|ux|ui)\b/.test(normalized)) {
    role = role ?? "designer"
    expansions.push("product designer UX UI recherche utilisateur prototype")
  }

  if (/\b(rh|people|recrutement|hr)\b/.test(normalized)) {
    role = role ?? "people"
    departments.add("People")
    expansions.push("people operations recrutement ressources humaines managers")
  }

  if (/\b(sales|commercial|vente|client)\b/.test(normalized)) {
    role = role ?? "commercial"
    expansions.push("sales customer success relation client compte")
  }

  return {
    ...intent,
    role,
    skills: Array.from(skills),
    departments: Array.from(departments),
    searchQuery: [intent.searchQuery, ...expansions].filter(Boolean).join(" "),
  }
}

function parseBody<T>(schema: z.ZodType<T>, body: unknown) {
  const result = schema.safeParse(body)
  if (!result.success) {
    throw new HttpError(400, result.error.issues[0]?.message ?? "Payload invalide")
  }
  return result.data
}

function param(value: unknown) {
  return String(value)
}

async function assertNoManagerCycle(companyId: string, employeeId: string, managerId: string | null | undefined) {
  if (!managerId) {
    return
  }

  if (managerId === employeeId) {
    throw new HttpError(400, "Un employe ne peut pas etre son propre superieur")
  }

  let cursor: string | null = managerId
  const seen = new Set<string>()

  while (cursor) {
    if (seen.has(cursor)) {
      throw new HttpError(400, "Cycle hierarchique detecte")
    }
    seen.add(cursor)

    if (cursor === employeeId) {
      throw new HttpError(400, "Cycle hierarchique detecte")
    }

    const [manager] = await db
      .select({ id: employees.id, managerId: employees.managerId })
      .from(employees)
      .where(and(eq(employees.companyId, companyId), eq(employees.id, cursor)))
      .limit(1)

    cursor = manager?.managerId ?? null
  }
}

async function buildConversationRows(companyId: string, visibleConversationIds?: string[]) {
  if (visibleConversationIds && visibleConversationIds.length === 0) {
    return []
  }

  const conditions = [eq(conversations.companyId, companyId)]
  if (visibleConversationIds) {
    conditions.push(inArray(conversations.id, visibleConversationIds))
  }

  return db
    .select({
      id: conversations.id,
      companyId: conversations.companyId,
      type: conversations.type,
      title: conversations.title,
      lastMessageAt: conversations.lastMessageAt,
      createdAt: conversations.createdAt,
      participantEmployeeIds: sql<string[]>`coalesce(array_agg(${conversationParticipants.employeeId}) filter (where ${conversationParticipants.employeeId} is not null), '{}')`,
    })
    .from(conversations)
    .leftJoin(conversationParticipants, eq(conversationParticipants.conversationId, conversations.id))
    .where(and(...conditions))
    .groupBy(conversations.id)
    .orderBy(desc(conversations.lastMessageAt), desc(conversations.createdAt))
}

async function canReadConversation(companyId: string, conversationId: string, userId: string) {
  const employee = await currentEmployee(companyId, userId)
  if (!employee) {
    return false
  }

  const [participant] = await db
    .select({ id: conversationParticipants.id })
    .from(conversationParticipants)
    .innerJoin(conversations, eq(conversations.id, conversationParticipants.conversationId))
    .where(
      and(
        eq(conversations.companyId, companyId),
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.employeeId, employee.id),
      ),
    )
    .limit(1)

  return Boolean(participant)
}

async function interpretAssistantQuery(query: string): Promise<AssistantIntent> {
  const today = formatLocalDate(new Date())
  const raw = await chatJson<unknown>(
    [
      `Date courante locale: ${today}`,
      `Demande utilisateur: ${query}`,
      "Retourne uniquement un JSON.",
      "Si la demande contient demain, calcule la date ISO YYYY-MM-DD a partir de la date courante.",
    ].join("\n"),
    [
      "Tu extrais l'intention de recherche interne d'entreprise.",
      "Schema JSON strict:",
      '{ "intent": "find_people|schedule_meeting|general_search", "role": "string|null", "skills": ["string"], "departments": ["string"], "date": "YYYY-MM-DD|null", "durationMinutes": 30, "availabilityRequired": true, "searchQuery": "string" }',
      "searchQuery doit etre une requete semantique riche et non vide pour retrouver les fiches de poste pertinentes.",
      "Exemples: dev => developpeur logiciel engineering; designer => product designer UX UI; RH => people operations.",
      "Si aucune date n'est demandee, date doit valoir null et availabilityRequired false.",
      "N'invente pas de noms d'employes.",
    ].join("\n"),
  )

  const parsed = assistantIntentSchema.safeParse(raw)
  if (!parsed.success) {
    throw new HttpError(502, "Le modele local n'a pas retourne une intention exploitable.")
  }

  const searchQuery = parsed.data.searchQuery.trim()
  const intent = {
    ...parsed.data,
    searchQuery:
      searchQuery ||
      [parsed.data.role, ...parsed.data.skills, ...parsed.data.departments, query]
        .filter((part): part is string => Boolean(part?.trim()))
        .join(" "),
  }

  return expandAssistantIntent(intent, query)
}

const sockets = new Map<string, Set<{ send: (data: string) => void }>>()

function broadcastConversation(conversationId: string, payload: unknown) {
  const subscribers = sockets.get(conversationId)
  if (!subscribers) {
    return
  }

  const data = JSON.stringify(payload)
  for (const socket of subscribers) {
    socket.send(data)
  }
}

export const app = new Elysia()
  .use(
    cors({
      origin: isAllowedWebOrigin,
      credentials: true,
      allowedHeaders: ["content-type", "authorization"],
    }),
  )
  .use(
    openapi({
      path: "/api/openapi",
      documentation: {
        info: {
          title: "Companinator API",
          version: "0.0.1",
        },
      },
    }),
  )
  .all("/api/auth/*", ({ request }) => auth.handler(request))
  .get("/api/health", async () => {
    const ollama = await checkOllama()
    return { ok: true, service: "companinator-api", ollama }
  })
  .get("/api/uploads/community/:fileName", async ({ params }) => {
    try {
      const fileName = param(params.fileName)
      if (!/^[a-zA-Z0-9._-]+$/.test(fileName)) {
        throw new HttpError(400, "Nom de fichier invalide")
      }

      const file = Bun.file(join(COMMUNITY_STORAGE_DIR, fileName))
      if (!(await file.exists())) {
        throw new HttpError(404, "Image introuvable")
      }

      return new Response(file, {
        headers: {
          "content-type": communityImageContentType(fileName),
          "cache-control": "public, max-age=31536000, immutable",
        },
      })
    } catch (error) {
      return jsonError(error)
    }
  })
  .get("/api/me", async ({ request }) => {
    try {
      const session = await requireSession(request)
      const rows = await db
        .select({ membership: companyMemberships, company: companies })
        .from(companyMemberships)
        .innerJoin(companies, eq(companies.id, companyMemberships.companyId))
        .where(eq(companyMemberships.userId, session.user.id))
        .orderBy(asc(companies.name))

      const activeCompany = rows[0]?.company ?? null
      const employee = activeCompany ? await currentEmployee(activeCompany.id, session.user.id) : null

      return {
        user: session.user,
        memberships: rows.map((row) => ({
          companyId: row.membership.companyId,
          role: row.membership.role,
          company: serializeCompany(row.company),
        })),
        activeCompanyId: activeCompany?.id ?? null,
        employee: employee ? serializeEmployee(employee) : null,
      }
    } catch (error) {
      return jsonError(error)
    }
  })
  .get("/api/companies/:companyId/dashboard", async ({ request, params }) => {
    try {
      const companyId = param(params.companyId)
      await requireMembership(request, companyId)

      const [employeeCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(employees)
        .where(and(eq(employees.companyId, companyId), eq(employees.status, "active")))
      const [eventCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(employeeEvents)
        .where(eq(employeeEvents.companyId, companyId))
      const [conversationCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(conversations)
        .where(eq(conversations.companyId, companyId))
      const [postCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(communityPosts)
        .where(eq(communityPosts.companyId, companyId))

      return {
        employees: employeeCount?.count ?? 0,
        events: eventCount?.count ?? 0,
        conversations: conversationCount?.count ?? 0,
        posts: postCount?.count ?? 0,
      }
    } catch (error) {
      return jsonError(error)
    }
  })
  .get("/api/companies/:companyId/employees", async ({ request, params, query }) => {
    try {
      const companyId = param(params.companyId)
      await requireMembership(request, companyId)
      const q = String(query.q ?? "").trim()
      const conditions = [eq(employees.companyId, companyId)]

      if (query.includeArchived !== "true") {
        conditions.push(eq(employees.status, "active"))
      }

      if (q) {
        const like = `%${q}%`
        conditions.push(
          or(
            ilike(employees.name, like),
            ilike(employees.title, like),
            ilike(employees.department, like),
            ilike(employees.jobDescription, like),
          )!,
        )
      }

      const rows = await db.select().from(employees).where(and(...conditions)).orderBy(asc(employees.name))
      return rows.map(serializeEmployee)
    } catch (error) {
      return jsonError(error)
    }
  })
  .post("/api/companies/:companyId/employees", async ({ request, params, body }) => {
    try {
      const companyId = param(params.companyId)
      const { session } = await requireAdmin(request, companyId)
      const input = parseBody(employeeInput, body)

      if (input.managerId) {
        const [manager] = await db
          .select({ id: employees.id })
          .from(employees)
          .where(and(eq(employees.companyId, companyId), eq(employees.id, input.managerId)))
          .limit(1)
        if (!manager) {
          throw new HttpError(400, "Superieur introuvable")
        }
      }

      const embedding = await embedText(`${input.title}\n${input.jobDescription}`)
      const [employee] = await db
        .insert(employees)
        .values({
          companyId,
          name: input.name,
          email: input.email ?? null,
          title: input.title,
          department: input.department ?? null,
          managerId: input.managerId ?? null,
          jobDescription: input.jobDescription,
          jobEmbedding: embedding,
        })
        .returning()

      await db.insert(employeeEvents).values({
        companyId,
        employeeId: employee.id,
        createdByUserId: session.user.id,
        title: "Onboarding",
        description: "Premier point RH a planifier",
        type: "meeting",
        startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        endsAt: new Date(Date.now() + 24 * 60 * 60 * 1000 + 30 * 60 * 1000),
      })

      return serializeEmployee(employee)
    } catch (error) {
      return jsonError(error)
    }
  })
  .patch("/api/companies/:companyId/employees/:employeeId", async ({ request, params, body }) => {
    try {
      const companyId = param(params.companyId)
      const employeeId = param(params.employeeId)
      await requireAdmin(request, companyId)
      const input = parseBody(employeeInput.partial(), body)

      await assertNoManagerCycle(companyId, employeeId, input.managerId)
      const embedding =
        input.title || input.jobDescription
          ? await embedText(`${input.title ?? ""}\n${input.jobDescription ?? ""}`)
          : undefined

      const [employee] = await db
        .update(employees)
        .set({
          ...input,
          email: input.email ?? undefined,
          department: input.department ?? undefined,
          managerId: input.managerId ?? undefined,
          jobEmbedding: embedding ?? undefined,
          updatedAt: new Date(),
        })
        .where(and(eq(employees.companyId, companyId), eq(employees.id, employeeId)))
        .returning()

      if (!employee) {
        throw new HttpError(404, "Employe introuvable")
      }

      return serializeEmployee(employee)
    } catch (error) {
      return jsonError(error)
    }
  })
  .get("/api/companies/:companyId/hierarchy", async ({ request, params }) => {
    try {
      const companyId = param(params.companyId)
      await requireMembership(request, companyId)

      const rows = await db
        .select()
        .from(employees)
        .where(and(eq(employees.companyId, companyId), eq(employees.status, "active")))
        .orderBy(asc(employees.name))

      return {
        nodes: rows.map((employee) => ({ id: employee.id, employee: serializeEmployee(employee) })),
        edges: rows
          .filter((employee) => employee.managerId)
          .map((employee) => ({
            id: `${employee.managerId}-${employee.id}`,
            source: employee.managerId!,
            target: employee.id,
          })),
      }
    } catch (error) {
      return jsonError(error)
    }
  })
  .get("/api/companies/:companyId/employees/:employeeId/events", async ({ request, params }) => {
    try {
      const companyId = param(params.companyId)
      const employeeId = param(params.employeeId)
      await requireMembership(request, companyId)
      const rows = await db
        .select()
        .from(employeeEvents)
        .where(and(eq(employeeEvents.companyId, companyId), eq(employeeEvents.employeeId, employeeId)))
        .orderBy(asc(employeeEvents.startsAt))

      return rows.map(serializeEvent)
    } catch (error) {
      return jsonError(error)
    }
  })
  .post("/api/companies/:companyId/employees/:employeeId/events", async ({ request, params, body }) => {
    try {
      const companyId = param(params.companyId)
      const employeeId = param(params.employeeId)
      const { session } = await requireMembership(request, companyId)
      const input = parseBody(eventInput, body)
      const startsAt = new Date(input.startsAt)
      const endsAt = new Date(input.endsAt)

      if (endsAt <= startsAt) {
        throw new HttpError(400, "La date de fin doit etre apres le debut")
      }

      const [employee] = await db
        .select({ id: employees.id })
        .from(employees)
        .where(and(eq(employees.companyId, companyId), eq(employees.id, employeeId)))
        .limit(1)

      if (!employee) {
        throw new HttpError(404, "Employe introuvable")
      }

      const [event] = await db
        .insert(employeeEvents)
        .values({
          companyId,
          employeeId,
          createdByUserId: session.user.id,
          title: input.title,
          description: input.description ?? null,
          type: input.type,
          startsAt,
          endsAt,
        })
        .returning()

      return serializeEvent(event)
    } catch (error) {
      return jsonError(error)
    }
  })
  .get("/api/companies/:companyId/search", async ({ request, params, query }) => {
    try {
      const companyId = param(params.companyId)
      await requireMembership(request, companyId)
      const q = String(query.q ?? "").trim()
      if (!q) {
        return []
      }

      const embedding = await embedText(q)
      if (embedding) {
        const distance = sql<number>`${employees.jobEmbedding} <=> ${vectorLiteral(embedding)}::vector`
        const rows = await db
          .select({ employee: employees, distance })
          .from(employees)
          .where(and(eq(employees.companyId, companyId), eq(employees.status, "active"), isNotNull(employees.jobEmbedding)))
          .orderBy(distance)
          .limit(12)

        return rows.map((row) => ({
          employee: serializeEmployee(row.employee),
          score: Math.max(0, 1 - Number(row.distance ?? 1)),
        }))
      }

      const like = `%${q}%`
      const rows = await db
        .select()
        .from(employees)
        .where(
          and(
            eq(employees.companyId, companyId),
            eq(employees.status, "active"),
            or(
              ilike(employees.name, like),
              ilike(employees.title, like),
              ilike(employees.department, like),
              ilike(employees.jobDescription, like),
            ),
          ),
        )
        .limit(12)

      return rows.map((employee) => ({ employee: serializeEmployee(employee), score: 0.5 }))
    } catch (error) {
      return jsonError(error)
    }
  })
  .post("/api/companies/:companyId/assistant/query", async ({ request, params, body }) => {
    try {
      const companyId = param(params.companyId)
      await requireMembership(request, companyId)
      const input = parseBody(assistantInput, body)
      const ollama = await checkOllama()

      if (!ollama.available) {
        throw new HttpError(503, ollamaSetupMessage(ollama))
      }

      const intent = await interpretAssistantQuery(input.query)
      await ensureCompanyEmployeeEmbeddings(companyId)

      const embedding = await embedTextStrict(intent.searchQuery)
      const distance = sql<number>`${employees.jobEmbedding} <=> ${vectorLiteral(embedding)}::vector`
      const semanticRows = await db
        .select({ employee: employees, distance })
        .from(employees)
        .where(and(eq(employees.companyId, companyId), eq(employees.status, "active"), isNotNull(employees.jobEmbedding)))
        .orderBy(distance)
        .limit(14)

      const date = parseLocalDate(intent.date)
      const availabilityChecked = Boolean(date)
      const eventRows = date
        ? await db
            .select()
            .from(employeeEvents)
            .where(
              and(
                eq(employeeEvents.companyId, companyId),
                gt(employeeEvents.endsAt, businessWindow(date).start),
                lt(employeeEvents.startsAt, businessWindow(date).end),
              ),
            )
        : []

      const intentTerms = [intent.role, ...intent.skills, ...intent.departments]
        .filter((term): term is string => Boolean(term))
        .map((term) => term.toLowerCase())

      const candidates = semanticRows
        .map((row) => {
          const employee = row.employee
          const events = eventRows.filter((event) => event.employeeId === employee.id)
          const nextFreeSlot = date ? findFirstFreeSlot(events, date, intent.durationMinutes) : null
          const semanticScore = Math.max(0, 1 - Number(row.distance ?? 1))
          const haystack = `${employee.title} ${employee.department ?? ""} ${employee.jobDescription}`.toLowerCase()
          const intentBoost = intentTerms.some((term) => haystack.includes(term)) ? 0.08 : 0
          const available = date ? Boolean(nextFreeSlot) : true
          const availabilityBoost = availabilityChecked ? (available ? 0.08 : -0.12) : 0
          return {
            employee,
            score: Number((semanticScore + intentBoost + availabilityBoost).toFixed(3)),
            available,
            reason: available
              ? date
                ? `Disponible le ${formatLocalDate(date)}`
                : "Profil proche de la demande en recherche vectorielle"
              : `Pas de creneau libre de ${intent.durationMinutes} minutes sur la journee`,
            nextFreeSlot,
          }
        })
        .sort((left, right) => right.score - left.score)
        .slice(0, 8)

      const llmAnswer = await chatStrict(
        [
          `Demande initiale: ${input.query}`,
          `Intention extraite: ${JSON.stringify(intent)}`,
          `Candidats classes: ${JSON.stringify(
            candidates.map((candidate) => ({
              name: candidate.employee.name,
              handle: `@${employeeHandle(candidate.employee)}`,
              title: candidate.employee.title,
              department: candidate.employee.department,
              available: candidate.available,
              score: candidate.score,
              nextFreeSlot: candidate.nextFreeSlot ? candidate.nextFreeSlot.toISOString() : null,
            })),
          )}`,
          availabilityChecked
            ? "Une date est demandee: tu peux parler des disponibilites et des premiers creneaux libres."
            : "Aucune date n'est demandee: ne parle pas de disponibilite, parle seulement de pertinence des profils.",
          "Reponds directement en francais, sans meta-commentaire du type voici la proposition.",
          "Redige une phrase naturelle, pas une liste brute, et ne pose pas de question finale.",
          "Mentionne les profils pertinents avec leur handle exact en minuscules, par exemple @prenom_nom, pour que l'interface puisse ouvrir leur fiche.",
          "Mentionne uniquement des handles fournis dans les candidats classes.",
        ].join("\n"),
      )

      return {
        answer: llmAnswer,
        interpretedRole: intent.role,
        interpretedDate: date ? formatLocalDate(date) : null,
        candidates: candidates.map(serializeCandidate),
        ollamaAvailable: true,
      }
    } catch (error) {
      if (error instanceof LocalAiError) {
        return jsonError(new HttpError(error.status, error.message))
      }
      if (error instanceof Error && error.name === "TimeoutError") {
        return jsonError(new HttpError(503, "IA locale indisponible: Ollama n'a pas repondu assez vite."))
      }
      return jsonError(error)
    }
  })
  .get("/api/companies/:companyId/conversations", async ({ request, params }) => {
    try {
      const companyId = param(params.companyId)
      const { session } = await requireMembership(request, companyId)
      const employee = await currentEmployee(companyId, session.user.id)
      if (!employee) {
        return []
      }

      const visibleRows = await db
        .select({ id: conversationParticipants.conversationId })
        .from(conversationParticipants)
        .where(eq(conversationParticipants.employeeId, employee.id))
      const rows = await buildConversationRows(
        companyId,
        visibleRows.map((row) => row.id),
      )

      return rows.map(serializeConversation)
    } catch (error) {
      return jsonError(error)
    }
  })
  .post("/api/companies/:companyId/conversations", async ({ request, params, body }) => {
    try {
      const companyId = param(params.companyId)
      const { session } = await requireMembership(request, companyId)
      const sender = await currentEmployee(companyId, session.user.id)
      if (!sender) {
        throw new HttpError(403, "Aucun employe associe a cet utilisateur")
      }
      const input = parseBody(conversationInput, body)
      const participantIds = Array.from(new Set([sender.id, ...input.participantEmployeeIds]))

      const existingEmployees = await db
        .select({ id: employees.id })
        .from(employees)
        .where(and(eq(employees.companyId, companyId), inArray(employees.id, participantIds)))
      if (existingEmployees.length !== participantIds.length) {
        throw new HttpError(400, "Un participant est introuvable")
      }

      const [conversation] = await db
        .insert(conversations)
        .values({
          companyId,
          type: input.type,
          title: input.title ?? null,
          createdByEmployeeId: sender.id,
        })
        .returning()

      await db.insert(conversationParticipants).values(
        participantIds.map((employeeId) => ({
          conversationId: conversation.id,
          employeeId,
        })),
      )

      const rows = await buildConversationRows(companyId, [conversation.id])
      return serializeConversation(rows[0])
    } catch (error) {
      return jsonError(error)
    }
  })
  .get("/api/companies/:companyId/conversations/:conversationId/messages", async ({ request, params }) => {
    try {
      const companyId = param(params.companyId)
      const conversationId = param(params.conversationId)
      const { session } = await requireMembership(request, companyId)
      const allowed = await canReadConversation(companyId, conversationId, session.user.id)
      if (!allowed) {
        throw new HttpError(403, "Conversation inaccessible")
      }

      const rows = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conversationId))
        .orderBy(asc(messages.createdAt))
      return rows.map(serializeMessage)
    } catch (error) {
      return jsonError(error)
    }
  })
  .post("/api/companies/:companyId/conversations/:conversationId/messages", async ({ request, params, body }) => {
    try {
      const companyId = param(params.companyId)
      const conversationId = param(params.conversationId)
      const { session } = await requireMembership(request, companyId)
      const sender = await currentEmployee(companyId, session.user.id)
      if (!sender) {
        throw new HttpError(403, "Aucun employe associe a cet utilisateur")
      }
      const allowed = await canReadConversation(companyId, conversationId, session.user.id)
      if (!allowed) {
        throw new HttpError(403, "Conversation inaccessible")
      }
      const input = parseBody(messageInput, body)
      const [message] = await db
        .insert(messages)
        .values({
          conversationId,
          senderEmployeeId: sender.id,
          body: input.body,
        })
        .returning()
      await db.update(conversations).set({ lastMessageAt: new Date() }).where(eq(conversations.id, conversationId))

      const serialized = serializeMessage(message)
      broadcastConversation(conversationId, { type: "message.created", message: serialized })
      return serialized
    } catch (error) {
      return jsonError(error)
    }
  })
  .get("/api/companies/:companyId/groups", async ({ request, params }) => {
    try {
      const companyId = param(params.companyId)
      await requireMembership(request, companyId)
      const rows = await db.select().from(groups).where(eq(groups.companyId, companyId)).orderBy(asc(groups.name))
      return rows.map(serializeGroup)
    } catch (error) {
      return jsonError(error)
    }
  })
  .post("/api/companies/:companyId/groups", async ({ request, params, body }) => {
    try {
      const companyId = param(params.companyId)
      await requireAdmin(request, companyId)
      const input = parseBody(groupInput, body)
      const [group] = await db
        .insert(groups)
        .values({ companyId, name: input.name, description: input.description ?? null })
        .returning()
      if (input.memberEmployeeIds.length) {
        await db.insert(groupMembers).values(
          input.memberEmployeeIds.map((employeeId) => ({
            groupId: group.id,
            employeeId,
          })),
        )
      }
      return serializeGroup(group)
    } catch (error) {
      return jsonError(error)
    }
  })
  .get("/api/companies/:companyId/community/posts", async ({ request, params }) => {
    try {
      const companyId = param(params.companyId)
      await requireMembership(request, companyId)
      const rows = await db
        .select()
        .from(communityPosts)
        .where(eq(communityPosts.companyId, companyId))
        .orderBy(desc(communityPosts.createdAt))
      return rows.map(serializePost)
    } catch (error) {
      return jsonError(error)
    }
  })
  .post("/api/companies/:companyId/community/posts", async ({ request, params, body }) => {
    try {
      const companyId = param(params.companyId)
      const { session } = await requireMembership(request, companyId)
      const employee = await currentEmployee(companyId, session.user.id)
      if (!employee) {
        throw new HttpError(403, "Aucun employe associe a cet utilisateur")
      }
      const input = await parsePostRequest(request, body)
      if (!input.body && !input.imageUrl) {
        throw new HttpError(400, "Ajoute un message ou une image")
      }

      const [post] = await db
        .insert(communityPosts)
        .values({
          companyId,
          groupId: input.groupId ?? null,
          authorEmployeeId: employee.id,
          title: input.title || localPostTitle(input.body),
          body: input.body,
          imageUrl: input.imageUrl,
        })
        .returning()
      return serializePost(post)
    } catch (error) {
      return jsonError(error)
    }
  })
  .get("/api/companies/:companyId/community/posts/:postId/comments", async ({ request, params }) => {
    try {
      const companyId = param(params.companyId)
      const postId = param(params.postId)
      await requireMembership(request, companyId)
      const rows = await db
        .select()
        .from(communityComments)
        .where(eq(communityComments.postId, postId))
        .orderBy(asc(communityComments.createdAt))
      return rows
    } catch (error) {
      return jsonError(error)
    }
  })
  .get("/api/admin/companies/:companyId/conversations", async ({ request, params }) => {
    try {
      const companyId = param(params.companyId)
      const { membership } = await requireAdmin(request, companyId)
      const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1)
      if (!company) {
        throw new HttpError(404, "Entreprise introuvable")
      }

      const rows = await buildConversationRows(companyId)
      return {
        mode: canAdminReadConversations(membership, company.adminCanReadConversations) ? "full" : "metadata",
        conversations: rows.map(serializeConversation),
      }
    } catch (error) {
      return jsonError(error)
    }
  })
  .get("/api/admin/companies/:companyId/conversations/:conversationId/messages", async ({ request, params }) => {
    try {
      const companyId = param(params.companyId)
      const conversationId = param(params.conversationId)
      const { session, membership } = await requireAdmin(request, companyId)
      const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1)
      if (!company || !canAdminReadConversations(membership, company.adminCanReadConversations)) {
        throw new HttpError(403, "Lecture admin des conversations desactivee")
      }

      await db.insert(adminConversationAudits).values({
        companyId,
        conversationId,
        adminUserId: session.user.id,
        reason: "Consultation depuis le panneau admin",
      })

      const rows = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conversationId))
        .orderBy(asc(messages.createdAt))
      return rows.map(serializeMessage)
    } catch (error) {
      return jsonError(error)
    }
  })
  .patch("/api/admin/companies/:companyId/settings", async ({ request, params, body }) => {
    try {
      const companyId = param(params.companyId)
      await requireOwner(request, companyId)
      const input = parseBody(companySettingsInput, body)
      const [company] = await db
        .update(companies)
        .set({ adminCanReadConversations: input.adminCanReadConversations, updatedAt: new Date() })
        .where(eq(companies.id, companyId))
        .returning()
      return serializeCompany(company)
    } catch (error) {
      return jsonError(error)
    }
  })
  .ws("/api/ws/conversations/:conversationId", {
    open(ws) {
      const conversationId = param(ws.data.params.conversationId)
      const subscribers = sockets.get(conversationId) ?? new Set()
      subscribers.add(ws)
      sockets.set(conversationId, subscribers)
    },
    close(ws) {
      const conversationId = param(ws.data.params.conversationId)
      const subscribers = sockets.get(conversationId)
      subscribers?.delete(ws)
      if (subscribers?.size === 0) {
        sockets.delete(conversationId)
      }
    },
    message(ws, message) {
      ws.send(JSON.stringify({ type: "echo", message }))
    },
  })
