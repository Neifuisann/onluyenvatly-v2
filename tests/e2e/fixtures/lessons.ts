import type { NewLesson } from "../../../src/db/schema.ts";
import {
  DEFAULT_LESSON_CONFIG,
  type Question,
} from "../../../src/features/lessons/schema.ts";
import { STATS_LESSON, statsQuestionsV1 } from "./stats.ts";

// Synthetic content only. The marker must never appear in student responses.
export const ANSWER_MARKER = "PRIVATE_EXPLANATION_S2_E2E";
export const e2eQuestions: Question[] = [
  {
    id: "q_e2e",
    type: "mcq",
    stem: "Chu kì có đơn vị nào?",
    options: [{ text: "Giây" }, { text: "Mét" }],
    answer: 0,
    explanation: ANSWER_MARKER,
  },
];

/**
 * S3 runner journeys (11 §3, journeys 2–5): every question type, teacher
 * order and no shuffles, so the specs know which buttons are correct.
 * Max score 2: 0.25 + 0.25 + 1 + 0.5.
 */
export const runnerQuestions: Question[] = [
  {
    id: "q_run_mcq1",
    type: "mcq",
    stem: "Một vật dao động điều hòa với phương trình $x = 5\\cos(2\\pi t)$ cm. Biên độ là",
    options: [
      { text: "2 cm" },
      { text: "5 cm" },
      { text: "10 cm" },
      { text: "$2\\pi$ cm" },
    ],
    answer: 1,
    points: 0.25,
    explanation: ANSWER_MARKER,
  },
  {
    id: "q_run_mcq2",
    type: "mcq",
    stem: "Đơn vị của tần số là",
    options: [{ text: "s" }, { text: "Hz" }, { text: "m" }, { text: "N" }],
    answer: 1,
    points: 0.25,
  },
  {
    id: "q_run_tf1",
    type: "tf",
    stem: "Xét các phát biểu sau về con lắc lò xo:",
    statements: [
      { text: "Chu kì phụ thuộc vào khối lượng vật.", answer: true },
      { text: "Chu kì phụ thuộc vào biên độ.", answer: false },
      { text: "Cơ năng tỉ lệ với bình phương biên độ.", answer: true },
      { text: "Tần số tăng khi tăng khối lượng.", answer: false },
    ],
    explanation: ANSWER_MARKER,
  },
  {
    id: "q_run_short1",
    type: "short",
    stem: "Tính chu kì (s) của con lắc có $k = 100$ N/m, $m = 1$ kg.",
    answer: "0.63",
    points: 0.5,
    explanation: ANSWER_MARKER,
  },
];

/**
 * S7-02: the first question has no teacher explanation (AI offered), the
 * second has one (shown instead, no AI). The stem differs per project so
 * each project's question has its own cache entry.
 */
export const aiQuestions = (project: "d" | "m"): Question[] => [
  {
    id: "q_ai_mcq",
    type: "mcq",
    stem: `Đơn vị của tần số dao động là (${project})`,
    options: [{ text: "Giây" }, { text: "Héc" }],
    answer: 1,
  },
  {
    id: "q_ai_teacher",
    type: "mcq",
    stem: "Đơn vị của chu kì dao động là",
    options: [{ text: "Giây" }, { text: "Héc" }],
    answer: 0,
    explanation: "Lời giải của giáo viên: chu kì đo bằng giây.",
  },
];

/** Title prefix of the drafts the AI import spec creates; the seed removes them. */
export const IMPORTED_TITLE_PREFIX = "E2E – Nhập đề";

/** Title prefix of the drafts the compose spec creates (S5-07); the seed removes them. */
export const COMPOSED_TITLE_PREFIX = "E2E – Ghép đề";

/**
 * S7-06 review journey: three mcq questions whose right option says so, so
 * the spec can pick it however the practice set shuffles the options.
 */
export const REVIEW_RIGHT = "Chọn phương án này";
export const reviewQuestions = (project: "d" | "m"): Question[] =>
  [1, 2, 3].map((n) => ({
    id: `q_review_${n}`,
    type: "mcq",
    stem: `Câu ôn tập số ${n} (${project}): $v = ${n},\text{m/s}$`,
    options: [
      { text: REVIEW_RIGHT },
      { text: "Sai một" },
      { text: "Sai hai" },
      { text: "Sai ba" },
    ],
    answer: 0,
  }));

/**
 * S7-03 admin explanations: two questions for "Tạo sẵn cho cả bài" and one
 * with the teacher's text. Per project, so each generates its own.
 */
export const aiAdminQuestions = (project: "d" | "m"): Question[] => [
  {
    id: "q_pre_1",
    type: "mcq",
    stem: `Biên độ dao động kí hiệu là (${project})`,
    options: [{ text: "$A$" }, { text: "$T$" }],
    answer: 0,
  },
  {
    id: "q_pre_2",
    type: "short",
    stem: `Chu kì $T = 2$ s. Tần số bằng bao nhiêu Hz? (${project})`,
    answer: "0.5",
  },
  {
    id: "q_pre_teacher",
    type: "mcq",
    stem: "Đơn vị của biên độ là",
    options: [{ text: "mét" }, { text: "giây" }],
    answer: 0,
    explanation: "Biên độ là độ dời lớn nhất, đo bằng mét.",
  },
];

/**
 * The 👎 queue (S7-03): one flagged explanation per project, inserted by
 * the seed for the `e2e-ai-admin-*` lesson (the hashes match no question).
 */
export const flaggedExplanations = (["d", "m"] as const).map((p) => ({
  legacyId: `e2e-ai-admin-${p}`,
  questionHash: (p === "d" ? "d" : "e").repeat(64),
  questionId: "q_flagged",
  contentMd: `Lời giải bị đánh giá chưa tốt (${p}).`,
  votesDown: 3,
}));

/**
 * B-05 game rooms: five mcq questions whose right option says so, so the
 * spec can pick it in any player's shuffle. Each has a private explanation
 * that must never reach a player.
 */
export const GAME_RIGHT = "Về đích đúng";
export const gameQuestions = (project: "d" | "m"): Question[] =>
  [1, 2, 3, 4, 5].map((n) => ({
    id: `q_game_${n}`,
    type: "mcq",
    stem: `Câu đua số ${n} (${project}): $s = ${n}\\,\\text{m}$`,
    options: [
      { text: GAME_RIGHT },
      { text: "Lệch một" },
      { text: "Lệch hai" },
      { text: "Lệch ba" },
    ],
    answer: 0,
    explanation: ANSWER_MARKER,
  }));

export type E2eLesson = NewLesson & { questions?: Question[] };

/** `legacyId` prefix of the teacher-owned lessons (B-03), then `d`/`m`. */
export const TEACHER_LESSON_PREFIX = "e2e-teacher-";

export const e2eLessons: E2eLesson[] = [
  {
    legacyId: "1720000000000",
    title: "E2E – Dao động điều hòa",
    grade: 12,
    chapter: "Dao động cơ",
    tags: ["e2e", "giữa kì"],
    sortOrder: -100,
    description: "Ôn tập **dao động** với $T = 2\\pi/\\omega$.",
    config: {
      ...DEFAULT_LESSON_CONFIG,
      timeLimitSec: 3000,
      maxAttempts: 3,
      examGuard: true,
    },
    status: "published",
  },
  {
    legacyId: "1720000000001",
    title: "E2E – Điện trường",
    grade: 11,
    chapter: "Điện trường",
    tags: ["e2e"],
    sortOrder: -99,
    config: DEFAULT_LESSON_CONFIG,
    status: "published",
  },
  ...Array.from(
    { length: 25 },
    (_, i): E2eLesson => ({
      legacyId: `e2e-catalog-${i}`,
      title: `E2E – Bài luyện ${String(i + 1).padStart(2, "0")}`,
      grade: 10,
      chapter: "Động học",
      tags: ["e2e"],
      sortOrder: i,
      config: DEFAULT_LESSON_CONFIG,
      status: "published",
    }),
  ),
  {
    legacyId: "e2e-draft",
    title: "E2E – Bản nháp kín",
    config: DEFAULT_LESSON_CONFIG,
    status: "draft",
  },
  {
    legacyId: "e2e-archived",
    title: "E2E – Đã lưu trữ",
    config: DEFAULT_LESSON_CONFIG,
    status: "archived",
  },
  // Own tag, so the catalog specs' counts for `tag=e2e` don't change.
  {
    legacyId: "e2e-runner",
    title: "E2E – Làm bài đủ dạng",
    grade: 12,
    chapter: "Dao động cơ",
    tags: ["e2e-runner"],
    sortOrder: -200,
    config: DEFAULT_LESSON_CONFIG,
    status: "published",
    questions: runnerQuestions,
  },
  {
    legacyId: "e2e-timer",
    title: "E2E – Hẹn giờ 1 phút",
    grade: 12,
    chapter: "Dao động cơ",
    tags: ["e2e-runner"],
    sortOrder: -199,
    config: { ...DEFAULT_LESSON_CONFIG, timeLimitSec: 60 },
    status: "published",
    questions: runnerQuestions.slice(0, 2),
  },
  // S4-03 reveal policies: the result page must not carry the answer key.
  {
    legacyId: "e2e-reveal-never",
    title: "E2E – Không công bố đáp án",
    grade: 12,
    chapter: "Dao động cơ",
    tags: ["e2e-runner"],
    sortOrder: -198,
    config: { ...DEFAULT_LESSON_CONFIG, revealAnswers: "never" },
    status: "published",
    questions: runnerQuestions.slice(0, 2),
  },
  {
    legacyId: "e2e-not-open",
    title: "E2E – Chưa đến giờ",
    grade: 12,
    chapter: "Dao động cơ",
    tags: ["e2e-runner"],
    sortOrder: -195,
    config: {
      ...DEFAULT_LESSON_CONFIG,
      startsAt: "2099-01-01T01:00:00+07:00",
    },
    status: "published",
    questions: runnerQuestions.slice(0, 2),
  },
  {
    legacyId: "e2e-closed",
    title: "E2E – Đã công bố đáp án",
    grade: 12,
    chapter: "Dao động cơ",
    tags: ["e2e-runner"],
    sortOrder: -194,
    config: {
      ...DEFAULT_LESSON_CONFIG,
      revealAnswers: "after_deadline",
      startsAt: "2026-01-05T01:00:00+07:00",
      timeLimitSec: 60,
    },
    status: "published",
    questions: runnerQuestions.slice(0, 2),
  },
  {
    legacyId: "e2e-guard",
    title: "E2E – Có giám sát",
    grade: 12,
    chapter: "Dao động cơ",
    tags: ["e2e-runner"],
    sortOrder: -196,
    config: { ...DEFAULT_LESSON_CONFIG, examGuard: true },
    status: "published",
    questions: runnerQuestions.slice(0, 2),
  },
  {
    legacyId: "e2e-reveal-later",
    title: "E2E – Đáp án sau giờ làm",
    grade: 12,
    chapter: "Dao động cơ",
    tags: ["e2e-runner"],
    sortOrder: -197,
    // Opened a minute before seeding; answers out an hour later.
    config: {
      ...DEFAULT_LESSON_CONFIG,
      revealAnswers: "after_deadline",
      startsAt: new Date(Date.now() - 60_000).toISOString(),
      timeLimitSec: 3600,
    },
    status: "published",
    questions: runnerQuestions.slice(0, 2),
  },
  // S5-04 journey 7, one per Playwright project (the spec republishes it).
  ...(["d", "m"] as const).map(
    (p): E2eLesson => ({
      legacyId: `e2e-publish-${p}`,
      title: `E2E – Xuất bản (${p})`,
      grade: 12,
      chapter: "Dao động cơ",
      tags: ["e2e-publish"],
      sortOrder: -190,
      // Unrated, so the leaderboard specs never see these students.
      config: { ...DEFAULT_LESSON_CONFIG, countsForRating: false },
      status: "published",
      questions: runnerQuestions.slice(0, 2),
    }),
  ),
  // S7-02 AI explanations, one per Playwright project so each generates its
  // own. No grade (off the dashboard's recommendations), unrated, last in
  // the catalog.
  ...(["d", "m"] as const).map(
    (p): E2eLesson => ({
      legacyId: `e2e-ai-${p}`,
      title: `E2E – Giải thích AI (${p})`,
      tags: ["e2e-ai"],
      sortOrder: 500,
      config: { ...DEFAULT_LESSON_CONFIG, countsForRating: false },
      status: "published",
      questions: aiQuestions(p),
    }),
  ),
  // S7-03 admin explanations, one per project; unpublished content would
  // hide it from the page, so published but off every student list.
  ...(["d", "m"] as const).map(
    (p): E2eLesson => ({
      legacyId: `e2e-ai-admin-${p}`,
      title: `E2E – Giải thích AI quản trị (${p})`,
      tags: ["e2e-ai"],
      sortOrder: 501,
      config: { ...DEFAULT_LESSON_CONFIG, countsForRating: false },
      status: "published",
      questions: aiAdminQuestions(p),
    }),
  ),
  // S7-06 review journey, one per project: no shuffle, so the test's
  // letters are known; own chapter, unrated, off every list.
  ...(["d", "m"] as const).map(
    (p): E2eLesson => ({
      legacyId: `e2e-review-${p}`,
      title: `E2E – Ôn tập (${p})`,
      chapter: `Ôn tập E2E (${p})`,
      tags: ["e2e-review"],
      sortOrder: 502,
      config: {
        ...DEFAULT_LESSON_CONFIG,
        countsForRating: false,
        shuffleQuestions: false,
        shuffleOptions: false,
      },
      status: "published",
      questions: reviewQuestions(p),
    }),
  ),
  ...(["d", "m"] as const).map(
    (p): E2eLesson => ({
      legacyId: `e2e-game-${p}`,
      title: `E2E – Đua tốc độ (${p})`,
      chapter: `Thi đấu E2E (${p})`,
      tags: ["e2e-game"],
      sortOrder: 503,
      config: { ...DEFAULT_LESSON_CONFIG, countsForRating: false },
      status: "published",
      questions: gameQuestions(p),
    }),
  ),
  // B-03 classes journey: one per project, owned by that project's teacher
  // (fixtures/users `e2eTeacherUsername`), so it is in no seeded class and
  // only that teacher sees it.
  ...(["d", "m"] as const).map(
    (p): E2eLesson => ({
      legacyId: `${TEACHER_LESSON_PREFIX}${p}`,
      title: `E2E – Bài của cô (${p})`,
      chapter: `Lớp học E2E (${p})`,
      tags: ["e2e-class"],
      sortOrder: 504,
      config: { ...DEFAULT_LESSON_CONFIG, countsForRating: false },
      status: "published",
      questions: runnerQuestions.slice(0, 2),
    }),
  ),
  // S6-05 statistics: archived (off the catalog and every student page);
  // the seed adds version 2 and the attempts of fixtures/stats.ts.
  {
    legacyId: STATS_LESSON.legacyId,
    title: STATS_LESSON.title,
    grade: 11,
    chapter: "Dòng điện không đổi",
    tags: ["e2e-stats"],
    sortOrder: -300,
    config: DEFAULT_LESSON_CONFIG,
    status: "archived",
    questions: statsQuestionsV1,
  },
];
