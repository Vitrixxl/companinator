import { relations } from "drizzle-orm"
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
  type AnyPgColumn,
} from "drizzle-orm/pg-core"

export const membershipRoleEnum = pgEnum("membership_role", ["owner", "admin", "member"])
export const employeeStatusEnum = pgEnum("employee_status", ["active", "archived"])
export const eventTypeEnum = pgEnum("event_type", ["meeting", "focus", "absence", "other"])
export const conversationTypeEnum = pgEnum("conversation_type", ["direct", "group"])

export const user = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export const session = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)],
)

export const account = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("accounts_user_id_idx").on(table.userId)],
)

export const verification = pgTable(
  "verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("verifications_identifier_idx").on(table.identifier)],
)

export const companies = pgTable(
  "companies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    timezone: text("timezone").notNull().default("Europe/Paris"),
    adminCanReadConversations: boolean("admin_can_read_conversations").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
)

export const companyMemberships = pgTable(
  "company_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: membershipRoleEnum("role").notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("company_memberships_company_user_idx").on(table.companyId, table.userId),
    index("company_memberships_user_id_idx").on(table.userId),
  ],
)

export const employees = pgTable(
  "employees",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    managerId: uuid("manager_id").references((): AnyPgColumn => employees.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    email: text("email"),
    title: text("title").notNull(),
    department: text("department"),
    jobDescription: text("job_description").notNull().default(""),
    jobEmbedding: vector("job_embedding", { dimensions: 768 }),
    status: employeeStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("employees_company_id_idx").on(table.companyId),
    index("employees_manager_id_idx").on(table.managerId),
    index("employees_user_id_idx").on(table.userId),
  ],
)

export const employeeEvents = pgTable(
  "employee_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    description: text("description"),
    type: eventTypeEnum("type").notNull().default("meeting"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("employee_events_company_id_idx").on(table.companyId),
    index("employee_events_employee_id_idx").on(table.employeeId),
    index("employee_events_range_idx").on(table.startsAt, table.endsAt),
  ],
)

export const groups = pgTable(
  "groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("groups_company_id_idx").on(table.companyId)],
)

export const groupMembers = pgTable(
  "group_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("group_members_group_employee_idx").on(table.groupId, table.employeeId)],
)

export const communityPosts = pgTable(
  "community_posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    groupId: uuid("group_id").references(() => groups.id, { onDelete: "set null" }),
    authorEmployeeId: uuid("author_employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    imageUrl: text("image_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("community_posts_company_id_idx").on(table.companyId),
    index("community_posts_group_id_idx").on(table.groupId),
  ],
)

export const communityComments = pgTable(
  "community_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => communityPosts.id, { onDelete: "cascade" }),
    authorEmployeeId: uuid("author_employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("community_comments_post_id_idx").on(table.postId)],
)

export const communityReactions = pgTable(
  "community_reactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => communityPosts.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    emoji: text("emoji").notNull().default("like"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("community_reactions_post_employee_idx").on(table.postId, table.employeeId)],
)

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    type: conversationTypeEnum("type").notNull().default("direct"),
    title: text("title"),
    createdByEmployeeId: uuid("created_by_employee_id").references(() => employees.id, { onDelete: "set null" }),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("conversations_company_id_idx").on(table.companyId)],
)

export const conversationParticipants = pgTable(
  "conversation_participants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("conversation_participants_conversation_employee_idx").on(table.conversationId, table.employeeId),
    index("conversation_participants_employee_id_idx").on(table.employeeId),
  ],
)

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderEmployeeId: uuid("sender_employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("messages_conversation_id_idx").on(table.conversationId)],
)

export const adminConversationAudits = pgTable(
  "admin_conversation_audits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    adminUserId: text("admin_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("admin_conversation_audits_company_id_idx").on(table.companyId)],
)

export const assistantThreads = pgTable(
  "assistant_threads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("assistant_threads_company_user_idx").on(table.companyId, table.userId)],
)

export const assistantMessages = pgTable(
  "assistant_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => assistantThreads.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("assistant_messages_thread_id_idx").on(table.threadId)],
)

export const companiesRelations = relations(companies, ({ many }) => ({
  memberships: many(companyMemberships),
  employees: many(employees),
}))

export const employeeRelations = relations(employees, ({ one, many }) => ({
  company: one(companies, { fields: [employees.companyId], references: [companies.id] }),
  manager: one(employees, { fields: [employees.managerId], references: [employees.id], relationName: "manager" }),
  reports: many(employees, { relationName: "manager" }),
  events: many(employeeEvents),
}))

export const conversationRelations = relations(conversations, ({ many }) => ({
  participants: many(conversationParticipants),
  messages: many(messages),
}))

export type User = typeof user.$inferSelect
export type Company = typeof companies.$inferSelect
export type CompanyMembership = typeof companyMemberships.$inferSelect
export type Employee = typeof employees.$inferSelect
export type EmployeeEvent = typeof employeeEvents.$inferSelect
