# 10 — Data Migration (v1 → v2)

## 1. Strategy
- **Big-bang cutover with a rehearsed script**, not dual-writes. The dataset is small (hundreds of users, thousands of results), so a full copy takes minutes.
- v2 lives in a **separate Supabase project** (Free allows 2 active projects), preferably in `ap-southeast-1`. v1 keeps running untouched until cutover, and it's the rollback target.
- The migration script `scripts/migrate-legacy.ts` is **idempotent**. It upserts by `legacy_id`, so it can be re-run for rehearsals and for the final delta.
- Staging: during development the "second" free project is the v2 prod-to-be. For a separate staging environment, use a local Supabase (Docker via the `supabase` CLI) or a Neon free branch. Don't create a 3rd Supabase Free project, because only 2 can be active at once.

## 2. Pre-migration inventory (Sprint 0)
Run against v1 (read-only) and record the results in this doc:
```sql
select pg_size_pretty(pg_database_size(current_database()));
select relname, n_live_tup, pg_size_pretty(pg_total_relation_size(relid))
from pg_stat_user_tables order by pg_total_relation_size(relid) desc;
select count(*) filter (where is_approved) approved, count(*) from students;
select count(*), min(timestamp), max(timestamp) from results;
select jsonb_path_query_array(questions, '$[*].type') ... -- distinct question types
select count(*) from results where student_id is null;
select count(*) from lessons where questions is null or jsonb_array_length(questions)=0;
```
Also export the `session` table count (it isn't migrated; everyone logs in again) and the storage bucket object count and size.

Automated as `pnpm v1:inventory > tmp/v1-inventory.md`. **Results (2026-09-28):**

| Item | v1 |
|---|---|
| DB size | 205 MB (`results` 174 MB, `rating_history` 9 MB, `lessons` 4 MB) |
| Students | 292 (291 approved) |
| Lessons | 170 rows: 169 lessons + the `quiz_game` placeholder (skipped); 1 empty; avg 30.4 questions, max 104 |
| Question types | `abcd` 4,378 · `truefalse` 614 · `number` 153 (no `essay`, no HTML in stems) |
| Results | 24,206 (since 2025-04-03); 55 without a student |
| Ratings / history | 273 / 23,409 |
| `session` rows | 13 (not migrated) |
| Storage | `lesson-images` only: 2,527 objects, 18 MB |
| `quizzes`/`quiz_results`, `temp_lesson_content`, `ai_interactions` | `quiz_results`, `temp_lesson_content` and `ai_interactions` don't exist |

**Dry run of S2-05 on the real data (local target, rolled back):** 292/292 students, 169 lessons, 5,145/5,145 questions, 0 errors, 4 warnings (text-less true/false groups given a default lead-in).

## 3. Mapping

| v1 | v2 | Transform |
|---|---|---|
| `students` | `users` (role `student`) | `id→legacy_id`; `full_name`; `phone_number→phone` (normalize: strip spaces, `+84→0`); `date_of_birth`; `password_hash` as is (bcrypt); `is_approved → status` (`active`/`pending`); `approved_device_id → approved_device_id` **only if** device policy stays on (otherwise null); `avatar_url → avatar_path` (strip base URL); `created_at` |
| hard-coded admin | `users` (role `admin`) | Created by `seed.ts` with a new password the owner chooses |
| `lessons` | `lessons` + `lesson_versions` (version 1) | `id→legacy_id`; `title`, `description`, `grade`, `subject→chapter`, `tags`, `lesson_image→cover_path`, `order→sort_order`, `views`, `created`, `last_updated→updated_at`; status `published` (v1 has no draft concept, so check with the owner); `questions` → normalized `Question[]` (see §4); config from `time_limit_*`, `shuffle_*`, `enable_question_pool`, `question_pool_size`, `question_type_distribution`, `points_distribution`; `source_text` regenerated from questions by the serializer |
| `results` | `attempts` (status `submitted`, mode from `mode`) | `id→legacy_result_id`; `lesson_id` via legacy map; `student_id` via legacy map; `questions` (per-answer objects) → `items/answers/earned` matched to question ids by normalized stem text; `score`, `total_points→max_score`; `timestamp→submitted_at`; `time_taken`; `exam_guard_flags → guard_events`; `ip_address` |
| `ratings` | `ratings` | Copy the current rating **as is** (don't recompute) |
| `rating_history` | `rating_events` | Copy; link `attempt_id` when a result matches (same student, lesson, ±2 min timestamp) |
| `quizzes`, `quiz_results` | archived to JSON in backups | Only migrate if the quiz game is kept (P2) |
| `temp_lesson_content`, `ai_interactions`, `system_settings`, `session` | not migrated | Archived in the final v1 dump |
| Storage `lesson-images` | Storage `media` | Copy objects (script using the Storage API), keep paths under `legacy/`; rewrite URLs in lesson JSON |
| `materials/*` (repo) | `src/content/ly-thuyet/*.mdx` | One-time conversion script + manual review |
| `public/lesson_handout/*.jpg` | `public/handouts/*.webp` | `sharp` conversion script |

### 3.1 Running it (S9-06: users, lessons, result history and lesson images)
```bash
pnpm migrate:legacy --dry-run      # one transaction, rolled back; writes the report only
pnpm migrate:legacy --skip-media   # write rows, don't copy images
pnpm migrate:legacy                # write rows, then copy images into the v2 `media` bucket
```
Env: `V1_DATABASE_URL` (read in a `READ ONLY` transaction), `DATABASE_URL_DIRECT` for v2, and `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` of the **v2** project for images. It refuses to run if both URLs point at the same host. Output: `tmp/migration-report.md` (gitignored): counts, question errors and warnings per lesson legacy id, skipped students **by legacy id only** (no names or phones), media failures. Exit code 2 when there are question errors or media failures.

Images on their own (the production migration ran with `--skip-media`, so lesson figures and covers did not load until this ran):
```bash
node --env-file=<file> scripts/copy-legacy-media.ts --dry-run   # count jobs, check v1 sources and what is already in v2
node --env-file=<file> scripts/copy-legacy-media.ts             # create buckets if missing, copy, record `media` rows
```
It only reads v1 (`V1_DATABASE_URL`, `READ ONLY`) and writes Storage plus `media` rows; it never touches lessons, users or history. It creates the public `media` and private `imports` buckets when they are missing. With `DATABASE_URL_DIRECT` it also checks that every cover and question image the v2 lessons reference loads from the public URL, and exits 2 if one doesn't.

Rules as implemented (`scripts/lib/migrate-legacy.ts`, normalization in `src/features/lessons/domain/legacy.ts`):
- **Students** are upserted by `legacy_id`; v1 stays the source of truth until cutover, so a re-run refreshes status, name, phone, DOB and password hash. Skipped: invalid phone, non-bcrypt hash, or a phone already owned by another account (another v1 student or a v2-only account). Avatars and the device binding are not migrated yet (S8-04, S6).
- **Lessons** are upserted by `legacy_id` with content-addressed, immutable versions and `source_text` regenerated by the serializer. Changed source content creates another version; referenced snapshots are never overwritten. Points use `per-question` mode with v1's baked-in per-question points. `question_count`/`type_counts` come from the deterministic pool split (`domain/summary.ts`). A lesson with no valid question stays a `draft` without a version.
- A lesson **edited in the v2 editor** (a draft, an authored version, or a native version above 1 without a migration hash) is left untouched and listed as "kept". Historical migration versions do not prevent a later source delta.
- **Images**: v1 bucket URLs map to `legacy/<sanitized name>`; base64 covers become `legacy/covers/lesson-<id>.<ext>`; other URLs are reported. Copies skip objects already in the bucket, and each copied object gets a `media` row.
- v1's `quiz_game` row in `lessons` (the dropped quiz game's placeholder) is skipped and listed under "Skipped lessons".
- **Rehearsal**: exercised locally against a v1-shaped PGlite database built from `tests/fixtures/v1-sample`, and as a dry run of the real v1 data into local PGlite (§2). Applying to Neon/the v2 project and the image copy wait for S0-06.

## 4. Question normalization rules
- `type`: `abcd|multiple_choice → mcq`; `truefalse|true_false → tf`; `number|fill_blank → short`; anything else → report and skip (and list it for the owner).
- mcq `correct: "B"` → `answer: 1`; options `string | {text}` → `{text}`; options with `image`/`imageUrl` → `image: {path}`.
- tf: `options[]` + `correct: [true,false,…]` (booleans or `"true"/"false"` strings) → `statements[{text, answer}]`.
- short: `correct` (number or string) → `answer` string with a `.` decimal separator.
- Stems: strip `[x pts]` markers into `points`; keep LaTeX as is; convert `<br>` to newlines; strip other HTML tags into plain text (log each lesson that had HTML for manual review).
- Images: `[img src="…"]` tags leave the text; the first becomes the element's `image`, and any further ones stay inline as `![](media:…)`. A stem may be image-only.
- tf groups with neither stem text nor image get the lead-in "Mỗi mệnh đề sau đúng hay sai?" (reported as a warning).
- Question ids: keep the v1 `id` if present and unique (e.g. `q_1`), else generate one.
- Validation: every migrated question is parsed through the v2 Zod schema. Failures go into `migration-report.md` with lesson id and question index. The target is 0 failures before cutover.

## 5. Result → attempt matching
v1 results store copies of the questions, not references. For each result question:
1. Normalize the stem (same `normalizeQuestionText` as v1 `adaptiveQuizService`) and find the question in the lesson's current questions.
2. If found, record `{q: id}`, the student's answer (converted to v2 format), and `earned` (keep v1's recorded `earnedPoints`, since history is not re-graded).
3. If not found (the lesson was edited since), create a **legacy version** of the lesson from that result's embedded questions (deduplicated by hash) and point the item at it. This preserves review pages for old results.
4. Rebuild `mistakes` from migrated attempts: wrong items, ordered by time.

S9-06 implementation additionally compares embedded options and answer keys;
stem equality alone cannot establish that a question is unchanged. Shuffled
MCQ options map to the stored option order. Historical content is canonicalized
and deduplicated through `lesson_versions.legacy_hash`; `rating_events.legacy_history_id`
makes history retries idempotent. Recorded marks and totals are copied without
re-grading. Results lacking an embedded answer key or question content are
reported as explicit skips; the script does not invent historical content.

The source is one repeatable-read, read-only snapshot, with results paged 200
at a time. All target database writes are transactional. Native v2 attempts
survive. A migrated student's native rating events are replayed from the latest
copied v1 rating, and their mistakes are rebuilt chronologically from both
histories. Unrelated v2 users remain untouched. Old IP and guard metadata is
omitted from migration. Count-only history and verification reports are safe
CI artifacts; source data and session credentials are never artifacts.

`node scripts/verify-migration.ts` checks source counts, every eligible result's
stored answers and marks, rating snapshots/history, all version schemas and
answer-safe projections, 20 random students, and leaderboard ties. Native
pilot ratings are compared with the expected replay. Controlled password
checks need `MIGRATION_PASSWORD_CHECKS_FILE` pointing to a private, gitignored
JSON array of at least five `{legacyId,password}` entries; reports contain only
the verified count. Teacher review, passwords and live image copy remain
explicit gates when those inputs are unavailable.

## 6. Cutover runbook
| When | Step | Owner |
|---|---|---|
| T-14 d | Full rehearsal on a fresh v2 project: run migrate, run verification SQL, click through 10 random students and lessons | Dev |
| T-7 d | Announce to students: date, "log in again with the same phone and password", new look | Teacher |
| T-7 d | Lower v1 activity: no new lessons in v1 after T-2 d (or re-run the lesson part of the migration) | Teacher |
| T-0, 22:00 (low traffic) | Put v1 in read-only mode: set an env flag that makes `POST /api/results` return 503 with a message, and redeploy v1 | Dev |
| T-0 | Final `pg_dump` of v1 (kept for 1 year) | Dev |
| T-0 | Run `migrate-legacy.ts` (delta, idempotent) → verification SQL (§7) | Dev |
| T-0 | Point the domain / `onluyenvatly.vercel.app` project to v2 (see note) | Dev |
| T-0 | Smoke test: log in as 3 migrated students, take a test, check leaderboard and admin | Dev + teacher |
| T+1 d | Monitor errors, quota, support messages | Dev |
| T+14 d | Decommission v1: rotate its keys, pause the v1 Supabase project (keep the dump) | Dev |

**Domain note:** deploy v2 as a *new Vercel project* (e.g. `onluyenvatly-v2.vercel.app`). A `*.vercel.app` name can belong to only one project at a time. At cutover, remove `onluyenvatly.vercel.app` from the v1 project's Domains settings (the v1 project keeps working on another alias, which you should rename first, e.g. `onluyenvatly-v1.vercel.app`), then add it to the v2 project. Expect about a minute of downtime and no DNS propagation. Rollback is the same steps in reverse. Rehearse this with two throwaway projects in Sprint 0. If a custom domain is bought later, this becomes a simple DNS/project switch.

**Rehearsal checklist (S0-09, with two throwaway projects `olvl-a`, `olvl-b`; not yet run):**
1. [ ] Deploy any page to both projects (A says "A", B says "B"). Time each step from here on.
2. [ ] In A → Settings → Domains, add `olvl-rehearsal.vercel.app`. Confirm it serves "A".
3. [ ] In A, add the alias `olvl-rehearsal-old.vercel.app` and confirm it serves "A" (this is the rename step for v1).
4. [ ] Remove `olvl-rehearsal.vercel.app` from A; add it to B. Note the downtime seen by `curl` in a loop.
5. [ ] Reverse the switch (rollback path) and note the downtime.
6. [ ] Instant Rollback: deploy B twice (v1 text, v2 text), use Deployments → previous → Instant Rollback, confirm the old text, then undo it.
7. [ ] Record timings and anything surprising here, then delete both projects.

## 7. Verification checklist (automated in `scripts/verify-migration.ts`)
- Counts: users (students) = v1 students; lessons = v1 lessons; attempts = v1 results (minus documented skips); ratings = v1 ratings.
- For 20 random students: the rating equals v1; the number of attempts equals v1; the latest attempt score equals v1.
- For every lesson: the question count equals v1; the Zod parse passes; the answer-stripped view contains no `answer`.
- 5 random v1 password hashes verify against known test accounts (use accounts the teacher controls).
- Leaderboard top 20 is identical to v1 (same students and ratings in the same order; within a tie, v1 had no fixed order, so compare tied rows as a set).

## 8. Rollback
Within 14 days: move the domain alias back to v1 and turn off v1 read-only mode. Attempts made in v2 after cutover would be lost to v1. Export them with `scripts/export-v2-attempts.ts` if needed. This is acceptable because rollback is only for severe failures in the first days.
