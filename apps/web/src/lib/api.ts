import type {
  AssistantResponseDTO,
  CommunityPostDTO,
  CompanyDTO,
  ConversationDTO,
  EmployeeDTO,
  EmployeeEventDTO,
  GroupDTO,
  MessageDTO,
  MembershipDTO,
} from "@workspace/shared"

export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api"
export const WS_URL = import.meta.env.VITE_WS_URL ?? "ws://localhost:3000/api/ws"
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

export function createEmployee(companyId: string, payload: Partial<EmployeeDTO>) {
  return apiFetch<EmployeeDTO>(`/companies/${companyId}/employees`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
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
