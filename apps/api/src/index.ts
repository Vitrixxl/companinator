import { app } from "./app"
import { env } from "./env"

app.listen(env.PORT)

console.log(`Companinator API listening on http://localhost:${env.PORT}`)
