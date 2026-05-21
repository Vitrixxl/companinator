import { env } from "./env"

function configuredWebOrigins() {
  return env.WEB_ORIGIN.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
}

function isPrivateOrLoopbackHost(hostname: string) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.startsWith("10.") ||
    hostname.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
  )
}

function isDevWebOrigin(origin: string) {
  if (env.NODE_ENV === "production") {
    return false
  }

  try {
    const url = new URL(origin)
    return ["http:", "https:"].includes(url.protocol) && ["5173", "4173"].includes(url.port) && isPrivateOrLoopbackHost(url.hostname)
  } catch {
    return false
  }
}

export function isAllowedWebOrigin(request: Request) {
  const origin = request.headers.get("origin")
  if (!origin) {
    return true
  }

  return configuredWebOrigins().includes(origin) || isDevWebOrigin(origin)
}

export async function trustedWebOrigins(request?: Request) {
  const origins = new Set(configuredWebOrigins())
  const origin = request?.headers.get("origin")

  if (origin && isDevWebOrigin(origin)) {
    origins.add(origin)
  }

  return Array.from(origins)
}
