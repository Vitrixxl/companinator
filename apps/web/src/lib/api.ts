import type {
  AssistantResponseDTO,
  CommunityPostDTO,
  CompanyDTO,
  ConversationDTO,
  EmployeeDTO,
  EmployeeEventDTO,
  GroupDTO,
  HierarchyImportResultDTO,
  MessageDTO,
  MembershipDTO,
  SystemCompanyDTO,
} from "@workspace/shared"

const API_PORT = import.meta.env.VITE_API_PORT ?? "3000"

function currentBrowserHost() {
  if (typeof window === "undefined") {
    return "localhost"
  }
  return window.location.hostname
}

function urlHost(hostname: string) {
  return hostname.includes(":") ? `[${hostname}]` : hostname
}

function isLoopbackUrl(value: string) {
  try {
    const url = new URL(value)
    return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1"
  } catch {
    return false
  }
}

function shouldReplaceLoopbackUrl(value: string | undefined) {
  if (!value || typeof window === "undefined") {
    return false
  }

  const browserHost = currentBrowserHost()
  return browserHost !== "localhost" && browserHost !== "127.0.0.1" && browserHost !== "::1" && isLoopbackUrl(value)
}

function browserApiOrigin() {
  if (typeof window === "undefined") {
    return `http://localhost:${API_PORT}`
  }

  const protocol = window.location.protocol === "https:" ? "https:" : "http:"
  return `${protocol}//${urlHost(currentBrowserHost())}:${API_PORT}`
}

function browserWsOrigin() {
  if (typeof window === "undefined") {
    return `ws://localhost:${API_PORT}`
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
  return `${protocol}//${urlHost(currentBrowserHost())}:${API_PORT}`
}

const configuredApiUrl = import.meta.env.VITE_API_URL || undefined
const configuredWsUrl = import.meta.env.VITE_WS_URL || undefined

export const API_URL =
  configuredApiUrl && !shouldReplaceLoopbackUrl(configuredApiUrl) ? configuredApiUrl : `${browserApiOrigin()}/api`
export const WS_URL =
  configuredWsUrl && !shouldReplaceLoopbackUrl(configuredWsUrl) ? configuredWsUrl : `${browserWsOrigin()}/api/ws`
const API_ORIGIN = API_URL.replace(/\/api\/?$/, "")

export interface MeResponse {
  user: {
    id: string
    name: string
    email: string
  }
  memberships: MembershipDTO[]
  activeCompanyId: string | null
  employee: EmployeeDTO | null
  isSystemAdmin: boolean
}

export interface DashboardResponse {
  employees: number
  events: number
  conversations: number
  posts: number
}

export interface HierarchyResponse {
  nodes: Array<{ id: string; employee: EmployeeDTO }>
  edges: Array<{ id: string; source: string; target: string }>
}

export interface SearchResult {
  employee: EmployeeDTO
  score: number
}

export interface AdminConversationResponse {
  mode: "metadata" | "full"
  conversations: ConversationDTO[]
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...init.headers,
    },
    ...init,
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(payload?.error ?? `HTTP ${response.status}`)
  }

  return response.json() as Promise<T>
}

async function apiFormFetch<T>(path: string, formData: FormData): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    credentials: "include",
    body: formData,
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(payload?.error ?? `HTTP ${response.status}`)
  }

  return response.json() as Promise<T>
}

export function assetUrl(path: string | null | undefined) {
  if (!path) {
    return null
  }
  if (/^https?:\/\//.test(path)) {
    return path
  }
  return `${API_ORIGIN}${path}`
}

export function signIn(email: string, password: string) {
  return apiFetch<{ token: string; user: MeResponse["user"] }>("/auth/sign-in/email", {
    method: "POST",
    body: JSON.stringify({ email, password, rememberMe: true }),
  })
}

export function signOut() {
  return apiFetch<void>("/auth/sign-out", { method: "POST" })
}

export const getMe = () => apiFetch<MeResponse>("/me")
export const getDashboard = (companyId: string) => apiFetch<DashboardResponse>(`/companies/${companyId}/dashboard`)
export const getEmployees = (companyId: string, q = "") =>
  apiFetch<EmployeeDTO[]>(`/companies/${companyId}/employees${q ? `?q=${encodeURIComponent(q)}` : ""}`)
export const getHierarchy = (companyId: string) => apiFetch<HierarchyResponse>(`/companies/${companyId}/hierarchy`)
export const getEmployeeEvents = (companyId: string, employeeId: string) =>
  apiFetch<EmployeeEventDTO[]>(`/companies/${companyId}/employees/${employeeId}/events`)
export const getConversations = (companyId: string) => apiFetch<ConversationDTO[]>(`/companies/${companyId}/conversations`)
export const getMessages = (companyId: string, conversationId: string) =>
  apiFetch<MessageDTO[]>(`/companies/${companyId}/conversations/${conversationId}/messages`)
export const getPosts = (companyId: string) => apiFetch<CommunityPostDTO[]>(`/companies/${companyId}/community/posts`)
export const getGroups = (companyId: string) => apiFetch<GroupDTO[]>(`/companies/${companyId}/groups`)
export const getAdminConversations = (companyId: string) =>
  apiFetch<AdminConversationResponse>(`/admin/companies/${companyId}/conversations`)
export const getSuperAdminCompanies = () => apiFetch<SystemCompanyDTO[]>("/super-admin/companies")

export function createEmployee(companyId: string, payload: Partial<EmployeeDTO>) {
  return apiFetch<EmployeeDTO>(`/companies/${companyId}/employees`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function importHierarchyCsv(companyId: string, file: File) {
  const formData = new FormData()
  formData.append("file", file)
  return apiFormFetch<HierarchyImportResultDTO>(`/companies/${companyId}/hierarchy/import`, formData)
}

export function createEvent(companyId: string, employeeId: string, payload: Record<string, unknown>) {
  return apiFetch<EmployeeEventDTO>(`/companies/${companyId}/employees/${employeeId}/events`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function askAssistant(companyId: string, query: string) {
  return apiFetch<AssistantResponseDTO>(`/companies/${companyId}/assistant/query`, {
    method: "POST",
    body: JSON.stringify({ query }),
  })
}

export type AssistantStreamMetadata = Omit<AssistantResponseDTO, "answer">

type AssistantStreamEvent =
  | { type: "metadata"; data: AssistantStreamMetadata }
  | { type: "delta"; data: string }
  | { type: "done"; data: { answer: string } }
  | { type: "error"; error: string }

export async function streamAssistant(
  companyId: string,
  query: string,
  handlers: {
    onMetadata?: (metadata: AssistantStreamMetadata) => void
    onDelta?: (delta: string) => void
    onDone?: (answer: string) => void
  },
) {
  const response = await fetch(`${API_URL}/companies/${companyId}/assistant/stream`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query }),
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(payload?.error ?? `HTTP ${response.status}`)
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error("Flux assistant indisponible.")
  }

  const decoder = new TextDecoder()
  let buffer = ""
  let fullAnswer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() ?? ""

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) {
        continue
      }

      const event = JSON.parse(trimmed) as AssistantStreamEvent
      if (event.type === "metadata") {
        handlers.onMetadata?.(event.data)
        continue
      }
      if (event.type === "delta") {
        fullAnswer += event.data
        handlers.onDelta?.(event.data)
        continue
      }
      if (event.type === "done") {
        fullAnswer = event.data.answer || fullAnswer
        handlers.onDone?.(fullAnswer)
        return
      }
      if (event.type === "error") {
        throw new Error(event.error)
      }
    }
  }

  handlers.onDone?.(fullAnswer)
}

export function createConversation(
  companyId: string,
  payload: { title?: string | null; type?: "direct" | "group"; participantEmployeeIds: string[] },
) {
  return apiFetch<ConversationDTO>(`/companies/${companyId}/conversations`, {
    method: "POST",
    body: JSON.stringify({ type: "direct", title: null, ...payload }),
  })
}

export function sendMessage(companyId: string, conversationId: string, body: string) {
  return apiFetch<MessageDTO>(`/companies/${companyId}/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify({ body }),
  })
}

export function createPost(companyId: string, payload: { title?: string; body: string; groupId?: string | null; imageFile?: File | null }) {
  if (payload.imageFile) {
    const formData = new FormData()
    formData.append("title", payload.title ?? "")
    formData.append("body", payload.body)
    if (payload.groupId) {
      formData.append("groupId", payload.groupId)
    }
    formData.append("image", payload.imageFile)
    return apiFormFetch<CommunityPostDTO>(`/companies/${companyId}/community/posts`, formData)
  }

  return apiFetch<CommunityPostDTO>(`/companies/${companyId}/community/posts`, {
    method: "POST",
    body: JSON.stringify({ title: payload.title ?? "", body: payload.body, groupId: payload.groupId ?? null }),
  })
}

export function createGroup(companyId: string, payload: { name: string; description?: string | null; memberEmployeeIds: string[] }) {
  return apiFetch<GroupDTO>(`/companies/${companyId}/groups`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function updateCompanySettings(companyId: string, payload: { adminCanReadConversations: boolean }) {
  return apiFetch<CompanyDTO>(`/admin/companies/${companyId}/settings`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
}

export function createSuperAdminCompany(payload: {
  name: string
  slug?: string
  timezone: string
  adminCanReadConversations: boolean
  ownerName?: string
  ownerEmail?: string
  ownerTitle: string
  ownerPassword?: string
}) {
  return apiFetch<SystemCompanyDTO>("/super-admin/companies", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}
