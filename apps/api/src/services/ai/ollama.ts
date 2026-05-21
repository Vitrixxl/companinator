import { env } from "../../env"

export interface OllamaStatus {
  available: boolean
  error?: string
  missingModels?: string[]
}

export class LocalAiError extends Error {
  constructor(
    message: string,
    public status = 503,
  ) {
    super(message)
  }
}

function isTimeout(error: unknown) {
  return error instanceof Error && error.name === "TimeoutError"
}

function localAiErrorMessage(action: string) {
  return `IA locale indisponible: Ollama n'a pas repondu assez vite pendant ${action}. Verifie que le modele est charge et relance la demande.`
}

export async function checkOllama(): Promise<OllamaStatus> {
  try {
    const response = await fetch(`${env.OLLAMA_BASE_URL}/api/tags`, { signal: AbortSignal.timeout(5000) })
    if (!response.ok) {
      return { available: false, error: `HTTP ${response.status}` }
    }
    const payload = (await response.json()) as { models?: Array<{ name?: string; model?: string }> }
    const modelNames = (payload.models ?? []).flatMap((model) => [model.name, model.model]).filter(Boolean) as string[]
    const required = [env.OLLAMA_CHAT_MODEL, env.OLLAMA_EMBED_MODEL]
    const missingModels = required.filter(
      (requiredModel) =>
        !modelNames.some((modelName) => modelName === requiredModel || modelName.startsWith(`${requiredModel}:`)),
    )

    if (missingModels.length) {
      return {
        available: false,
        missingModels,
        error: `Modeles Ollama manquants: ${missingModels.join(", ")}`,
      }
    }

    return { available: true }
  } catch (error) {
    return { available: false, error: error instanceof Error ? error.message : "Ollama indisponible" }
  }
}

export function ollamaSetupMessage(status?: OllamaStatus) {
  const missing = status?.missingModels?.length ? ` Modeles manquants: ${status.missingModels.join(", ")}.` : ""
  return `IA locale indisponible.${missing} Lance: ollama serve ; ollama pull ${env.OLLAMA_CHAT_MODEL} ; ollama pull ${env.OLLAMA_EMBED_MODEL}`
}

export async function requireOllama() {
  const status = await checkOllama()
  if (!status.available) {
    throw new LocalAiError(ollamaSetupMessage(status))
  }
}

export async function embedText(input: string): Promise<number[] | null> {
  if (!input.trim()) {
    return null
  }

  try {
    const response = await fetch(`${env.OLLAMA_BASE_URL}/api/embed`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: env.OLLAMA_EMBED_MODEL,
        input,
      }),
      signal: AbortSignal.timeout(8000),
    })

    if (!response.ok) {
      return null
    }

    const payload = (await response.json()) as { embeddings?: number[][]; embedding?: number[] }
    return payload.embeddings?.[0] ?? payload.embedding ?? null
  } catch {
    return null
  }
}

export async function embedTextStrict(input: string): Promise<number[]> {
  await requireOllama()
  const embedding = await embedText(input)

  if (!embedding) {
    throw new LocalAiError("Le modele local n'a pas retourne d'embedding.")
  }

  if (embedding.length !== env.OLLAMA_EMBED_DIMENSIONS) {
    throw new LocalAiError(
      `Dimension embedding invalide: ${embedding.length}. Attendu: ${env.OLLAMA_EMBED_DIMENSIONS}. Verifie OLLAMA_EMBED_MODEL.`,
    )
  }

  return embedding
}

export async function chat(prompt: string, system?: string): Promise<string | null> {
  try {
    const response = await fetch(`${env.OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: env.OLLAMA_CHAT_MODEL,
        stream: false,
        messages: [
          {
            role: "system",
            content:
              system ??
              "Tu aides a trouver les bons employes dans une entreprise. Reponds en francais, de facon concise, sans inventer de disponibilites.",
          },
          { role: "user", content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(60000),
    })

    if (!response.ok) {
      return null
    }

    const payload = (await response.json()) as { message?: { content?: string }; response?: string }
    return payload.message?.content ?? payload.response ?? null
  } catch (error) {
    if (isTimeout(error)) {
      throw new LocalAiError(localAiErrorMessage("la generation de reponse"))
    }
    return null
  }
}

export async function chatStrict(prompt: string, system?: string): Promise<string> {
  await requireOllama()
  const response = await chat(prompt, system)

  if (!response) {
    throw new LocalAiError("Le modele local n'a pas retourne de reponse.")
  }

  return response
}

function parseJsonContent(content: string) {
  const trimmed = content.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  return JSON.parse(fenced?.[1] ?? trimmed)
}

export async function chatJson<T>(prompt: string, system: string): Promise<T> {
  await requireOllama()

  let response: Response
  try {
    response = await fetch(`${env.OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: env.OLLAMA_CHAT_MODEL,
        stream: false,
        format: "json",
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(60000),
    })
  } catch (error) {
    if (isTimeout(error)) {
      throw new LocalAiError(localAiErrorMessage("l'analyse de la demande"))
    }
    throw error
  }

  if (!response.ok) {
    throw new LocalAiError(`Ollama chat JSON a echoue: HTTP ${response.status}`)
  }

  const payload = (await response.json()) as { message?: { content?: string }; response?: string }
  const content = payload.message?.content ?? payload.response
  if (!content) {
    throw new Error("Le modele local n'a pas retourne de JSON.")
  }

  try {
    return parseJsonContent(content) as T
  } catch {
    throw new LocalAiError("Le modele local n'a pas retourne un JSON valide.", 502)
  }
}

export function vectorLiteral(values: number[]) {
  return `[${values.map((value) => Number(value).toFixed(8)).join(",")}]`
}
