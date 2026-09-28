# ADR-007: Generate each AI explanation once, store it in the DB, and serve it to everyone

- **Status:** Proposed
- **Date:** 2026-09-28

## Context
v1 calls Gemini on every "Explain" click, so the same question is explained again for every student. The Gemini free tier has low per-minute and per-day limits, and the last 3 months of commits show 3 model switches ("change gemini model again"), which suggests the team keeps running into limits or quality issues.

## Decision
- Table `question_explanations(question_hash, lesson_id, question_id, model, content_md, created_at, rating_up, rating_down)`.
- `question_hash` = SHA-256 of the normalized stem + options + correct answer. An explanation is automatically invalidated when the question changes, and it's reused when a question is copied into another lesson.
- Flow: cache hit → return. On a miss → check rate limits (per student 20/day, global `AI_DAILY_BUDGET`) → generate → store → return.
- Admin can **pre-generate** explanations for a whole lesson at publish time, in a batch spread over time to respect RPM, and can edit or approve them.
- Teacher-written explanations (in the lesson text) always take priority over AI.
- Students can give 👍/👎. An explanation that gets 3 or more 👎 is regenerated or flagged for the teacher.
- The model name comes from env (`GEMINI_MODEL_TEXT`). Use the cheapest/lite model that gives acceptable Vietnamese physics answers.

## Consequences
- Gemini calls scale with the **number of distinct questions** (thousands, once), not with student clicks.
- Explanations become reviewable content that improves over time.
- If Gemini is down or out of quota, cached explanations still work and new ones show "Giải thích đang được chuẩn bị".
