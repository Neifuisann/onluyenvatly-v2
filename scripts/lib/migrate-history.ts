/** S9-06: transaction-scoped historical import. Reports contain counts only. */
import { createHash } from "node:crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "../../src/db/schema.ts";
import { outcomeOf } from "../../src/features/attempts/domain/review.ts";
import { normalizeLegacyResult } from "../../src/features/lessons/domain/legacy-results.ts";
import { serializeLesson } from "../../src/features/lessons/domain/serializer.ts";
import { QuestionsSchema } from "../../src/features/lessons/schema.ts";
import { replayRatings } from "../../src/features/rating/domain/rating.ts";
import { nextMistake } from "../../src/features/review/domain/mistakes.ts";
import type { V1Row } from "./migrate-legacy.ts";

type Db<Q extends PgQueryResultHKT> = PgDatabase<Q, typeof schema>;
const {
  users,
  lessons,
  lessonVersions,
  attempts,
  ratingEvents,
  ratings,
  mistakes,
} = schema;
export const legacyHash = (content: unknown) =>
  createHash("sha256").update(JSON.stringify(content)).digest("hex");
const date = (value: unknown) => {
  const d = value instanceof Date ? value : new Date(String(value));
  if (!Number.isFinite(d.getTime()))
    throw new Error("invalid history timestamp");
  return d;
};
const chunks = <T>(rows: T[], size = 200) =>
  Array.from({ length: Math.ceil(rows.length / size) }, (_, i) =>
    rows.slice(i * size, (i + 1) * size),
  );
export type HistoryReport = {
  results: number;
  inserted: number;
  existing: number;
  skipped: Record<string, number>;
  versions: number;
  events: number;
  eventsExisting: number;
  unmatchedEvents: number;
  skippedEvents: number;
  ratings: number;
  nativeRatingsRebased: number;
  mistakes: number;
};

export async function migrateHistory<Q extends PgQueryResultHKT>(
  db: Db<Q>,
  results: AsyncIterable<readonly V1Row[]> | Iterable<readonly V1Row[]>,
  history: readonly V1Row[],
  snapshots: readonly V1Row[],
): Promise<HistoryReport> {
  const report: HistoryReport = {
    results: 0,
    inserted: 0,
    existing: 0,
    skipped: {},
    versions: 0,
    events: 0,
    eventsExisting: 0,
    unmatchedEvents: 0,
    skippedEvents: 0,
    ratings: 0,
    nativeRatingsRebased: 0,
    mistakes: 0,
  };
  const userMap = new Map(
    (await db.select({ id: users.id, legacyId: users.legacyId }).from(users))
      .filter((u) => u.legacyId !== null)
      .map((u) => [u.legacyId, u.id]),
  );
  const lessonMap = new Map(
    (
      await db
        .select({
          id: lessons.id,
          legacyId: lessons.legacyId,
          currentVersionId: lessons.currentVersionId,
        })
        .from(lessons)
    ).map((l) => [l.legacyId, l]),
  );
  const versions = await db.select().from(lessonVersions);
  const versionMap = new Map(
    versions.map((v) => [
      v.id,
      { ...v, questions: QuestionsSchema.parse(v.questions) },
    ]),
  );
  const hashMap = new Map(
    versions
      .filter((v) => v.legacyHash)
      .map((v) => [`${v.lessonId}:${v.legacyHash}`, v.id]),
  );
  const maxVersion = new Map<number, number>();
  for (const v of versions)
    maxVersion.set(
      v.lessonId,
      Math.max(maxVersion.get(v.lessonId) ?? 0, v.version),
    );
  const existing = new Set(
    (await db.select({ legacyId: attempts.legacyResultId }).from(attempts)).map(
      (a) => a.legacyId,
    ),
  );
  const skip = (reason: string) => {
    report.skipped[reason] = (report.skipped[reason] ?? 0) + 1;
  };
  for await (const batch of results) {
    const insert: (typeof attempts.$inferInsert)[] = [];
    for (const row of batch) {
      report.results++;
      const legacyResultId = String(row.id);
      const wasExisting = existing.has(legacyResultId);
      const userId = userMap.get(String(row.student_id));
      const lesson = lessonMap.get(String(row.lesson_id));
      if (!userId) {
        skip("student not migrated");
        continue;
      }
      if (!lesson) {
        skip("lesson not migrated");
        continue;
      }
      const current =
        lesson.currentVersionId === null
          ? undefined
          : versionMap.get(lesson.currentVersionId);
      let normalized: ReturnType<typeof normalizeLegacyResult>;
      let submittedAt: Date;
      const score = Number(row.score),
        maxScore = Number(row.total_points);
      try {
        submittedAt = date(row.timestamp);
        if (
          !Number.isFinite(score) ||
          !Number.isFinite(maxScore) ||
          score < 0 ||
          maxScore <= 0 ||
          score > maxScore + 0.011 ||
          maxScore > 99999
        )
          throw new Error("invalid result score");
        normalized = normalizeLegacyResult(
          row.questions,
          current?.questions ?? [],
          (content) => `q_h${legacyHash(content).slice(0, 24)}`,
        );
      } catch (error) {
        skip(error instanceof Error ? error.message : "invalid result");
        continue;
      }
      const historical = new Map(
        normalized
          .filter((i) => i.historical)
          .map((i) => [i.question.id, i.question]),
      );
      // One id cannot represent two different questions within a snapshot.
      if (
        normalized.some(
          (i) =>
            i.historical &&
            JSON.stringify(historical.get(i.question.id)) !==
              JSON.stringify(i.question),
        )
      ) {
        skip("conflicting embedded ids");
        continue;
      }
      let historicalVersionId: number | undefined;
      if (historical.size) {
        const questions = [...historical.values()].sort((a, b) =>
          a.id.localeCompare(b.id),
        );
        const hash = legacyHash(questions);
        const key = `${lesson.id}:${hash}`;
        historicalVersionId = hashMap.get(key);
        if (historicalVersionId === undefined) {
          const version = (maxVersion.get(lesson.id) ?? 0) + 1;
          const [created] = await db
            .insert(lessonVersions)
            .values({
              lessonId: lesson.id,
              version,
              legacyHash: hash,
              questions,
              sourceText: serializeLesson(questions),
              createdAt: submittedAt,
            })
            .returning();
          if (!created) throw new Error("historical version insert failed");
          historicalVersionId = created.id;
          versionMap.set(created.id, { ...created, questions });
          hashMap.set(key, created.id);
          maxVersion.set(lesson.id, version);
          report.versions++;
        }
      }
      const baseVersion = current?.id ?? historicalVersionId;
      if (baseVersion === undefined) {
        skip("missing content version");
        continue;
      }
      const rawTime = Number(row.time_taken ?? 0);
      if (!Number.isFinite(rawTime) || rawTime < 0 || rawTime > 2147483647) {
        skip("invalid result duration");
        continue;
      }
      const timeTakenSec = Math.round(rawTime);
      insert.push({
        legacyResultId,
        userId,
        lessonId: lesson.id,
        lessonVersionId: baseVersion,
        mode: row.mode === "practice" ? "practice" : "test",
        status: "submitted",
        counterRecorded: true,
        items: normalized.map((i) => ({
          q: i.question.id,
          p: i.points,
          ...(i.historical &&
            historicalVersionId !== undefined &&
            historicalVersionId !== baseVersion && { v: historicalVersionId }),
          ...(i.order && { o: i.order }),
        })),
        answers: normalized.map((i) => i.answer),
        earned: normalized.map((i) => i.earned),
        score,
        maxScore,
        score10: Math.round((score / maxScore) * 1000) / 100,
        startedAt: new Date(submittedAt.getTime() - timeTakenSec * 1000),
        submittedAt,
        timeTakenSec,
        // Old IP/guard metadata is not needed to preserve scores or history.
        ip: null,
        guardEvents: [],
      });
      existing.add(legacyResultId);
      if (wasExisting) report.existing++;
    }
    for (const part of chunks(insert)) {
      const written = await db
        .insert(attempts)
        .values(part)
        .onConflictDoUpdate({
          target: attempts.legacyResultId,
          set: {
            userId: sql`excluded.user_id`,
            lessonId: sql`excluded.lesson_id`,
            lessonVersionId: sql`excluded.lesson_version_id`,
            mode: sql`excluded.mode`,
            status: "submitted",
            items: sql`excluded.items`,
            answers: sql`excluded.answers`,
            earned: sql`excluded.earned`,
            score: sql`excluded.score`,
            maxScore: sql`excluded.max_score`,
            score10: sql`excluded.score10`,
            startedAt: sql`excluded.started_at`,
            submittedAt: sql`excluded.submitted_at`,
            timeTakenSec: sql`excluded.time_taken_sec`,
          },
        })
        .returning({ inserted: sql<boolean>`(xmax = 0)` });
      report.inserted += written.filter((r) => r.inserted).length;
    }
  }
  const importedAttempts = await db
    .select({
      id: attempts.id,
      userId: attempts.userId,
      lessonId: attempts.lessonId,
      submittedAt: attempts.submittedAt,
    })
    .from(attempts)
    .where(sql`${attempts.legacyResultId} is not null`);
  const matches = new Map<string, typeof importedAttempts>();
  for (const a of importedAttempts) {
    const key = `${a.userId}:${a.lessonId}`;
    const list = matches.get(key) ?? [];
    list.push(a);
    matches.set(key, list);
  }
  const oldEvents = await db.select().from(ratingEvents);
  const eventIds = new Set(oldEvents.map((e) => e.legacyHistoryId));
  const linked = new Set(oldEvents.map((e) => e.attemptId));
  const eventRows: (typeof ratingEvents.$inferInsert)[] = [];
  for (const row of history) {
    const legacyHistoryId = String(row.id);
    if (eventIds.has(legacyHistoryId)) {
      report.eventsExisting++;
      continue;
    }
    const userId = userMap.get(String(row.student_id));
    if (!userId) {
      report.skippedEvents++;
      continue;
    }
    const lessonId = lessonMap.get(String(row.lesson_id))?.id ?? null;
    const createdAt = date(row.timestamp);
    const candidates = (matches.get(`${userId}:${lessonId}`) ?? []).filter(
      (a) =>
        a.submittedAt &&
        Math.abs(a.submittedAt.getTime() - createdAt.getTime()) <= 120000,
    );
    const attemptId =
      candidates.length === 1 && !linked.has(candidates[0]?.id ?? "")
        ? (candidates[0]?.id ?? null)
        : null;
    if (attemptId) linked.add(attemptId);
    else report.unmatchedEvents++;
    eventRows.push({
      legacyHistoryId,
      userId,
      lessonId,
      attemptId,
      before: Number(row.previous_rating),
      delta: Number(row.rating_change),
      after: Number(row.new_rating),
      performance: row.performance === null ? null : Number(row.performance),
      timeBonus: null,
      formula: "v1-legacy",
      createdAt,
    });
  }
  for (const part of chunks(eventRows))
    report.events += (
      await db
        .insert(ratingEvents)
        .values(part)
        .onConflictDoNothing({ target: ratingEvents.legacyHistoryId })
        .returning({ id: ratingEvents.id })
    ).length;
  const allEvents = await db
    .select()
    .from(ratingEvents)
    .orderBy(asc(ratingEvents.createdAt), asc(ratingEvents.id));
  for (const row of snapshots) {
    const userId = userMap.get(String(row.student_id));
    if (!userId) continue;
    const legacy = allEvents.filter(
      (e) => e.userId === userId && e.formula === "v1-legacy",
    );
    const native = allEvents.filter(
      (e) => e.userId === userId && e.formula === "v2",
    );
    const rating = Number(row.rating);
    const peak = Math.max(
      rating,
      ...legacy.flatMap((e) => [e.before, e.after]),
    );
    const replay = replayRatings(native, {
      rating,
      peak,
      rated: legacy.length,
    });
    for (const [i, step] of replay.steps.entries()) {
      const event = native[i];
      if (!event) continue;
      if (
        event.before !== step.before ||
        event.after !== step.after ||
        event.delta !== step.delta
      )
        await db
          .update(ratingEvents)
          .set({ before: step.before, after: step.after, delta: step.delta })
          .where(eq(ratingEvents.id, event.id));
    }
    await db
      .insert(ratings)
      .values({
        userId,
        rating: replay.state.rating,
        peak: replay.state.peak,
        ratedAttempts: replay.state.rated,
        updatedAt:
          native.at(-1)?.createdAt ?? date(row.last_updated ?? new Date()),
      })
      .onConflictDoUpdate({
        target: ratings.userId,
        set: {
          rating: replay.state.rating,
          peak: replay.state.peak,
          ratedAttempts: replay.state.rated,
        },
      });
    report.ratings++;
    if (native.length) report.nativeRatingsRebased++;
  }
  // Replay migrated and native attempts together. Unrelated v2 users are untouched.
  for (const userId of userMap.values()) {
    const rows = await db
      .select()
      .from(attempts)
      .where(and(eq(attempts.userId, userId), eq(attempts.status, "submitted")))
      .orderBy(asc(attempts.submittedAt), asc(attempts.id));
    const states = new Map<string, typeof mistakes.$inferInsert>();
    for (const a of rows) {
      const changes = new Map<
        string,
        { item: schema.AttemptItem; index: number; wrong: boolean }
      >();
      for (const [index, item] of a.items.entries()) {
        const v = versionMap.get(item.v ?? a.lessonVersionId ?? -1);
        if (!v) throw new Error("missing replay version");
        const key = `${v.lessonId}:${item.q}`;
        const wrong =
          outcomeOf(a.earned?.[index] ?? 0, item.p, a.answers[index]) !==
          "correct";
        if (!changes.has(key) || wrong)
          changes.set(key, { item, index, wrong });
      }
      for (const [key, change] of changes) {
        const { item } = change;
        const v = versionMap.get(item.v ?? a.lessonVersionId ?? -1);
        const q = v?.questions.find((q) => q.id === item.q);
        if (!v || !q) throw new Error("missing replay question");
        const prev = states.get(key);
        if (!change.wrong && (!prev || prev.status === "resolved")) continue;
        const next = nextMistake(
          prev
            ? {
                wrongCount: prev.wrongCount ?? 0,
                correctStreak: prev.correctStreak ?? 0,
                status: prev.status ?? "open",
              }
            : null,
          change.wrong ? "wrong" : "correct",
        );
        if (next)
          states.set(key, {
            ...next,
            wrongCount: Math.min(next.wrongCount, 32767),
            userId,
            lessonId: v.lessonId,
            questionId: q.id,
            questionType: q.type,
            lessonVersionId: v.id,
            lastAttemptId: a.id,
            updatedAt: a.submittedAt ?? a.startedAt,
          });
      }
    }
    await db.delete(mistakes).where(eq(mistakes.userId, userId));
    for (const part of chunks([...states.values()]))
      await db.insert(mistakes).values(part);
    report.mistakes += states.size;
  }
  await db.execute(
    sql`update lessons l set attempt_count = (select count(*)::int from attempts a where a.lesson_id = l.id and a.status = 'submitted') where l.legacy_id is not null`,
  );
  await db.execute(
    sql`update attempts a set counter_recorded = true from lessons l where a.lesson_id = l.id and l.legacy_id is not null and a.status = 'submitted'`,
  );
  return report;
}
