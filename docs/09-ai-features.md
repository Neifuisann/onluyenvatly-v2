# 09 — AI Features (Google Gemini, free tier)

## 1. Use cases

| # | Feature | Who | Priority | Model env | Streaming | Cache |
|---|---|---|---|---|---|---|
| AI1 | Explain a question after submit | Student | P0 | `GEMINI_MODEL_TEXT` (flash-lite class) | Yes (short) | **DB, per question hash, shared** |
| AI2 | Import PDF / DOCX / image → lesson text format | Admin | P0 | `GEMINI_MODEL_IMPORT` (flash class, multimodal) | Yes | None (one-off) |
| AI3 | Generate lesson description | Admin | P1 | TEXT | No | Stored on lesson |
| AI4 | Suggest tags | Admin | P1 | TEXT | No | Stored on lesson |
| AI5 | Pre-generate explanations for a lesson | Admin | P1 | TEXT | Background batches | DB |
| AI6 | Lesson quality check (missing answers, ambiguous stems, wrong units) | Admin | P2 | IMPORT | Yes | None |
| AI7 | Cover image generation | Admin | P2 | Pollinations (free) or none | — | Storage |

Dropped from v1: the free-form "chat assist" in the editor (low value, highest token use). It can come back as P2 if the teacher asks for it.

## 2. Integration design
- SDK: `@google/genai`, one wrapper in `src/features/ai/gemini.ts` exposing `generateText()`, `streamText()` and `generateFromFile()`. The wrapper handles timeouts (explain 25 s, import 280 s), retry with jitter on 429/503 (max 2), and structured logging of token counts.
- Model names always come from env. Free-tier models and limits change, and v1 changed models 3 times in a few weeks. Check the model and your limits in Google AI Studio (Rate limits page) at the start of each semester.
- **Global daily budget** (`settings.ai_daily_budget`, default 200 generations/day). A counter row in `rate_limits` (`ai:global:{date}`) is checked before every generation. When exhausted, explain returns `AI_QUOTA` and the UI shows "Hết lượt giải thích AI hôm nay, hãy thử lại vào ngày mai" (no AI explanations left today, try again tomorrow).
- **Kill switch:** `settings.ai_enabled`.

As built (S7-01): `src/features/ai/gemini.ts` exposes `createAi(deps)` with `generateText()` and `streamText()` (a file import is `contents` with inline data, so there is no separate `generateFromFile()`); `client.ts` wires the real `@google/genai` client, the env models and the gate. Rules (`ai/domain/policy.ts`, pure, gated at 95 %):
- `GEMINI_MODEL_TEXT` / `GEMINI_MODEL_IMPORT` may list **fallback models**, comma-separated (production import: `gemini-3.5-flash-lite,gemini-3.5-flash,gemini-3.8-flash`; nothing older than `gemini-3.5-flash-lite`). Each free-tier model has its own quota and its own load, so a 429 (quota) or 503 (model overloaded, "high demand") moves straight to the next model; on the last model it retries. Put a model that is reliably available first: on 2026-10-07 the newest flash models (3.6–3.8) answered 503 or broke mid-stream on most tries, and `gemini-3.8-flash` hung up to ~3 min before its 503, so an import listing only that model always ran out of time ("AI đang bận"). `gemini-3.5-flash-lite` with high thinking imports the 28-question 2025 THPT reference exam in ~35 s with every answer matching its key.
- Import also caps each model's wait for its **first chunk** at 100 s (`AI_ATTEMPT_TIMEOUT_MS`): a model that has not started answering by then is aborted and treated like a 503, so one hung model cannot use up the 280 s deadline. Once a model is streaming, only the deadline applies.
- A request may set `thinking` (`low`/`medium`/`high`): Gemini 3+ models get `thinkingLevel` plus streamed thought summaries (`includeThoughts`), so a thinking model sends its first chunk within seconds and passes the first-chunk cap; the SDK's `text` leaves the thoughts out. Older or unknown model names get no thinking config (a 2.x model answers 400 to `thinkingLevel`, which would stop the fallback chain). Import uses `high`: on the 2025 THPT reference exam, `gemini-3.5-flash-lite` at its default level misread the answer grid in 1 of 4 runs and dropped a data table; at `high` the answers matched in every run (~35 s, first chunk 4–12 s).
- Other 5xx and network errors retry the same model (max 2, backoff 0.5–1 s then 1–2 s, jittered), then move on; 404 (model gone) moves on; other 4xx stop. One deadline covers the whole call (retries, backoff and, for streams, the stream itself): explain 25 s, import 280 s. A stream retries only until its first chunk; after that a failure ends it and its `result` says why.
- The **gate** runs once per call, before any request: no key or model → `AI_UNAVAILABLE`; `ai_enabled` off → `AI_UNAVAILABLE`; then `reserveAiCall()` (`ai/budget.ts`) increments the `rate_limits` row `ai:global:{Vietnam date}` **only while it is below the budget** (one conditional upsert, safe under parallel calls), else `AI_QUOTA`. The budget is `settings.ai_daily_budget`, capped by the env `AI_DAILY_BUDGET` when that is above 0 (staging safety). A call that fails after the gate stays counted.
- Every call logs one JSON line `{ evt: "ai", feature, model, ok, reason?, status?, retries, inputTokens, outputTokens, thoughtTokens, ms }`: never the prompt, the output or who asked. A result is `complete` only when the model stopped normally (`STOP`) with non-empty text, so truncated text is never stored.
- The admin dashboard's "AI hôm nay" tile shows today's counter against the budget (`getAiUsageToday`), or "Đang tắt".
- E2E points the SDK at a local stand-in with `GEMINI_BASE_URL` (tests only).

## 3. AI1: explanation prompt (Vietnamese)
System instruction:
> Bạn là giáo viên Vật lý THPT tại Việt Nam. Giải thích ngắn gọn, chính xác, đúng chương trình GDPT 2018. Dùng LaTeX trong $...$ cho công thức. Không bịa số liệu. Nếu đề thiếu dữ kiện, nói rõ.

User content (structured):
```
Loại câu: {mcq|tf|short}
Đề bài: {stem}
Các lựa chọn / phát biểu: {…}
Đáp án đúng: {…}
Lời giải của giáo viên (nếu có): {…}
Yêu cầu: 1) Ý chính cần nhớ (1–2 câu) 2) Các bước giải ngắn 3) Vì sao các lựa chọn sai là sai (với trắc nghiệm) 4) Mẹo tránh nhầm.
Tối đa 250 từ.
```
- The **student's own answer is not sent**. That keeps the explanation shareable across students, and the UI adds "Bạn đã chọn C" (you chose C) next to it.
- Output is rendered as Markdown (no HTML) plus KaTeX on the server when stored.
- Rough size: ~600 input + ~450 output tokens per explanation.

As built (S7-02, `PROMPT_VERSION = "explain-v1"`, `ai/domain/explain.ts`): the system instruction above plus a format rule (plain text, **bold** and `$…$` only; no headings, tables, HTML or images; one idea per line), because the stored text is rendered by `MathText` (Markdown-lite). MCQ options are listed in the teacher's order with the key, and the model is told that each student sees them **shuffled**, so it names an option by its content, not its letter. TF lists each statement with Đúng/Sai; short gives the answer and tolerance. A question with a figure tells the model it can't see it. The teacher's explanation is **not** sent: a question that has one shows it and offers no AI (ADR-007). Temperature 0.3, up to 2,048 output tokens (thinking included), 25 s.

On the result page (only once answers may be shown), every question without a teacher explanation shows either the stored explanation ("Giải thích của AI", server-rendered with KaTeX, an "AI có thể nhầm" note until a teacher reviews it, 👍/👎 with counts) or, when AI is on, a "Giải thích bằng AI" button. The button posts to `POST /api/ai/explain` (05 §3), shows the text as it streams (plain, formulas not yet rendered), then refreshes the page into the stored version. Errors: "Hết lượt giải thích AI hôm nay, hãy thử lại vào ngày mai" (global budget), a per-student variant (20 a day), and "Giải thích đang được chuẩn bị. Bạn quay lại sau nhé." (Gemini down or AI off, ADR-007), each with "Thử lại". The page reads stored explanations with one query (`getReviewExplanations`: primary keys + my vote).

### AI3/AI4, as built (S7-05)
Under "Mô tả" and "Thẻ" in the editor's "Cài đặt" tab, **"Viết mô tả bằng AI"** and **"Gợi ý thẻ"** send the form's title, grade and chapter plus the text being edited (saved or not). The prompt (`ai/domain/lesson-helpers.ts`, `HELPERS_PROMPT_VERSION = "helpers-v1"`) holds only a digest: title, grade, chapter, counts per type and the first 15 stems without images, capped at 3,000 characters; no options and no answers. The description is asked for as one paragraph of at most 60 words and cleaned to plain text (no markdown, no wrapping quotes, ≤ 600 characters); tags are up to 6 short lower-case phrases, reusing the catalog's own tags when they fit (a suggested tag equal to a known one keeps the known spelling). The description replaces the field; suggested tags are added to the ones already typed, without duplicates and within the form's limit of 20. Nothing is saved until "Lưu cài đặt", so "Stored on lesson" above happens through the normal settings save. Each click is one call through the gate and the daily budget (limit 20 per 10 minutes per admin), temperature 0.4, up to 1,024 output tokens, 25 s.

### AI5 and review, as built (S7-03)
`/admin/explanations` (05 §1) gives the teacher two views. **"Theo bài"** lists a lesson's published questions with their explanation and a "Tạo sẵn cho cả bài" panel: the browser asks the server for one explanation at a time, every 6 s (10 a minute, leaving room under the lite model's ~15 RPM for students asking meanwhile), shows progress, and stops on "Dừng", on an error (budget spent, AI off, Gemini down) or when every question has one. Pre-generation uses the same prompt, the same cache (by hash, so a question shared by two lessons is generated once) and the same global budget as students. **"Cần xem lại"** is the 👎 queue: explanations with 3 or more "chưa đúng hoặc khó hiểu" votes that no admin has reviewed. On any stored explanation the teacher can **Sửa** (the text becomes the teacher's, marked reviewed; students then see "Giáo viên đã xem lại" instead of the "AI có thể nhầm" note), **Duyệt** (keep it as is, out of the queue) or **Tạo lại** (ask Gemini again; votes and review are cleared). Questions whose explanation is written in the lesson text are shown read-only; they are edited in the lesson editor.

## 4. AI2: document import
1. The admin uploads a PDF, DOCX or image (≤ 10 MB) directly to a private Storage bucket `imports/` via a signed URL. Bytes don't go through the function body.
2. `POST /api/ai/import { path }` (route handler, `maxDuration = 300`). It downloads the file server-side and:
   - DOCX → `mammoth` → text + images (images re-uploaded to `media/`) → Gemini "normalize to format".
   - PDF / image → sent to Gemini as inline data with the format spec.
3. The prompt includes the **exact text format spec** from 04 §3.3 plus 2 few-shot examples. Output streams back as plain text.
4. The editor receives the stream into a new draft, and the parser immediately validates it. The admin fixes any flagged items.
5. The import file is deleted from `imports/` after 24 h (daily cron).

As built (S7-04, `ai/import-service.ts`, prompt `import-v2` in `ai/domain/import.ts`): the upload goes to the private `imports` bucket (the browser PUTs to a signed URL); the route reads it back and trusts its first bytes, not its declared type. DOCX: mammoth → HTML → plain lines (paragraphs, list items, table rows as `a | b`), images stored in `media` when they are PNG/JPEG/WEBP ≤ 2 MB and otherwise replaced by `[Hình]` (MathType/EMF formulas in Word files are images, so they arrive as `[Hình]` and must be retyped; equations typed with Word's equation editor are dropped by mammoth). PDF/image: inline data. The system instruction holds the format rules of 04 §3.3, the guardrails below and three worked examples (a unit test checks they parse: the first and third cleanly, the second with exactly its two missing keys). Since `import-v2` (2026-10-07) it also asks the model to copy a shared passage ("Sử dụng thông tin sau cho Câu 3 và Câu 4") into every question that uses it (questions are shown alone and shuffled), to copy data tables as `a | b` lines in the stem, to copy the "Cho biết" constants into the questions that use them, and, when the exam has an answer key, to first write it out on an `ĐÁP ÁN:` line and mark the answers from that line. Output streams to the page, which parses it live; `cleanImportText` drops a wrapping ``` fence and everything before the first `Câu N:` (the key line, any preamble), and moves table rows the model wrote below the options or statements up into the stem (below an option the parser would read them as part of it). The draft is created only when the teacher clicks, then the editor's validation takes over. Figures the model can't copy are `[Hình]` lines under the stem, counted on the page, for the teacher to replace with "Chèn ảnh". One import is one call counted in the daily budget; 10 an hour per admin. Files are removed by the daily cron after 24 h (the teacher can retry within the day without uploading again).

Quality guardrails: the prompt requires `*` markers only where the source shows the answer. If the answer key is missing, leave it unmarked so the validator flags "thiếu đáp án" (missing answer) instead of letting the AI guess.

## 5. Evaluation (cheap and manual)
- `tests/ai/fixtures/`: 10 representative questions (mcq/tf/short, with formulas and figures) and 3 source PDFs.
- `pnpm ai:eval` runs the prompts on the fixtures and writes Markdown into `tests/ai/out/` for a human (the teacher) to review. Run it when changing models or prompts. It's not part of CI because it uses quota.
- Keep a changelog of prompt versions in `src/features/ai/prompts.ts` (`PROMPT_VERSION`), stored with each explanation.

## 6. Failure modes
| Failure | Behaviour |
|---|---|
| 429 / quota | Explain: show cached explanation if any, else message. Import: stop the stream with a clear error, keep the partial text in the draft |
| Timeout | Same as above; explanations aren't stored if incomplete |
| Hallucinated answer in an explanation | The correct answer is always given to the model; 👎 votes flag it for the teacher; the teacher can edit or replace it |
| Model deprecated | Change the env var; no code change |
