import type { NewLesson } from "../../../src/db/schema.ts";
import {
  DEFAULT_LESSON_CONFIG,
  type Question,
} from "../../../src/features/lessons/schema.ts";

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

export type E2eLesson = NewLesson & { questions?: Question[] };

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
    legacyId: "e2e-reveal-later",
    title: "E2E – Đáp án sau giờ làm",
    grade: 12,
    chapter: "Dao động cơ",
    tags: ["e2e-runner"],
    sortOrder: -197,
    config: {
      ...DEFAULT_LESSON_CONFIG,
      revealAnswers: "after_deadline",
      timeLimitSec: 3600,
    },
    status: "published",
    questions: runnerQuestions.slice(0, 2),
  },
];
