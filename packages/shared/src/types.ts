export type MembershipRole = "owner" | "admin" | "member"
export type EmployeeStatus = "active" | "archived"
export type EventType = "meeting" | "focus" | "absence" | "other"
export type ConversationType = "direct" | "group"

export interface CompanyDTO {
  id: string
  name: string
  slug: string
  timezone: string
  adminCanReadConversations: boolean
}

export interface SystemCompanyDTO extends CompanyDTO {
  createdAt: string
  updatedAt: string
  employeeCount: number
  membershipCount: number
  conversationCount: number
  owners: Array<{
    id: string
    name: string
    email: string
  }>
  currentUserRole: MembershipRole | null
}

export interface MembershipDTO {
  companyId: string
  role: MembershipRole
  company: CompanyDTO
}

export interface EmployeeDTO {
  id: string
  companyId: string
  userId: string | null
  managerId: string | null
  name: string
  email: string | null
  title: string
  department: string | null
  jobDescription: string
  status: EmployeeStatus
  createdAt: string
  updatedAt: string
}

export interface EmployeeEventDTO {
  id: string
  employeeId: string
  title: string
  description: string | null
  type: EventType
  startsAt: string
  endsAt: string
}

export interface HierarchyNodeDTO {
  id: string
  employee: EmployeeDTO
}

export interface HierarchyEdgeDTO {
  id: string
  source: string
  target: string
}

export interface ConversationDTO {
  id: string
  companyId: string
  type: ConversationType
  title: string | null
  participantEmployeeIds: string[]
  lastMessageAt: string | null
  createdAt: string
}

export interface MessageDTO {
  id: string
  conversationId: string
  senderEmployeeId: string
  body: string
  createdAt: string
}

export interface CommunityPostDTO {
  id: string
  companyId: string
  groupId: string | null
  authorEmployeeId: string
  title: string
  body: string
  imageUrl: string | null
  createdAt: string
}

export interface GroupDTO {
  id: string
  companyId: string
  name: string
  description: string | null
  createdAt: string
}

export interface AssistantCandidateDTO {
  employee: EmployeeDTO
  handle: string
  score: number
  available: boolean
  reason: string
  nextFreeSlot: string | null
}

export interface AssistantResponseDTO {
  answer: string
  interpretedRole: string | null
  interpretedDate: string | null
  candidates: AssistantCandidateDTO[]
  ollamaAvailable: boolean
}
