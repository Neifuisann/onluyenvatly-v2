# ADR-001: Next.js (App Router) on Vercel Hobby replaces Express

- **Status:** Accepted (owner, 2026-09-28)
- **Date:** 2026-09-28

## Context
v1 runs Express inside one Vercel function and serves hand-written HTML. The owner doesn't like Express or the current UI, wants to stay on Vercel or another free platform, and wants $0 running cost, speed, and ≥100 concurrent users. The app is small (≈300 students, 1–3 admins) and read-heavy, with short write bursts at test submission.

## Options considered

| Option | Pros | Cons |
|---|---|---|
| **A. Next.js App Router on Vercel Hobby** | Made by Vercel, zero config; RSC + Server Actions mean no separate API layer; static/ISR pages cost no function time; Fluid compute lets one instance serve many concurrent requests; big ecosystem (shadcn/ui); preview deploys per PR | Framework complexity (caching semantics); Hobby is non-commercial only; quotas (1M invocations, 4 h Active CPU) need watching |
| B. SvelteKit or Nuxt on Vercel | Smaller bundles, simpler mental model | Smaller component ecosystem for an admin-heavy app; team's React familiarity is higher (v1 used vanilla JS, so neither has an advantage) |
| C. Astro + Hono API on Vercel | Very fast static pages, Hono is a pleasant Express replacement | Two paradigms (islands + API), more wiring for authenticated dynamic pages such as the test runner and dashboards |
| D. Cloudflare Workers/Pages (Hono or Next via OpenNext) | Generous free requests (100k/day), no cold starts, **commercial use allowed on the free plan** | Free plan limits CPU time to **10 ms per request**. bcrypt verification alone is ~50–100 ms, so existing password hashes would need re-hashing or a different KDF. Postgres needs Hyperdrive. Next.js support is via an adapter |
| E. Keep Express, only redo the UI | Least work | The owner explicitly rejects Express; keeps the single-function design and the security problems |

## Decision
**Option A.** Next.js (latest stable) with the App Router on Vercel Hobby, Node.js runtime, Fluid compute on, function region `sin1`.

## Consequences
- The whole backend becomes Server Components, Server Actions and a handful of Route Handlers in the same repo.
- We must design for the cache (see 02 §3) and watch prefetch behaviour to stay inside quotas (see 08).
- Admin-heavy UI gets shadcn/ui and Radix accessibility for free.
- Lock-in is moderate. Next.js can be self-hosted or run on Cloudflare via OpenNext if we ever have to leave Vercel (see the exit plan below).

## Commercial-use caveat
Vercel's fair-use guidelines limit Hobby to non-commercial personal use. That includes a site that takes payments, sells a product or service, or shows ads. v1 has a `pricing` column on lessons.

**Resolved 2026-09-28:** the owner confirmed the site is **non-commercial** (no payments, ads or paid tutoring), so Hobby is allowed. The `pricing` column is not migrated. If that ever changes, the site must move to Vercel Pro ($20/month) or to Option D (Cloudflare free, which allows commercial use) before launching the paid feature.

## Exit plan (if quotas or ToS force a move)
1. Build with the OpenNext Cloudflare adapter and deploy to Workers.
2. Swap `bcryptjs` for a KDF that fits Workers CPU limits (rehash on next login), or move to the Workers Paid plan ($5/month).
3. Point the DB driver at Supabase through Hyperdrive.
Keep domain logic in pure functions (see 14) so this move touches only adapters.
