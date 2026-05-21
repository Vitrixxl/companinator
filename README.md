# Companinator

SaaS B2B de cartographie d'entreprise avec backend ElysiaJS, front React/shadcn UI, organigramme React Flow, messagerie, communaute, groupes, admin et recherche assistee par Ollama.

## Prerequis

- Bun 1.3+
- Docker + Docker Compose
- Ollama pour l'assistant IA, le parsing d'intention et les embeddings locaux

## Lancement

```bash
bun install
cp .env.example .env
bun run db:up
bun run db:migrate
bun run db:seed
bun run dev:api
bun run dev:web -- --host 0.0.0.0
```

URLs:

- Front: http://localhost:5173
- API: http://localhost:3000
- OpenAPI: http://localhost:3000/api/openapi

Avec `bun run dev:web -- --host 0.0.0.0`, le front deduit automatiquement l'API depuis l'adresse ouverte dans le navigateur. Par exemple `http://10.43.161.120:5173` appellera `http://10.43.161.120:3000/api`.

## Comptes De Test

Tous les comptes utilisent le mot de passe `Companinator123!`.

- `admin@acme.local` - owner
- `nadia.benali@acme.local` - admin
- `ines.moreau@acme.local` - membre engineering
- `mehdi.roux@acme.local` - membre sales

Le seed cree `Acme France` avec 20 employes, 14 evenements, 5 groupes, 5 posts communautaires et 3 conversations.

## Stockage Local

Les images de l'onglet communaute sont stockees localement dans `apps/api/storage/community` et servies par l'API via `/api/uploads/community/:fileName`.
Les uploads runtime sont ignores par Git; seules les images de seed `seed-*.svg` sont versionnees.

## IA Locale

L'assistant exige Ollama et les deux modeles locaux. Sans ca, l'API renvoie une erreur de setup au lieu de simuler une recherche IA.

```bash
ollama serve
ollama pull llama3.2
ollama pull embeddinggemma
bun run ai:check
bun run embeddings:backfill
```

`bun run embeddings:backfill` genere les embeddings manquants des fiches de poste via `embeddinggemma` et les stocke dans Postgres/pgvector.

## Scripts

- `bun run typecheck`
- `bun run build`
- `bun run db:up`
- `bun run db:migrate`
- `bun run db:seed`
- `bun run ai:check`
- `bun run embeddings:backfill`
