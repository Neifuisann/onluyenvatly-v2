# 01 — Product Requirements

## 1. Vision

A fast, calm, phone-first place where Vietnamese high-school students **practise physics in the THPT exam format**, get instant and trustworthy marks, understand their mistakes, and see their progress. The teacher gets an efficient way to publish tests and see where the class struggles.

## 2. Goals and non-goals

### Goals
| ID | Goal | Measure |
|---|---|---|
| G1 | Zero running cost | $0/month on Vercel Hobby + Supabase Free + Gemini free tier, with ≥40 % headroom on every quota (see 08) |
| G2 | Fast | p75 LCP < 1.8 s on a mid-range Android over 4G; test start < 500 ms p95 server time (see 08) |
| G3 | Capacity | 100 concurrent students taking a test with p95 < 800 ms and 0 errors (k6 test, see 11) |
| G4 | Trustworthy results | Scores computed only on the server; answers never sent before submit |
| G5 | Modern UX | Single design system, WCAG 2.2 AA contrast, usable one-handed on a 360 px wide phone |
| G6 | Maintainable | TypeScript end to end, schema in repo, ≥80 % unit coverage on grading and rating |
| G7 | Lossless migration | Every v1 student, lesson, result and rating carried over; students keep their passwords |

### Non-goals (v2.0)
- Payments, paid content or ads. The site is non-commercial (owner decision), which keeps it within Vercel Hobby terms; see ADR-001.
- Device binding (owner decision).
- Native mobile apps. The site will be an installable PWA instead.
- ~~Real-time multiplayer quiz game.~~ Reversed on 2026-10-06: class races in game rooms (R10, B-05, ADR-008), student-paced with bounded polling rather than a realtime service.
- Multi-tenant or multiple schools. There is one teacher organisation, though several admin/teacher accounts are supported.
- XP, badges, leagues, quests. Removed in v1; could come back after launch as P3.

## 3. Personas

| Persona | Context | Needs |
|---|---|---|
| **Học sinh (student)**, grade 10–12, ~300 users | Budget Android phone, mobile data, often studies at night, takes 15–50 minute tests | Start a test quickly; not lose answers; see score and mistakes right away; know their rank |
| **Giáo viên (teacher/admin)**, 1–3 users | Laptop, writes tests from Word/PDF, often late at night before class | Paste or import a test in minutes; approve students; see which questions the class got wrong |
| **Visitor** | Parent or prospective student from a shared link | Understand what the site is; see a lesson preview; register |

## 4. Functional requirements

Priority: **P0** is required for launch (parity with v1 plus the fixes), **P1** is needed shortly after launch, **P2** is later or depends on usage data.

### 4.1 Accounts & access
| ID | Requirement | P |
|---|---|---|
| A1 | A student registers with full name, phone (VN format), date of birth and password (≥ 8 chars). The account starts as `pending`. | P0 |
| A2 | Admin approves or rejects pending students. A rejected account cannot log in. | P0 |
| A3 | Login with phone and password on one page. The role is detected automatically; admins log in with the same form (username or phone). | P0 |
| A4 | Existing v1 passwords keep working (bcrypt). | P0 |
| A5 | ~~Single-device binding~~: **dropped** (owner decision, §7). Students may log in from any device | — |
| A6 | Optional single active session: a new login revokes the student's other sessions. Global setting. | P0 |
| A7 | Change password; admin resets a password and gets a one-time temporary password. | P0 |
| A8 | Multiple admin accounts, created by an existing admin. | P1 |
| A9 | Logout; logout from all devices. | P0 |
| A10 | Rate limit on login and register (5 per minute per IP+phone, 20 per hour). | P0 |

### 4.2 Lessons (catalog)
| ID | Requirement | P |
|---|---|---|
| L1 | Catalog with search (accent-insensitive Vietnamese), filters for grade, subject/chapter and tags, and sorts: order, newest, popular, A–Z. | P0 |
| L2 | Each card shows title, grade, number of questions, time limit, the student's best score, and a "not done / done / in progress" state. | P0 |
| L3 | Lesson overview page: description, format (counts per question type), duration, attempts so far, and a "Bắt đầu làm bài" button. | P0 |
| L4 | "Continue where I left off" on the dashboard (last incomplete or in-progress attempt). | P0 |
| L5 | Lessons can be `draft`, `published` or `archived`. Only published lessons are visible to students. | P0 |
| L6 | Lessons are grouped into chapters or collections (e.g. "Dao động cơ"). | P1 |
| L7 | Public share page with an OG image and a preview of the first 2 questions without answers. | P1 |

### 4.3 Taking a test (quiz engine)
| ID | Requirement | P |
|---|---|---|
| Q1 | Starting a test creates an **attempt** on the server. The server picks questions (pool/distribution), fixes the order and option shuffle, and sets a deadline. | P0 |
| Q2 | The client gets question content **without answers**. | P0 |
| Q3 | Question types: MCQ (A–D, one correct), true/false with 4 statements (THPT scoring), short numeric answer (comma or dot decimals, optional tolerance). Math via KaTeX, optional image per question and per option. | P0 |
| Q4 | Answers autosave to local storage on every change and sync to the server every 30 s and on page hide. A reload or phone lock resumes the attempt. | P0 |
| Q5 | Timer shows server-authoritative remaining time, warns at 5 min and 1 min, and auto-submits at 0. The server rejects answers after deadline + 30 s grace. | P0 |
| Q6 | Question navigator (grid showing answered, flagged, current), flag for review, and a confirmation listing unanswered questions before submit. | P0 |
| Q7 | Submit → the server grades, stores the attempt, updates rating, and returns the result. Submitting twice is safe (idempotent). | P0 |
| Q8 | Exam guard: record tab/app switches and fullscreen exits as flags on the attempt, shown to admin. Copy-blocking applies only in test mode. | P0 |
| Q9 | Practice mode: instant feedback after each question, no rating impact. | P1 |
| Q10 | Lesson settings: max attempts (default unlimited), show answers after submit (yes/no/after deadline), whether the attempt counts for rating. | P1 |

### 4.4 Results & learning
| ID | Requirement | P |
|---|---|---|
| R1 | Result page: score out of 10 (and raw points), time taken, rating change, and per-question review (your answer, correct answer, explanation). | P0 |
| R2 | "Giải thích bằng AI" per question. The answer comes from the DB cache if one exists, otherwise it's generated once and cached for everyone. | P0 |
| R3 | History of my attempts with score trend. | P0 |
| R4 | Mistakes bank: every wrong question, filterable by chapter and type, marked resolved when answered correctly twice later. | P0 |
| R5 | Personalized practice: build a 10–30 question practice set from my mistakes. | P0 |
| R6 | Leaderboard by rating with tiers; weekly "most improved"; filter by grade. | P0 |
| R7 | Profile: rating chart, accuracy by chapter and question type, streak of active days (computed, no gamification). | P1 |
| R8 | Theory materials for grade 10/11/12 as static pages (migrated from `materials/`). | P1 |
| R9 | Handout gallery. | P2 |
| R10 | **Game rooms** (B-05, ADR-008): the teacher opens a room from chosen lessons (random bank of 5–40 questions, a pace, the question types) and shows its PIN, link and QR; logged-in students join, pick a racer and race through the same bank in their own order with server-timed speed points, streaks and live standings; podium and the hardest questions at the end. Lessons whose answers are hidden are excluded; no rating or mistakes. Reverses §7 Q4 (owner request, 2026-10-06) | P2 |

### 4.5 Admin
| ID | Requirement | P |
|---|---|---|
| M1 | Lesson list: search, filter by status, drag to reorder, duplicate, archive, delete (with confirmation). | P0 |
| M2 | Editor: paste the **v1 text format**, get live parsed preview with KaTeX and inline validation (missing answer, duplicate options). Images by paste, drag or upload. | P0 |
| M3 | Settings tab: time limit, shuffle, pool size and type distribution, points per type, visibility, answer reveal. | P0 |
| M4 | Import from PDF/DOCX/image via Gemini, streamed into the editor as text in the same format. | P0 |
| M5 | Students: pending queue (approve/reject in bulk), search, reset password, revoke sessions, deactivate, delete. | P0 |
| M6 | Results: all attempts with filters (lesson, student, date), attempt detail including exam-guard flags, delete attempt (recomputes rating). | P0 |
| M7 | Lesson statistics: attempts, average, distribution, per-question % correct, wrong-option breakdown, list of students who chose each option. | P0 |
| M8 | Dashboard: active students (7 days), attempts per day, pending approvals, hardest questions this week. | P1 |
| M9 | AI helpers: generate description, suggest tags. | P1 |
| M10 | Adaptive quiz builder: create a lesson from questions in lessons of the last N days, weighted by class error rate. | P1 |
| M11 | Audit log of admin actions. | P1 |
| M12 | Export results to CSV/XLSX. | P1 |
| M13 | Global settings: single-session policy, registration open/closed, AI on/off, announcement banner. | P0 |

## 5. Non-functional requirements

| ID | Category | Requirement |
|---|---|---|
| N1 | Cost | $0/month. Hard rule: no feature ships if its steady-state usage uses more than 60 % of any free quota (see 08 §4). |
| N2 | Performance | Core Web Vitals "good" at p75 (LCP < 2.5 s, INP < 200 ms, CLS < 0.1). Targets are stricter: LCP < 1.8 s, JS < 150 KB gzipped on student pages. |
| N3 | Capacity | 100 concurrent test takers; burst of 100 submits within 10 s at the end of a timed class test. |
| N4 | Availability | Best effort (free tier). No single request path depends on a third party other than Vercel and Supabase. AI is optional and degrades gracefully. |
| N5 | Data durability | Nightly logical backup kept for 30 days (free tier has no backups; see 12). An in-progress attempt survives network loss. |
| N6 | Security | OWASP ASVS L1. No answer leakage before submit. Service key never reaches the browser. Rate limits on auth and AI. |
| N7 | Privacy | Collect only name, phone, DOB. Students can export their data and request deletion. Phone numbers are masked in public UI. |
| N8 | Accessibility | WCAG 2.2 AA; keyboard operable; KaTeX output keeps MathML for screen readers. |
| N9 | i18n | UI in Vietnamese only (strings kept in one module so English could be added later). Dates shown in `Asia/Ho_Chi_Minh`. |
| N10 | Browser support | Last 2 years of Chrome/Android WebView, Safari iOS 16+, Samsung Internet. |
| N11 | Observability | Error tracking and a daily quota check with alerts (see 12). |

## 6. Success metrics (first 60 days after launch)
- p75 LCP on `/lessons` and the test runner < 1.8 s (Vercel Speed Insights or web-vitals beacon).
- 0 incidents of lost test attempts.
- Teacher can publish a 40-question test from a PDF in < 10 minutes.
- Every free quota below 60 % usage.
- Student weekly active rate ≥ v1 baseline (measure v1 baseline in Sprint 0).

## 7. Owner decisions

| # | Question | Decision (2026-09-28) | Effect on the design |
|---|---|---|---|
| 1 | Does the site make money (paid lessons, ads, tutoring sales)? | **No, non-commercial** | Vercel Hobby is allowed. ADR-001 accepted as is. v1's `pricing` column is not migrated |
| 2 | Keep the v1 rating quirk (no change for tests > 5 min)? | **Fix it in v2** | v2 uses only the new formula (ADR-004). No formula toggle. Migrated ratings are copied unchanged |
| 3 | Device binding? | **No** | Device binding removed everywhere (no device cookie, no `approved_device_id`, no "reset device" action). Single active session (A6) stays |
| 4 | Quiz game? | **No, drop it**, then **reversed 2026-10-06**: the owner asked for Kahoot/Quizizz-style class races | v1’s game and its `quizzes`/`quiz_results` stay archived. R10 and B-05 are back as new game rooms (ADR-008), not a v1 port |
| 5 | Domain: keep `onluyenvatly.vercel.app` or buy one (≈ $10/year, the only optional cost)? | *Open* (not blocking; default is to keep the `.vercel.app` name) | — |
