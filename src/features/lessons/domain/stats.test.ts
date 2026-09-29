import { describe, expect, it } from "vitest";
import {
  statsAttempts,
  statsQuestionsV1,
  statsQuestionsV2,
  statsStudents,
} from "../../../../tests/e2e/fixtures/stats";
import { grade } from "../../grading/domain/grade";
import type { Question } from "../schema";
import {
  chooseStatsVersion,
  computeLessonStats,
  type McqDetail,
  parseStatsParams,
  type QuestionStats,
  type ShortDetail,
  type StatsAttempt,
  scoreBucket,
  sortQuestionStats,
  statsHref,
  statsVersionOptions,
  type TfDetail,
} from "./stats";

const toStats = (version: 1 | 2): StatsAttempt[] =>
  statsAttempts
    .filter((a) => a.version === version)
    .map((a) => ({
      userId: `u${a.student}`,
      name: statsStudents[a.student]?.fullName ?? "?",
      score10: a.score10,
      items: a.items,
      answers: a.answers,
      earned: a.earned,
    }));

const detail = <T>(q: QuestionStats | undefined) => q?.detail as T;

describe("the hand-computed fixture (tests/e2e/fixtures/stats.ts)", () => {
  it("stores what the grader gives", () => {
    for (const a of statsAttempts) {
      const qs = a.version === 1 ? statsQuestionsV1 : statsQuestionsV2;
      const aligned = a.items.map(
        (item) => qs.find((q) => q.id === item.q) as Question,
      );
      const g = grade(aligned, a.items, a.answers, "thpt2025");
      expect(g.earned).toEqual(a.earned);
      expect(g.score10).toBe(a.score10);
    }
  });

  // Worked out by hand in the fixture's comment; literal numbers only.
  const stats = computeLessonStats(statsQuestionsV2, toStats(2), "thpt2025");

  it("summarizes the attempts", () => {
    expect(stats.attempts).toBe(5);
    expect(stats.students).toBe(5);
    // (10 + 8.33 + 0.33 + 0.83 + 3.33) / 5 = 4.564
    expect(stats.average).toBe(4.56);
    // 0.33, 0.83, [3.33], 8.33, 10
    expect(stats.median).toBe(3.33);
    expect(stats.distribution).toEqual([2, 0, 0, 1, 0, 0, 0, 0, 1, 1]);
    expect(stats.questions.map((q) => [q.id, q.position, q.type])).toEqual([
      ["q_st_mcq", 1, "mcq"],
      ["q_st_tf", 2, "tf"],
      ["q_st_short", 3, "short"],
    ]);
  });

  it("maps mcq letters back to the original options", () => {
    const [mcq] = stats.questions;
    expect(mcq?.seen).toBe(5);
    expect(mcq?.answered).toBe(4);
    expect(mcq?.fullMarks).toBe(2);
    expect(mcq?.fullMarksRate).toBe(0.4);
    expect(mcq?.averageShare).toBe(0.4);
    const d = detail<McqDetail>(mcq);
    expect(d.options).toEqual([
      { index: 0, count: 1, isKey: false, students: ["Phạm Thống Kê Dũng"] },
      { index: 1, count: 1, isKey: false, students: ["Lê Thống Kê Chi"] },
      {
        index: 2,
        count: 2,
        isKey: true,
        students: ["Nguyễn Thống Kê An", "Trần Thống Kê Bình"],
      },
      { index: 3, count: 0, isKey: false, students: [] },
    ]);
    expect(d.blank).toBe(1);
    expect(d.blankStudents).toEqual(["Hoàng Thống Kê Giang"]);
  });

  it("counts true/false statements", () => {
    const tf = stats.questions[1];
    expect(tf?.answered).toBe(4);
    expect(tf?.fullMarks).toBe(1);
    expect(tf?.fullMarksRate).toBe(0.2);
    // (1 + 0.5 + 0.1 + 0.25 + 0) / 5
    expect(tf?.averageShare).toBeCloseTo(0.37, 10);
    expect(detail<TfDetail>(tf).statements).toEqual([
      { index: 0, answer: true, correct: 4, blank: 1, correctRate: 0.8 },
      { index: 1, answer: false, correct: 3, blank: 1, correctRate: 0.6 },
      { index: 2, answer: true, correct: 1, blank: 2, correctRate: 0.2 },
      { index: 3, answer: false, correct: 2, blank: 2, correctRate: 0.4 },
    ]);
  });

  it("groups short answers by the grader's normalization", () => {
    const short = stats.questions[2];
    expect(short?.answered).toBe(4);
    expect(short?.fullMarks).toBe(3);
    expect(short?.fullMarksRate).toBe(0.6);
    expect(short?.averageShare).toBe(0.6);
    expect(detail<ShortDetail>(short)).toEqual({
      type: "short",
      top: [
        { answer: "1.5", count: 2, correct: true },
        { answer: "1.50", count: 1, correct: true },
        { answer: "2", count: 1, correct: false },
      ],
      distinct: 3,
      blank: 1,
    });
  });

  it("sorts hardest first", () => {
    expect(
      sortQuestionStats(stats.questions, "hardest").map((q) => q.id),
    ).toEqual(["q_st_tf", "q_st_mcq", "q_st_short"]);
    expect(sortQuestionStats(stats.questions, "order")).toEqual(
      stats.questions,
    );
  });

  it("keeps versions apart", () => {
    const v1 = computeLessonStats(statsQuestionsV1, toStats(1), "thpt2025");
    expect(v1.attempts).toBe(1);
    expect(v1.average).toBe(10);
    expect(v1.median).toBe(10);
    expect(v1.distribution).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 1]);
    expect(v1.questions.map((q) => q.fullMarksRate)).toEqual([1, 1]);
  });
});

describe("computeLessonStats edge cases", () => {
  const mcq: Question = {
    id: "q_m",
    type: "mcq",
    stem: "?",
    options: [{ text: "a" }, { text: "b" }],
    answer: 0,
  };
  const tf: Question = {
    id: "q_t",
    type: "tf",
    stem: "?",
    statements: [
      { text: "a", answer: true },
      { text: "b", answer: false },
    ],
  };
  const short: Question = {
    id: "q_s",
    type: "short",
    stem: "?",
    answer: "2",
  };
  const unseen: Question = { ...short, id: "q_unseen" };
  const attempt = (
    userId: string,
    answers: unknown[],
    earned: (number | null)[] | null,
    score10: number | null = 5,
  ): StatsAttempt => ({
    userId,
    name: userId,
    score10,
    items: [
      { q: "q_m", p: 1 },
      { q: "q_t", p: 1 },
      { q: "q_s", p: 1 },
      { q: "q_gone", p: 1 },
    ],
    answers,
    earned,
  });

  it("is empty without attempts", () => {
    const s = computeLessonStats([mcq, unseen], [], "thpt2025");
    expect(s).toMatchObject({
      attempts: 0,
      students: 0,
      average: null,
      median: null,
      distribution: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    });
    expect(s.questions[0]).toMatchObject({
      seen: 0,
      fullMarksRate: null,
      averageShare: null,
    });
  });

  it("grades again when marks are missing, ignores unknown ids and bad answers", () => {
    const s = computeLessonStats(
      [mcq, tf, short, unseen],
      [
        // Not graded: shares come from the grader (proportional tf).
        attempt("u1", ["A", [true, true], "2", "x"], null),
        // Invalid letter, malformed tf, non-string short; same student.
        attempt("u1", ["Z", "yes", 42, "x"], [0, 0, 0, 0], 10),
        // Even count of scores, unscored attempt.
        attempt("u2", ["B", [null, false], "3", null], [0, 0.5, 0], 0),
        attempt("u3", [null, null, null], [0, 0, 0], null),
      ],
      "proportional",
    );
    expect(s.attempts).toBe(4);
    expect(s.students).toBe(3);
    expect(s.average).toBe(5); // (5 + 10 + 0) / 3
    expect(s.median).toBe(5);
    expect(s.distribution).toEqual([1, 0, 0, 0, 0, 1, 0, 0, 0, 1]);
    const [m, t, sh, un] = s.questions;
    expect(m).toMatchObject({ seen: 4, answered: 3, fullMarks: 1 });
    expect(detail<McqDetail>(m).options.map((o) => o.count)).toEqual([1, 1]);
    expect(detail<McqDetail>(m).blank).toBe(1);
    // u1 proportional 1/2 → 0.5, u2 earned 0.5.
    expect(t?.averageShare).toBe(0.25);
    expect(detail<TfDetail>(t).statements).toEqual([
      { index: 0, answer: true, correct: 1, blank: 2, correctRate: 0.25 },
      { index: 1, answer: false, correct: 1, blank: 1, correctRate: 0.25 },
    ]);
    expect(sh).toMatchObject({ seen: 4, answered: 3, fullMarks: 1 });
    expect(detail<ShortDetail>(sh)).toMatchObject({ distinct: 2, blank: 1 });
    expect(un?.seen).toBe(0);
    expect(sortQuestionStats(s.questions, "hardest").at(-1)?.id).toBe(
      "q_unseen",
    );
  });

  it("keeps the five most frequent short answers", () => {
    const answers = ["1", "1", "2", "3", "4", "5", "6"];
    const s = computeLessonStats(
      [short],
      answers.map((a, i) => ({
        userId: `u${i}`,
        name: `u${i}`,
        score10: 1,
        items: [{ q: "q_s", p: 1 }],
        answers: [a],
        earned: [a === "2" ? 1 : 0],
      })),
      "thpt2025",
    );
    const d = detail<ShortDetail>(s.questions[0]);
    expect(d.distinct).toBe(6);
    expect(d.top.map((x) => x.answer)).toEqual(["1", "2", "3", "4", "5"]);
    expect(d.top[1]?.correct).toBe(true);
  });

  it("buckets scores, 10 in the last", () => {
    expect([0, 0.99, 1, 9.99, 10, -1, 11].map(scoreBucket)).toEqual([
      0, 0, 1, 9, 9, 0, 9,
    ]);
  });
});

describe("stats page params", () => {
  it("parses and falls back", () => {
    expect(parseStatsParams({})).toEqual({ version: null, sort: "order" });
    expect(parseStatsParams({ version: "12", sort: "hardest" })).toEqual({
      version: 12,
      sort: "hardest",
    });
    expect(parseStatsParams({ version: ["x", "3"], sort: "worst" })).toEqual({
      version: null,
      sort: "order",
    });
    expect(parseStatsParams({ version: "-3" }).version).toBeNull();
  });

  it("builds links", () => {
    const p = { version: null, sort: "order" } as const;
    expect(statsHref(7, p)).toBe("/admin/lessons/7/stats");
    expect(statsHref(7, p, { version: 3, sort: "hardest" })).toBe(
      "/admin/lessons/7/stats?version=3&sort=hardest",
    );
  });

  const at = new Date("2026-09-01T00:00:00Z");
  const v = (id: number, version: number, attempts: number) => ({
    id,
    version,
    createdAt: at,
    attempts,
  });

  it("lists versions with attempts plus the current one, newest first", () => {
    expect(statsVersionOptions([v(1, 1, 4)], v(5, 3, 0))).toEqual([
      v(5, 3, 0),
      v(1, 1, 4),
    ]);
    expect(statsVersionOptions([v(1, 1, 4), v(5, 3, 2)], v(5, 3, 0))).toEqual([
      v(5, 3, 2),
      v(1, 1, 4),
    ]);
    expect(statsVersionOptions([], null)).toEqual([]);
  });

  it("chooses the requested, else the current, else the newest version", () => {
    const list = [v(5, 3, 2), v(1, 1, 4)];
    expect(chooseStatsVersion(list, 1, 5)?.id).toBe(1);
    expect(chooseStatsVersion(list, 99, 5)?.id).toBe(5);
    expect(chooseStatsVersion(list, null, null)?.id).toBe(5);
    expect(chooseStatsVersion([], null, 5)).toBeNull();
  });
});
