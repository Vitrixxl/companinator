import { z } from "zod"

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().default("postgres://companinator:companinator@localhost:5432/companinator"),
  BETTER_AUTH_SECRET: z.string().default("dev-secret-change-me-in-production"),
  BETTER_AUTH_URL: z.string().default("http://localhost:3000"),
  WEB_ORIGIN: z.string().default("http://localhost:5173"),
  SUPER_ADMIN_EMAILS: z.string().default("admin@acme.local"),
  OLLAMA_BASE_URL: z.string().default("http://localhost:11434"),
  OLLAMA_CHAT_MODEL: z.string().default("llama3.2"),
  OLLAMA_EMBED_MODEL: z.string().default("embeddinggemma"),
  OLLAMA_EMBED_DIMENSIONS: z.coerce.number().default(768),
})

export const env = envSchema.parse(process.env)
