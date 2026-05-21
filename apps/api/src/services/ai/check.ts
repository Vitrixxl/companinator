import { checkOllama } from "./ollama"

const status = await checkOllama()

if (!status.available) {
  console.error(`Ollama indisponible: ${status.error ?? "erreur inconnue"}`)
  if (status.missingModels?.length) {
    console.error(`Modeles a installer: ${status.missingModels.join(", ")}`)
  }
  process.exit(1)
}

console.log("Ollama disponible")
