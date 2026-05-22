import { and, eq } from "drizzle-orm"

import { auth } from "./auth"
import { db } from "./db/client"
import { companyMemberships, employees, type CompanyMembership, type Employee } from "./db/schema"
import { env } from "./env"

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

export function jsonError(error: unknown) {
  if (error instanceof HttpError) {
    return Response.json({ error: error.message }, { status: error.status })
  }

  console.error(error)
  return Response.json({ error: "Erreur interne du serveur" }, { status: 500 })
}

export async function requireSession(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers })

  if (!session) {
    throw new HttpError(401, "Session requise")
  }

  return session
}

export function isSuperAdminEmail(email: string) {
  const allowedEmails = env.SUPER_ADMIN_EMAILS.split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)

  return allowedEmails.includes(email.toLowerCase())
}

export async function requireSuperAdmin(request: Request) {
  const session = await requireSession(request)

  if (!isSuperAdminEmail(session.user.email)) {
    throw new HttpError(403, "Droits plateforme requis")
  }

  return session
}

export async function requireMembership(request: Request, companyId: string) {
  const session = await requireSession(request)
  const [membership] = await db
    .select()
    .from(companyMemberships)
    .where(and(eq(companyMemberships.companyId, companyId), eq(companyMemberships.userId, session.user.id)))
    .limit(1)

  if (!membership) {
    throw new HttpError(403, "Acces entreprise refuse")
  }

  return { session, membership }
}

export async function requireAdmin(request: Request, companyId: string) {
  const context = await requireMembership(request, companyId)

  if (context.membership.role !== "owner" && context.membership.role !== "admin") {
    throw new HttpError(403, "Droits admin requis")
  }

  return context
}

export async function requireAdminOrSuperAdmin(request: Request, companyId: string) {
  const session = await requireSession(request)

  if (isSuperAdminEmail(session.user.email)) {
    return { session, membership: null }
  }

  const [membership] = await db
    .select()
    .from(companyMemberships)
    .where(and(eq(companyMemberships.companyId, companyId), eq(companyMemberships.userId, session.user.id)))
    .limit(1)

  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    throw new HttpError(403, "Droits admin requis")
  }

  return { session, membership }
}

export async function requireOwner(request: Request, companyId: string) {
  const context = await requireMembership(request, companyId)

  if (context.membership.role !== "owner") {
    throw new HttpError(403, "Droits owner requis")
  }

  return context
}

export async function currentEmployee(companyId: string, userId: string): Promise<Employee | null> {
  const [employee] = await db
    .select()
    .from(employees)
    .where(and(eq(employees.companyId, companyId), eq(employees.userId, userId), eq(employees.status, "active")))
    .limit(1)

  return employee ?? null
}

export function canAdminReadConversations(membership: CompanyMembership, adminCanReadConversations: boolean) {
  return adminCanReadConversations && (membership.role === "owner" || membership.role === "admin")
}
