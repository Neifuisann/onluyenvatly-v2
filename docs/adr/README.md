# Architecture Decision Records

| ADR | Decision | Status |
|---|---|---|
| [001](001-nextjs-on-vercel.md) | Next.js App Router on Vercel Hobby replaces Express | Accepted |
| [002](002-supabase-postgres-with-drizzle.md) | Keep Supabase Postgres Free; Drizzle ORM via transaction pooler | Accepted |
| [003](003-custom-session-auth.md) | Custom DB-session auth with phone + password, roles in DB (no device binding) | Accepted |
| [004](004-server-side-grading.md) | Server-authoritative attempts and grading; drop the client encryption layer; v2 rating formula | Accepted |
| [005](005-caching-and-invalidation.md) | Tagged Next.js data cache; no in-memory caches, no Redis | Accepted |
| [006](006-media-storage.md) | Supabase Storage public bucket, browser-side resize, direct signed uploads | Accepted |
| [007](007-ai-explanation-cache.md) | AI explanations generated once per question and stored | Accepted |
| [008](008-game-rooms-bounded-polling.md) | Live game rooms: student-paced race, bounded polling, no realtime service | Proposed |
| [009](009-multi-teacher-classes.md) | Multiple teachers, classes and subjects: ownership columns, classes as the only bridge to students | Proposed |
| [010](010-solo-zombie-game.md) | "Bắn zombie": a lesson played as a solo game, graded per shot | Proposed |
| [011](011-video-lessons.md) | "Học qua video": questions along a YouTube video, no skipping on the first viewing | Proposed |

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
