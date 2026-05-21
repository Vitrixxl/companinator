import type {
  AssistantCandidateDTO,
  CommunityPostDTO,
  CompanyDTO,
  ConversationDTO,
  EmployeeDTO,
  EmployeeEventDTO,
  GroupDTO,
  MessageDTO,
} from "@workspace/shared"

import type { Company, Employee, EmployeeEvent } from "./db/schema"

type ConversationRow = {
  id: string
  companyId: string
  type: "direct" | "group"
  title: string | null
  lastMessageAt: Date | null
  createdAt: Date
  participantEmployeeIds: string[]
}

export function serializeCompany(company: Company): CompanyDTO {
  return {
    id: company.id,
    name: company.name,
    slug: company.slug,
    timezone: company.timezone,
    adminCanReadConversations: company.adminCanReadConversations,
  }
}

export function serializeEmployee(employee: Employee): EmployeeDTO {
  return {
    id: employee.id,
    companyId: employee.companyId,
    userId: employee.userId,
    managerId: employee.managerId,
    name: employee.name,
    email: employee.email,
    title: employee.title,
    department: employee.department,
    jobDescription: employee.jobDescription,
    status: employee.status,
    createdAt: employee.createdAt.toISOString(),
    updatedAt: employee.updatedAt.toISOString(),
  }
}

export function employeeHandle(employee: { name: string }) {
  return employee.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

export function serializeEvent(event: EmployeeEvent): EmployeeEventDTO {
  return {
    id: event.id,
    employeeId: event.employeeId,
    title: event.title,
    description: event.description,
    type: event.type,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt.toISOString(),
  }
}

export function serializeConversation(conversation: ConversationRow): ConversationDTO {
  return {
    id: conversation.id,
    companyId: conversation.companyId,
    type: conversation.type,
    title: conversation.title,
    participantEmployeeIds: conversation.participantEmployeeIds,
    lastMessageAt: conversation.lastMessageAt?.toISOString() ?? null,
    createdAt: conversation.createdAt.toISOString(),
  }
}

export function serializeMessage(row: {
  id: string
  conversationId: string
  senderEmployeeId: string
  body: string
  createdAt: Date
}): MessageDTO {
  return {
    id: row.id,
    conversationId: row.conversationId,
    senderEmployeeId: row.senderEmployeeId,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
  }
}

export function serializePost(row: {
  id: string
  companyId: string
  groupId: string | null
  authorEmployeeId: string
  title: string
  body: string
  imageUrl: string | null
  createdAt: Date
}): CommunityPostDTO {
  return {
    id: row.id,
    companyId: row.companyId,
    groupId: row.groupId,
    authorEmployeeId: row.authorEmployeeId,
    title: row.title,
    body: row.body,
    imageUrl: row.imageUrl,
    createdAt: row.createdAt.toISOString(),
  }
}

export function serializeGroup(row: {
  id: string
  companyId: string
  name: string
  description: string | null
  createdAt: Date
}): GroupDTO {
  return {
    id: row.id,
    companyId: row.companyId,
    name: row.name,
    description: row.description,
    createdAt: row.createdAt.toISOString(),
  }
}

export function serializeCandidate(input: {
  employee: Employee
  score: number
  available: boolean
  reason: string
  nextFreeSlot: Date | null
}): AssistantCandidateDTO {
  return {
    employee: serializeEmployee(input.employee),
    handle: employeeHandle(input.employee),
    score: input.score,
    available: input.available,
    reason: input.reason,
    nextFreeSlot: input.nextFreeSlot?.toISOString() ?? null,
  }
}
