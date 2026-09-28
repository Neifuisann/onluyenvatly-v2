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
import { copyAll } from "./lib/media-copy.ts";
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
if (new URL(v1Url).host === new URL(v2Url).host) {
  console.error(
    "V1_DATABASE_URL and the v2 URL point at the same host. Refusing.",
  );
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

try {
  const source = await v1.begin("read only", async (tx) => ({
    students: await tx<
      V1Row[]
    >`select * from students order by created_at nulls first, id`,
    lessons: await tx<V1Row[]>`select * from lessons order by id`,
  }));
  console.log(
    `v1: ${source.students.length} students, ${source.lessons.length} lessons`,
  );

  let users: UserReport | undefined;
  let lessons: LessonReport | undefined;
  let jobs: MediaJob[] = [];
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
      phase = "commit";
      if (dryRun) throw new DryRunRollback();
    });
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
  const errors = lessons.problems.filter((p) => p.severity === "error").length;
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
} finally {
  await v1.end();
  await v2Client.end();
}
