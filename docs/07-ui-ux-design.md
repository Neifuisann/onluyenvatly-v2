# 07 — UI/UX Design System

## 1. Design principles
1. **Focus over flash.** Students come here to do a test, not to admire the UI. Drop the purple glassmorphism, particle animations and emoji. Use calm surfaces, strong type and clear hierarchy.
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

### 3.1 Color tokens (Tailwind v4 `@theme`, OKLCH; light and dark)
| Token | Light | Dark | Use |
|---|---|---|---|
| `--background` | `oklch(0.985 0.003 250)` (near-white, cool) | `oklch(0.17 0.01 255)` | Page |
| `--surface` | `oklch(1 0 0)` | `oklch(0.21 0.012 255)` | Cards |
| `--foreground` | `oklch(0.22 0.02 255)` | `oklch(0.95 0.005 255)` | Text |
| `--muted-foreground` | `oklch(0.50 0.02 255)` | `oklch(0.72 0.015 255)` | Secondary text (≥ 4.5:1) |
| `--border` | `oklch(0.91 0.008 255)` | `oklch(0.30 0.012 255)` | |
| `--primary` | **Blueprint blue** `oklch(0.50 0.19 262)` | `oklch(0.68 0.16 262)` | Main actions, links, selected option |
| `--accent` | **Amber** `oklch(0.80 0.16 75)` | `oklch(0.80 0.15 75)` | Highlights, streaks, flags |
| `--success` | `oklch(0.60 0.15 150)` | `oklch(0.72 0.15 150)` | Correct |
| `--danger` | `oklch(0.58 0.20 27)` | `oklch(0.70 0.18 27)` | Wrong, destructive |
| `--warning` | `oklch(0.75 0.15 75)` | | Timer < 5 min |
| Tier colors | Bronze `#B0703C`, Silver `#8A94A6`, Gold `#D4A017`, Platinum `#2BA7B8`, Diamond `#5B7CFA`, Master `#E0457B` | | Badges only |

The theme follows the system setting by default and can be toggled in Settings. Every text/background token pair is checked for ≥ 4.5:1 in CI by a small contrast script.

### 3.2 Typography
- **Be Vietnam Pro** (400/500/600/700) for UI and content. It's designed for Vietnamese stacked diacritics.
- **JetBrains Mono** (tabular) for timer, scores, numeric inputs.
- Scale (rem): 0.8125 caption · 0.875 small · 1 body · 1.125 question stem (mobile) · 1.25 h3 · 1.5 h2 · 2 h1 · 2.75 display (landing only).
- Question stems use 1.125 rem with line-height 1.7, because formulas and diacritics need air.
- KaTeX font size is 1.05em relative to the text.

### 3.3 Space, shape, depth, motion
- 4 px spacing grid. Content max width is 720 px for reading and tests, 1200 px for catalog and admin.
- Radius: 12 px cards, 10 px inputs and buttons, 999 px chips.
- Shadows: one soft level for cards, one for popovers. No glow effects.
- Motion: 150–200 ms ease-out for state changes; page transitions via View Transitions where supported; no looping animations. Everything off under `prefers-reduced-motion`.

### 3.4 Iconography & imagery
lucide-react, 20 px, stroke 1.75. Lesson covers are optional. Without one, show a generated pattern tile from the chapter color, never the random stock photos v1 uses.

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
| `TestTimer` | mm:ss mono, turns warning < 5 min, danger < 1 min, `aria-live="polite"` announcements at 5 and 1 min |
| `SaveIndicator` | "Đã lưu" / "Đang lưu…" / "Mất kết nối – đã lưu trên máy" |
| `SubmitDialog` | Lists unanswered and flagged, confirm button |
| `ScoreHero` | Big score /10, points, time, rating delta with tier badge animation |
| `ReviewItem` | Correct/incorrect icon + label, your answer vs correct, teacher explanation, "Giải thích bằng AI" button, 👍/👎 |
| `RatingChart`, `AccuracyByChapter` | Recharts, lazy-loaded |
| `LeaderboardTable` | Rank, avatar/initials, name, class, tier, rating, 7-day delta; sticky "me" row |
| `EmptyState`, `ErrorState`, `Skeleton*` | Every list has all three |
| Admin: `DataTable` (TanStack Table), `LessonEditor` (CodeMirror 6 + live preview), `ImageDropzone`, `StatsBar` | S5-01: the lesson list is a plain server-filtered table (`LessonTable`), no TanStack: ~170 rows need no client sorting or paging. Reorder by dragging the handle (pointer events, so touch works too) or ↑/↓ on the focused handle, announced in a live region; only on the unfiltered list |

## 5. Key screens (mobile wireframes)

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
