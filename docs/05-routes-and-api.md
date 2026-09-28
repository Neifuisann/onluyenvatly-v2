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
| `/admin` | Dashboard |
| `/admin/lessons` | List, reorder, status filter |
| `/admin/lessons/new`, `/admin/lessons/[id]/edit` | Editor (tabs: Nội dung, Cài đặt, Xem trước, Thống kê) |
| `/admin/lessons/[id]/stats` | Lesson statistics |
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
| `login` | `{ identifier, password }` | Rate limit 5/min per IP+identifier. Checks status, device policy, single-session → creates session → redirect by role |
| `register` | `{ fullName, phone, dob, password, grade?, className? }` | Rate limit 3/hour/IP; `registration_open`; phone unique |
| `logout` | — | Deletes the current session |
| `logoutAll` | — | Deletes all of the user's sessions |
| `changePassword` | `{ current, next }` | Revokes other sessions |

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
| `explainQuestion({ attemptId, index })` | Owner, submitted; cache first; rate limits (see 09) |
| `voteExplanation({ hash, up })` | One vote per user per explanation (stored in a small `explanation_votes` table or a unique constraint) |

### `features/lessons/admin-actions.ts` (admin)
`saveDraft`, `publish`, `unpublish`, `archive`, `duplicate`, `deleteLesson` (soft delete if it has attempts), `reorder({ ids[] })`, `createUploadUrl({ contentType, bytes })`, `generateDescription`, `suggestTags`, `pregenerateExplanations`.

As built (S5-01): the list actions are `reorder({ ids })`, `duplicate(id)`, `archive(id)`, `restore(id)` and `deleteLesson(id)`. Each runs `requireAdmin()`, Zod, then one transaction in `admin-service.ts` that also writes its `audit_log` row (`lesson.reorder`, `lesson.duplicate`, `lesson.archive`, `lesson.restore`, `lesson.delete` with `{ soft }`), then `updateTag` for what students can see (`lessons` for order/status; `lesson:{id}` for status; `:public`/`:answers` too on a hard delete) and `refresh()` for the uncached admin list. `reorder` takes every lesson not deleted in the new order and refuses a stale list (`CONFLICT`), so orders written from two tabs never interleave; it rewrites `sort_order` as 0…n−1. `duplicate` copies metadata, config and the draft (else published) content into a new draft placed right below the source. `restore` brings an archived lesson back as a draft. `/admin/lessons` itself reads `getAdminLessons({ q, status })` (`admin-queries.ts`) per request, uncached, with the same accent-insensitive search as the catalog.

As built (S5-02): there is no `/admin/lessons/new` page. "Tạo bài mới" on the list is the form action `createLesson()`: it inserts an empty draft (default config, last in the order, `lesson.create` audit row) and redirects to `/admin/lessons/[id]/edit`, so the editor always works on a saved row. The editor page reads `getLessonForEditing(id)` (per request, admin only): metadata, config, and the draft's source text and questions, else the published version's. `renderTexBatch([{ tex, display }])` (≤ 300 formulas, ≤ 5,000 characters each) returns KaTeX HTML for the live preview, so KaTeX stays on the server (06 §4).

As built (S5-03): `saveSettings({ id, form })` saves the "Cài đặt" tab: title, description, grade, chapter, tags and `LessonConfig`. The form travels as its raw input values (`SettingsFormSchema`), and the server runs the same pure `fromSettingsForm` as the browser, with the pool checked against the question counts of the version attempts use (published, else draft). Invalid input returns `VALIDATION` with `fieldErrors` per field. Metadata and config are not versioned, so they apply at once, also on a published lesson; attempts in progress keep their items and points (fixed at start). The service recomputes `question_count`/`type_counts` from the published version under the new pool, writes `lesson.settings` to the audit log, and the action invalidates `lessons` and `lesson:{id}`.

### `features/students/admin-actions.ts`
`approve(ids[])`, `reject(ids[])`, `resetPassword(id)` → returns a temp password once, `resetDevice(id)`, `revokeSessions(id)`, `setStatus(id, status)`, `deleteStudent(id)` (cascades; audit), `createAdmin(...)`.

### `features/attempts/admin-actions.ts`
`deleteAttempt(id)`: deletes the attempt and its rating event, then recomputes that student's rating by replaying rating events in order (cheap: tens to hundreds of rows).

### `features/settings/actions.ts`
`updateSettings(partial)` (admin), `updateMyProfile`, `uploadAvatar` (signed URL), `requestDeletion`, `exportMyData` (returns JSON download).

## 3. Route Handlers
| Method & path | Purpose | Auth |
|---|---|---|
| `POST /api/attempts/[id]/save` | Autosave (fetch with `keepalive`, or `sendBeacon` on `pagehide`). Body `{ answers, flagged, guardEvents? }` (the whole answer state plus exam-guard events not yet sent, which only append; ≤ 16 KB, any content type since beacons post `text/plain`). One guarded `UPDATE … WHERE id AND user_id AND status='in_progress' AND deadline_at + 30 s ≥ now AND jsonb_array_length(items) = n`; only a miss runs a second read to say why. Returns `Result` JSON: 200 `{ savedAt }`, 401, 403 (origin), 404 (missing or not yours), 409 `ATTEMPT_CLOSED`/`DEADLINE_PASSED`, 400 `VALIDATION`. No rate limit: the client syncs at most every 30 s and the write is one small UPDATE | Session cookie + owner check + same-origin (`lib/same-origin.ts`: `Origin`, else `Sec-Fetch-Site`) |
| `POST /api/attempts/[id]/submit` | Submit and grade; returns `{ resultUrl, score, maxScore, score10, alreadySubmitted, late }`. Body `{ answers, flagged, clientSubmitId }`. One pre-read (attempt ⋈ lesson config) and the cached `getLessonWithAnswers` run outside the transaction; then `SELECT … FOR UPDATE`, re-check `status`, grade with the pure `grade()`, store `answers/earned/score/score10/submitted_at/time_taken_sec/client_submit_id`, and bump `lessons.attempt_count`. An already-submitted attempt returns its stored result (`alreadySubmitted: true`), so retries and parallel submits are idempotent. After `deadline_at` + 30 s the request is still accepted but graded with the last saved answers (`late: true`); `time_taken_sec` is capped at the limit. Rating and mistakes join this transaction in S4-01/S4-02 | Session cookie + owner check + same-origin |
| `POST /api/ai/import` | Streams Gemini output (text/plain chunks) for PDF/DOCX/image import. `maxDuration = 300` | Admin |
| `GET /api/cron/daily` | Expire stale attempts, prune sessions/rate_limits/versions, keep Supabase awake, compute quota snapshot | `Authorization: Bearer ${CRON_SECRET}` |
| `GET /api/health` | `select 1` + version | Public, no cache |
| `GET /lessons/by-legacy/[legacyId]` etc. | Legacy lookups → 308 | Public |
| `GET /admin/results/export` | CSV stream | Admin |

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
| `getLessonStats(lessonId)` | C `lesson:{id}:stats`, 5 min | admin stats |
| `getSettings()` | C `settings` | everywhere |

## 5. Error codes (returned by actions, mapped to Vietnamese messages in `src/lib/messages.ts`)
`UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION`, `RATE_LIMITED`, `INVALID_CREDENTIALS`, `ACCOUNT_PENDING`, `ACCOUNT_REJECTED`, `REGISTRATION_CLOSED`, `ATTEMPT_CLOSED`, `ATTEMPT_LIMIT`, `DEADLINE_PASSED`, `AI_UNAVAILABLE`, `AI_QUOTA`, `CONFLICT`, `INTERNAL`.
