# 00 — Current System Audit (v1)

Sources: the `../onluyenvatly` repo (166 commits, ~81k lines) and the live site `onluyenvatly.vercel.app`, inspected 2026-09-28.

## 1. Snapshot

| Metric | Value |
|---|---|
| Lessons (landing counter) | 170 |
| Registered students | 291 |
| Hosting | Vercel, function region `sin1` (Singapore), edge `hkg1` |
| Server | Express 4, one Vercel function. `vercel.json` rewrites `/(.*)` to `/api`, `maxDuration: 300` |
| DB | Supabase Postgres (`supabase-js` with the service-role key, plus a `pg` pool used only for sessions) |
| Storage | Supabase Storage bucket `lesson-images` |
| AI | Google Gemini `gemini-2.5-flash` (text), Pollinations (images) |
| Frontend | 33 HTML views, 36 vanilla JS files, 12 CSS files (`style.css` alone is 6,656 lines); Font Awesome and KaTeX from CDNs |
| Landing page perf (warm) | TTFB ≈ 320 ms, DOMContentLoaded ≈ 1.2 s, load ≈ 2.1 s |

## 2. Feature inventory

Legend: **Keep**, **Redesign** (keep the intent, change the implementation), **Drop**.

### Student side
| Feature | v1 location | v2 decision |
|---|---|---|
| Register with phone, name, DOB and password; waits for teacher approval | `routes/auth.js`, `student-register.html` | Keep |
| Login with phone and password | `authService.authenticateStudent` | Keep (existing bcrypt hashes stay valid) |
| Device binding (one approved device per student) | `approved_device_id`, `device-id.js`, `fp.min.js` fingerprint | **Drop** (owner decision) |
| Single active session per student | `terminateExistingSessions` | Keep (configurable) |
| Lesson catalog: search, grade/subject/tag filters, sort, pagination | `lessons.html`, `lessons.js`, RPC `search_lessons` | Redesign |
| Take a lesson test: MCQ (`abcd`), 4-statement true/false (`truefalse`), short numeric (`number`) | `lesson.html` (3,185 lines) + `lesson.js` | Redesign: new quiz runner, **server grading** |
| Timer, auto-submit, warnings, shuffle questions/answers, question pool with type distribution, points distribution | lesson columns `time_limit_*`, `shuffle_*`, `question_pool_size` … | Keep |
| Exam guard (tab-switch flags) | `exam_guard_flags` on results | Keep |
| Rating update on zero scores | v1 skips it | Apply it (ADR-004) |
| Copy / right-click blocking on all non-admin pages | Script injected into every HTML response in `api/index.js` | Redesign: apply only inside an active test |
| Result page with per-question review | `result.html` (1,446 lines) | Redesign |
| AI "explain this answer" | `POST /api/explain` | Redesign: cache per question |
| ELO-style rating, rating history, tiers (Bronze→Master) | `ratingService.js` | Keep, computed server-side, with the >5-minute time-bonus bug fixed (owner decision, ADR-004) |
| Leaderboard | `leaderboard.html` | Redesign |
| Profile: stats, history, rating chart | `profile.html` | Redesign |
| Review mistakes, personalized practice from mistakes | `review-mistakes.html`, `personalizedQuizService.js` | Keep |
| Practice mode | `practice.html` | Merge into "Ôn tập" (review) |
| Quiz game (`quizzes.main_quiz`, timed points, sound effects) | `quizgame.html` | **Drop** (owner decision) |
| Study materials (grade 10/11/12 theory) | `materials/*.json` + HTML, `study-materials.html` | Redesign as static MDX pages |
| Gallery of lesson handouts (22 JPGs) | `gallery.html` | Keep as a static page |
| Public share page for a lesson (OG preview) | `/share/lesson/:id` | Keep |
| Settings: avatar, privacy, devices, export data, delete request, logout-all | `settings.html` (860 lines) | Keep a smaller set |

### Admin side
| Feature | v1 | v2 |
|---|---|---|
| Lesson list: reorder, duplicate, delete, search | `admin-list.html` + 1.5k-line JS | Redesign |
| Lesson editor with a text format (`Câu 1:` / `A.` / `*B.` / `a)` / `Answer:` / `[2 pts]`), live preview, image paste | `admin-new-v2.js` (2,470 lines) | Keep the text format, rebuild the editor |
| Lesson configuration (time limit, pool, points, shuffle) | `admin-configure.html` | Merge into the editor as a "Settings" tab |
| AI: PDF/DOCX → lesson text (streamed) | `aiService.formatDocumentWithAI`, `processImagePdfWithAI` | Keep |
| AI: summary, tag suggestions, lesson analysis, chat assist | `routes/ai.js` | Keep summary and tags. Chat assist and analysis are P2 |
| AI image generation (Pollinations) + stock fallback | `imageGenerationService.js` | P2 |
| Student management: approve/reject, delete, reset password, unbind device | `admin-students.html` | Keep (without device unbinding) |
| Results history | `history.html` | Keep |
| Lesson statistics: per-question wrong-option analysis, which students got it wrong | `lesson-statistics.js`, `getLessonDetailedStatistics` | Keep |
| Dashboard stats | `/api/admin/dashboard-stats` | Keep |
| Adaptive quiz builder (reuse questions from recent lessons) | `adaptiveQuizService.js` | P1 |
| Encryption toggle (`system_settings`) | `adminEncryptionController.js` | Drop |

### Dead or misleading
- The landing page advertises **XP, achievements, streaks, leagues and quests**. Those routes were removed ("remove useless feature"), and the README still documents them. v2 advertises only features that exist.
- `routes/debug.js`, `routes/test-auth.js` (a test auth bypass), `routes/webhooks.js`, `GET /api/clear-cache`, legacy editor `admin-edit.html`, `streak-widget.js`, `activity-feed.js`: **Drop**.
- Tables `temp_lesson_content`, `quiz_results` and `ai_interactions`: check their row counts during migration, then archive or drop them.

## 3. Problems found

### 3.1 Security and integrity (critical)

| # | Finding | Evidence | Impact |
|---|---|---|---|
| S1 | **The server trusts client-computed scores.** `submitResult` adds up `answer.earnedPoints` and `answer.points` from the request body. | `lib/controllers/resultController.js:21-29` | Any student can POST a perfect score. That corrupts rating, leaderboard and statistics. |
| S2 | **Correct answers are public.** `GET /api/lessons/:id` uses `optionalAuth` and returns every question with `correct`. Confirmed on production without logging in (the response contained `"correct":"B"`). | `routes/lessons.js`, `databaseService.getLessonById` | Every test can be read, answer key included, by anyone. |
| S3 | The "end-to-end encryption" hands its key to the same browser (`POST /api/encryption/init`), and it is currently switched off in production. | `routes/encryption.js`, `system_settings` | It adds complexity and doesn't protect anything. |
| S4 | The admin account is a hard-coded username and bcrypt hash in source. There is one shared admin and no audit trail. | `lib/config/constants.js:10-14` | You have to edit code to rotate credentials, and there's no way to add a second teacher. |
| S5 | Fallback secrets live in code: `SESSION_SECRET` defaults to `'fallback-secret-replace-me!'`, and the Supabase URL and anon key are hard-coded. | `lib/config/session.js`, `lib/config/database.js` | A misconfigured deploy runs with a known session secret. |
| S6 | All DB access uses the **service-role key**, which bypasses row-level security. | `lib/config/database.js` | One bug in a query can leak any row. |
| S7 | A test auth bypass ships in the production bundle. It is gated by env, but it's still there. | `lib/middleware/testAuth.js`, `routes/test-auth.js` | Risk of a misconfigured env. |

### 3.2 Performance and cost
- **Every page and API call runs through one Express function** (`X-Powered-By: Express`). Pages that could be static, such as the landing page and materials, still pay for a function invocation and a cold start.
- Static assets are served from the CDN but with `cache-control: public, max-age=0, must-revalidate`, so browsers revalidate every CSS, JS and image file on every visit.
- In-memory caches (`cacheService`, `aiCacheService`) don't survive serverless instances. Hit rates are low and results are inconsistent across instances.
- The `pg` pool is set to `max: 20` connections **per function instance**. That's the wrong pattern for serverless and can exhaust Supabase connections under load.
- Every lesson page loads Font Awesome (~100 KB CSS and fonts) and KaTeX from third-party CDNs, and KaTeX renders on the client.
- `results.questions` stores a full copy of every answered question (question text, all options, answer text) for **every attempt**. That's the main way the 500 MB free DB fills up.
- Lesson IDs are `Date.now().toString()`. They aren't sequential across tables and they collide if two lessons are created in the same millisecond.

### 3.3 Maintainability
- A `columnMapper` translates between camelCase and snake_case by hand in many places, and the column names are mixed (`created`, `last_updated`, `timestamp`, `lessonImage`/`lesson_image`).
- `databaseService.js` is 2,961 lines. There are no types and no schema in the repo (tables were created by hand in the Supabase dashboard).
- `README.md` documents routes that no longer exist.
- There are 5 tests (unit tests for the quiz services plus one encryption test). Grading, the main business logic, lives in inline `<script>` in `lesson.html` and has no tests.
- Numeric answers are compared as exact strings (`userAnswer === correctAnswer`), so `1,5` ≠ `1.5` and `2.50` ≠ `2.5`. That is a real source of wrong marks for Vietnamese students, who write decimals with a comma.

### 3.4 UX
- The dark purple glassmorphism look has low contrast on secondary text, dense cards and emoji/icon clutter.
- There are 4 separate login pages (`/login`, `/student/login`, `/admin/login`, and a register page served on two URLs).
- Copy-blocking and disabled text selection on every page hurt accessibility and irritate honest users.
- The mobile nav and the quiz layout aren't designed for one-handed use on phones, which is how most students take tests.
- There's no offline tolerance. A network blip at submit time can lose a whole test.

## 4. Business rules to preserve exactly

These are the behaviours students and the teacher know. v2 must reproduce them, and they get unit tests (see 11).

1. **True/false (4 statements) partial credit.** 4 correct → 100 %, 3 → 50 %, 2 → 25 %, 1 → 10 %, 0 → 0 % of the question's points. This is the THPT 2025 format. If a question has ≠ 4 statements, score is proportional.
2. **Points distribution.** Per-type totals are split across questions to 2 decimals, with the remainder handed out 0.01 at a time so the sum is exact (`lib/utils/pointsDistributor.js`).
3. **Question pool.** When `enable_question_pool` is set and the pool is smaller than the question count, pick N questions per type using `question_type_distribution`, or proportionally if there's no distribution.
4. **Rating (ELO-like).** Start at 1500, K = 48, `expected = 1/(1+10^((1500−R)/400))`, `Δ = K·(perf − expected)·timeBonus·streakMult`, then ×2 if Δ > 0 and perf ≥ 0.8, ×1.5 if Δ < 0 and perf ≤ 0.5. Rounded. Tiers: ≥2000 Master, ≥1800 Diamond, ≥1600 Platinum, ≥1400 Gold, ≥1200 Silver, otherwise Bronze.
   - ⚠️ v1 bug: `timeBonus = max(0, 1 − timeTaken/300)` with time in **seconds**. Any test longer than 5 minutes therefore gives **Δ = 0**, and v1 also skips the rating update when `score = 0`. **Owner decision: fixed in v2** (the new time bonus is in ADR-004). Everything else in this rule is unchanged.
5. Students need **teacher approval** before they can log in.
6. Scores are rounded to 0.01.
7. Mistake IDs are `<resultId>_<questionIndex>`. v2 replaces them with `(attempt_id, question_id)`.
