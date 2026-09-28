# Ôn Luyện Vật Lý v2 — Design Docs

Rebuild of **onluyenvatly.vercel.app** (physics practice platform for Vietnamese grade 10–12 students).

**Goals:** faster, modern UI/UX, no Express, **$0/month** running cost, **≥100 concurrent users**, still deployed on Vercel.

## TL;DR of the decision

| Area | v1 (today) | v2 (proposed) |
|---|---|---|
| Server | Express 4 app inside one Vercel function (`/(.*) → /api`) | **Next.js (App Router) + React Server Components + Server Actions** on Vercel Hobby |
| UI | 30 hand-written HTML pages, 6.6k-line `style.css`, jQuery-style DOM scripts | React + **Tailwind CSS v4 + shadcn/ui**, design system, mobile-first |
| DB | Supabase Postgres via supabase-js with the service key, plus `pg` for sessions | **Same Supabase Postgres** (free tier), accessed through **Drizzle ORM** and the transaction pooler |
| Auth | express-session + `connect-pg-simple`, hard-coded admin | Custom session auth (DB sessions, httpOnly cookie), roles in DB, bcrypt hashes kept compatible |
| Grading | **Browser computes the score, server trusts it**; answers shipped to the client | **Server-side grading**; the client never sees answers until it submits |
| "Encryption" layer | AES layer whose key is handed to the same browser | Removed (replaced by server-side grading) |
| Caching | Hand-written in-memory caches + Cache-Control middleware | Static/ISR pages + tag-based data cache, invalidated on admin edits |
| AI | Gemini call on every "Explain" click | Gemini, **explanations cached per question** in DB, rate-limited |

## Document map

| # | Doc | What it answers |
|---|---|---|
| 00 | [Current system audit](00-current-system-audit.md) | What exists today, what's broken, what we keep or drop |
| 01 | [Product requirements](01-product-requirements.md) | Users, features (P0/P1/P2), non-functional targets |
| 02 | [Architecture](02-architecture.md) | Stack, rendering strategy, request flows, repo layout |
| 03 | [ADRs](adr/) | Why each major decision was made, and what we rejected |
| 04 | [Data model](04-data-model.md) | New schema, question JSON format, indexes, size budget |
| 05 | [Routes & server API](05-routes-and-api.md) | Every page, server action and route handler |
| 06 | [Auth & security](06-auth-and-security.md) | Sessions, roles, device binding, anti-cheat, threat model |
| 07 | [UI/UX design system](07-ui-ux-design.md) | Design principles, tokens, components, key screens |
| 08 | [Performance & capacity](08-performance-and-capacity.md) | Budgets, 100-concurrent math, free-tier quota budget, load test |
| 09 | [AI features](09-ai-features.md) | Gemini use cases, caching, quotas, fallbacks |
| 10 | [Data migration](10-data-migration.md) | Moving v1 data into v2, cutover, rollback |
| 11 | [Testing strategy](11-testing-strategy.md) | Unit, integration, E2E, load tests |
| 12 | [DevOps & operations](12-devops-and-operations.md) | Environments, CI/CD, backups, monitoring, runbooks |
| 13 | [Project plan](13-project-plan.md) | **Sprints, tasks, estimates, acceptance criteria** |
| 14 | [Coding conventions](14-coding-conventions.md) | Folder layout, patterns, naming, review checklist |

## Reading order

- **Owner / teacher:** README → 01 → 07 → 13
- **Developer starting work:** 02 → adr/ → 04 → 05 → 06 → 14 → 13
- **Before go-live:** 08 → 10 → 12

## Verified constraints (checked 2026-09-28)

- **Vercel Hobby** includes 1M function invocations, 4 h Active CPU, 360 GB-hrs provisioned memory, 100 GB Fast Data Transfer, 10 GB Fast Origin Transfer, 5K image transformations per month. Functions can run up to 300 s with Fluid compute. Runtime logs are kept for 1 hour. **Hobby is for non-commercial use only** (see [ADR-001](adr/001-nextjs-on-vercel.md#commercial-use-caveat)).
- **Supabase Free** includes 500 MB database, 1 GB file storage, 5 GB egress, 2 active projects. Projects **pause after 1 week of inactivity** and there are **no automatic backups**.
- **Gemini API free tier** limits change often and are shown per project in Google AI Studio. The design assumes low single-digit RPM and a few hundred requests per day.

Re-check these numbers before Sprint 0. Quotas are the main way this project could stop being free.
