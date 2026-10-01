/** S9-06: read-only source comparisons; output contains counts, never account data. */
import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { compare } from "bcryptjs";
import postgres from "postgres";
import { z } from "zod";
import { normalizeV1Questions } from "../src/features/lessons/domain/legacy.ts";
import { normalizeLegacyResult } from "../src/features/lessons/domain/legacy-results.ts";
import { toPublicQuestion } from "../src/features/lessons/domain/public-question.ts";
import { QuestionsSchema } from "../src/features/lessons/schema.ts";
import { replayRatings } from "../src/features/rating/domain/rating.ts";
import { pgErrorCode } from "../src/lib/pg-error.ts";
import { databaseIdentity } from "./lib/database-identity.ts";

const v1Url = process.env.V1_DATABASE_URL;
const v2Url = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
if (!v1Url || !v2Url || databaseIdentity(v1Url) === databaseIdentity(v2Url))
  throw new Error("Set distinct source and target database URLs.");
const source = postgres(v1Url, { max: 1, prepare: false });
const target = postgres(v2Url, { max: 1, prepare: false });
try {
  await source.begin(
    "isolation level repeatable read read only",
    async (v1) => {
      await target.begin(
        "isolation level repeatable read read only",
        async (v2) => {
          const students = await v1`select id,password_hash from students`;
          const lessons =
            await v1`select id,questions from lessons where id <> 'quiz_game'`;
          const history =
            await v1`select id,student_id,previous_rating,rating_change,new_rating from rating_history`;
          const ratings = await v1`select student_id,rating from ratings`;
          const users =
            await v2`select id,legacy_id,password_hash from users where legacy_id is not null`;
          const catalog =
            await v2`select id,legacy_id,current_version_id from lessons where legacy_id is not null`;
          const versions =
            await v2`select id,lesson_id,questions from lesson_versions`;
          const attempts =
            await v2`select id,legacy_result_id,user_id,lesson_id,items,answers,earned,score,max_score,score10,submitted_at from attempts where legacy_result_id is not null`;
          const events =
            await v2`select legacy_history_id,user_id,formula,before,after,delta,performance,time_bonus from rating_events order by created_at,id`;
          const ratingRows = await v2`select user_id,rating from ratings`;
          const failures: Record<string, number> = {};
          const fail = (key: string) => {
            failures[key] = (failures[key] ?? 0) + 1;
          };
          const userMap = new Map(users.map((u) => [String(u.legacy_id), u]));
          const lessonMap = new Map(
            catalog.map((l) => [String(l.legacy_id), l]),
          );
          const versionMap = new Map(versions.map((v) => [Number(v.id), v]));
          const attemptMap = new Map(
            attempts.map((a) => [String(a.legacy_result_id), a]),
          );
          const eventIds = new Set(
            events.map((e) => String(e.legacy_history_id)),
          );
          for (const student of students) {
            const user = userMap.get(String(student.id));
            if (!user) fail("missing student");
            else if (user.password_hash !== student.password_hash)
              fail("password hash mismatch");
          }
          if (users.length !== students.length) fail("student count");
          if (catalog.length !== lessons.length) fail("lesson count");
          let validVersions = 0;
          for (const v of versions) {
            const parsed = QuestionsSchema.safeParse(v.questions);
            if (!parsed.success) {
              fail("invalid version schema");
              continue;
            }
            validVersions++;
            // Explicit projection check traverses every nested object, including tf statements.
            const hasAnswer = (value: unknown): boolean =>
              Array.isArray(value)
                ? value.some(hasAnswer)
                : value !== null &&
                  typeof value === "object" &&
                  Object.entries(value).some(
                    ([key, val]) =>
                      ["answer", "explanation", "tolerance"].includes(key) ||
                      hasAnswer(val),
                  );
            if (parsed.data.some((q) => hasAnswer(toPublicQuestion(q))))
              fail("unsafe taking projection");
          }
          for (const lesson of lessons) {
            const migrated = lessonMap.get(String(lesson.id));
            if (!migrated) {
              fail("missing lesson");
              continue;
            }
            const current = versionMap.get(Number(migrated.current_version_id));
            const expected = normalizeV1Questions(lesson.questions);
            if (expected.problems.some((p) => p.severity === "error"))
              fail("invalid source lesson");
            if (
              expected.questions.length !==
              (Array.isArray(current?.questions) ? current.questions.length : 0)
            )
              fail("current question count");
          }
          let after = "",
            sourceResults = 0,
            eligible = 0,
            skipped = 0;
          const skippedReasons: Record<string, number> = {};
          const byStudent = new Map<
            string,
            { count: number; latestTime: number; latestScore: number }
          >();
          for (;;) {
            const rows =
              await v1`select id,student_id,lesson_id,"timestamp",questions,score,total_points,time_taken from results where id > ${after} order by id limit 200`;
            if (!rows.length) break;
            for (const r of rows) {
              sourceResults++;
              let reason: string | undefined;
              const user = userMap.get(String(r.student_id));
              const lesson = lessonMap.get(String(r.lesson_id));
              let normalized:
                | ReturnType<typeof normalizeLegacyResult>
                | undefined;
              if (!user) reason = "student not migrated";
              else if (!lesson) reason = "lesson not migrated";
              else
                try {
                  if (
                    !(Number(r.total_points) > 0) ||
                    Number(r.score) < 0 ||
                    Number(r.score) > Number(r.total_points) + 0.011
                  )
                    throw new Error("invalid result score");
                  normalized = normalizeLegacyResult(
                    r.questions,
                    [],
                    () => "q_verify",
                  );
                } catch (error) {
                  reason =
                    error instanceof Error ? error.message : "invalid result";
                }
              if (reason) {
                skipped++;
                skippedReasons[reason] = (skippedReasons[reason] ?? 0) + 1;
                if (attemptMap.has(String(r.id)))
                  fail("unexpected skipped result imported");
                continue;
              }
              eligible++;
              const a = attemptMap.get(String(r.id));
              if (!a) {
                fail("missing eligible result");
                continue;
              }
              if (
                a.user_id !== user?.id ||
                Number(a.lesson_id) !== Number(lesson?.id)
              )
                fail("result ownership");
              if (
                Math.abs(Number(a.score) - Number(r.score)) > 0.005 ||
                Math.abs(Number(a.max_score) - Number(r.total_points)) >
                  0.005 ||
                Math.abs(
                  Number(a.score10) -
                    Math.round(
                      (Number(r.score) / Number(r.total_points)) * 1000,
                    ) /
                      100,
                ) > 0.005
              )
                fail("result score mismatch");
              if (
                JSON.stringify((a.earned as unknown[]).map(Number)) !==
                JSON.stringify(normalized?.map((i) => i.earned))
              )
                fail("recorded marks mismatch");
              if (
                JSON.stringify(a.answers) !==
                JSON.stringify(normalized?.map((i) => i.answer))
              )
                fail("recorded answers mismatch");
              const key = String(r.student_id),
                time = new Date(r.timestamp).getTime();
              const prev = byStudent.get(key) ?? {
                count: 0,
                latestTime: -Infinity,
                latestScore: 0,
              };
              prev.count++;
              if (time > prev.latestTime) {
                prev.latestTime = time;
                prev.latestScore = Number(r.score);
              }
              byStudent.set(key, prev);
            }
            after = String(rows.at(-1)?.id);
          }
          if (eligible !== attempts.length) fail("attempt count");
          for (const row of history) {
            if (
              userMap.has(String(row.student_id)) &&
              !eventIds.has(String(row.id))
            )
              fail("missing rating history");
            const event = events.find(
              (e) => String(e.legacy_history_id) === String(row.id),
            );
            if (
              event &&
              (Number(event.before) !== Number(row.previous_rating) ||
                Number(event.delta) !== Number(row.rating_change) ||
                Number(event.after) !== Number(row.new_rating))
            )
              fail("rating history values mismatch");
            if (
              event &&
              event.user_id !== userMap.get(String(row.student_id))?.id
            )
              fail("rating history ownership mismatch");
          }
          const expectedRatings = new Map<string, number>();
          for (const r of ratings) {
            const user = userMap.get(String(r.student_id));
            if (!user) {
              fail("missing rated student");
              continue;
            }
            const native = events
              .filter((e) => e.user_id === user.id && e.formula === "v2")
              .map((e) => ({
                formula: "v2",
                delta: Number(e.delta),
                performance:
                  e.performance === null ? null : Number(e.performance),
                timeBonus: e.time_bonus === null ? null : Number(e.time_bonus),
              }));
            const expected = replayRatings(native, {
              rating: Number(r.rating),
              peak: Number(r.rating),
              rated: 0,
            }).state.rating;
            expectedRatings.set(String(r.student_id), expected);
            if (
              Number(
                ratingRows.find((row) => row.user_id === user.id)?.rating,
              ) !== expected
            )
              fail("rating snapshot mismatch");
          }
          // Random sample is selected privately. Reports expose only sample size and mismatches.
          const sample = [...byStudent.keys()]
            .map((id) => ({ id, rank: randomBytes(8).toString("hex") }))
            .sort((a, b) => a.rank.localeCompare(b.rank))
            .slice(0, 20);
          for (const { id } of sample) {
            const user = userMap.get(id),
              expected = byStudent.get(id);
            const actual = attempts
              .filter((a) => a.user_id === user?.id)
              .sort(
                (a, b) =>
                  new Date(b.submitted_at).getTime() -
                  new Date(a.submitted_at).getTime(),
              );
            if (
              actual.length !== expected?.count ||
              Number(actual[0]?.score) !== expected?.latestScore
            )
              fail("student sample mismatch");
          }
          // Include every tied row at the twentieth-place boundary, comparing sets.
          const expectedTop = [...expectedRatings.entries()].sort(
            (a, b) => b[1] - a[1],
          );
          const cutoff =
            expectedTop[Math.min(19, expectedTop.length - 1)]?.[1] ?? Infinity;
          const expectedSet = expectedTop
            .filter(([, rating]) => rating >= cutoff)
            .map(([id, rating]) => `${id}:${rating}`)
            .sort();
          const actualSet = users
            .flatMap((u) => {
              const r = ratingRows.find((r) => r.user_id === u.id);
              return r && Number(r.rating) >= cutoff
                ? [`${u.legacy_id}:${Number(r.rating)}`]
                : [];
            })
            .sort();
          if (JSON.stringify(expectedSet) !== JSON.stringify(actualSet))
            fail("leaderboard mismatch");
          let passwordsVerified = 0;
          if (process.env.MIGRATION_PASSWORD_CHECKS_FILE) {
            const checks = z
              .array(
                z.strictObject({ legacyId: z.string(), password: z.string() }),
              )
              .min(5)
              .parse(
                JSON.parse(
                  await readFile(
                    process.env.MIGRATION_PASSWORD_CHECKS_FILE,
                    "utf8",
                  ),
                ),
              );
            for (const check of checks) {
              const user = userMap.get(check.legacyId);
              if (
                !user ||
                !(await compare(check.password, String(user.password_hash)))
              )
                fail("controlled password mismatch");
              else passwordsVerified++;
            }
          }
          const report = {
            automatedOk: Object.keys(failures).length === 0,
            counts: {
              students: students.length,
              lessons: lessons.length,
              sourceResults,
              eligibleResults: eligible,
              skippedResults: skipped,
              attempts: attempts.length,
              history: history.length,
              ratings: ratings.length,
              validVersions,
              sampledStudents: sample.length,
              passwordsVerified,
            },
            skippedReasons,
            failures,
            manualGates: {
              controlledPasswords: passwordsVerified >= 5,
              teacherReview: false,
              mediaCopy: false,
            },
          };
          await mkdir("tmp", { recursive: true });
          await writeFile(
            "tmp/migration-verification.json",
            JSON.stringify(report, null, 2),
          );
          console.log(JSON.stringify(report));
          if (!report.automatedOk) process.exitCode = 1;
        },
      );
    },
  );
} catch (error) {
  const code = pgErrorCode(error);
  console.error(
    JSON.stringify({
      evt: "migration_verification_failure",
      code: code && /^[A-Z0-9_]{2,40}$/.test(code) ? code : "UNKNOWN",
    }),
  );
  process.exitCode = 1;
} finally {
  await source.end();
  await target.end();
}
