# 07 — UI/UX Design System

## 1. Design principles
1. **Focus over flash.** Students (from middle school to college) come here to do a test, not to admire the UI. Calm surfaces, strong type, clear hierarchy and one primary action per screen; the mascot appears only where it has a job.
2. **Phone first, one hand.** Design at 360×740 first. Primary actions sit in the bottom half of the screen (sticky bottom bar), with touch targets ≥ 44 px.
3. **Never lose work.** Autosave everywhere, a visible "Đã lưu" (saved) state, and resume after reload.
4. **Instant feedback.** Optimistic UI for flags and answers; skeletons instead of spinners; pages under 1 s.
5. **Honest and encouraging.** Show real numbers and real progress. Mistakes are framed as "cần ôn" (to review), not as failure.
6. **Accessible by default.** WCAG 2.2 AA contrast, full keyboard use, never color alone for correct/incorrect (always an icon plus text), MathML kept for screen readers, respects `prefers-reduced-motion`.

## 2. Information architecture

```
Student (bottom tab bar on mobile, left sidebar ≥ 1024px)
├─ Trang chủ      /dashboard   (continue, recommended, recent, rating)
├─ Bài tập        /lessons     (catalog → overview → runner → result)
├─ Ôn tập         /review      (mistakes bank → personalized practice)
├─ Xếp hạng       /leaderboard
└─ Tôi            /profile     (stats, history) → /settings

Admin (sidebar)
├─ Tổng quan  ├─ Bài tập (list / editor / stats)  ├─ Nhập bằng AI
├─ Học sinh (Chờ duyệt badge)  ├─ Kết quả  ├─ Giải thích AI
└─ Cài đặt  └─ Nhật ký
```
Public: top bar with logo, "Lý thuyết", "Đăng nhập", and a primary "Đăng ký" button.

## 3. Visual language

**v2 redesign ("Lagoon", 2026-09-29).** The palette, type and imagery come from the Physics Bunny mascot: navy ink (the hoodie), lagoon teal (the hood lining), sun yellow (the sparkles) and a peach blush. Clean surfaces, one clear primary action per screen, the bunny where it has a job (07 §3.4). Tokens live in `src/app/globals.css`; `pnpm check:contrast` checks every pair below in both themes.

### 3.1 Color tokens (Tailwind v4 `@theme`, OKLCH; light and dark)
| Token | Light | Dark | Use |
|---|---|---|---|
| `--background` | `oklch(0.974 0.006 240)` cloud | `oklch(0.165 0.022 262)` navy night | Page |
| `--panel` | `oklch(0.99 0.003 240)` | `oklch(0.185 0.024 262)` | Desktop content panel, sticky bars |
| `--surface` | white | `oklch(0.212 0.026 262)` | Cards |
| `--foreground` | `oklch(0.235 0.045 262)` navy ink | `oklch(0.955 0.007 250)` | Text |
| `--muted-foreground` | `oklch(0.5 0.03 258)` | `oklch(0.75 0.022 255)` | Secondary text (≥ 4.5:1) |
| `--primary` | **Lagoon teal** `oklch(0.5 0.1 198)` | `oklch(0.8 0.115 190)` | Actions, links, the selected answer |
| `--primary-soft` | `oklch(0.95 0.032 192)` | `oklch(0.3 0.055 205)` | Selected fills, active nav, info |
| `--ink` / `--ink-foreground` / `--ink-muted` | navy `oklch(0.27 0.065 264)` | same | Hero surfaces: continue card, score, landing and auth panels |
| `--accent` (+ `-soft`, `-text`) | **Sun yellow** `oklch(0.85 0.155 85)` | `oklch(0.85 0.15 85)` | Highlights, flags, progress on ink, badges |
| `--peach` | `oklch(0.93 0.045 45)` | `oklch(0.32 0.04 40)` | Decorative tints (topic glyphs, bronze rank) |
| `--success` (+ `-soft`, `-text`) | `oklch(0.64 0.16 150)` | `oklch(0.74 0.16 152)` | Correct |
| `--danger` (+ `-soft`, `-text`) | `oklch(0.575 0.2 26)` | `oklch(0.7 0.18 26)` | Wrong, destructive |
| `--warning` (+ `-text`) | `oklch(0.79 0.15 72)` | `oklch(0.82 0.15 75)` | Timer < 5 min |
| Tier colors | Bronze `#B0703C`, Silver `#8A94A6`, Gold `#D4A017`, Platinum `#2BA7B8`, Diamond `#5B7CFA`, Master `#E0457B` | | Rank rings only; tiers show their emblem (`public/tiers`) |

Selected-but-not-graded states (an option, Đ/S) always use teal, never green/red. The theme follows the system by default and can be toggled.

Primary and destructive buttons use opaque `--primary-hover` / `--danger-hover` fills, checked against their foregrounds in both themes. Reducing fill opacity can fail contrast on light cards even when the base token passes.

### 3.2 Typography
- **Inter** (variable, Vietnamese subset) for UI and question text; tabular figures (`.num`) for timers, scores and ratings, so numbers never jiggle.
- **Bricolage Grotesque** (display) for page titles (`.heading-page`), section titles (`.heading-section`), big numbers and the score.
- **JetBrains Mono** only where code is shown (lesson editor, raw import text, generated passwords); not preloaded.
- Question stems 1.125 rem (1.1875 rem from `sm`), line-height 1.7; KaTeX at 1.05em.

### 3.3 Space, shape, depth, motion
- 4 px grid. Reading and tests up to 720–1024 px wide; catalog, dashboard and admin up to 1152 px.
- Radius: 8 / 12 (inputs, `rounded-md`) / 18 (cards, `rounded-lg`) / 24 (heroes, `rounded-xl`) / 32 px; buttons, chips and segmented controls are pills.
- Shadows: `shadow-card` (cards), `shadow-raised` (heroes, floating bars, hover), `shadow-popover`. Light mode uses hairline borders plus shadow; dark mode uses borders.
- Motion: 150–200 ms state changes, a press-in on buttons, `animate-rise`/`animate-pop` on first paint of key blocks, the score ring sweep. Entrance motion uses transforms only so text stays readable throughout. All off under `prefers-reduced-motion` (global rule in `globals.css`).
- Shell: desktop sidebar on the page background with the active item on a raised pill, content in a rounded panel; phones get a slim blurred top bar and a floating blurred tab bar in the thumb zone.

### 3.4 Iconography & imagery
- lucide-react, 20 px, stroke 1.75 (2–2.25 when active).
- **The Physics Bunny** (`<Mascot pose>`, WebP in `public/mascot`, built by `scripts/optimize-mascot.ts`, which also writes `mascot-sizes.ts`). Each pose has one job: wave (sign-in), rocket (landing, sign-up), waiting (pending approval), key (passwords), teacher (first-visit welcome, closing CTA), laptop (continue card, empty history), studying (next lesson, lessons), sleeping (test not open / closed), celebrate / ok / keep-going (score ≥ 8 / ≥ 5 / < 5, never blame), all-clear (nothing to review), idea (practice card, hints), podium (leaderboard), broken (errors), space (404), telescope (no results). Plain `<img>` with intrinsic sizes: no image-optimization quota (ADR-006).
- Brand mark = the bunny's head (`public/brand/mark.webp`); favicon, apple-icon and PWA icons come from `scripts/build-icons.ts`.
- The static 1200×630 social preview (`src/app/opengraph-image.png`, with an alt-text file) uses the rocket pose and browser-rendered Vietnamese type. Rebuild with `node scripts/build-social-image.ts http://localhost:3100` against the local app. It uses the app's fonts and tokens and adds no runtime image-generation cost.
- Lesson cards show a **topic glyph** (icon + tint per physics topic, from `lessons/domain/topic.ts`) unless the teacher set a cover; never stock photos.

## 4. Component inventory
Built on shadcn/ui (copied into `src/components/ui`) plus app components:

| Component | Notes |
|---|---|
| `AppShell` | Bottom tabs (mobile) / sidebar (desktop), announcement banner, user menu |
| `LessonCard` | Title, grade chip, chapter, `28 câu · 50 phút`, my best score ring, status badge (Mới / Đang làm / Đã làm) |
| `FilterBar` | Search input + grade segmented control + chapter/tag sheet (mobile) or popover (desktop); URL-synced |
| `MathText` | Server component: Markdown-lite + KaTeX → HTML, cached |
| `QuestionCard` | Stem, image (tap to zoom), options. Variants: `taking`, `review`, `preview` |
| `McqOptions` | Large tappable rows with letter badge; selected = primary border + fill; keyboard 1–4/A–D |
| `TrueFalseTable` | 4 statement rows × two big toggles `Đúng` / `Sai`, fits in 360 px |
| `ShortAnswerInput` | Numeric keyboard (`inputmode="decimal"`), accepts `,` and `.`, shows the normalized value |
| `QuestionNavigator` | Grid of numbers: answered (filled), flagged (amber dot), current (ring); bottom sheet on mobile |
| `TestTimer` | mm:ss tabular figures, turns warning < 5 min, danger < 1 min, `aria-live="polite"` announcements at 5 and 1 min |
| `SaveIndicator` | "Đã lưu" / "Đang lưu…" / "Mất kết nối – đã lưu trên máy" |
| `SubmitDialog` | Lists unanswered and flagged, confirm button |
| `ScoreHero` | Navy surface, animated score ring, points, time, rating delta and a mascot reaction; respects reduced motion |
| `ReviewItem` | Correct/incorrect icon + label, your answer vs correct, teacher explanation, "Giải thích bằng AI" button, 👍/👎 |
| `RatingChart`, `AccuracyByChapter` | Recharts, lazy-loaded |
| `LeaderboardTable` | Rank, avatar/initials, name, class, tier, rating, 7-day delta; sticky "me" row |
| `EmptyState`, `ErrorState`, `Skeleton*` | Every list has all three |
| Admin: `DataTable` (TanStack Table), `LessonEditor` (CodeMirror 6 + live preview), `ImageDropzone`, `StatsBar` | S5-01: the lesson list is a plain server-filtered table (`LessonTable`), no TanStack: ~170 rows need no client sorting or paging. Reorder by dragging the handle (pointer events, so touch works too) or ↑/↓ on the focused handle, announced in a live region; only on the unfiltered list |

## 5. Key screens (mobile wireframes)

The wireframes below describe the information hierarchy. The Lagoon redesign adds a first-visit three-step guide until the student's first completed test, a featured next lesson when no test is in progress, a focused runner with a floating mobile action bar, and matching answer controls on the result screen. Sign-up shows registration → teacher approval → practice; copy makes answer-release timing explicit. Auth artwork stays in document flow so short desktop windows cannot overlap it with the value list. Admin pages use the shared shell and compact tables, with the approval queue emphasized on the overview and keyboard-operable segmented editor tabs.

### 5.1 Dashboard
```
┌──────────────────────────────┐
│ Chào Huy 👋        [avatar]  │
│ ┌──────────────────────────┐ │
│ │ ĐANG LÀM DỞ              │ │
│ │ Đề ôn GK1 – Dao động cơ  │ │
│ │ 18/28 câu · còn 21:40    │ │
│ │ [ Tiếp tục làm bài  → ]  │ │
│ └──────────────────────────┘ │
│ Rating 1 684  ▲ +32  Platinum│
│ ▁▂▃▅▄▆▇ (7 lần gần nhất)     │
│ ┌────────────┐┌────────────┐ │
│ │ 12 câu sai ││ Hạng #14   │ │
│ │ cần ôn  →  ││ lớp 12  →  │ │
│ └────────────┘└────────────┘ │
│ GỢI Ý CHO BẠN                │
│ [LessonCard] [LessonCard] →  │
├──────────────────────────────┤
│ 🏠  📚  🔁  🏆  👤            │  bottom tabs
└──────────────────────────────┘
```

### 5.2 Test runner (core screen)
```
┌──────────────────────────────┐
│ ←  Câu 7/28       ⏱ 32:15    │  sticky header; tap "7/28" → navigator sheet
│ ▓▓▓▓▓▓░░░░░░░░░░ Đã lưu ✓    │  progress + save state
├──────────────────────────────┤
│ Câu 7 · Trắc nghiệm · 0,25đ  │
│ Một con lắc lò xo có k = 100 │
│ N/m, m = 1 kg. Chu kì dao    │
│ động là  T = 2π√(m/k) …      │
│ [ figure – tap to zoom ]     │
│ ┌──────────────────────────┐ │
│ │ (A)  0,2π s              │ │
│ ├──────────────────────────┤ │
│ │ (B)  0,63 s          ✓sel│ │  selected
│ ├──────────────────────────┤ │
│ │ (C)  2π s                │ │
│ ├──────────────────────────┤ │
│ │ (D)  10 s                │ │
│ └──────────────────────────┘ │
├──────────────────────────────┤
│ [⚑ Đánh dấu] [← Trước] [Sau →]│ sticky bottom bar, thumb zone
└──────────────────────────────┘
```
Behaviour:
- One question per screen on mobile, swipe or buttons to move; "Xem tất cả" switches to a scrolling list (preference is remembered). On desktop, the list is shown with the navigator in a sticky side panel.
- Answers are saved locally on every change and synced every 30 s and on page hide. The save indicator is always visible.
- Offline: banner "Mất kết nối – bài làm vẫn được lưu trên máy". Submit queues and retries with backoff; the deadline has 30 s of grace.
- Submit is on the last question and in the navigator sheet → `SubmitDialog`.
- Exam-guard mode: a small shield icon "Chế độ thi" in the header, a toast on return from a tab switch ("Đã ghi nhận rời khỏi bài thi"), selection and copy disabled only inside the runner.
- The keyboard works on desktop: `1–4` choose, `←/→` move, `F` flag, `Enter` next.

**As built (S3-04):** `/attempts/[id]` lives in its own `(runner)` route group, so no app shell competes with the runner's sticky header and bottom bar. Question text is rendered on the server (`MathText`) and passed to the client runner as React nodes; only answer-free content in display order reaches the browser. State lives in a per-attempt Zustand store over pure transitions (`features/attempts/domain/runner-state.ts`). Phones open one question per screen, desktops (≥ 1024 px) the list; the choice is remembered in `localStorage` (`runner:view`). MCQ options and Đ/S buttons are toggle buttons (`aria-pressed`), so a second tap clears a choice; a chosen Đ or S uses the neutral primary "selected" style, never green/red, which would read as graded. The navigator and `SubmitDialog` are native `<dialog>`s (bottom sheet on phones). Shortcuts also accept `1–6`/`A–E` for options; they're ignored while typing in an input or when a dialog is open.

**Autosave (S3-05):** every change is written to `localStorage` (`attempt:{id}`, with a `dirty` flag) at once. The server gets the state when it changed: every 30 s, when the tab is hidden, when the connection returns, and by `sendBeacon` on `pagehide` (or when leaving through an in-app link). Failures retry after 2, 4, 8, 16, then 30 s. On load, an unsynced local copy wins over the server copy; a clean one is ignored, so a save from another device shows up. `SaveIndicator` states: "Đã lưu", "Đã lưu trên máy" (waiting for the next sync), "Đang lưu…", "Mất kết nối – đã lưu trên máy" (plus the offline banner), "Bài làm đã đóng" (409/404: the page refreshes, which leads to the result), and "Phiên đăng nhập đã hết hạn" (with a sign-in link in a new tab, so the test stays open). The answered count moved from the header to the navigator; the header shows the progress bar and the save state.

### 5.3 True/false question
```
│ Câu 22 · Đúng/Sai · 1đ       │
│ Xét con lắc đơn dao động …   │
│ ┌──────────────────┬───┬───┐ │
│ │ a) Chu kì phụ…   │ Đ │ S │ │
│ │ b) Cơ năng …     │ Đ │ S │ │
│ │ c) …             │ Đ │ S │ │
│ │ d) …             │ Đ │ S │ │
│ └──────────────────┴───┴───┘ │
```

### 5.4 Result
```
┌──────────────────────────────┐
│        7,75 / 10             │  ScoreHero (count-up animation)
│  22/28 câu đúng · 38:12      │
│  Rating 1 652 → 1 684  ▲ +32 │
│  [ Xem lại bài ] [ Làm lại ] │
├──────────────────────────────┤
│ Lọc: [Tất cả][Sai 6][Đúng]   │
│ ✗ Câu 3 · Trắc nghiệm        │
│   Bạn chọn: C  · Đáp án: B   │
│   Giải thích của giáo viên…  │
│   [✨ Giải thích bằng AI]     │
│ ✓ Câu 4 …                    │
└──────────────────────────────┘
```
If `revealAnswers = after_deadline`, show the score now and "Đáp án sẽ hiển thị sau hh:mm dd/mm".

As built (S7-06), **`/review` and practice mode**: mistakes are framed as "cần ôn". The page lists each open mistake as a card (type, "Sai n lần", the stem clamped to four lines, lesson, last seen, "Xem bài làm"), with a chapter select and type chips carrying counts; lessons whose answers are still hidden are marked "Chưa công bố đáp án" and stay out of practice, with a note saying how many. "Tạo bài ôn tập" offers 10/20/30 questions (large radio rows) for the current filters; with a practice open, a highlighted "Làm tiếp" card replaces it. The practice runs in the normal runner with a "Ôn tập · không tính xếp hạng" badge and no timer: under each question "Kiểm tra" (enabled once answered) shows "Chính xác!" / "Chưa đúng" / "Đúng một phần" with an icon (never color alone), the key in the letters this student sees, and a pointer to the detailed solution on the result page; the answer is then locked (tapping another option does nothing). The result page reads "Ôn tập cá nhân" with "Về trang ôn tập" instead of "Làm lại".

As built (S4-03, `attempts/domain/review.ts`, owner decisions 2026-09-28): answers, explanations and per-question right/wrong marks are shown together or not at all, because marks alone would give mcq answers away for a retake. While hidden, the page shows the total score, the correct count, the rating change and each question with only the student's own choice (built from the answer-free view; the answer key is not read). `after_deadline` opens at the lesson's reveal time, `startsAt + time limit + 30 s` (04 scheduled tests); an unscheduled `after_deadline` stays hidden. Admins always see the review. The "Sai" filter counts everything short of full marks (wrong, partial tf, blank). The score counts up once after hydration (the server HTML has the final value; no motion with reduced motion). The overview's start panel shows the start time, the reveal/close time, extra tries, and "Bài chưa mở" / "Bài đã đóng" instead of the start button.

### 5.5 Catalog
Search is sticky at the top, followed by grade chips `Tất cả · 10 · 11 · 12` and a "Bộ lọc" button (chapter, tag, status: Chưa làm / Đã làm, sort). Cards are in 1 column on mobile, 2 on tablet, 3 on desktop. The list is paginated with "Xem thêm", not infinite scroll, because that's cheaper and better for the back button.

### 5.6 Admin lesson editor (desktop)
```
┌ Bài tập / Đề ôn GK1 ─────────── [Nháp ▾] [Lưu nháp] [Xuất bản] ┐
│ Tabs: Nội dung | Cài đặt | Xem trước | Thống kê                 │
├──────────────────────────────┬──────────────────────────────────┤
│ CodeMirror (text format)     │ Live preview (MathText, cards)   │
│ Câu 1: …                     │ ✓ Câu 1  Trắc nghiệm  0,25đ      │
│ A. …                         │ ⚠ Câu 2  thiếu đáp án đúng       │
│ *B. …                        │ …                                │
│ [📷 dán ảnh] [✨ Nhập từ PDF] │ Tổng: 28 câu · 18/4/6 · 10đ      │
└──────────────────────────────┴──────────────────────────────────┘
```
The validation panel links each error to its line in the editor. Pasting an image uploads it and inserts `![](media:…)` at the cursor.

As built (S5-02, `features/lessons/components/editor/`): CodeMirror 6 is loaded with `next/dynamic` (`ssr: false`) and highlights the text with the parser's own line grammar (`classifyLine`): headers, option/statement letters (a `*`-marked one in the success color), `Answer:`, points, `Giải thích:`, `$…$`. Tab is left to the browser so keyboard users can leave the editor. The text is parsed on every change through `useDeferredValue`, with the last saved questions as `previous` so ids stay stable. The right pane has the validation panel ("Dòng 12, cột 1: …", each a button that puts the cursor there), a sticky stats bar ("Tổng: 28 câu · 18/4/6 · 10đ", plus "Mỗi lượt làm: …" when the pool is on; `domain/editor-stats.ts`) and the preview cards with the answer key and explanation. The preview renders Markdown-lite with the same code as `MathText` (`render-nodes.tsx`); formulas come from `renderTexBatch` in batches and are cached for the session, showing their source until they arrive. A unit test renders every text of the 10 real v1 lessons both ways and requires identical HTML. Below 1024 px a "Soạn thảo / Xem trước" switch shows one pane at a time. Leaving with unsaved changes asks first (`beforeunload`). Saving is S5-04.

As built (S5-04 to S5-06): under the title, a publish bar: "Lưu nháp" (also Ctrl/⌘+S; the message says how many errors remain), "Xuất bản" (disabled while the text has errors, with the reason next to it, or when there is nothing new; a confirm dialog says attempts in progress keep the old content), "Ngừng xuất bản" on published lessons and "Bỏ bản nháp" (confirm) when a draft sits on top of a published version. Above the editor, "Chèn ảnh" opens a file picker; pasting or dropping images into CodeMirror works too. Each image is resized in the browser (1280 px WebP 0.8), uploaded straight to Storage and inserted as `![](media:… =WxH)` on its own line where it was pasted, even if the text moved meanwhile (a CodeMirror position mapped through later edits); progress and errors show in a live region. The "Cài đặt" tab ends with "Ảnh bìa" (pick, preview, remove; saved at once). The third tab is **"Làm thử"** rather than "Xem trước", so it isn't confused with the content tab's live preview pane: it mounts the real student `Runner` in preview mode on the text being edited, with the lesson's pool, shuffles and points (a new draw with "Tạo lượt mới"). Preview mode keeps every screen and control of the runner but has no autosave, submit request, exam guard or exit link; each question shows how the current answer scores ("Trả lời đúng/sai", "Đúng một phần (0,5/1đ)"), the key in display terms and the explanation; "Nộp bài" opens a local result (score, correct count, score out of 10) with "Làm lại". It is mounted only while open, so each visit starts fresh on the latest text. KaTeX for all three tabs shares one session cache.

**As built (S8-01 teacher redesign, 2026-09-30): the v1 two-step flow.** The three tabs became two steps, like v1's "stage 1 editor → stage 2 configure", made consistent:
```
┌ ← Danh sách bài                                            [Thống kê] ┐
│ Đề ôn GK1 – Dao động cơ  (• Đã xuất bản)                              │
├ (1 Soạn nội dung)──(2 Cài đặt & xuất bản)  ✓ Đã lưu [▷ Làm thử] [Lưu nháp] [Tiếp tục →] ┤  sticky work bar
│ Tổng: 28 câu · 18/4/6 · 10đ          │ [Chèn ảnh] hoặc dán/kéo thả ảnh │
│ Kiểm tra: không có lỗi               │ 1 Câu 1: …                      │
│ ┌ (Câu 1) Trắc nghiệm · 0,25đ   ✓ ┐  │ 2 A. …                          │
│ │ A … ✓B … C … D …               │  │ 3 *B. …                         │  text editor, sticky
│ └────────────────────────────────┘  │ …                               │
└──────────────────────────────────────┴─────────────────────────────────┘
```
- **"Tạo bài mới"** (list and overview) creates a draft and opens step 1. **Step 1 "Soạn nội dung"**: the rendered question cards on the **left** (stats bar, the "Kiểm tra" panel, cards drawn like the runner's question card with the key in success color plus a check and "Đáp án đúng", never color alone), the **text editor on the right**, sticky under the work bar. Clicking a card's header or an issue puts the cursor on its line. With errors, a note above the panes says so on every screen size. Phones keep the "Soạn thảo / Xem trước" switch.
- **"Tiếp tục"** saves the text as the draft when it changed (a failed save stays on step 1 with the message), then opens **step 2 "Cài đặt & xuất bản"** at `?step=settings`, a history entry, so Back returns to step 1 and a reload keeps the step. Both steps stay mounted, so CodeMirror keeps its undo history. The stepper buttons switch steps too.
- **Step 2**: the settings form (sections with an icon each; checkboxes and radios are large tappable rows with a primary border when chosen) and "Ảnh bìa" on the left; a sticky **publish panel** on the right: status badge and what students see, a checklist (question count, "Nội dung còn n lỗi" with "Sửa ở bước 1", settings valid / changed), a summary (types, points, time, attempts, per-attempt pool) and the secondary actions "Lưu cài đặt", "Ngừng xuất bản", "Bỏ bản nháp". **"Xuất bản"** is the work bar's primary button: disabled while the text has errors (described by the checklist) or there is nothing new; with invalid settings it shows every field's message instead; after the confirm dialog it saves changed settings first, then publishes the text as seen.
- **"Làm thử"** (work bar, both steps) replaces the steps with the runner preview until "Quay lại soạn bài".
- Phones: the step's two actions ("Lưu nháp · Tiếp tục" / "Quay lại nội dung · Xuất bản") sit in a floating bar in the thumb zone, like the runner; the work bar scrolls away.

As built (S5-03): "Cài đặt" is a second ARIA tab (←/→ between tabs; both panels stay mounted so CodeMirror keeps its undo history). Sections: Thông tin bài, Thời gian và lượt làm (minutes, empty = no limit; start time as `datetime-local` in Vietnam time, stored with `+07:00`), Câu hỏi (shuffles; pool as "tắt / theo tổng số câu / theo từng loại", with the counts the live text has), Tính điểm (per question or a total per type; tf scale), Sau khi nộp bài (reveal, rating, exam guard). `domain/settings-form.ts` validates on every change against the live content; a field shows its message once touched or after a save attempt, and saving is refused with a summary until every field is valid. Blocked combinations: reveal after the shared deadline without a start time or a limit, a pool larger than the content (total or per type), an empty pool or empty per-type totals, points with more than 2 decimals, and out-of-range limits or attempts. The stats bar in "Nội dung" follows valid settings live. A note at the top says settings apply as soon as they are saved.

### 5.7 Teacher screens (S8-01, 2026-09-30)
The admin area uses the same Lagoon language as the student side. Every page starts with `PageHeader` (optional back link, display title with status chips, lead, actions on the right); settings blocks and panels are `SectionCard`s. Link-based switches (lesson status, student view/status/grade, explanation views, stats sort) are one muted pill track with the current choice raised (`SegmentedNav`, like the catalog's grade switch). Page-level empty states show the bunny (telescope for no matches, all-clear for an empty queue, graph for stats without attempts).
- `/admin`: greeting lead, a navy hero with the approval queue ("5 học sinh đang chờ duyệt" → "Duyệt ngay", waiting bunny) or today's submissions (graph bunny), icon tiles, the 30-day chart (today's bar in sun yellow) and the hardest questions with a rate bar.
- `/admin/lessons`: pill search, status switch, a table of 20 rows per page with topic glyphs, status badges (dot + text), and numbered pages (`Pagination`: first, last, current ± 1, "…" for longer runs; "Trang trước/sau" become arrows on phones). The unfiltered list stays reorderable per page.
- Students, results and pending rows carry initials avatars; result scores are tinted pills by the result screen's bands (≥ 8 / ≥ 5 / below). The AI import uses a drop zone and a three-step strip.

## 6. Content & tone (Vietnamese UI copy)
- Talk to the student with "bạn". Keep it short and positive: "Làm tốt lắm!", "Còn 6 câu cần ôn lại."
- Error messages say what happened and what to do: "Mất kết nối. Bài làm đã được lưu trên máy, hệ thống sẽ tự gửi lại."
- Scores use a comma decimal (7,75) and dates look like `28/09/2026 21:30`, always `Asia/Ho_Chi_Minh`.
- All strings live in `src/lib/messages.ts`, not scattered through components.

## 7. PWA
`app/manifest.ts` (name "Ôn Luyện Vật Lý", theme color primary, icons) makes the site installable on the home screen. **No service-worker caching of pages in v2.0**, to avoid serving stale tests. Offline tolerance inside the runner comes from localStorage.

## 8. Design deliverables per sprint
- Sprint 1: tokens + typography + AppShell + auth screens in Storybook-less "/dev/ui" page (a hidden route that lists components; free and no extra tooling).
- Sprint 3: runner and result screens tested with 3 students on real phones (hallway test, 15 min each).
- Sprint 8: accessibility pass (axe in Playwright + manual keyboard and TalkBack check).
