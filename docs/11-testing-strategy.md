# 11 — Testing Strategy

## 1. Pyramid

| Layer | Tool | Scope | Runs |
|---|---|---|---|
| Unit | **Vitest** | Pure domain logic: parser, serializer, grading, points distribution, pool selection, shuffling, rating, number normalization, `toPublicQuestion`, rate-limit window math, phone normalization | Every push (CI), < 20 s |
| Integration | Vitest + **PGlite** (in-process Postgres 17 with the real migrations applied, `src/test/db.ts`); no Docker needed locally or in CI | Queries and service functions: `startAttempt`, `submit` transaction, rating update + replay, mistakes upsert, auth/session lifecycle, migrations apply cleanly | Every push |
| Component | Vitest + Testing Library (jsdom) | Runner state machine (answer, flag, navigate, offline queue), editor validation panel | Every push |
| E2E | **Playwright** (Chromium + WebKit mobile viewport) | Critical journeys against `next build && next start` + seeded DB | Every PR |
| Security | Playwright + custom checks; OWASP ZAP baseline (Docker) | Authz matrix, answer leakage, headers | PR (authz) / before release (ZAP) |
| Accessibility | `@axe-core/playwright` | Key pages, zero serious/critical violations | Every PR |
| Performance | Lighthouse CI (preview URL), bundle-size script | Budgets in 08 | Every PR |
| Load | **k6** (local, free) | 100 and 300 VU flows against staging | Sprint 8 and before cutover |
| Migration | `verify-migration.ts` | Counts and parity (10 §7) | Rehearsals and cutover |

**Coverage targets:** `features/grading`, `features/rating`, `features/lessons/parser` ≥ **95 %** lines; overall domain modules ≥ 80 %. UI is not coverage-gated.

## 2. Golden tests for business rules (ported from v1 behaviour)
`src/features/grading/domain/grade.test.ts` (with `points.test.ts`, `short-answer.test.ts`, and `src/features/attempts/domain/build-items.test.ts` for pool selection and the seeded shuffle; both folders are gated at ≥ 95 % lines and branches) must include:
- TF 4 statements: 4/3/2/1/0 correct → 1 / 0.5 / 0.25 / 0.1 / 0 × points; unanswered statement counts as wrong.
- TF with 3 statements → proportional.
- MCQ with shuffled options: displayed letter mapped back through `o[]`.
- Short: `"1,5"` = `"1.5"` = `" 1.50 "`; tolerance; non-numeric string fallback; empty → 0.
- Points `per-type-total`: 3 questions sharing 1.00 point → `[0.34, 0.33, 0.33]`, sum exactly 1.00.
- Score10 rounding to 2 decimals.

`src/features/rating/rating.test.ts`:
- v1 formula reproduces known v1 `rating_history` rows (take 20 real rows from the v1 export as fixtures).
- v2 formula (ADR-004) table tests; tiers at the boundaries 1199/1200, 1999/2000.
- Replay after deleting an attempt equals a fresh computation.

`src/features/lessons/parser.test.ts`:
- The sample in 04 §3.3, and every v1 lesson's `source_text` round trip: `parse(serialize(q)) == q` for all migrated lessons (a fixture snapshot of v1 lessons, anonymized).

## 3. E2E journeys (Playwright)

`lessons.spec.ts` covers the S2 catalog/overview in desktop Chromium and a 360 px Android viewport: accent-insensitive search, filters, cumulative pagination, back/reload and search focus, legacy 308 redirects, invalid/missing/unpublished lookups, student HTML/RSC answer-leak checks, light/dark screenshots, and zero serious/critical axe violations. `pnpm seed --profile e2e` now also upserts 27 published synthetic lessons plus a draft and archived lesson, with version content containing a private explanation marker for leak detection. The seed remains local/CI-only. The Next.js streamed shell requires JavaScript; a GET form alone does not provide a no-JavaScript page.

`runner.spec.ts` (S3) takes the seeded `e2e-runner` lesson (all three types, no shuffle, 2 points) and `e2e-timer` (1-minute limit) as dedicated students `runner`/`runner2`, one per Playwright project, so parallel projects never share an attempt. It covers the runner UI (answers, flag, navigator sheet/panel, list view, keyboard, submit dialog), axe and 360 px overflow in light and dark (with reduced motion so axe never samples mid-transition), and journey 4's leak check on every runner response.

1. **Register → pending → admin approves → login → dashboard.**
2. **Take a test end to end:** start, answer all 3 types, flag, reload mid-test (answers restored), go offline, answer, come back online (sync), submit → result shows the correct score for known answers.
3. **Timer:** lesson with a 1-minute limit → auto-submit happens → server rejects a late save.
4. **Answer leakage guard:** during the runner, capture every network response and assert none contains `"answer"`, `"statements":[{"text":…,"answer"` or `"explanation"`.
5. **Double submit** (two parallel requests) → one attempt, same score, one rating event.
6. **Review:** wrong answers appear in `/review`; start personalized practice; answer correctly twice → resolved.
7. **Admin editor:** paste the text format with an error → validation shows the line → fix → publish → the student sees the new version; an in-progress attempt on the old version still grades against the old version.
8. **Authz matrix** (`authz.spec.ts`): each role × each protected route and action → expected 200/302/403.
9. **Device policy on:** login on device A, login on B → `DEVICE_MISMATCH`; admin resets → B works.
10. **Leaderboard** updates within 60 s of a submit.

**Running E2E locally without Docker:** `pnpm db:local` starts a PGlite server on `:54329` (set `DATABASE_URL` to it and `DATABASE_POOL_MAX=1` in `.env.local`), then `pnpm db:migrate && pnpm seed --profile e2e && pnpm build && pnpm e2e --workers=1`. PGlite multiplexes one session, so concurrent queries can get garbled: keep one worker and restart `db:local` if you see `ECONNRESET`. CI uses a real `postgres:16` service with full parallelism.

Test data: `scripts/seed.ts --profile e2e` creates 1 admin, 5 students (active, pending, rejected), and 3 lessons covering all question types and configs. Each spec resets its tables through a `/api/test/reset` handler that is compiled only when `E2E=1` and **excluded from production builds** (the build fails if `E2E` is set on a `VERCEL_ENV=production` build).

## 4. Manual test passes
- **Device matrix** (Sprint 3 and Sprint 8): cheap Android + Chrome, iPhone Safari, Zalo in-app browser (students open links from Zalo!), desktop Chrome/Edge.
- **Hallway test** with 3 students on runner and result (see 07 §8).
- **Teacher acceptance** of the editor and import with 3 real exam PDFs.

## 5. Load test (k6)
`tests/load/test-day.js`:
- Pre-create 300 load-test users and 1 lesson (28 questions, 5-minute limit) in **staging**.
- Stages: ramp to 100 VUs over 60 s → each VU logs in (cookie), loads the runner page, `POST save` every 5 s with random answers, then all submit in a 10 s window → load the result page.
- Thresholds: `http_req_failed < 0.1%`, `p(95) < 800ms` per endpoint tag, 0 checks failing on "score is present".
- Repeat at 300 VUs (stretch).
- Afterwards: verify in the DB that 100 (or 300) attempts are submitted with scores, and that ratings and rating events count match.
- Quota note: one 300-VU run uses about 30k invocations, which is fine. Don't run it daily.
- Staging needs deployment protection disabled or an automation bypass token, and must point at the **staging DB**, never prod.

## 6. CI gates (`.github/workflows/ci.yml`)
`pnpm install --frozen-lockfile` → `biome ci` → `tsc --noEmit` → `vitest run --coverage` (with a Postgres service) → `next build` → bundle budget check → Playwright E2E (sharded ×2) → upload report. A PR can't merge if any step fails. Vercel builds the preview in parallel. Lighthouse CI runs against the preview URL.
