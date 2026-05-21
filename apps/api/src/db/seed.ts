import { and, eq } from "drizzle-orm"

import { auth } from "../auth"
import { embedText } from "../services/ai/ollama"
import { sqlClient, db } from "./client"
import {
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
  user,
} from "./schema"

const demoPassword = "Companinator123!"

const demoUsers = [
  { key: "owner", name: "Camille Martin", email: "admin@acme.local", role: "owner" as const },
  { key: "cto", name: "Nadia Benali", email: "nadia.benali@acme.local", role: "admin" as const },
  { key: "frontend", name: "Ines Moreau", email: "ines.moreau@acme.local", role: "member" as const },
  { key: "sales", name: "Mehdi Roux", email: "mehdi.roux@acme.local", role: "member" as const },
]

async function getOrCreateUser(input: { name: string; email: string }) {
  const [existing] = await db.select().from(user).where(eq(user.email, input.email)).limit(1)
  if (existing) {
    return existing
  }

  const signedUpResponse = await auth.api.signUpEmail({
    body: {
      name: input.name,
      email: input.email,
      password: demoPassword,
    },
  } as never)
  const signedUp = (signedUpResponse instanceof Response ? await signedUpResponse.json() : signedUpResponse) as {
    user: { id: string }
  }

  const [created] = await db.select().from(user).where(eq(user.id, signedUp.user.id)).limit(1)
  if (!created) {
    throw new Error(`Impossible de creer l'utilisateur ${input.email}`)
  }
  return created
}

async function getOrCreateCompany() {
  const [existing] = await db.select().from(companies).where(eq(companies.slug, "acme")).limit(1)
  if (existing) {
    return existing
  }

  const [company] = await db
    .insert(companies)
    .values({
      name: "Acme France",
      slug: "acme",
      timezone: "Europe/Paris",
      adminCanReadConversations: false,
    })
    .returning()

  return company
}

async function ensureMembership(input: {
  companyId: string
  userId: string
  role: "owner" | "admin" | "member"
}) {
  const [existing] = await db
    .select()
    .from(companyMemberships)
    .where(and(eq(companyMemberships.companyId, input.companyId), eq(companyMemberships.userId, input.userId)))
    .limit(1)

  if (existing) {
    if (existing.role !== input.role) {
      await db.update(companyMemberships).set({ role: input.role }).where(eq(companyMemberships.id, existing.id))
    }
    return
  }

  await db.insert(companyMemberships).values(input)
}

async function getOrCreateEmployee(input: {
  companyId: string
  userId?: string | null
  managerId?: string | null
  name: string
  email: string
  title: string
  department: string
  jobDescription: string
}) {
  const [existing] = await db
    .select()
    .from(employees)
    .where(and(eq(employees.companyId, input.companyId), eq(employees.email, input.email)))
    .limit(1)

  const embedding = existing?.jobEmbedding ? undefined : await embedText(`${input.title}\n${input.department}\n${input.jobDescription}`)

  if (existing) {
    const [updated] = await db
      .update(employees)
      .set({
        userId: input.userId ?? existing.userId,
        managerId: input.managerId ?? null,
        name: input.name,
        title: input.title,
        department: input.department,
        jobDescription: input.jobDescription,
        jobEmbedding: embedding ?? existing.jobEmbedding,
        updatedAt: new Date(),
      })
      .where(eq(employees.id, existing.id))
      .returning()
    return updated
  }

  const [employee] = await db
    .insert(employees)
    .values({
      companyId: input.companyId,
      userId: input.userId ?? null,
      managerId: input.managerId ?? null,
      name: input.name,
      email: input.email,
      title: input.title,
      department: input.department,
      jobDescription: input.jobDescription,
      jobEmbedding: embedding,
    })
    .returning()

  return employee
}

async function getOrCreateGroup(input: { companyId: string; name: string; description: string }) {
  const [existing] = await db
    .select()
    .from(groups)
    .where(and(eq(groups.companyId, input.companyId), eq(groups.name, input.name)))
    .limit(1)

  if (existing) {
    return existing
  }

  const [group] = await db.insert(groups).values(input).returning()
  return group
}

async function ensureGroupMembers(groupId: string, employeeIds: string[]) {
  for (const employeeId of employeeIds) {
    await db.insert(groupMembers).values({ groupId, employeeId }).onConflictDoNothing()
  }
}

async function ensureEvent(input: {
  companyId: string
  employeeId: string
  createdByUserId: string
  title: string
  description: string
  type: "meeting" | "focus" | "absence" | "other"
  startsAt: Date
  endsAt: Date
}) {
  const [existing] = await db
    .select({ id: employeeEvents.id })
    .from(employeeEvents)
    .where(and(eq(employeeEvents.employeeId, input.employeeId), eq(employeeEvents.title, input.title)))
    .limit(1)

  if (!existing) {
    await db.insert(employeeEvents).values(input)
  }
}

async function getOrCreatePost(input: {
  companyId: string
  authorEmployeeId: string
  title: string
  body: string
  groupId?: string | null
  imageUrl?: string | null
}) {
  const [existing] = await db
    .select()
    .from(communityPosts)
    .where(and(eq(communityPosts.companyId, input.companyId), eq(communityPosts.title, input.title)))
    .limit(1)

  if (existing) {
    if (input.imageUrl && existing.imageUrl !== input.imageUrl) {
      const [updated] = await db
        .update(communityPosts)
        .set({ imageUrl: input.imageUrl })
        .where(eq(communityPosts.id, existing.id))
        .returning()
      return updated
    }
    return existing
  }

  const [post] = await db
    .insert(communityPosts)
    .values({
      companyId: input.companyId,
      authorEmployeeId: input.authorEmployeeId,
      title: input.title,
      body: input.body,
      groupId: input.groupId ?? null,
      imageUrl: input.imageUrl ?? null,
    })
    .returning()
  return post
}

async function ensureComment(input: { postId: string; authorEmployeeId: string; body: string }) {
  const [existing] = await db
    .select({ id: communityComments.id })
    .from(communityComments)
    .where(and(eq(communityComments.postId, input.postId), eq(communityComments.body, input.body)))
    .limit(1)

  if (!existing) {
    await db.insert(communityComments).values(input)
  }
}

async function getOrCreateConversation(input: {
  companyId: string
  title: string
  createdByEmployeeId: string
  type?: "direct" | "group"
}) {
  const [existing] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.companyId, input.companyId), eq(conversations.title, input.title)))
    .limit(1)

  if (existing) {
    return existing
  }

  const [conversation] = await db
    .insert(conversations)
    .values({
      companyId: input.companyId,
      title: input.title,
      type: input.type ?? "group",
      createdByEmployeeId: input.createdByEmployeeId,
      lastMessageAt: new Date(),
    })
    .returning()
  return conversation
}

async function ensureConversationParticipants(conversationId: string, employeeIds: string[]) {
  for (const employeeId of employeeIds) {
    await db.insert(conversationParticipants).values({ conversationId, employeeId }).onConflictDoNothing()
  }
}

async function ensureMessage(input: { conversationId: string; senderEmployeeId: string; body: string }) {
  const [existing] = await db
    .select({ id: messages.id })
    .from(messages)
    .where(and(eq(messages.conversationId, input.conversationId), eq(messages.body, input.body)))
    .limit(1)

  if (!existing) {
    await db.insert(messages).values(input)
    await db.update(conversations).set({ lastMessageAt: new Date() }).where(eq(conversations.id, input.conversationId))
  }
}

function at(dayOffset: number, hour: number, minutes = 0) {
  const date = new Date()
  date.setDate(date.getDate() + dayOffset)
  date.setHours(hour, minutes, 0, 0)
  return date
}

const usersByKey = new Map<string, Awaited<ReturnType<typeof getOrCreateUser>>>()
for (const demoUser of demoUsers) {
  usersByKey.set(demoUser.key, await getOrCreateUser(demoUser))
}

const company = await getOrCreateCompany()

for (const demoUser of demoUsers) {
  await ensureMembership({
    companyId: company.id,
    userId: usersByKey.get(demoUser.key)!.id,
    role: demoUser.role,
  })
}

const ceo = await getOrCreateEmployee({
  companyId: company.id,
  userId: usersByKey.get("owner")!.id,
  name: "Camille Martin",
  email: "admin@acme.local",
  title: "CEO",
  department: "Direction",
  jobDescription: "Dirige l'entreprise, arbitre les priorites business, suit les managers et anime les rituels de direction.",
})

const cto = await getOrCreateEmployee({
  companyId: company.id,
  userId: usersByKey.get("cto")!.id,
  managerId: ceo.id,
  name: "Nadia Benali",
  email: "nadia.benali@acme.local",
  title: "CTO",
  department: "Engineering",
  jobDescription: "Responsable technique, encadre les developpeurs, choisit l'architecture et synchronise les projets produit.",
})

const productLead = await getOrCreateEmployee({
  companyId: company.id,
  managerId: ceo.id,
  name: "Thomas Leroy",
  email: "thomas.leroy@acme.local",
  title: "Product Lead",
  department: "Produit",
  jobDescription: "Priorise la roadmap, formalise les besoins clients, coordonne les designers et les developpeurs.",
})

const salesLead = await getOrCreateEmployee({
  companyId: company.id,
  managerId: ceo.id,
  name: "Amandine Petit",
  email: "amandine.petit@acme.local",
  title: "Head of Sales",
  department: "Sales",
  jobDescription: "Pilote les objectifs commerciaux, coache les account executives et suit les opportunites strategiques.",
})

const peopleLead = await getOrCreateEmployee({
  companyId: company.id,
  managerId: ceo.id,
  name: "Alice Nguyen",
  email: "alice.nguyen@acme.local",
  title: "People Lead",
  department: "People",
  jobDescription: "Structure les rituels RH, gere les recrutements, accompagne les managers et les parcours internes.",
})

const employeesByKey = {
  ceo,
  cto,
  productLead,
  salesLead,
  peopleLead,
  frontend: await getOrCreateEmployee({
    companyId: company.id,
    userId: usersByKey.get("frontend")!.id,
    managerId: cto.id,
    name: "Ines Moreau",
    email: "ines.moreau@acme.local",
    title: "Developpeuse Frontend React",
    department: "Engineering",
    jobDescription: "Developpe les interfaces React, maintient le design system, implemente les parcours utilisateurs et les tests front.",
  }),
  backend: await getOrCreateEmployee({
    companyId: company.id,
    managerId: cto.id,
    name: "Lucas Garnier",
    email: "lucas.garnier@acme.local",
    title: "Developpeur Backend Elysia",
    department: "Engineering",
    jobDescription: "Construit les APIs Elysia, optimise PostgreSQL, maintient les integrations IA et les services temps reel.",
  }),
  fullstack: await getOrCreateEmployee({
    companyId: company.id,
    managerId: cto.id,
    name: "Emma Caron",
    email: "emma.caron@acme.local",
    title: "Developpeuse Fullstack",
    department: "Engineering",
    jobDescription: "Intervient sur React, Elysia et PostgreSQL, livre des fonctionnalites produit de bout en bout.",
  }),
  devops: await getOrCreateEmployee({
    companyId: company.id,
    managerId: cto.id,
    name: "Hugo Faure",
    email: "hugo.faure@acme.local",
    title: "DevOps Engineer",
    department: "Engineering",
    jobDescription: "Maintient Docker, CI/CD, observabilite, environnements de staging et automatisations de deploiement.",
  }),
  qa: await getOrCreateEmployee({
    companyId: company.id,
    managerId: cto.id,
    name: "Lea Bernard",
    email: "lea.bernard@acme.local",
    title: "QA Engineer",
    department: "Engineering",
    jobDescription: "Ecrit les plans de test, automatise les scenarios critiques et suit les regressions produit.",
  }),
  data: await getOrCreateEmployee({
    companyId: company.id,
    managerId: cto.id,
    name: "Chloe Masson",
    email: "chloe.masson@acme.local",
    title: "Data Analyst",
    department: "Data",
    jobDescription: "Analyse les usages, construit les dashboards, travaille sur la qualite des donnees et les indicateurs SaaS.",
  }),
  designer: await getOrCreateEmployee({
    companyId: company.id,
    managerId: productLead.id,
    name: "Sarah Diallo",
    email: "sarah.diallo@acme.local",
    title: "Product Designer",
    department: "Produit",
    jobDescription: "Concoit les parcours B2B, prepare les prototypes, documente les composants et conduit les tests utilisateurs.",
  }),
  pm: await getOrCreateEmployee({
    companyId: company.id,
    managerId: productLead.id,
    name: "Antoine Perrot",
    email: "antoine.perrot@acme.local",
    title: "Product Manager",
    department: "Produit",
    jobDescription: "Cadre les besoins, redige les specs, priorise le backlog et synchronise les retours clients.",
  }),
  uxResearch: await getOrCreateEmployee({
    companyId: company.id,
    managerId: productLead.id,
    name: "Maya Fontaine",
    email: "maya.fontaine@acme.local",
    title: "UX Researcher",
    department: "Produit",
    jobDescription: "Organise les interviews utilisateurs, synthetise les apprentissages et mesure la clarte des workflows.",
  }),
  accountExecutive: await getOrCreateEmployee({
    companyId: company.id,
    userId: usersByKey.get("sales")!.id,
    managerId: salesLead.id,
    name: "Mehdi Roux",
    email: "mehdi.roux@acme.local",
    title: "Account Executive",
    department: "Sales",
    jobDescription: "Suit les comptes clients, prepare les demonstrations, negocie les contrats et remonte les signaux marche.",
  }),
  customerSuccess: await getOrCreateEmployee({
    companyId: company.id,
    managerId: salesLead.id,
    name: "Clara Vidal",
    email: "clara.vidal@acme.local",
    title: "Customer Success Manager",
    department: "Customer Success",
    jobDescription: "Accompagne les clients B2B, suit l'adoption, detecte les risques de churn et coordonne les plans de succes.",
  }),
  support: await getOrCreateEmployee({
    companyId: company.id,
    managerId: salesLead.id,
    name: "Theo Lambert",
    email: "theo.lambert@acme.local",
    title: "Support Specialist",
    department: "Support",
    jobDescription: "Traite les demandes support, qualifie les bugs et documente les reponses recurrentes.",
  }),
  recruiter: await getOrCreateEmployee({
    companyId: company.id,
    managerId: peopleLead.id,
    name: "Omar Haddad",
    email: "omar.haddad@acme.local",
    title: "Talent Acquisition",
    department: "People",
    jobDescription: "Source les candidats, coordonne les entretiens et suit le pipeline de recrutement.",
  }),
  finance: await getOrCreateEmployee({
    companyId: company.id,
    managerId: ceo.id,
    name: "Julia Rossi",
    email: "julia.rossi@acme.local",
    title: "Finance Analyst",
    department: "Finance",
    jobDescription: "Prepare les reportings financiers, suit le MRR, la marge et les previsions de tresorerie.",
  }),
  marketing: await getOrCreateEmployee({
    companyId: company.id,
    managerId: ceo.id,
    name: "Eva Marchand",
    email: "eva.marchand@acme.local",
    title: "Marketing Lead",
    department: "Marketing",
    jobDescription: "Pilote les campagnes, le positionnement, les contenus et les evenements de generation de demande.",
  }),
}

const allEmployees = Object.values(employeesByKey)

const engineeringGroup = await getOrCreateGroup({
  companyId: company.id,
  name: "Engineering",
  description: "Equipe technique, architecture, delivery et qualite.",
})
const productGroup = await getOrCreateGroup({
  companyId: company.id,
  name: "Produit",
  description: "Roadmap, discovery, design et priorisation.",
})
const salesGroup = await getOrCreateGroup({
  companyId: company.id,
  name: "Sales & Success",
  description: "Acquisition, relation client, support et renouvellement.",
})
const peopleGroup = await getOrCreateGroup({
  companyId: company.id,
  name: "People",
  description: "Recrutement, onboarding, rituels RH et culture interne.",
})
const taskforceGroup = await getOrCreateGroup({
  companyId: company.id,
  name: "IA Taskforce",
  description: "Experimentations LLM, embeddings et automatisations internes.",
})

await ensureGroupMembers(engineeringGroup.id, [
  employeesByKey.cto.id,
  employeesByKey.frontend.id,
  employeesByKey.backend.id,
  employeesByKey.fullstack.id,
  employeesByKey.devops.id,
  employeesByKey.qa.id,
  employeesByKey.data.id,
])
await ensureGroupMembers(productGroup.id, [
  employeesByKey.productLead.id,
  employeesByKey.designer.id,
  employeesByKey.pm.id,
  employeesByKey.uxResearch.id,
])
await ensureGroupMembers(salesGroup.id, [
  employeesByKey.salesLead.id,
  employeesByKey.accountExecutive.id,
  employeesByKey.customerSuccess.id,
  employeesByKey.support.id,
])
await ensureGroupMembers(peopleGroup.id, [employeesByKey.peopleLead.id, employeesByKey.recruiter.id])
await ensureGroupMembers(taskforceGroup.id, [
  employeesByKey.cto.id,
  employeesByKey.backend.id,
  employeesByKey.data.id,
  employeesByKey.pm.id,
])

const eventFixtures = [
  [employeesByKey.frontend, "Sprint planning front", "Planning de sprint equipe front", "meeting", at(1, 10), at(1, 11)],
  [employeesByKey.backend, "Focus API conversations", "Bloc de concentration backend", "focus", at(1, 9), at(1, 11)],
  [employeesByKey.fullstack, "Pair programming IA", "Session sur la recherche semantique", "meeting", at(1, 14), at(1, 15)],
  [employeesByKey.devops, "Maintenance staging", "Fenetre d'intervention infra", "focus", at(2, 9), at(2, 12)],
  [employeesByKey.qa, "Recette organigramme", "Validation React Flow et fiches employes", "meeting", at(2, 11), at(2, 12)],
  [employeesByKey.designer, "Tests utilisateurs", "Entretiens sur le parcours assistant", "meeting", at(2, 15), at(2, 17)],
  [employeesByKey.accountExecutive, "Demo prospect", "Presentation SaaS B2B", "meeting", at(1, 16), at(1, 17)],
  [employeesByKey.customerSuccess, "QBR client", "Revue trimestrielle compte grand client", "meeting", at(3, 10), at(3, 11)],
  [employeesByKey.peopleLead, "Onboarding batch", "Accueil des nouveaux arrivants", "meeting", at(3, 9), at(3, 10)],
  [employeesByKey.recruiter, "Entretiens backend", "Pipeline recrutement engineering", "meeting", at(1, 11), at(1, 12)],
  [employeesByKey.ceo, "Comite direction", "Synchronisation hebdo managers", "meeting", at(1, 9), at(1, 10)],
  [employeesByKey.finance, "Forecast MRR", "Previsions revenus et cash", "focus", at(4, 14), at(4, 16)],
] as const

for (const [employee, title, description, type, startsAt, endsAt] of eventFixtures) {
  await ensureEvent({
    companyId: company.id,
    employeeId: employee.id,
    createdByUserId: usersByKey.get("owner")!.id,
    title,
    description,
    type,
    startsAt,
    endsAt,
  })
}

const posts = [
  await getOrCreatePost({
    companyId: company.id,
    authorEmployeeId: employeesByKey.ceo.id,
    title: "Objectif du trimestre",
    body: "Priorite a la qualite des donnees RH, aux boucles de feedback courtes et a la visibilite inter-equipes.",
    imageUrl: "/api/uploads/community/seed-quarter.svg",
  }),
  await getOrCreatePost({
    companyId: company.id,
    authorEmployeeId: employeesByKey.productLead.id,
    title: "Discovery utilisateurs",
    body: "On cherche trois volontaires pour tester le parcours organigramme et la recherche d'expertise.",
    groupId: productGroup.id,
    imageUrl: "/api/uploads/community/seed-discovery.svg",
  }),
  await getOrCreatePost({
    companyId: company.id,
    authorEmployeeId: employeesByKey.cto.id,
    title: "Standard API interne",
    body: "Les nouveaux endpoints exposent des erreurs JSON homogenes et verifient systematiquement le tenant.",
    groupId: engineeringGroup.id,
    imageUrl: "/api/uploads/community/seed-api.svg",
  }),
  await getOrCreatePost({
    companyId: company.id,
    authorEmployeeId: employeesByKey.peopleLead.id,
    title: "Rituels managers",
    body: "Les managers peuvent ajouter les evenements de disponibilite directement depuis la fiche employe.",
    groupId: peopleGroup.id,
    imageUrl: "/api/uploads/community/seed-rituals.svg",
  }),
  await getOrCreatePost({
    companyId: company.id,
    authorEmployeeId: employeesByKey.data.id,
    title: "Exploration embeddings",
    body: "Les fiches de poste sont vectorisees pour ameliorer la recherche de profils disponibles.",
    groupId: taskforceGroup.id,
    imageUrl: "/api/uploads/community/seed-embeddings.svg",
  }),
]

await ensureComment({
  postId: posts[0].id,
  authorEmployeeId: employeesByKey.customerSuccess.id,
  body: "Je peux fournir des cas clients pour tester la recherche par metier.",
})
await ensureComment({
  postId: posts[1].id,
  authorEmployeeId: employeesByKey.designer.id,
  body: "Je prends les sessions utilisateurs cote design.",
})
await ensureComment({
  postId: posts[2].id,
  authorEmployeeId: employeesByKey.backend.id,
  body: "Je documente les conventions Elysia dans le README.",
})

const projectConversation = await getOrCreateConversation({
  companyId: company.id,
  title: "Projet Companinator",
  createdByEmployeeId: employeesByKey.ceo.id,
})
await ensureConversationParticipants(projectConversation.id, [
  employeesByKey.ceo.id,
  employeesByKey.cto.id,
  employeesByKey.productLead.id,
  employeesByKey.frontend.id,
  employeesByKey.backend.id,
  employeesByKey.designer.id,
])
await ensureMessage({
  conversationId: projectConversation.id,
  senderEmployeeId: employeesByKey.ceo.id,
  body: "On centralise ici les arbitrages du projet Companinator.",
})
await ensureMessage({
  conversationId: projectConversation.id,
  senderEmployeeId: employeesByKey.cto.id,
  body: "Je peux coordonner un point technique avec Ines et Lucas demain.",
})
await ensureMessage({
  conversationId: projectConversation.id,
  senderEmployeeId: employeesByKey.productLead.id,
  body: "La priorite produit reste la recherche d'expertise et l'organigramme consultable.",
})

const engineeringConversation = await getOrCreateConversation({
  companyId: company.id,
  title: "Engineering daily",
  createdByEmployeeId: employeesByKey.cto.id,
})
await ensureConversationParticipants(engineeringConversation.id, [
  employeesByKey.cto.id,
  employeesByKey.frontend.id,
  employeesByKey.backend.id,
  employeesByKey.fullstack.id,
  employeesByKey.qa.id,
  employeesByKey.devops.id,
])
await ensureMessage({
  conversationId: engineeringConversation.id,
  senderEmployeeId: employeesByKey.frontend.id,
  body: "Le front React Flow est pret pour tester les fiches employes.",
})
await ensureMessage({
  conversationId: engineeringConversation.id,
  senderEmployeeId: employeesByKey.backend.id,
  body: "Je regarde la recherche vectorielle et le fallback texte quand Ollama n'est pas lance.",
})

const salesProductConversation = await getOrCreateConversation({
  companyId: company.id,
  title: "Sales x Produit",
  createdByEmployeeId: employeesByKey.salesLead.id,
})
await ensureConversationParticipants(salesProductConversation.id, [
  employeesByKey.salesLead.id,
  employeesByKey.accountExecutive.id,
  employeesByKey.customerSuccess.id,
  employeesByKey.productLead.id,
  employeesByKey.pm.id,
])
await ensureMessage({
  conversationId: salesProductConversation.id,
  senderEmployeeId: employeesByKey.accountExecutive.id,
  body: "Les prospects demandent souvent qui contacter pour un sujet technique precis.",
})
await ensureMessage({
  conversationId: salesProductConversation.id,
  senderEmployeeId: employeesByKey.pm.id,
  body: "On va tester cette question avec l'assistant et les disponibilites.",
})

console.log(`Seed termine avec ${allEmployees.length} employes et ${posts.length} posts.
Comptes de test:
- admin@acme.local / ${demoPassword} (owner)
- nadia.benali@acme.local / ${demoPassword} (admin)
- ines.moreau@acme.local / ${demoPassword} (member)
- mehdi.roux@acme.local / ${demoPassword} (member)
Entreprise: ${company.name}`)

await sqlClient.end()
