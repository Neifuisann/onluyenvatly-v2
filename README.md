# Ôn Luyện Vật Lý v2

Rebuild of [onluyenvatly.vercel.app](https://onluyenvatly.vercel.app): a fast, phone-first place for Vietnamese high-school students to practise physics in the THPT exam format.

All design documents live in [`docs/`](docs/README.md). Start with the [project plan](docs/13-project-plan.md) and the [coding conventions](docs/14-coding-conventions.md).

## Getting started

Requires Node 22+ and pnpm (`corepack enable`).

```bash
pnpm install
cp .env.example .env.local   # or: vercel env pull .env.local
pnpm db:migrate && pnpm seed   # prints the admin password once
pnpm dev
```

The component gallery lives at `/dev/ui` (404 in production).

Open http://localhost:3000. Health check: http://localhost:3000/api/health.

| Command | What it does |
|---|---|
| `pnpm lint` / `pnpm format` | Biome check / fix |
| `pnpm typecheck` | Generate route types, then `tsc --noEmit` |
| `pnpm test` / `pnpm test:coverage` | Vitest unit tests |
| `pnpm build && pnpm e2e` | Production build, then Playwright against `next start` |
| `pnpm db:generate` / `pnpm db:migrate` | Generate a migration from `src/db/schema.ts` / apply migrations (`DATABASE_URL_DIRECT`) |
| `pnpm db:local` | Local Postgres without Docker (PGlite on `:54329`, see docs/11 §3) |
| `pnpm seed` / `pnpm seed --profile e2e` | Settings row + first admin / E2E test accounts (local DB only) |
| `pnpm check:contrast` | WCAG AA check of every design-token pair |
| `pnpm v1:inventory` | Read-only v1 DB inventory as Markdown (needs `V1_DATABASE_URL`) |
| `pnpm v1:fixtures` | Anonymized v1 fixtures into `tests/fixtures/v1/` (needs `V1_DATABASE_URL`) |
