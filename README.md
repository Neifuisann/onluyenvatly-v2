# Ôn Luyện Vật Lý v2

Rebuild of [onluyenvatly.vercel.app](https://onluyenvatly.vercel.app): a fast, phone-first place for Vietnamese high-school students to practise physics in the THPT exam format.

All design documents live in [`docs/`](docs/README.md). Start with the [project plan](docs/13-project-plan.md) and the [coding conventions](docs/14-coding-conventions.md).

## Getting started

Requires Node 22+ and pnpm (`corepack enable`).

```bash
pnpm install
cp .env.example .env.local   # or: vercel env pull .env.local
pnpm dev
```

Open http://localhost:3000. Health check: http://localhost:3000/api/health.

| Command | What it does |
|---|---|
| `pnpm lint` / `pnpm format` | Biome check / fix |
| `pnpm typecheck` | Generate route types, then `tsc --noEmit` |
| `pnpm test` / `pnpm test:coverage` | Vitest unit tests |
| `pnpm build && pnpm e2e` | Production build, then Playwright against `next start` |
| `pnpm v1:inventory` | Read-only v1 DB inventory as Markdown (needs `V1_DATABASE_URL`) |
| `pnpm v1:fixtures` | Anonymized v1 fixtures into `tests/fixtures/v1/` (needs `V1_DATABASE_URL`) |
