/**
 * S2-05: v1 → v2 migration, part 0 (users, lessons + versions, media jobs).
 * Idempotent: rows are upserted by `legacy_id`, so rehearsals and the final
 * delta run are the same command (10 §1). Results → attempts, rating events
 * and mistakes arrive in S9-06.
 *
 * Takes plain v1 rows and a v2 Drizzle handle (postgres-js in the CLI, PGlite
 * in tests). Imports src files by relative path (Node type stripping).
 */
import { and, eq, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "../../src/db/schema.ts";
import { normalizePhone } from "../../src/features/auth/core/phone.ts";
import {
  cleanLegacyText,
  defaultV1MediaPath,
  type LegacyProblem,
  type MediaMapper,
  normalizeV1Config,
  normalizeV1Grade,
  normalizeV1Questions,
  normalizeV1Tags,
} from "../../src/features/lessons/domain/legacy.ts";
import { serializeLesson } from "../../src/features/lessons/domain/serializer.ts";
import { summarizeLesson } from "../../src/features/lessons/domain/summary.ts";

const { users, lessons, lessonVersions } = schema;

export type V1Row = Record<string, unknown>;
type Db<Q extends PgQueryResultHKT> = PgDatabase<Q, typeof schema>;

/** A file to copy from v1 (URL or data: URL) into the v2 `media` bucket. */
export type MediaJob = { source: string; path: string; lessonLegacyId: string };

export type UserReport = {
  v1: number;
  inserted: number;
  updated: number;
  /** Legacy ids only: the report must not carry names or phone numbers. */
  skipped: { legacyId: string; reason: string }[];
};

export type LessonProblem = LegacyProblem & { legacyId: string };

export type LessonReport = {
  v1: number;
  inserted: number;
  updated: number;
  /** Lessons edited in v2 since the last run; their content was left alone. */
  keptV2Content: string[];
  questionsV1: number;
  questionsMigrated: number;
  problems: LessonProblem[];
};

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
/** Names, titles, chapters: HTML stripped, one line, single spaces. */
const oneLine = (v: unknown) =>
  cleanLegacyText(str(v)).text.replace(/\s+/g, " ");

function toDate(v: unknown): Date | null {
  if (v === null || v === undefined || v === "") return null;
  const d = new Date(typeof v === "number" ? v : String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

const BCRYPT = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

export async function migrateUsers<Q extends PgQueryResultHKT>(
  db: Db<Q>,
  students: readonly V1Row[],
): Promise<UserReport> {
  const report: UserReport = {
    v1: students.length,
    inserted: 0,
    updated: 0,
    skipped: [],
  };
  // Who owns each phone in v2 already (small table: hundreds of rows).
  const existing = await db
    .select({ id: users.id, legacyId: users.legacyId, phone: users.phone })
    .from(users);
  const phoneOwner = new Map<string, string>();
  for (const u of existing)
    if (u.phone) phoneOwner.set(u.phone, u.legacyId ?? `v2:${u.id}`);

  for (const row of students) {
    const legacyId = str(row.id);
    const skip = (reason: string) => report.skipped.push({ legacyId, reason });
    const phone = normalizePhone(str(row.phone_number ?? row.phone));
    if (!phone) {
      skip("invalid phone number");
      continue;
    }
    const owner = phoneOwner.get(phone);
    if (owner && owner !== legacyId) {
      skip(
        owner.startsWith("v2:")
          ? "phone already used by a v2-only account"
          : `phone already used by v1 student ${owner}`,
      );
      continue;
    }
    const passwordHash = str(row.password_hash);
    if (!BCRYPT.test(passwordHash)) {
      skip("password hash is not bcrypt");
      continue;
    }

    const active = row.is_approved === true;
    const createdAt = toDate(row.created_at) ?? new Date();
    const dob = /^\d{4}-\d{2}-\d{2}/.exec(str(row.date_of_birth))?.[0] ?? null;
    const className =
      str(row.class_name ?? row.class)
        .trim()
        .slice(0, 20) || null;
    const values = {
      legacyId,
      role: "student" as const,
      status: active ? ("active" as const) : ("pending" as const),
      fullName: oneLine(row.full_name) || "Học sinh",
      phone,
      dateOfBirth: dob,
      grade: normalizeV1Grade(row.grade),
      className,
      passwordHash,
      approvedAt: active ? createdAt : null,
      createdAt,
    };
    // v1 stays the source of truth until cutover, so a re-run refreshes
    // everything except role and the v2-only fields.
    const [res] = await db
      .insert(users)
      .values(values)
      .onConflictDoUpdate({
        target: users.legacyId,
        set: {
          status: values.status,
          fullName: values.fullName,
          phone: values.phone,
          dateOfBirth: values.dateOfBirth,
          grade: values.grade,
          className: values.className,
          passwordHash: values.passwordHash,
          approvedAt: values.approvedAt,
          updatedAt: sql`now()`,
        },
      })
      .returning({ inserted: sql<boolean>`(xmax = 0)` });
    if (res?.inserted) report.inserted += 1;
    else report.updated += 1;
    phoneOwner.set(phone, legacyId);
  }
  return report;
}

const DATA_URL = /^data:image\/(png|jpe?g|webp|gif);base64,/i;

function coverJob(
  value: unknown,
  legacyId: string,
  mapMedia: MediaMapper,
): { job: MediaJob | null; problem: string | null } {
  const src = str(value).trim();
  if (!src) return { job: null, problem: null };
  const data = DATA_URL.exec(src);
  if (data) {
    const ext = (data[1] ?? "png").toLowerCase().replace("jpeg", "jpg");
    const path = `legacy/covers/lesson-${legacyId}.${ext}`;
    return {
      job: { source: src, path, lessonLegacyId: legacyId },
      problem: null,
    };
  }
  const path = mapMedia(src);
  return path
    ? { job: { source: src, path, lessonLegacyId: legacyId }, problem: null }
    : { job: null, problem: `cover not migrated: ${src.slice(0, 80)}` };
}

export async function migrateLessons<Q extends PgQueryResultHKT>(
  db: Db<Q>,
  v1Lessons: readonly V1Row[],
  mapMedia: MediaMapper = defaultV1MediaPath,
): Promise<{ report: LessonReport; media: MediaJob[] }> {
  const report: LessonReport = {
    v1: v1Lessons.length,
    inserted: 0,
    updated: 0,
    keptV2Content: [],
    questionsV1: 0,
    questionsMigrated: 0,
    problems: [],
  };
  const media = new Map<string, MediaJob>();

  for (const row of v1Lessons) {
    const legacyId = str(row.id);
    const problem = (p: LegacyProblem) =>
      report.problems.push({ ...p, legacyId });

    const normalized = normalizeV1Questions(row.questions, mapMedia);
    const { questions } = normalized;
    normalized.problems.forEach(problem);
    const { config, problems: configProblems } = normalizeV1Config(row);
    configProblems.forEach(problem);
    report.questionsV1 += Array.isArray(row.questions)
      ? row.questions.length
      : 0;

    const cover = coverJob(row.lesson_image, legacyId, mapMedia);
    if (cover.problem) problem({ severity: "warning", message: cover.problem });
    if (questions.length === 0)
      problem({
        severity: "error",
        message: "no valid questions; the lesson stays a draft",
      });

    const createdAt =
      toDate(row.created) ?? toDate(row.created_at) ?? new Date();
    const { questionCount, typeCounts } = summarizeLesson(questions, config);
    const meta = {
      legacyId,
      title: oneLine(row.title) || `Bài ${legacyId}`,
      description: cleanLegacyText(str(row.description)).text || null,
      grade: normalizeV1Grade(row.grade),
      chapter: oneLine(row.subject) || null,
      tags: normalizeV1Tags(row.tags),
      coverPath: cover.job?.path ?? null,
      sortOrder: Math.trunc(Number(row.order)) || 0,
      config,
      questionCount,
      typeCounts,
      createdAt,
      updatedAt: toDate(row.last_updated) ?? createdAt,
      publishedAt: questions.length > 0 ? createdAt : null,
    };

    const outcome = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({
          id: lessons.id,
          status: lessons.status,
          draftVersionId: lessons.draftVersionId,
        })
        .from(lessons)
        .where(eq(lessons.legacyId, legacyId));
      const versions = existing
        ? await tx
            .select({
              id: lessonVersions.id,
              version: lessonVersions.version,
              createdBy: lessonVersions.createdBy,
            })
            .from(lessonVersions)
            .where(eq(lessonVersions.lessonId, existing.id))
        : [];
      // Migrated versions have no author; anything else was saved in the v2 editor.
      if (
        existing &&
        (existing.draftVersionId !== null ||
          versions.some((v) => v.version > 1 || v.createdBy !== null))
      )
        return "kept" as const;

      const status =
        questions.length === 0
          ? ("draft" as const)
          : existing && existing.status !== "draft"
            ? existing.status
            : ("published" as const);
      const [lesson] = await tx
        .insert(lessons)
        .values({ ...meta, status })
        .onConflictDoUpdate({
          target: lessons.legacyId,
          set: { ...meta, status, updatedAt: meta.updatedAt },
        })
        .returning({ id: lessons.id, inserted: sql<boolean>`(xmax = 0)` });
      if (!lesson) throw new Error(`upsert returned nothing for ${legacyId}`);

      if (questions.length > 0) {
        const content = { sourceText: serializeLesson(questions), questions };
        const v1 = versions.find((v) => v.version === 1);
        let versionId = v1?.id;
        if (versionId !== undefined)
          await tx
            .update(lessonVersions)
            .set(content)
            .where(
              and(
                eq(lessonVersions.id, versionId),
                eq(lessonVersions.lessonId, lesson.id),
              ),
            );
        else {
          const [inserted] = await tx
            .insert(lessonVersions)
            .values({ lessonId: lesson.id, version: 1, ...content })
            .returning({ id: lessonVersions.id });
          versionId = inserted?.id;
        }
        await tx
          .update(lessons)
          .set({ currentVersionId: versionId ?? null })
          .where(eq(lessons.id, lesson.id));
      }
      return lesson.inserted ? ("inserted" as const) : ("updated" as const);
    });

    if (outcome === "kept") {
      report.keptV2Content.push(legacyId);
      continue;
    }
    report[outcome] += 1;
    report.questionsMigrated += questions.length;
    for (const url of normalized.mediaUrls) {
      const path = mapMedia(url);
      if (path)
        media.set(path, { source: url, path, lessonLegacyId: legacyId });
    }
    if (cover.job) media.set(cover.job.path, cover.job);
  }
  return { report, media: [...media.values()] };
}

export type MediaReport = {
  copied: number;
  existing: number;
  failed: { path: string; error: string }[];
  skipped: boolean;
};

/** Markdown for `tmp/migration-report.md` (no names or phone numbers). */
export function renderReport(r: {
  startedAt: Date;
  dryRun: boolean;
  target: string;
  users: UserReport;
  lessons: LessonReport;
  media: MediaReport;
}): string {
  const errors = r.lessons.problems.filter((p) => p.severity === "error");
  const warnings = r.lessons.problems.filter((p) => p.severity === "warning");
  const row = (p: LessonProblem) =>
    `| ${p.legacyId} | ${p.index === undefined ? "" : p.index + 1} | ${p.message.replaceAll("|", "\\|")} |`;
  const lines = [
    "# Migration report (v1 → v2)",
    "",
    `- Started: ${r.startedAt.toISOString()}`,
    `- Target: \`${r.target}\`${r.dryRun ? " (**dry run**, rolled back)" : ""}`,
    "",
    "## Counts",
    "",
    "| Entity | v1 | inserted | updated | skipped / kept |",
    "|---|---|---|---|---|",
    `| students → users | ${r.users.v1} | ${r.users.inserted} | ${r.users.updated} | ${r.users.skipped.length} |`,
    `| lessons | ${r.lessons.v1} | ${r.lessons.inserted} | ${r.lessons.updated} | ${r.lessons.keptV2Content.length} kept (edited in v2) |`,
    `| questions | ${r.lessons.questionsV1} | ${r.lessons.questionsMigrated} migrated | | ${r.lessons.questionsV1 - r.lessons.questionsMigrated} not migrated |`,
    `| media | | ${r.media.copied} copied | ${r.media.existing} already there | ${r.media.skipped ? "copy skipped" : `${r.media.failed.length} failed`} |`,
    "",
    `## Question/lesson errors (${errors.length}): target 0 before cutover (10 §4)`,
    "",
    "| Lesson legacy id | Question # | Problem |",
    "|---|---|---|",
    ...errors.map(row),
    "",
    `## Warnings (${warnings.length}): review manually`,
    "",
    "| Lesson legacy id | Question # | Problem |",
    "|---|---|---|",
    ...warnings.map(row),
    "",
    `## Skipped students (${r.users.skipped.length})`,
    "",
    "| Student legacy id | Reason |",
    "|---|---|",
    ...r.users.skipped.map((s) => `| ${s.legacyId} | ${s.reason} |`),
    "",
    `## Lessons kept (edited in v2): ${r.lessons.keptV2Content.join(", ") || "none"}`,
    "",
    `## Media failures (${r.media.failed.length})`,
    "",
    ...r.media.failed.map((f) => `- \`${f.path}\`: ${f.error}`),
    "",
  ];
  return lines.join("\n");
}
