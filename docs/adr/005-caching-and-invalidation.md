# ADR-005: Cache shared data with Next.js tagged caching; no in-memory caches, no Redis

- **Status:** Proposed
- **Date:** 2026-09-28

## Context
v1 has several in-process caches (`cacheService`, `aiCacheService`, `lessonCacheMiddleware`) and hand-tuned `Cache-Control` headers. On serverless each instance has its own memory, so hit rates are unpredictable and invalidation is inconsistent. For $0 and 100 concurrent users we want most reads to hit neither the function nor the DB.

## Decision
1. **Static first.** Marketing, materials, gallery and legal pages are prerendered at build.
2. **Tagged data cache** (`"use cache"` + `cacheTag()` + `cacheLife()`, or `unstable_cache` on older Next versions) for data that's **the same for every student**: lesson catalog, lesson metadata, answer-stripped lesson content, leaderboard, rating tiers.
3. **Per-user data is never cached across users.** It's queried per request, and React `cache()` dedupes it within one request.
4. **Invalidate by tag from the mutation** that changed the data. Tag names are defined in one file (`src/lib/cache-tags.ts`):
   - `lessons` catalog; `lesson:{id}`; `lesson:{id}:public`; `lesson:{id}:answers`
   - `leaderboard` (also `cacheLife` 60 s)
   - `settings` (global settings row)
5. No Redis/Upstash, since the free tiers add another quota to watch. Revisit only if the tagged cache proves insufficient.

## Consequences
- The catalog, lesson pages and leaderboard cost ~0 DB queries on cache hits.
- Developers must use the helpers in `features/*/queries.ts`, not ad-hoc `db.select()` in pages. This is enforced in review (see 14).
- The exact caching API changed between Next 14, 15 and 16. Pin the Next version and follow its docs. As built in S1/S2, query functions use explicit `"use cache"` directives and cache helpers rather than the proposed runtime `cached(fn, ...)` wrapper; the cache boundary is compiler-managed. Pages still depend only on feature query functions.
