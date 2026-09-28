# Architecture Decision Records

| ADR | Decision | Status |
|---|---|---|
| [001](001-nextjs-on-vercel.md) | Next.js App Router on Vercel Hobby replaces Express | Proposed (non-commercial confirmed, so Hobby is allowed) |
| [002](002-supabase-postgres-with-drizzle.md) | Keep Supabase Postgres Free; Drizzle ORM via transaction pooler | Proposed |
| [003](003-custom-session-auth.md) | Custom DB-session auth with phone + password, roles in DB (no device binding) | Proposed |
| [004](004-server-side-grading.md) | Server-authoritative attempts and grading; drop the client encryption layer; v2 rating formula | Proposed (rating fix approved by owner) |
| [005](005-caching-and-invalidation.md) | Tagged Next.js data cache; no in-memory caches, no Redis | Proposed |
| [006](006-media-storage.md) | Supabase Storage public bucket, browser-side resize, direct signed uploads | Proposed |
| [007](007-ai-explanation-cache.md) | AI explanations generated once per question and stored | Proposed |

To add one, copy the template below to `NNN-short-title.md`, then set Status to `Accepted` when the owner signs off (Sprint 0, task S0-02).

```markdown
# ADR-NNN: Title
- **Status:** Proposed | Accepted | Superseded by ADR-XXX
- **Date:** YYYY-MM-DD
## Context
## Options
## Decision
## Consequences
```
