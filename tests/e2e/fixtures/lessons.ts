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

export const e2eLessons: NewLesson[] = [
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
    (_, i): NewLesson => ({
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
];
