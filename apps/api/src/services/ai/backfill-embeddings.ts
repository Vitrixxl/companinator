import { eq, isNull } from "drizzle-orm"

import { db, sqlClient } from "../../db/client"
import { employees } from "../../db/schema"
import { employeeEmbeddingInput } from "./embeddings"
import { embedTextStrict } from "./ollama"

const missing = await db.select().from(employees).where(isNull(employees.jobEmbedding))

for (const employee of missing) {
  const embedding = await embedTextStrict(employeeEmbeddingInput(employee))
  await db.update(employees).set({ jobEmbedding: embedding, updatedAt: new Date() }).where(eq(employees.id, employee.id))
  console.log(`Embedding cree: ${employee.name}`)
}

console.log(`${missing.length} embeddings generes.`)

await sqlClient.end()
