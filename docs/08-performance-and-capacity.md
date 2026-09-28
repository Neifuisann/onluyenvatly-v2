# 08 — Performance, Capacity & Free-Tier Budget

## 1. Performance budgets (enforced in CI where possible)

| Metric | Target | How it's checked |
|---|---|---|
| LCP p75 (mobile 4G, mid-range Android) | **< 1.8 s** on `/`, `/lessons`, `/attempts/[id]` | Lighthouse CI on preview (throttled), web-vitals beacon in prod |
| INP p75 | < 150 ms | web-vitals beacon |
| CLS | < 0.05 | Lighthouse CI |
| First-load JS (gzip), student routes | **< 150 KB** (runner < 180 KB) | `next build` output checked by `scripts/check-bundle.ts` in CI |
| Admin routes JS | < 350 KB (editor lazy-loads CodeMirror) | same |
| TTFB static/ISR | < 100 ms (CDN) | Synthetic check |
| TTFB dynamic p75 | < 400 ms | Vercel logs / Speed Insights |
| Server time p95: `startAttempt` | < 300 ms | k6 |
| Server time p95: `submit` | < 500 ms | k6 |
| DB queries per page render | ≤ 3 (per-user); 0 for cached shared data | Drizzle query logger in dev, asserted in integration tests |

### Techniques that achieve these
- RSC by default. Client components only for interactive islands (runner, filters, editor, charts).
- KaTeX rendered on the server and cached with the lesson. Only `katex.min.css` (~23 KB) plus the fonts that are actually used get shipped.
- Self-hosted fonts via `next/font` with the `vietnamese` subset, `display: swap`, preloaded.
- Icons via `lucide-react`, tree-shaken (v1 loads all of Font Awesome).
- Images: browser-resized WebP, explicit width/height, `loading="lazy"` below the fold.
- `<Suspense>` streaming. The shell and cached catalog render immediately, and per-user progress streams in.
- Recharts, CodeMirror and the AI import UI are all `dynamic(() => import(...))`.
- No client-side data-fetching library. RSC handles reads; the runner uses fetch plus a small retry queue.
- DB in the same region as the functions (`sin1` ↔ `ap-southeast-1`).

## 2. Capacity: 100 concurrent test takers

**Scenario (worst realistic case):** a teacher assigns a 45-minute test to 100 students who all start within 2 minutes and submit within 10 seconds at the end.

| Phase | Requests | Rate | Cost per request | Load |
|---|---|---|---|---|
| Start | 100 × (`startAttempt` + runner page) | ~2 rps over 2 min | ~3 queries, 20–40 ms | trivial |
| Autosave | Each client syncs **only if answers changed**, at most every 30 s, plus on page hide | ≤ 3.3 rps, typically ~1.5 rps | 1 UPDATE, ~5 ms | trivial |
| Submit burst | 100 submits in ~10 s | **~10 rps peak** | lock + grade (pure, < 5 ms CPU) + 1 tx with 4–6 statements ≈ 30–60 ms | light |
| Result pages | 100 | ~10 rps | 2 queries | light |

Why this fits comfortably:
- **Fluid compute** lets one function instance handle many concurrent requests while they wait on I/O, so 10 rps doesn't mean 10 cold starts.
- DB: the Supabase Free (Nano) instance plus the Supavisor transaction pooler handles hundreds of short transactions per second. Each function instance uses `max: 5` pooled connections, so even 10 instances use only 50 pooler client connections.
- The lesson-with-answers used for grading comes from the data cache, so it isn't re-read 100 times.
- Row locks are per attempt, so submits don't contend with each other. `ratings` rows are per user, so there's no hot row either.

Hot spots to watch:
- **bcrypt on login.** 100 students logging in at the same minute ≈ 100 × ~80 ms CPU ≈ 8 CPU-seconds spread over a minute. That's fine, but it's why sessions last 30 days, so students don't log in before every test.
- **Leaderboard** after a burst of submits: served from cache (60 s TTL), so it's never computed per request.

**Target to prove in the load test (see 11 §5):** 100 virtual users, full test flow compressed to 5 minutes, **p95 < 800 ms for every endpoint, 0 errors, 0 lost answers.** Stretch goal: 300 VUs, to show 3× headroom.

## 3. Monthly usage model

**v1 baseline (S0-04, 2026-09-28):** 292 students; 9–54 active per week over the last 12 weeks; ~28 tests/day (p95 116); busiest hours 9h and 19h (VN); the busiest 10 minutes had 43 submits; v1 serves at most ~200k requests/month (owner, Vercel Usage tab). Quiz game: never used. The assumptions below are deliberately higher than this baseline.

Assumptions:
- 300 registered students, ~180 active in a typical month.
- An active student does 12 tests a month and browses ~20 other pages.
- 1 test ≈ 6 page/RSC requests + ~30 autosaves (only when changed) + 1 submit + ~3 explanation clicks (mostly DB-cache hits).
- Prefetch overhead × 1.5 on navigational requests.

| Resource | Estimate / month | Free limit | Usage |
|---|---|---|---|
| **Vercel function invocations** | 180 × (12 × 40 + 20 × 1.5) ≈ **92k**. Double for safety: **~185k** | 1,000,000 | **~19 %** |
| **Vercel Active CPU** | 185k × ~15 ms ≈ 46 min + logins/AI parsing ≈ **~1 h** | 4 h | **~25 %** |
| Vercel provisioned memory | ~185k × 0.2 s × 2 GB ≈ 21 GB-hrs (×3 for idle overlap ≈ 60) | 360 GB-hrs | ~17 % |
| Vercel Fast Data Transfer | ~185k × 25 KB + static JS ≈ **6–10 GB** | 100 GB | ~10 % |
| **Vercel Fast Origin Transfer** | dynamic responses ~185k × 15 KB (compressed) ≈ **3 GB** | 10 GB | **~30 %** ← watch |
| Vercel image optimization | ~0 (only static marketing images, built once) | 5K | ~0 % |
| **Supabase DB size** | ~140 MB after year 1 (04 §6) + ~40 MB migrated v1 data (v1 itself is 205 MB) | 500 MB | ~36 % |
| Supabase egress (DB + storage) | DB results ~1 GB + images ~1 GB | 5 GB (+5 GB cached) | ~40 % ← watch |
| Supabase storage | 18 MB existing images (2,527) + ~50 MB/year | 1 GB | ~7 % |
| Gemini requests | explanation cache misses (~100–300/day at first, falling as the cache fills) + imports | free tier RPD | see 09 |

**Rule:** if any line goes over **60 %** in the daily quota check (12 §5), stop feature work and optimise. The usual fixes are more caching, less prefetching, longer autosave intervals, and smaller payloads.

## 4. Cost-control guardrails built into the code
1. `<Link prefetch={false}>` on lesson-card grids and leaderboard rows.
2. Autosave is dirty-checked and throttled (30 s), with a flush on `pagehide`.
3. No polling anywhere. No realtime. Timers are client-side against the server `deadline_at`.
4. Shared data goes through tagged caching (ADR-005). Admin mutations invalidate precisely.
5. Payload hygiene: the runner gets question content once (RSC) and the save endpoint accepts only `{answers, flagged}` (≈ 1 KB for 40 questions; hard cap 16 KB). S3-05 sends the whole state rather than diffs: it is small, and last-write-wins stays trivially correct.
6. AI calls always go through the DB cache and the global daily budget (ADR-007).
7. Upload bytes never pass through functions (ADR-006).
8. Bots: `robots.txt` disallows everything except the landing, materials and share pages. `/admin` and `/attempts` send `noindex`.

## 5. What happens if we exceed a free limit
| Limit hit | Effect | Mitigation |
|---|---|---|
| Vercel Hobby invocations/CPU | Vercel may pause the project until the next cycle | Daily quota alert at 60 %, fix before 100 %; last resort: Pro for one month ($20) |
| Supabase egress/DB size | Grace period, then restrictions | Retention jobs, compact schema; archive old attempts to a JSON file in backups |
| Supabase inactivity pause | DB paused after 7 idle days | Daily cron query + nightly backup job touches the DB |
| Gemini quota | 429s | Cached explanations still work; UI shows "thử lại sau"; import waits and retries |
