<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Ôn Luyện Vật Lý v2 — agent guide

Rebuild of the physics practice site (`../onluyenvatly` is v1, read-only reference). Next.js 16 App Router (Cache Components on), TypeScript strict, Tailwind v4, shadcn/ui, Drizzle + Supabase Postgres, pnpm, Biome, Vitest, Playwright.

## Read before coding
- **Conventions (mandatory):** [docs/14-coding-conventions.md](docs/14-coding-conventions.md): layering, action template, caching, naming, review checklist.
- Plan and task IDs: [docs/13-project-plan.md](docs/13-project-plan.md). Work one task ID at a time.
- Architecture: [docs/02-architecture.md](docs/02-architecture.md). Data model: [docs/04-data-model.md](docs/04-data-model.md). Routes/actions: [docs/05-routes-and-api.md](docs/05-routes-and-api.md). Security: [docs/06-auth-and-security.md](docs/06-auth-and-security.md). UI: [docs/07-ui-ux-design.md](docs/07-ui-ux-design.md). Decisions: [docs/adr/](docs/adr/README.md).

## Non-negotiables
- Answers and explanations never reach a student before submit. Grading is server-only (ADR-004).
- Business rules live in pure functions under `src/features/<x>/domain/` with unit tests next to them.
- Every server action starts with an auth guard, then Zod validation. Never throw to the client; return `ok`/`err`.
- `import "server-only"` in queries, services, `db/*` and anything that reads secrets. Read env through `src/lib/env.server.ts`, never `process.env` directly.
- Free-tier quotas are a hard budget (docs/08): no new per-request DB query on a hot path without a reason; `prefetch={false}` on long link lists.
- UI strings are Vietnamese (in `messages.ts`), code identifiers English. Mobile first (360 px), light and dark.
- No personal data or secrets in logs, fixtures or commits.

## Commands
```bash
pnpm dev            # local dev server
pnpm lint           # biome check (pnpm format to fix)
pnpm typecheck      # next typegen && tsc --noEmit
pnpm test           # vitest unit tests
pnpm build && pnpm e2e   # production build + Playwright
```
Run lint, typecheck and test before declaring a task done. Update the docs when behaviour or schema changes.

## Git
Branch `feat/S1-04-auth-core`; Conventional Commit titles referencing the task ID (`feat(auth): S1-04 session core`); squash merge; PRs under ~400 lines.
