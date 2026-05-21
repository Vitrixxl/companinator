import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"

import { db } from "./db/client"
import { account, session, user, verification } from "./db/schema"
import { env } from "./env"

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user,
      session,
      account,
      verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
  },
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins: [env.WEB_ORIGIN],
})

export type Session = typeof auth.$Infer.Session
