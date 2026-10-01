/**
 * S2-05: migrate v1 → v2 (users, lessons + versions, lesson images). 10 §1–4.
 *
 *   pnpm migrate:legacy --dry-run      # everything in one transaction, rolled back
 *   pnpm migrate:legacy                # write, then copy images
 *   pnpm migrate:legacy --skip-media   # write only
 *
 * Env: V1_DATABASE_URL (read in a READ ONLY transaction), DATABASE_URL_DIRECT
 * (or DATABASE_URL) for v2, and SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY of
 * the v2 project for the image copy. Idempotent: re-run for rehearsals and
 * the final delta. Writes tmp/migration-report.md (no names or phones).
 */
import { mkdir, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/db/schema.ts";
import { databaseIdentity } from "./lib/database-identity.ts";
import { copyAll } from "./lib/media-copy.ts";
import { type HistoryReport, migrateHistory } from "./lib/migrate-history.ts";
import {
  type LessonReport,
  type MediaJob,
  type MediaReport,
  migrateLessons,
  migrateUsers,
  renderReport,
  type UserReport,
  type V1Row,
} from "./lib/migrate-legacy.ts";

const { values: args } = parseArgs({
  options: {
    "dry-run": { type: "boolean", default: false },
    "skip-media": { type: "boolean", default: false },
  },
});
const dryRun = args["dry-run"] ?? false;
const skipMedia = dryRun || (args["skip-media"] ?? false);

const v1Url = process.env.V1_DATABASE_URL;
const v2Url = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
if (!v1Url || !v2Url) {
  console.error(
    "Set V1_DATABASE_URL and DATABASE_URL_DIRECT (or DATABASE_URL).",
  );
  process.exit(1);
}
if (databaseIdentity(v1Url) === databaseIdentity(v2Url)) {
  console.error("Source and target identify the same database. Refusing.");
  process.exit(1);
}
const storage =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? {
        url: process.env.SUPABASE_URL,
        serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        bucket: "media",
      }
    : null;
if (!skipMedia && !storage) {
  console.error(
    "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (v2) to copy images, or pass --skip-media.",
  );
  process.exit(1);
}

const target = new URL(v2Url).host;
const startedAt = new Date();
console.log(`${dryRun ? "[dry run] " : ""}Migrating v1 → ${target}`);

const v1 = postgres(v1Url, { max: 1, prepare: false, idle_timeout: 5 });
const v2Client = postgres(v2Url, {
  max: 1,
  prepare: false,
  onnotice: () => {},
});
const db = drizzle({ client: v2Client, schema });

class DryRunRollback extends Error {}
let databaseCommitted = false;

try {
  await v1.begin(
    "isolation level repeatable read read only",
    async (sourceTx) => {
      const source = {
        students: await sourceTx<
          V1Row[]
        >`select * from students order by created_at nulls first, id`,
        lessons: await sourceTx<V1Row[]>`select * from lessons order by id`,
        // v1 writes ISO UTC into timestamp-without-time-zone columns. Cast
        // explicitly so a Windows/Asia-Bangkok client cannot shift history 7h.
        history: await sourceTx<
          V1Row[]
        >`select id, student_id, lesson_id, previous_rating, rating_change, new_rating, performance, "timestamp" at time zone 'UTC' as timestamp from rating_history order by "timestamp", id`,
        ratings: await sourceTx<
          V1Row[]
        >`select student_id, rating, last_updated at time zone 'UTC' as last_updated from ratings order by student_id`,
      };
      console.log(
        `v1: ${source.students.length} students, ${source.lessons.length} lessons`,
      );

      let users: UserReport | undefined;
      let lessons: LessonReport | undefined;
      let jobs: MediaJob[] = [];
      let history: HistoryReport | undefined;
      // One round trip per row: against a remote DB this takes minutes, so show
      // that it's alive. Everything is one transaction; Ctrl-C leaves no partial data.
      let phase = "users";
      const tick = setInterval(() => {
        const s = Math.round((Date.now() - startedAt.getTime()) / 1000);
        console.log(`  … ${phase} (${s} s)`);
      }, 10_000);
      try {
        await db.transaction(async (tx) => {
          console.log("Migrating users…");
          users = await migrateUsers(tx, source.students);
          phase = "lessons";
          console.log("Migrating lessons…");
          const out = await migrateLessons(tx, source.lessons);
          lessons = out.report;
          jobs = out.media;
          phase = "results, rating history and mistakes";
          // Bounded result pages under one read-only source snapshot. No PII is
          // persisted to disk, logs or artifacts; only the count report is written.
          async function* resultPages() {
            let after = "";
            for (;;) {
              const rows = await sourceTx<
                V1Row[]
              >`select * from results where id > ${after} order by id limit 200`;
              if (!rows.length) break;
              yield rows;
              after = String(rows.at(-1)?.id);
            }
          }
          history = await migrateHistory(
            tx,
            resultPages(),
            source.history,
            source.ratings,
          );
          phase = "commit";
          if (dryRun) throw new DryRunRollback();
        });
        databaseCommitted = !dryRun;
      } catch (e) {
        if (!(e instanceof DryRunRollback)) throw e;
      } finally {
        clearInterval(tick);
      }
      if (!users || !lessons) throw new Error("migration produced no report");

      const media: MediaReport = {
        copied: 0,
        existing: 0,
        failed: [],
        skipped: skipMedia,
      };
      if (!skipMedia && storage && jobs.length > 0) {
        console.log(`Copying ${jobs.length} images…`);
        for (const r of await copyAll(jobs, storage)) {
          if (r.status === "failed") {
            media.failed.push({ path: r.path, error: r.error });
            continue;
          }
          media[r.status === "copied" ? "copied" : "existing"] += 1;
          await db
            .insert(schema.media)
            .values({ path: r.path, bytes: r.bytes })
            .onConflictDoNothing({ target: schema.media.path });
        }
      }

      const report = renderReport({
        startedAt,
        dryRun,
        target,
        users,
        lessons,
        media,
      });
      await mkdir("tmp", { recursive: true });
      await writeFile("tmp/migration-report.md", report);
      await writeFile(
        "tmp/migration-history-report.json",
        JSON.stringify(history, null, 2),
      );
      const errors = lessons.problems.filter(
        (p) => p.severity === "error",
      ).length;
      console.log(
        [
          `users: +${users.inserted} ~${users.updated} skipped ${users.skipped.length}`,
          `lessons: +${lessons.inserted} ~${lessons.updated} kept ${lessons.keptV2Content.length} skipped ${lessons.skipped.length}`,
          `questions: ${lessons.questionsMigrated}/${lessons.questionsV1} (errors ${errors})`,
          `media: copied ${media.copied}, existing ${media.existing}, failed ${media.failed.length}`,
          "report: tmp/migration-report.md",
        ].join("\n"),
      );
      if (errors > 0 || media.failed.length > 0) process.exitCode = 2;
    },
  );
} catch (error) {
  const code =
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string" &&
    /^[A-Z0-9_]{1,40}$/.test(error.code)
      ? error.code
      : "MIGRATION_FAILED";
  console.error(
    JSON.stringify({ evt: "migration_failure", code, databaseCommitted }),
  );
  process.exitCode = 1;
} finally {
  await v1.end();
  await v2Client.end();
}
