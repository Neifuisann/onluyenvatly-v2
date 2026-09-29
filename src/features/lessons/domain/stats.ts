/**
 * Lesson statistics (S6-05): what a version's submitted attempts say about
 * each question. Pure: questions and attempts in, numbers out. Displayed mcq
 * letters are mapped back to the teacher's options through each item's
 * option order, and short answers are grouped by the grader's own
 * normalization, so the numbers always agree with the marks.
 */
import { z } from "zod";
import type { AttemptItem } from "../../../db/schema.ts";
import {
  gradeItem,
  isBlank,
  originalOption,
  type TfScoring,
} from "../../grading/domain/grade.ts";
import {
  normalizeShortAnswer,
  shortAnswerMatches,
} from "../../grading/domain/short-answer.ts";
import type {
  McqQuestion,
  Question,
  QuestionType,
  ShortQuestion,
  TfQuestion,
} from "../schema.ts";

/** Latest submitted attempts read per version (the page says when capped). */
export const STATS_ATTEMPT_CAP = 2000;
/** Most frequent short answers shown per question. */
export const TOP_SHORT_ANSWERS = 5;
export const DISTRIBUTION_BUCKETS = 10;

export type StatsAttempt = {
  userId: string;
  name: string;
  score10: number | null;
  items: readonly AttemptItem[];
  answers: readonly unknown[];
  /** `attempts.earned`, aligned with `items`; null if never graded. */
  earned: readonly (number | null)[] | null;
};

export type McqOptionStat = {
  /** Index in the teacher's option list. */
  index: number;
  count: number;
  isKey: boolean;
  /** Distinct students who picked it, in Vietnamese name order. */
  students: string[];
};

export type McqDetail = {
  type: "mcq";
  options: McqOptionStat[];
  blank: number;
  blankStudents: string[];
};

export type TfStatementStat = {
  index: number;
  answer: boolean;
  correct: number;
  blank: number;
  /** correct / attempts that had the question; null when none did. */
  correctRate: number | null;
};

export type TfDetail = { type: "tf"; statements: TfStatementStat[] };

export type ShortAnswerStat = {
  answer: string;
  count: number;
  correct: boolean;
};

export type ShortDetail = {
  type: "short";
  top: ShortAnswerStat[];
  /** Distinct normalized answers, including those beyond the top 5. */
  distinct: number;
  blank: number;
};

export type QuestionStats = {
  id: string;
  /** 1-based position in the version. */
  position: number;
  type: QuestionType;
  /** Attempts that had this question. */
  seen: number;
  /** …and did not leave it blank. */
  answered: number;
  fullMarks: number;
  /** fullMarks / seen; null when nobody had it. */
  fullMarksRate: number | null;
  /** Mean of earned / points over `seen`; null when nobody had it. */
  averageShare: number | null;
  detail: McqDetail | TfDetail | ShortDetail;
};

export type LessonStats = {
  attempts: number;
  students: number;
  /** score10, 2 decimals; null without attempts. */
  average: number | null;
  median: number | null;
  /** Counts of score10 in [0,1), [1,2) … [9,10] (10 is in the last). */
  distribution: number[];
  /** In version order. */
  questions: QuestionStats[];
};

const round2 = (x: number) => Math.round(x * 100 + 1e-9) / 100;
const byName = new Intl.Collator("vi").compare;

type Acc = {
  q: Question;
  position: number;
  seen: number;
  answered: number;
  fullMarks: number;
  shareSum: number;
  // mcq
  options: { count: number; students: Map<string, string> }[];
  blank: number;
  blankStudents: Map<string, string>;
  // tf
  tf: { correct: number; blank: number }[];
  // short
  short: Map<string, ShortAnswerStat>;
};

function newAcc(q: Question, position: number): Acc {
  return {
    q,
    position,
    seen: 0,
    answered: 0,
    fullMarks: 0,
    shareSum: 0,
    options:
      q.type === "mcq"
        ? q.options.map(() => ({ count: 0, students: new Map() }))
        : [],
    blank: 0,
    blankStudents: new Map(),
    tf:
      q.type === "tf" ? q.statements.map(() => ({ correct: 0, blank: 0 })) : [],
    short: new Map(),
  };
}

/**
 * Share of the item's points the student got: from the stored marks when
 * present (what the student was actually given), else graded again.
 */
function shareOf(
  q: Question,
  item: AttemptItem,
  answer: unknown,
  earned: number | null | undefined,
  tfScoring: TfScoring,
): number {
  if (item.p > 0 && typeof earned === "number")
    return Math.min(1, Math.max(0, earned / item.p));
  return gradeItem(q, { ...item, p: 1 }, answer, tfScoring).earned;
}

function countMcq(
  acc: Acc,
  q: McqQuestion,
  item: AttemptItem,
  answer: unknown,
  a: StatsAttempt,
) {
  if (isBlank(answer)) {
    acc.blank++;
    acc.blankStudents.set(a.userId, a.name);
    return;
  }
  const original = originalOption(answer, item, q.options.length);
  const option = original === null ? undefined : acc.options[original];
  if (!option) return; // not a letter of this question: counted nowhere
  option.count++;
  option.students.set(a.userId, a.name);
}

function countTf(acc: Acc, q: TfQuestion, answer: unknown) {
  const given = Array.isArray(answer) ? answer : null;
  q.statements.forEach((s, i) => {
    const row = acc.tf[i];
    if (!row) return;
    const v: unknown = given ? given[i] : isBlank(answer) ? null : undefined;
    if (v === null || v === undefined) {
      // A whole blank answer leaves every statement blank; a malformed
      // (non-array) one is wrong, as the grader sees it.
      if (given || isBlank(answer)) row.blank++;
    } else if (v === s.answer) row.correct++;
  });
}

function countShort(acc: Acc, q: ShortQuestion, answer: unknown) {
  if (isBlank(answer)) {
    acc.blank++;
    return;
  }
  if (typeof answer !== "string") return;
  const key = normalizeShortAnswer(answer);
  const hit = acc.short.get(key);
  if (hit) hit.count++;
  else
    acc.short.set(key, {
      answer: key,
      count: 1,
      correct: shortAnswerMatches(answer, q.answer, q.tolerance),
    });
}

function names(map: Map<string, string>): string[] {
  return [...map.values()].sort(byName);
}

function finish(acc: Acc): QuestionStats {
  const { q, seen } = acc;
  let detail: QuestionStats["detail"];
  if (q.type === "mcq")
    detail = {
      type: "mcq",
      options: acc.options.map((o, index) => ({
        index,
        count: o.count,
        isKey: index === q.answer,
        students: names(o.students),
      })),
      blank: acc.blank,
      blankStudents: names(acc.blankStudents),
    };
  else if (q.type === "tf")
    detail = {
      type: "tf",
      statements: q.statements.map((s, index) => {
        const row = acc.tf[index] ?? { correct: 0, blank: 0 };
        return {
          index,
          answer: s.answer,
          correct: row.correct,
          blank: row.blank,
          correctRate: seen > 0 ? row.correct / seen : null,
        };
      }),
    };
  else {
    const all = [...acc.short.values()].sort(
      (a, b) =>
        b.count - a.count ||
        Number(b.correct) - Number(a.correct) ||
        byName(a.answer, b.answer),
    );
    detail = {
      type: "short",
      top: all.slice(0, TOP_SHORT_ANSWERS),
      distinct: all.length,
      blank: acc.blank,
    };
  }
  return {
    id: q.id,
    position: acc.position,
    type: q.type,
    seen,
    answered: acc.answered,
    fullMarks: acc.fullMarks,
    fullMarksRate: seen > 0 ? acc.fullMarks / seen : null,
    averageShare: seen > 0 ? acc.shareSum / seen : null,
    detail,
  };
}

function median(sorted: readonly number[]): number | null {
  const n = sorted.length;
  if (n === 0) return null;
  const mid = Math.floor(n / 2);
  const hi = sorted[mid] as number;
  return n % 2 ? hi : round2(((sorted[mid - 1] as number) + hi) / 2);
}

export function scoreBucket(score10: number): number {
  const b = Math.floor(Math.min(10, Math.max(0, score10)));
  return Math.min(DISTRIBUTION_BUCKETS - 1, b);
}

/**
 * @param questions the version's questions (with answers), in order.
 * @param attempts its submitted attempts. Items whose question id is not in
 *   the version are ignored.
 */
export function computeLessonStats(
  questions: readonly Question[],
  attempts: readonly StatsAttempt[],
  tfScoring: TfScoring,
): LessonStats {
  const accs = new Map<string, Acc>();
  questions.forEach((q, i) => {
    accs.set(q.id, newAcc(q, i + 1));
  });
  const students = new Set<string>();
  const scores: number[] = [];
  const distribution = Array.from({ length: DISTRIBUTION_BUCKETS }, () => 0);

  for (const a of attempts) {
    students.add(a.userId);
    if (a.score10 !== null) {
      scores.push(a.score10);
      const b = scoreBucket(a.score10);
      distribution[b] = (distribution[b] ?? 0) + 1;
    }
    a.items.forEach((item, i) => {
      const acc = accs.get(item.q);
      if (!acc) return;
      const answer = a.answers[i];
      const { q } = acc;
      acc.seen++;
      if (!isBlank(answer)) acc.answered++;
      const share = shareOf(q, item, answer, a.earned?.[i], tfScoring);
      acc.shareSum += share;
      if (share >= 1 - 1e-9) acc.fullMarks++;
      if (q.type === "mcq") countMcq(acc, q, item, answer, a);
      else if (q.type === "tf") countTf(acc, q, answer);
      else countShort(acc, q, answer);
    });
  }

  scores.sort((x, y) => x - y);
  const sum = scores.reduce((s, x) => s + x, 0);
  return {
    attempts: attempts.length,
    students: students.size,
    average: scores.length ? round2(sum / scores.length) : null,
    median: median(scores),
    distribution,
    questions: [...accs.values()].map(finish),
  };
}

export const STATS_SORTS = ["order", "hardest"] as const;
export type StatsSort = (typeof STATS_SORTS)[number];

/**
 * "Khó nhất trước": lowest full-marks rate, then lowest average share, then
 * version order; questions nobody had go last.
 */
export function sortQuestionStats(
  list: readonly QuestionStats[],
  sort: StatsSort,
): QuestionStats[] {
  if (sort === "order") return [...list];
  const rank = (x: number | null) => (x === null ? 2 : x);
  return [...list].sort(
    (a, b) =>
      rank(a.fullMarksRate) - rank(b.fullMarksRate) ||
      rank(a.averageShare) - rank(b.averageShare) ||
      a.position - b.position,
  );
}

export type StatsParams = { version: number | null; sort: StatsSort };

type RawParams = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;

const ParamsSchema = z.object({
  version: z.coerce
    .number()
    .int()
    .positive()
    .max(Number.MAX_SAFE_INTEGER)
    .nullable()
    .catch(null),
  sort: z.enum(STATS_SORTS).catch("order"),
});

/** Never throws: anything invalid falls back to the defaults. */
export function parseStatsParams(params: RawParams): StatsParams {
  return ParamsSchema.parse({
    version: first(params.version) || null,
    sort: first(params.sort),
  });
}

export function statsHref(
  lessonId: number,
  p: StatsParams,
  patch: Partial<StatsParams> = {},
): string {
  const next = { ...p, ...patch };
  const params = new URLSearchParams();
  if (next.version) params.set("version", String(next.version));
  if (next.sort !== "order") params.set("sort", next.sort);
  const qs = params.toString();
  return `/admin/lessons/${lessonId}/stats${qs ? `?${qs}` : ""}`;
}

export type StatsVersion = {
  id: number;
  version: number;
  createdAt: Date;
  attempts: number;
};

/**
 * The picker: versions with submitted attempts, plus the current version
 * (even without attempts, so a fresh publish shows as empty), newest first.
 */
export function statsVersionOptions(
  withAttempts: readonly StatsVersion[],
  current: Omit<StatsVersion, "attempts"> | null,
): StatsVersion[] {
  const list = [...withAttempts];
  if (current && !list.some((v) => v.id === current.id))
    list.push({ ...current, attempts: 0 });
  return list.sort((a, b) => b.version - a.version);
}

/** The requested version if listed, else the current one, else the newest. */
export function chooseStatsVersion(
  options: readonly StatsVersion[],
  requested: number | null,
  currentId: number | null,
): StatsVersion | null {
  return (
    options.find((v) => v.id === requested) ??
    options.find((v) => v.id === currentId) ??
    options[0] ??
    null
  );
}
