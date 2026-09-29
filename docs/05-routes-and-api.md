# 05 — Routes, Server Actions & Route Handlers

Conventions:
- **Pages** read data through `features/*/queries.ts` (`import 'server-only'`).
- **Mutations** are Server Actions in `features/*/actions.ts`. Every action: (1) authenticates (`requireStudent`/`requireAdmin`), (2) validates input with Zod, (3) rate-limits if needed, (4) does the work in a transaction if there's more than one write, (5) invalidates cache tags, (6) returns a typed `Result<T>`: `{ ok: true, data } | { ok: false, code, message }`. Actions never throw raw errors to the client.
- **Route handlers** exist only for streaming, beacons, cron and health.
- **URLs are English and short**, close to v1 so bookmarks survive. UI text is Vietnamese.

## 1. Pages

### Public
| Path | Render | Content |
|---|---|---|
| `/` | Static | Landing: value proposition, how it works, grade chapters, CTA register/login |
| `/login` | Static shell + action | Single login form (phone or username + password) |
| `/register` | Static shell + action | Registration form → `/register/pending` "chờ duyệt" (pending approval) screen |
| `/ly-thuyet`, `/ly-thuyet/[grade]/[chapter]/[slug]` | Static (MDX) | Theory materials migrated from v1 `materials/` |
| `/gallery` | Static | Handout gallery |
| `/share/lessons/[id]` | ISR | Public lesson preview + OG image (`opengraph-image.tsx`) |
| `/privacy`, `/terms` | Static | Short Vietnamese policy pages |

### Student (layout: `requireStudent()`; admins may view too)
| Path | Content |
|---|---|
| `/dashboard` | Continue card (in-progress attempt), recommended lessons, recent results, rating + tier, open mistakes count, announcement |
| `/lessons` | Catalog with filters (`?q=&grade=&chapter=&tag=&sort=&status=`), URL-driven so it's shareable and back-button friendly |
| `/lessons/[id]` | Lesson overview + my attempts + "Bắt đầu" / "Tiếp tục" |
| `/attempts/[id]` | Test runner (owner only, `in_progress`) |
| `/attempts/[id]/result` | Result & review (owner or admin): `ScoreHero` from the stored marks + the attempt's `rating_events` row (one unique-index lookup); the per-question review reads the cached answers-included version only when `revealAnswers` allows (07 §5.4) |
| `/review` | Mistakes bank + "Tạo bài ôn tập" (personalized practice) |
| `/leaderboard` | Rating leaderboard (`?grade=&period=all|week`) |
| `/profile` | My stats, rating chart, history |
| `/profile/[userId]` | Public-ish profile (name, tier, rating chart). Only fields allowed by privacy settings |
| `/settings` | Profile, password, avatar, devices/sessions, export data, delete request |

**S2 catalog implementation:** `/lessons` supports `q`, `grade`, `chapter`, `tag`, `sort=order|newest|popular|title`, and `page`. Each “Xem thêm” step retains the preceding cards (24 per step, at most 20 steps). Invalid params fall back per field; search ignores accents and treats `%`/`_` literally. Filters preserve browser history and reset pagination. Only published lessons are listed. Shared catalog/facet queries use tag `lessons` with an hours cache lifetime. Progress/status filters await the S3 attempts table.

**S2 overview implementation:** `/lessons/[id]` selects metadata and explicit rule fields only, cached under `lesson:{id}` for hours. It never selects `lesson_versions`, source text, questions, or the full config. Students receive a not-found view for drafts/archived lessons; admins can open those overviews directly. Since S3-03 a per-user panel streams in under the cached metadata (`getMyLessonAttempts`, uncached): "Tiếp tục làm bài" for the attempt in progress, otherwise the `startAttempt` form (hidden when `maxAttempts` is used up; admins are unlimited), and my finished attempts linking to their results.

**S4 leaderboard implementation:** `/leaderboard` takes `grade=10|11|12` and `period=all|week` (invalid values fall back to the defaults). `all` ranks active students with a `ratings` row by rating; `week` ranks those with a rated attempt in the last 7 days (rolling, like v1) by the sum of their changes. Equal values share a rank (1, 2, 2, 4). One cached query (`leaderboard` tag, revalidate 60 s, up to 1,000 rows) serves every student; the page shows the top 100 and finds the viewer's own row in the same data, pinned as a sticky row. Phone and date of birth are never selected.

**S4 dashboard implementation:** `/dashboard` makes 3 per-user queries (session, `getDashboardStats`, `getContinueAttempt`). The rank reuses `getLeaderboard({ grade: myGrade, period: "all" })` and the recommendations reuse `getCatalog` for my grade (both shared caches): the first 4 lessons in the teacher's order that I have neither submitted nor have in progress. The rating sparkline is inline SVG rendered on the server.

**S4 profile implementation:** `/profile?page=` (cumulative history, 20 per step, at most 25 steps) makes 4 per-user reads in parallel: `getProfileSummary` (rating, peak, tests, average, active days), `getRatingHistory` (latest 500 points, for the lazy Recharts chart), `getAccuracy` (points earned/available per question type and chapter over the latest 100 tests; the question type is resolved in SQL from `lesson_versions` and nothing else from the questions leaves the database) and `getMyHistory`. The streak counts consecutive Vietnam-time days with a submitted test, ending today or yesterday.

### Admin (layout: `requireAdmin()`)

| Path | Content |
|---|---|
| `/admin` | Dashboard (S6-06): tiles pending students (→ `/admin/students?view=pending`), active students and submitted attempts in the last 7 Vietnam days, attempts today (Vietnam day), AI today ("Chưa bật" placeholder until S7, no query); attempts per day for the last 30 Vietnam days (server SVG bars, zero-filled, summary sentence as the accessible name, a `<title>` per bar); hardest questions this week (lowest full-marks rate among (lesson, question) pairs with ≥ 5 answers in the last 7 Vietnam days, top 5, "Câu N" by position in the newest version answered, linking to that lesson's stats with `sort=hardest`). Students' attempts only |
| `/admin/lessons` | List, reorder, status filter |
| `/admin/lessons/new`, `/admin/lessons/[id]/edit` | Editor (tabs: Nội dung, Cài đặt, Xem trước; a "Thống kê" link opens the stats page) |
| `/admin/lessons/[id]/stats?version=&sort=` | Lesson statistics (S6-05): version picker (versions with students' submitted attempts plus the current one, newest first; default the current, else the newest), tiles (attempts, students, average and median /10), a 10-bucket CSS histogram, per question in version order or "Khó nhất trước" (`sort=hardest`): % full marks, average share of points, answered; mcq counts per original option with the key marked (word + icon), blanks and students per option in `<details>`; tf % correct per statement; short: top 5 normalized answers with counts and correctness. Linked from each row of `/admin/lessons` and from the editor. Students' attempts only; the latest 2,000 per version (the page says when capped) |
| `/admin/import` | AI import (PDF/DOCX/image → text) → opens the editor |
| `/admin/students` | Pending queue + all students |
| `/admin/students/[id]` | Student detail: attempts, rating, sessions, actions |
| `/admin/results` | All attempts, filters, CSV export |
| `/admin/explanations` | Review/edit AI explanations, 👎 queue |
| `/admin/settings` | Global settings, admins list |
| `/admin/audit` | Audit log |

### Legacy redirects (`next.config.ts` `redirects()`, permanent)
| v1 | v2 |
|---|---|
| `/student/login`, `/admin/login` | `/login` |
| `/student/register` | `/register` |
| `/lesson/:legacyId` | `/lessons/by-legacy/:legacyId` → handler looks up `legacy_id` → 308 to `/lessons/:id` |
| `/share/lesson/:legacyId` | same lookup → `/share/lessons/:id` |
| `/result/:legacyResultId` | lookup → `/attempts/:id/result` |
| `/student/dashboard`, `/multiplechoice`, `/truefalse` | `/dashboard`, `/lessons` |
| `/student/profile`, `/student/rating` | `/profile`, `/leaderboard` |
| `/study-materials` | `/ly-thuyet` |
| `/review-mistakes`, `/practice` | `/review` |
| `/history` | `/admin/results` |

S2-07 implements the lesson redirect only. The authenticated lookup validates the legacy key, uses the unique `legacy_id` index, caches under `lessons`, and returns a 308 with `Cache-Control: private, no-store`. Missing or student-inaccessible lessons return 404. Signed-out visitors log in before the lookup; the `next` URL preserves their bookmark.

## 2. Server Actions

### `features/auth/actions.ts`
| Action | Input | Notes |
|---|---|---|
| `login` | `{ identifier, password }` | Rate limit 5/min per IP+identifier. Checks status, single-session → creates session → redirect by role, or to `/change-password` first while `must_change_password` is set (S6-02) |
| `register` | `{ fullName, phone, dob, password, grade?, className? }` | Rate limit 3/hour/IP; `registration_open`; phone unique |
| `logout` | — | Deletes the current session |
| `logoutAll` | — | Deletes all of the user's sessions |
| `changePassword` | form `{ current, password, confirm, next? }` | As built (S6-02). Uses `requireSessionUser()`, the one guard that lets a user with `must_change_password` through. Rate limit 5 / 10 min per user (guessing the current password); checks the current password, the policy (also not the phone number, not the current password), sets the hash, clears `must_change_password`, revokes the other sessions, then redirects to `?next=` (checked with `safeNextPath`) or home. Field errors on `current`, `password`, `confirm`; the password fields are never refilled |

### `features/attempts/actions.ts`
| Action | Input | Notes |
|---|---|---|
| `startAttempt` | `{ lessonId }` (form) | Returns the existing in-progress attempt if any; checks `maxAttempts` (not for admins, who may also try unpublished lessons that have a version); builds items (pool, shuffle, points) from a random 32-bit seed; rate limit 10/min. Parallel starts converge through the unique in-progress index (`INSERT … ON CONFLICT DO NOTHING`, then re-read). Redirects to `/attempts/[id]` |
| `saveProgress`* | `{ attemptId, answers, flagged, guardEvents }` | Owner + in_progress + before deadline+grace. Last-write-wins, small payload |
| `submitAttempt`* | `{ attemptId, answers, clientSubmitId }` | Row lock, grade, rating, mistakes, one tx. Idempotent |

\* The runner calls these two through **route handlers** (`POST /api/attempts/[id]/save`, `POST /api/attempts/[id]/submit`) instead of Server Actions. Plain JSON endpoints are simpler for the offline retry queue, work with `sendBeacon`/`keepalive`, and can be driven by k6 in the load test. Both route handlers call the same service functions in `features/attempts/service.ts`.
| `checkPracticeAnswer` | `{ attemptId, index, answer }` | Practice mode only; returns correctness + correct answer for that one item |
| `startReviewPractice` | `{ count, chapter?, types? }` | Builds a `review` attempt from open mistakes |

### `features/ai/actions.ts`
| Action | Notes |
|---|---|
| `explainQuestion({ attemptId, index })` | Owner, submitted; cache first; rate limits (see 09). **As built (S7-02): a route handler, `POST /api/ai/explain` (§3), so the text can stream** |
| `voteExplanation({ hash, vote })` | One vote per user per explanation (`explanation_votes`). As built (S7-02): `requireStudent()`, Zod (`hash` 64 hex, `vote` `up` / `down` / `null` to clear), 60 per 10 min per user, then one transaction: lock the explanation (`NOT_FOUND` if missing), upsert or delete the vote, move `votes_up/votes_down` by the difference. Returns `{ votesUp, votesDown, vote }`. No cache tag: explanations are read per request |

### `features/lessons/admin-actions.ts` (admin)
`saveDraft`, `publish`, `unpublish`, `archive`, `duplicate`, `deleteLesson` (soft delete if it has attempts), `reorder({ ids[] })`, `createUploadUrl({ contentType, bytes })`, `generateDescription`, `suggestTags`, `pregenerateExplanations`.

As built (S5-01): the list actions are `reorder({ ids })`, `duplicate(id)`, `archive(id)`, `restore(id)` and `deleteLesson(id)`. Each runs `requireAdmin()`, Zod, then one transaction in `admin-service.ts` that also writes its `audit_log` row (`lesson.reorder`, `lesson.duplicate`, `lesson.archive`, `lesson.restore`, `lesson.delete` with `{ soft }`), then `updateTag` for what students can see (`lessons` for order/status; `lesson:{id}` for status; `:public`/`:answers` too on a hard delete) and `refresh()` for the uncached admin list. `reorder` takes every lesson not deleted in the new order and refuses a stale list (`CONFLICT`), so orders written from two tabs never interleave; it rewrites `sort_order` as 0…n−1. `duplicate` copies metadata, config and the draft (else published) content into a new draft placed right below the source. `restore` brings an archived lesson back as a draft. `/admin/lessons` itself reads `getAdminLessons({ q, status })` (`admin-queries.ts`) per request, uncached, with the same accent-insensitive search as the catalog.

As built (S5-02): there is no `/admin/lessons/new` page. "Tạo bài mới" on the list is the form action `createLesson()`: it inserts an empty draft (default config, last in the order, `lesson.create` audit row) and redirects to `/admin/lessons/[id]/edit`, so the editor always works on a saved row. The editor page reads `getLessonForEditing(id)` (per request, admin only): metadata, config, and the draft's source text and questions, else the published version's. `renderTexBatch([{ tex, display }])` (≤ 300 formulas, ≤ 5,000 characters each) returns KaTeX HTML for the live preview, so KaTeX stays on the server (06 §4).

As built (S5-03): `saveSettings({ id, form })` saves the "Cài đặt" tab: title, description, grade, chapter, tags and `LessonConfig`. The form travels as its raw input values (`SettingsFormSchema`), and the server runs the same pure `fromSettingsForm` as the browser, with the pool checked against the question counts of the version attempts use (published, else draft). Invalid input returns `VALIDATION` with `fieldErrors` per field. Metadata and config are not versioned, so they apply at once, also on a published lesson; attempts in progress keep their items and points (fixed at start). The service recomputes `question_count`/`type_counts` from the published version under the new pool, writes `lesson.settings` to the audit log, and the action invalidates `lessons` and `lesson:{id}`.

As built (S5-04): `saveDraft({ id, sourceText })`, `publish({ id, sourceText? })`, `unpublish(id)` and `discardDraft(id)` (`content-service.ts`, versioning in 04 `lesson_versions`). The browser sends only the text (≤ 300,000 characters); the server parses it itself with the lesson's previous questions, so ids and answers never come from the client. `saveDraft` returns `{ unchanged, errors }` (no write when there is no draft and the text equals the published one) and changes no shared tag. `publish` checks the text (no parse errors, ≥ 1 question, the pool fits: `VALIDATION` with a message otherwise), saves it as the draft and promotes it in one transaction, recomputes the card counts, and invalidates `lessons`, `lesson:{id}`, `lesson:{id}:public` and `lesson:{id}:answers`. Without a draft (or with the published text itself) it only sets the status back to published. Archived lessons are refused (`CONFLICT`). `unpublish` sets `draft` (attempts in progress can still submit) and invalidates `lessons` + `lesson:{id}`. Audit actions: `lesson.save_draft`, `lesson.publish` (`{ versionId, version, replaced, retired }`), `lesson.unpublish`, `lesson.discard_draft`.

As built (S5-05): `createUploadUrl({ contentType, bytes, width, height })` lives in `features/media/actions.ts`: admin only; `image/webp|png|jpeg`, ≤ 2 MB, ≤ 1280 px (the browser has already resized); rate limit 60 per 10 min per admin; `STORAGE_UNAVAILABLE` when `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` are missing or signing fails, `STORAGE_FULL` over the quota. It returns `{ path, uploadUrl }`, a one-time Supabase signed upload URL (`POST /storage/v1/object/upload/sign/media/{path}` with the service key); the browser `PUT`s the bytes there with `cache-control: max-age=31536000` and `x-upsert: false`. `setCover({ id, path | null })` sets `lessons.cover_path` (live, audit `lesson.cover`, invalidates `lessons` + `lesson:{id}`).

### `features/students/admin-actions.ts`
`approve({ ids })`, `reject({ ids })`, `resetPassword(id)` → returns a temp password once, `revokeSessions(id)`, `setStatus({ id, status })`, `deleteStudent({ id, confirmName })` (cascades; audit), `grantExtraAttempts({ userId, lessonId, extra })`, `createAdmin({ fullName, username, password })`. There is no "reset device" (no device binding, 01 §7).

As built (S6-01/02): every action runs `requireAdmin()`, Zod (`domain/input.ts`, ids are `z.uuid()`), then one transaction in `admin-service.ts` with its audit row, then tags and `refresh()`. They only touch `role = student` rows (`createAdmin` excepted), so an admin can never act on their own account or another admin (`FORBIDDEN` for oneself, `NOT_FOUND` for other admins). Audit `data` holds ids and counts only; never a name, phone or password.
- `approve`/`reject` take 1–200 distinct ids and move only `pending → active` (sets `approved_at/by`) / `pending → rejected`; the rest are skipped and counted (`{ done, skipped }`). One audit row per student (`student.approve`, `student.reject`). Invalidate `pendingStudents` (the nav badge).
- `resetPassword`: a 10-character temporary password (crypto random, alphabet without 0/O/1/l/I, a letter and a digit, accepted by the policy for that phone), bcrypt-hashed before the transaction opens, `must_change_password = true`, every session of the student deleted. It is returned once and shown in a dialog with a copy button; it is never stored, logged or audited (`student.reset_password` has only the count of revoked sessions).
- `revokeSessions` (`student.revoke_sessions`, `{ count }`); `setStatus` moves `active → disabled` (also revokes sessions) and `disabled|rejected → active` (a rejected student enabled later is stamped approved); anything else is `CONFLICT`. Audit `student.disable` / `student.enable`. Invalidates `leaderboard`.
- `deleteStudent`: the teacher types the student's name (`confirmName`, compared without case or extra spaces; mismatch → `VALIDATION` with `fieldErrors.confirmName`, nothing deleted). One transaction: lock the row, count their attempts, delete the user (attempts, ratings, rating events, mistakes, sessions and overrides cascade), recompute `lessons.attempt_count` for the lessons they had submitted attempts on, audit `student.delete` `{ attempts, lessons }`. Invalidates `pendingStudents`, `leaderboard` and, when counts changed, `lessons`. No `refresh()` (the detail page no longer exists); the client navigates to the list.
- `grantExtraAttempts`: `extra` 1–100 upserts the `attempt_overrides` row (a new grant replaces the old one, `granted_by` set), `extra: 0` removes it; the lesson must exist and not be deleted. Audit `student.grant_attempts` / `student.revoke_attempts` `{ lessonId, extra }`. Nothing shared is cached (overrides are read when an attempt starts).
- `createAdmin`: username unique and lowercase (`CONFLICT` with `fieldErrors.username`), password policy of 06 §1, status `active`. Audit `admin.create`. Its form is on `/admin/settings` (S6-03).

Pages: `/admin/students?view=pending|all&q=&status=&grade=&page=` (default `pending`: the queue, oldest first, up to 200, a checkbox per row, "Chọn tất cả", bulk Duyệt / Từ chối with a confirm; `all`: accent-insensitive name words or a phone prefix, status and grade chips, cumulative "Xem thêm" by 50, `prefetch={false}` on rows) and `/admin/students/[id]` (profile with phone and birth date, rating, action panel, extra tries, sessions with a short device name and IP, latest 50 attempts linking to `/attempts/[id]/result`). Both read per request without caching (`admin-queries.ts`); only the pending count behind the nav badge is shared-cached (`getPendingCount`, tag `pendingStudents`, invalidated by `register`, `approve`, `reject` and `deleteStudent`). `/change-password` (auth layout) is the page of `changePassword`.

### `features/attempts/admin-actions.ts`
`deleteAttempt(id)`: deletes the attempt and its rating event, then recomputes that student's rating by replaying rating events in order (cheap: tens to hundreds of rows).

As built (S6-04): `requireAdmin()`, the id (`z.uuid()`), then one transaction in `attempts/admin-service.ts`: lock the attempt, then the student's `ratings` row; delete the attempt (its `rating_events` row cascades); replay the remaining events (04 `rating_events`), rewriting only the events whose `before/delta/after` change and the `ratings` row (deleted when no event is left); `lessons.attempt_count − 1` for a submitted attempt (never below 0); audit `attempt.delete` `{ userId, lessonId, status, rated }`. Any status can be deleted (an in-progress or expired attempt has no rating event, so the rating is untouched). Mistakes stay as they are. Returns `{ userId, lessonId, status, rated }` and invalidates `leaderboard` when a rating changed and `lesson:{id}:stats` (`tags.lessonStats`, S6-05) for a submitted attempt; no `refresh()`, the client goes to `/admin/results`. Acceptance (`attempts/admin-service.test.ts`): three rated attempts, delete the middle → rating, peak, count and every remaining event equal a second student who took only the other two; also the first, the last, an in-progress and a not-rated attempt.

Pages (S6-04): `/admin/results?lesson=&q=&from=&to=&page=` (`attempts/admin-queries.ts`, per request, uncached): students' submitted attempts (admins' own tries are left out), newest first, cumulative "Xem thêm" by 50 (at most 20 steps; one extra row says "more", no `count(*)`). Filters in the URL, parsed by the pure `parseResultsParams` (invalid → no filter): a lesson select (every lesson, deleted ones marked), accent-insensitive student-name words (the `users_full_name_trgm_idx` expression), and a date range in Vietnam days (`from` 00:00 +07 inclusive to the day after `to`, swapped if reversed). Each row: the student (link to `/admin/students/[id]`), class and grade, lesson (or "Ôn tập cá nhân"), score /10, time taken, submitted at (Vietnam time), a guard-event count badge and "Xem bài" (`/attempts/[id]/result`); `prefetch={false}` on every row link. `/attempts/[id]/result` shows admins the exam-guard timeline (mm:ss since the start, Vietnamese label, icon, "no events" state; `guardTimeline` in `attempts/domain/guard.ts`) instead of the raw JSON, and "Xóa bài làm" behind a confirm dialog.

### `features/settings/actions.ts`
`updateSettings(partial)` (admin), `updateMyProfile`, `uploadAvatar` (signed URL), `requestDeletion`, `exportMyData` (returns JSON download).

As built (S6-03): `updateSettings(partial)` runs `requireAdmin()`, then `SettingsPatchSchema` (`settings/domain/settings.ts`: any of `registrationOpen`, `singleSession`, `aiEnabled` booleans, `aiDailyBudget` an integer 0–5000, `announcement` plain text cleaned to one line and ≤ 300 characters, empty → `null`; unknown keys refused; `VALIDATION` with `fieldErrors` per field). The service locks row 1, writes only the keys whose value changes plus `updated_by/at`, and audits `settings.update` `{ changed: [keys] }` in the same transaction; nothing changed → no write, no audit. Then `updateTag(settings)` and `refresh()`. Returns `{ changed }`. Every login and registration reads `getSettings()` (tag `settings`), so a new policy applies from the next login or registration (integration test in `settings/service.test.ts`); the student layout shows the announcement. There is no device policy and no rating-formula setting (01 §7). `/admin/settings` shows the form (the settings from the shared cache), the admin accounts (name, username, last login; `getAdmins()`, per request) and "Thêm quản trị viên", which calls S6-02's `createAdmin`: the new admin logs in with the password the creating admin set (not forced to change it). These admin actions live in `settings/actions.ts`, listed by name in `auth/authz.test.ts`; the student settings actions above will get their own file.

## 3. Route Handlers
| Method & path | Purpose | Auth |
|---|---|---|
| `POST /api/attempts/[id]/save` | Autosave (fetch with `keepalive`, or `sendBeacon` on `pagehide`). Body `{ answers, flagged, guardEvents? }` (the whole answer state plus exam-guard events not yet sent, which only append; ≤ 16 KB, any content type since beacons post `text/plain`). One guarded `UPDATE … WHERE id AND user_id AND status='in_progress' AND deadline_at + 30 s ≥ now AND jsonb_array_length(items) = n`; only a miss runs a second read to say why. Returns `Result` JSON: 200 `{ savedAt }`, 401, 403 (origin), 404 (missing or not yours), 409 `ATTEMPT_CLOSED`/`DEADLINE_PASSED`, 400 `VALIDATION`. No rate limit: the client syncs at most every 30 s and the write is one small UPDATE | Session cookie + owner check + same-origin (`lib/same-origin.ts`: `Origin`, else `Sec-Fetch-Site`) |
| `POST /api/attempts/[id]/submit` | Submit and grade; returns `{ resultUrl, score, maxScore, score10, alreadySubmitted, late }`. Body `{ answers, flagged, clientSubmitId }`. One pre-read (attempt ⋈ lesson config) and the cached `getLessonWithAnswers` run outside the transaction; then `SELECT … FOR UPDATE`, re-check `status`, grade with the pure `grade()`, store `answers/earned/score/score10/submitted_at/time_taken_sec/client_submit_id`, and bump `lessons.attempt_count`. An already-submitted attempt returns its stored result (`alreadySubmitted: true`), so retries and parallel submits are idempotent. After `deadline_at` + 30 s the request is still accepted but graded with the last saved answers (`late: true`); `time_taken_sec` is capped at the limit. Rating and mistakes join this transaction in S4-01/S4-02 | Session cookie + owner check + same-origin |
| `POST /api/ai/explain` | S7-02. Body `{ attemptId, index }` (≤ 1 KB). Refused unless the attempt is mine (or I am an admin), submitted, and its lesson's `revealAnswers` allows answers now (the result page's `revealFor`): otherwise 404 / 403 before anything is read or generated; a question with a teacher explanation is 400. Then a stored explanation for the question hash → 200 `text/plain` with the whole text (`X-Explanation: cached`, costs nothing). Otherwise the student limit (20 misses a day, admins exempt; 429 `AI_QUOTA` with its own message), the gate (kill switch → 503 `AI_UNAVAILABLE`, global budget → 429 `AI_QUOTA`) and a Gemini stream → 200 `text/plain` chunks (`X-Explanation: generated`); the body errors if generation fails midway. The response ends after the text is stored (only when complete), so the page refreshes straight into the rendered version. If the browser leaves mid-stream, the server keeps reading and stores the text. `maxDuration = 60` | Session cookie + same-origin; refused while `must_change_password` |
| `POST /api/ai/import` | Streams Gemini output (text/plain chunks) for PDF/DOCX/image import. `maxDuration = 300` | Admin |
| `GET /api/cron/daily` | Expire stale attempts, prune sessions/rate_limits/versions, keep Supabase awake, compute quota snapshot | `Authorization: Bearer ${CRON_SECRET}` |
| `GET /api/health` | `select 1` + version | Public, no cache |
| `GET /lessons/by-legacy/[legacyId]` etc. | Legacy lookups → 308 | Public |
| `GET /admin/results/export` | CSV of `/admin/results` with the same query (`lesson`, `q`, `from`, `to`), newest first, at most 10,000 rows (`X-Export-Truncated: true` when there were more). As built (S6-04): the session is checked first and answers JSON, never a redirect (401 `UNAUTHENTICATED` signed out, which `proxy.ts` lets through for this path; 403 `FORBIDDEN` for a student or an admin who must change the password). The body is built by the pure `resultsCsv`/`toCsv` (`attempts/domain/csv.ts`): UTF-8 BOM, RFC 4180 (comma, CRLF, quotes doubled), formula-injection guard, `.` decimals. Columns: Họ tên, Lớp, Khối, Bài, Điểm (/10), Điểm, Tối đa, Thời gian (giây), Nộp lúc (Vietnam time), Cảnh báo (guard events); never the phone or date of birth. `Content-Disposition: attachment; filename="ket-qua-YYYY-MM-DD.csv"` (Vietnam date), `Cache-Control: private, no-store`. The "Xuất CSV" link on the page carries the current filters | Admin (session cookie) |

## 4. Query functions (reads)
Grouped by feature. Each one is either **shared-cached** (C) or **per-request** (R).

| Function | Kind | Used by |
|---|---|---|
| `getCatalog(filters)` | C `lessons` | `/lessons`, dashboard |
| `getMyLessonProgress(userId)` | R | `/lessons` (merged client-side with the catalog) |
| `getLessonMeta(id)` | C `lesson:{id}` | overview, share |
| `getLessonForTaking(versionId)` | C `lesson:{id}:public` | runner |
| `getLessonWithAnswers(versionId)` | C `lesson:{id}:answers`, **server-only** | grading, result page |
| `getAttempt(id, userId)` | R | runner, result |
| `getLeaderboard({ grade, period })` | C `leaderboard`, 60 s | leaderboard, dashboard rank |
| `getMyStats(userId)` | R | profile, dashboard (split into `getDashboardStats` + `getContinueAttempt` in S4-06) |
| `getMistakes(userId, filters)` | R | review |
| `getLessonStats(lessonId, versionId, tfScoring)`, `getStatsVersions(lessonId)` | C `lesson:{id}:stats` (`tags.lessonStats`, invalidated by `deleteAttempt`), `cacheLife({ stale: 60, revalidate: 300, expire: 600 })`; a submit does **not** invalidate, so the page lags by up to 5 minutes. Only the computed result is cached (pure `computeLessonStats`), not the attempt rows | `/admin/lessons/[id]/stats` (S6-05); the header `getStatsLesson(id)` is R (one primary-key read) |
| `getResults(filters)`, `getResultsForExport(filters)` | R | `/admin/results`, CSV export (S6-04) |
| `getAdminOverview()` | C `adminOverview` (invalidated by `deleteAttempt`), `cacheLife({ stale: 60, revalidate: 300, expire: 600 })`; one SQL statement (both time windows are range scans of `attempts_submitted_idx`; hardest questions via `jsonb_array_elements(items) WITH ORDINALITY` × `earned[ord]` and the item's `p`) | `/admin` (S6-06), with the nav badge's cached `getPendingCount()` |
| `getSettings()` | C `settings` | everywhere |

## 5. Error codes (returned by actions, mapped to Vietnamese messages in `src/lib/messages.ts`)
`UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION`, `RATE_LIMITED`, `INVALID_CREDENTIALS`, `ACCOUNT_PENDING`, `ACCOUNT_REJECTED`, `REGISTRATION_CLOSED`, `ATTEMPT_CLOSED`, `ATTEMPT_LIMIT`, `DEADLINE_PASSED`, `AI_UNAVAILABLE`, `AI_QUOTA`, `CONFLICT`, `INTERNAL`.
