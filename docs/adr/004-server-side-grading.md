# ADR-004: Server-authoritative attempts and grading; remove the client "encryption" layer

- **Status:** Proposed
- **Date:** 2026-09-28

## Context
In v1:
1. The browser receives every question **with its correct answer** (`GET /api/lessons/:id`, even without login).
2. The browser computes `earnedPoints`, and `POST /api/results` adds up whatever the client sends.
3. An AES layer "protects" the payload, but the key is given to the same browser. It's currently disabled in production.

That makes scores, ratings, leaderboard and statistics forgeable, and answer keys public.

## Decision
- An **attempt** is created on the server when a test starts. It stores the chosen question IDs, the per-question option order, the seed, `started_at`, `deadline_at` and `lesson_version`.
- The student's page gets an **answer-stripped** view of those questions.
- On submit, the server grades using a pure function `grade(questions, answers, pointsPlan) → { perQuestion[], score, maxScore }` and stores the marks.
- Rating is updated in the same transaction using the v2 formula below.
- The **AES encryption layer, its key-exchange routes, the CSRF middleware and the `system_settings` toggle are removed.** Transport is HTTPS. Server Actions already check `Origin`, and cookies are `SameSite=Lax`.
- Exam integrity comes from: no answers before submit, server deadlines, exam-guard flags, per-student shuffles, and rate-limited attempt starts.

## Rating formula (owner approved 2026-09-28: fix in v2)
The v1 `timeBonus = max(0, 1 − timeTaken/300s)` makes any test longer than 5 minutes give **0 rating change**, and zero scores skip the update.

**v2 formula (the only one implemented):**
- `timeBonus = clamp(1 − 0.5·(timeTaken / timeLimit), 0.5, 1)`. With no time limit, `timeBonus = 1`.
- Rating is updated on zero scores too.
- Unchanged from v1: start 1500, K = 48, the expected-score formula, the ×2 (Δ > 0, perf ≥ 0.8) and ×1.5 (Δ < 0, perf ≤ 0.5) modifiers, rounding, and the tiers. The streak multiplier is fixed at 1, because v1 also always passed streak = 0.

There's no formula toggle. Migrated ratings and rating history are copied unchanged (history isn't recomputed). `rating_events.formula` records `'v1-legacy'` for migrated rows and `'v2'` for new ones.

## Consequences
- Answers can no longer be read before submit, and a forged submission can't produce a high score.
- Grading logic moves from inline HTML scripts to a tested TypeScript module.
- Numeric answers are compared numerically: accept `,` or `.` as the decimal separator, trim spaces, and use an optional per-question tolerance (default: exact after normalising to the stored precision).
- Practice mode with instant feedback (Q9) uses a per-question server action `checkAnswer(attemptId, questionId, answer)`. The practice attempt keeps the answer hidden until the student has committed to an answer.
