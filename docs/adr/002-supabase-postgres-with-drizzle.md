# ADR-002: Keep Supabase Postgres (Free); access it with Drizzle ORM through the transaction pooler

- **Status:** Accepted (owner, 2026-09-28)
- **Date:** 2026-09-28

## Context
All v1 data (students, lessons, results, ratings) is in Supabase Postgres. v1 uses `supabase-js` with the service-role key (which bypasses RLS) and has no schema in the repo. Serverless functions open many short-lived connections, so connection handling matters for 100 concurrent users.

## Options
| Option | Notes |
|---|---|
| **A. Supabase Free + Drizzle + postgres.js via Supavisor transaction pooler** | Zero migration of hosting, 500 MB DB, typed schema, migrations in git, SQL-first API |
| B. Supabase + keep `supabase-js` (PostgREST) | HTTP per query, no transactions across tables (grading needs attempt + rating + mistakes atomically), weak typing without codegen |
| C. Neon Free | Serverless driver over HTTP/WebSocket, branching. Needs a data move, scale-to-zero cold starts (~0.5–1 s), 0.5 GB storage limit. Similar to Supabase with more migration work |
| D. Prisma instead of Drizzle | Heavier client, slower cold starts, a query engine binary (improved in recent versions but still larger) |
| E. Turso / SQLite | Very generous free tier, but a full data-model port away from Postgres (JSONB, arrays, `unaccent` search) |

## Decision
**Option A.**
- The DB stays on Supabase Free. The v2 schema is created by Drizzle migrations in a **new schema** (or new project; see 10) and v1 data is copied over by a script.
- Runtime connections go through the **Supavisor transaction pooler (port 6543)** with `postgres(url, { prepare: false, max: 5 })`. The pool object is a module singleton, so Fluid compute reuses it across concurrent requests in one instance.
- Migrations and backups use the direct/session connection string, from CI or a laptop only.
- The app connects as a dedicated Postgres role `app_rw`, not `postgres` or the service role. RLS stays **enabled with no policies** on all tables, so the public anon REST API can't read anything. All access goes through the server.

## Consequences
- Real transactions for submit (attempt + rating + rating event + mistakes).
- A type-safe schema lives in `src/db/schema.ts` and the schema is reviewable in PRs.
- We must handle the Supabase Free **pause after 7 days of inactivity**, which will happen over Tết and the summer break. Mitigation: a daily Vercel cron hits `/api/cron/daily`, which runs a trivial query, and the GitHub nightly backup also touches the DB.
- No automatic backups on Free. We add a nightly `pg_dump` via GitHub Actions (see 12).
- 500 MB cap. The data model is designed compactly (see 04 §6).
