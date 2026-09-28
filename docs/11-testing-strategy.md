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

`src/features/rating/domain/rating.test.ts` (gated at ≥ 95 %):
- v1 formula reproduces known v1 `rating_history` rows (the 20 anonymized rows in `tests/fixtures/v1/rating-history.json`, all exact: gains, losses and the > 5 min zeros). The v1 time bonus exists only for this check.
- v2 formula (ADR-004) table tests; tiers at the boundaries 1199/1200, 1999/2000.
- Replay after deleting an attempt equals a fresh computation.

`src/features/lessons/parser.test.ts`:
- The sample in 04 §3.3, and every v1 lesson's `source_text` round trip: `parse(serialize(q)) == q` for all migrated lessons (a fixture snapshot of v1 lessons, anonymized).

## 3. E2E journeys (Playwright)

`lessons.spec.ts` covers the S2 catalog/overview in desktop Chromium and a 360 px Android viewport: accent-insensitive search, filters, cumulative pagination, back/reload and search focus, legacy 308 redirects, invalid/missing/unpublished lookups, student HTML/RSC answer-leak checks, light/dark screenshots, and zero serious/critical axe violations. `pnpm seed --profile e2e` now also upserts 27 published synthetic lessons plus a draft and archived lesson, with version content containing a private explanation marker for leak detection. The seed remains local/CI-only. The Next.js streamed shell requires JavaScript; a GET form alone does not provide a no-JavaScript page.

`runner.spec.ts` (S3) takes the seeded `e2e-runner` lesson (all three types, no shuffle, 2 points) and `e2e-timer` (1-minute limit) as dedicated students `runner`/`runner2`, one per Playwright project, so parallel projects never share an attempt. It covers the runner UI (answers, flag, navigator sheet/panel, list view, keyboard, submit dialog), axe and 360 px overflow in light and dark (with reduced motion so axe never samples mid-transition), journey 4's leak check on every runner response, journey 2 (reload restore, offline → online sync, cross-origin save refused, submit → server score 6,25), journey 5 (two parallel submits → one graded result) and journey 3 (the real 60 s timer auto-submits, then a save gets 409). Journey 5's "one rating event" check is an integration test in `attempts/service.test.ts` (S4-01), next to two different tests submitted at once by one student (both rated, in order).

`admin-lessons.spec.ts` (S5-01) logs in as the seeded admin: search, status chips, the no-reorder hint on filtered views, 360 px overflow and axe in light/dark (both projects). The desktop project alone duplicates the seeded draft, moves the copy with ↑ then back with a pointer drag (each reload checks the order stuck), archives, restores and deletes it; it first removes copies left by an interrupted run. Only drafts move, so the relative order of published lessons the catalog specs read never changes. It ends by creating a lesson with "Tạo bài mới" (lands on its editor, last in the list) and deleting it.

`admin-editor.spec.ts` (S5-02) opens the seeded draft's editor and saves nothing, so both projects run it: a pasted text with a missing `*` shows "Dòng 1, cột 1", the issue button moves the cursor there, typing `*` on the next line clears it, the preview shows the key and server KaTeX, and the stats bar counts types and points; axe light/dark and no 360 px overflow. Pasting the smallest real v1 lesson (serialized from the fixture) previews every question with no errors and no formula left unrendered. Settings (S5-03): reveal-after-deadline without start/limit plus a pool of 9 from 1 question is refused with a message on each field (checked through `aria-describedby`) and nothing is saved; axe light/dark. The desktop project also checks that the stats bar follows unsaved per-type points, saves a time limit and tf scale, reloads, and restores the seeded values (it saves only fields no other spec reads). `admin-publish.spec.ts` (S5-04, journey 7) uses a lesson, a student and an admin per project (`e2e-publish-d/m`): the student starts version 1 and answers; the teacher pastes a version 2 with an error, saves it as a draft (reload keeps it), follows the issue to its line, fixes it and publishes; the student's submit is still graded on version 1 (2/2), and a new attempt gets version 2's three questions. Axe light/dark on the editor. The seed deletes versions other than 1 of the seeded lessons, so every run starts from the fixture. `admin-media.spec.ts` (S5-05) runs against `tests/e2e/fake-storage.ts`, an in-memory Storage stand-in Playwright starts next to the app (`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` point at it; CI builds with `NEXT_PUBLIC_MEDIA_BASE_URL` on it, so the CSP allows it): a pasted photo-like PNG of over 5 MB arrives in Storage as a 1280 × 985 WebP of about 28 KB, through exactly one `PUT` to the signed URL, and the editor shows `![](media:… =1280x985)` and the image; the desktop project also sets, reloads and removes a cover (axe light/dark). `admin-editor.spec.ts` also covers "Làm thử" (S5-06) in both projects: keys and live outcomes, KaTeX, the local result and restart, no request to `/api/attempts`, axe and 360 px. Admin specs log in as their own seeded admin per project (`e2e-lessons-d`, `e2e-editor-m`, …): a login revokes the account's other sessions (single-session policy), so parallel specs must not share one.

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

**Running E2E locally without Docker:** start the Storage stand-in with `node tests/e2e/fake-storage.ts` (port 54330) and add `SUPABASE_URL=http://localhost:54330`, `SUPABASE_SERVICE_ROLE_KEY=e2e-service-key` and `NEXT_PUBLIC_MEDIA_BASE_URL=http://localhost:54330/storage/v1/object/public/media` to `.env.local` before building (Playwright reuses running servers locally, so it won't set these itself). `pnpm db:local` starts a PGlite server on `:54329` (set `DATABASE_URL` to it and `DATABASE_POOL_MAX=1` in `.env.local`), then `pnpm db:migrate && pnpm seed --profile e2e && pnpm build && pnpm e2e --workers=1`. PGlite multiplexes every client connection onto one session and only keeps a connection's messages together inside a transaction, so two connections running queries at once swap unnamed statements (errors like `invalid input syntax for type uuid` or `The "string" argument must be of type string`, or silently wrong rows, which the runner shows as a 404). `src/db/client.ts` keeps one pool per process, so `DATABASE_POOL_MAX=1` means one connection; keep one worker, don't point a second app process at the same `db:local`, and restart it if you see `ECONNRESET`. Locally Playwright reuses whatever already listens on `:3000`, so stop an old `next start` after rebuilding. CI uses a real `postgres:16` service with full parallelism.

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
