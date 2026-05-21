import { and, eq, isNull } from "drizzle-orm"

import { db } from "../../db/client"
import { employees } from "../../db/schema"
import { embedTextStrict } from "./ollama"

export function employeeEmbeddingInput(employee: {
  name: string
  title: string
  department: string | null
  jobDescription: string
}) {
  return [
    `Nom: ${employee.name}`,
    `Poste: ${employee.title}`,
    `Equipe: ${employee.department ?? "Non renseignee"}`,
    `Description: ${employee.jobDescription}`,
  ].join("\n")
}

export async function ensureCompanyEmployeeEmbeddings(companyId: string) {
  const missing = await db
    .select()
    .from(employees)
    .where(and(eq(employees.companyId, companyId), eq(employees.status, "active"), isNull(employees.jobEmbedding)))

  for (const employee of missing) {
    const embedding = await embedTextStrict(employeeEmbeddingInput(employee))
    await db.update(employees).set({ jobEmbedding: embedding, updatedAt: new Date() }).where(eq(employees.id, employee.id))
  }

  return { generated: missing.length }
}
