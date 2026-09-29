import type { AttemptAnswer, AttemptItem } from "../../../src/db/schema.ts";
import type { Question } from "../../../src/features/lessons/schema.ts";

/**
 * S6-05 lesson statistics: a hand-computed fixture shared by the unit test
 * (`lessons/domain/stats.test.ts`) and the e2e seed (`admin-stats.spec`).
 * The lesson is archived, so no catalog, dashboard or runner spec sees it,
 * and nothing but the seed writes its attempts. Every `earned` below is what
 * the grader gives (the unit test checks that too).
 */
export const STATS_LESSON = {
  legacyId: "e2e-stats",
  title: "E2E – Thống kê",
} as const;

/** Version 1 (older, one attempt). */
export const statsQuestionsV1: Question[] = [
  {
    id: "q_st_mcq",
    type: "mcq",
    stem: "Đơn vị của cường độ dòng điện là",
    options: [{ text: "V" }, { text: "W" }, { text: "A" }, { text: "Ω" }],
    answer: 2,
  },
  {
    id: "q_st_old",
    type: "short",
    stem: "Điện trở (Ω) khi $U = 20$ V, $I = 2$ A?",
    answer: "10",
  },
];

/** Version 2 (current, five attempts). Every question is worth 1 point. */
export const statsQuestionsV2: Question[] = [
  statsQuestionsV1[0] as Question,
  {
    id: "q_st_tf",
    type: "tf",
    stem: "Về dòng điện không đổi:",
    statements: [
      { text: "Có chiều không đổi.", answer: true },
      { text: "Có cường độ thay đổi theo thời gian.", answer: false },
      { text: "Đo bằng ampe kế.", answer: true },
      { text: "Chỉ chạy trong kim loại.", answer: false },
    ],
  },
  {
    id: "q_st_short",
    type: "short",
    stem: "Cường độ dòng điện (A) khi $q = 3$ C chạy qua trong $2$ s?",
    answer: "1.5",
  },
];

export type StatsFixtureAttempt = {
  /** Index into `statsStudents`. */
  student: number;
  version: 1 | 2;
  hoursAgo: number;
  items: AttemptItem[];
  answers: AttemptAnswer[];
  earned: number[];
  score10: number;
};

/** Five students of their own (grade 10, unrated: off every leaderboard). */
export const statsStudents = [
  { phone: "0900000030", fullName: "Nguyễn Thống Kê An" },
  { phone: "0900000031", fullName: "Trần Thống Kê Bình" },
  { phone: "0900000032", fullName: "Lê Thống Kê Chi" },
  { phone: "0900000033", fullName: "Phạm Thống Kê Dũng" },
  { phone: "0900000034", fullName: "Hoàng Thống Kê Giang" },
] as const;

const items = (o: number[]): AttemptItem[] => [
  { q: "q_st_mcq", o, p: 1 },
  { q: "q_st_tf", p: 1 },
  { q: "q_st_short", p: 1 },
];

/**
 * Version 2, shown order → original option through `o`:
 * - An:    "C" (o id.) → C ✓ · tf 4/4 → 1    · "1,5"  ✓ → 3    / 3 = 10
 * - Bình:  "B" o[1]=2 → C ✓ · tf 3/4 → 0.5  · "1.50" ✓ → 2.5  / 3 = 8.33
 * - Chi:   "A" o[0]=1 → B ✗ · tf 1/4 → 0.1  · "2"    ✗ → 0.1  / 3 = 0.33
 * - Dũng:  "A" o[0]=0 → A ✗ · tf 2/4 → 0.25 · blank   → 0.25 / 3 = 0.83
 * - Giang: blank           · tf blank → 0   · " 1,5 " ✓ → 1   / 3 = 3.33
 * (tf THPT 2025: 1/4 → 0.1, 2/4 → 0.25, 3/4 → 0.5; unanswered = wrong.)
 */
export const statsAttempts: StatsFixtureAttempt[] = [
  {
    student: 0,
    version: 2,
    hoursAgo: 30,
    items: items([0, 1, 2, 3]),
    answers: ["C", [true, false, true, false], "1,5"],
    earned: [1, 1, 1],
    score10: 10,
  },
  {
    student: 1,
    version: 2,
    hoursAgo: 29,
    items: items([3, 2, 1, 0]),
    answers: ["B", [true, false, false, false], "1.50"],
    earned: [1, 0.5, 1],
    score10: 8.33,
  },
  {
    student: 2,
    version: 2,
    hoursAgo: 28,
    items: items([1, 0, 3, 2]),
    answers: ["A", [true, true, false, true], "2"],
    earned: [0, 0.1, 0],
    score10: 0.33,
  },
  {
    student: 3,
    version: 2,
    hoursAgo: 27,
    items: items([0, 1, 2, 3]),
    answers: ["A", [true, false, null, null], null],
    earned: [0, 0.25, 0],
    score10: 0.83,
  },
  {
    student: 4,
    version: 2,
    hoursAgo: 26,
    items: items([2, 3, 0, 1]),
    answers: [null, null, " 1,5 "],
    earned: [0, 0, 1],
    score10: 3.33,
  },
  // Version 1, outside the dashboard's week.
  {
    student: 0,
    version: 1,
    hoursAgo: 24 * 12,
    items: [
      { q: "q_st_mcq", p: 1 },
      { q: "q_st_old", p: 1 },
    ],
    answers: ["C", "10"],
    earned: [1, 1],
    score10: 10,
  },
];
