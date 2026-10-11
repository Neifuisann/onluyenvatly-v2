import "server-only";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { attempts, lessons, lessonVersions } from "@/db/schema";
import type { AdminListFilters } from "./domain/admin-list";
import { searchTerms } from "./domain/catalog";
import type { ComposeSource } from "./domain/compose";
import { type Owner, ownedBy } from "./ownership";
import type { QuestionType } from "./schema";

/**
 * Teacher reads (S5-01). Per request and uncached: only the teacher uses them,
 * and the list must show a change as soon as it is made. Every one is
 * limited to the teacher's own lessons (B-03, `ownership.ts`).
 */

export type AdminLessonRow = {
  id: number;
  title: string;
  status: "draft" | "published" | "archived";
  grade: number | null;
  chapter: string | null;
  questionCount: number;
  attemptCount: number;
  hasDraft: boolean;
  /** A version is published ("Sửa" opens its questions, B-10). */
  hasPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Every matching lesson not deleted, in the teacher's order (the page sorts
 * it again when another order is chosen, `sortAdminRows`). ~170 small rows:
 * the page slices them in memory (`paginate`), because reordering one page
 * sends the full id order back.
 */
export async function getAdminLessons(
  owner: Owner,
  f: Pick<AdminListFilters, "q" | "status">,
): Promise<AdminLessonRow[]> {
  return db
    .select({
      id: lessons.id,
      title: lessons.title,
      status: lessons.status,
      grade: lessons.grade,
      chapter: lessons.chapter,
      questionCount: lessons.questionCount,
      attemptCount: lessons.attemptCount,
      hasDraft: sql<boolean>`${lessons.draftVersionId} is not null`,
      hasPublished: sql<boolean>`${lessons.currentVersionId} is not null`,
      createdAt: lessons.createdAt,
      updatedAt: lessons.updatedAt,
    })
    .from(lessons)
    .where(
      and(
        ownedBy(owner),
        isNull(lessons.deletedAt),
        f.status ? eq(lessons.status, f.status) : undefined,
        ...searchTerms(f.q).map(
          (w) =>
            sql`${lessons.searchText} ilike '%' || lower(immutable_unaccent(${w})) || '%'`,
        ),
      ),
    )
    .orderBy(asc(lessons.sortOrder), asc(lessons.id));
}

export type LessonForEditing = {
  id: number;
  title: string;
  description: string | null;
  grade: number | null;
  chapter: string | null;
  subject: string;
  tags: string[];
  coverPath: string | null;
  status: "draft" | "published" | "archived";
  /** Raw jsonb; the editor validates it with `LessonConfigSchema`. */
  config: unknown;
  /** The draft's text, else the published one's, else empty. */
  sourceText: string;
  /** Their questions, so re-parsing keeps question ids stable (04 §3.1). */
  questions: unknown;
  hasDraft: boolean;
  hasPublished: boolean;
};

/**
 * Everything the editor opens with (S5-02). Includes answers: admin only,
 * never reachable from student pages.
 */
export async function getLessonForEditing(
  owner: Owner,
  id: number,
): Promise<LessonForEditing | null> {
  const [row] = await db
    .select({
      id: lessons.id,
      title: lessons.title,
      description: lessons.description,
      grade: lessons.grade,
      chapter: lessons.chapter,
      subject: lessons.subject,
      tags: lessons.tags,
      coverPath: lessons.coverPath,
      status: lessons.status,
      config: lessons.config,
      sourceText: lessonVersions.sourceText,
      questions: lessonVersions.questions,
      hasDraft: sql<boolean>`${lessons.draftVersionId} is not null`,
      hasPublished: sql<boolean>`${lessons.currentVersionId} is not null`,
    })
    .from(lessons)
    .leftJoin(
      lessonVersions,
      eq(
        lessonVersions.id,
        sql`coalesce(${lessons.draftVersionId}, ${lessons.currentVersionId})`,
      ),
    )
    .where(and(eq(lessons.id, id), ownedBy(owner), isNull(lessons.deletedAt)))
    .limit(1);
  if (!row) return null;
  return {
    ...row,
    sourceText: row.sourceText ?? "",
    questions: row.questions ?? [],
  };
}

/**
 * `/admin/lessons/[id]/questions` (B-10): the CURRENT version as the teacher
 * corrects it, and how many submitted attempts a correction would regrade.
 * Includes answers: admin only. Null without a published version.
 */
export async function getLessonForCorrection(owner: Owner, id: number) {
  const [row] = await db
    .select({
      id: lessons.id,
      title: lessons.title,
      status: lessons.status,
      config: lessons.config,
      versionId: lessons.currentVersionId,
      version: lessonVersions.version,
      questions: lessonVersions.questions,
      hasDraft: sql<boolean>`${lessons.draftVersionId} is not null`,
    })
    .from(lessons)
    .innerJoin(lessonVersions, eq(lessonVersions.id, lessons.currentVersionId))
    .where(and(eq(lessons.id, id), ownedBy(owner), isNull(lessons.deletedAt)))
    .limit(1);
  if (!row?.versionId) return null;
  // `attempts_lesson_submitted_idx`, then the version filter.
  const [count] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(attempts)
    .where(
      and(
        eq(attempts.lessonId, id),
        eq(attempts.status, "submitted"),
        eq(attempts.lessonVersionId, row.versionId),
      ),
    );
  return { ...row, versionId: row.versionId, submitted: count?.n ?? 0 };
}

/**
 * Questions of one type in a version's jsonb, counted by Postgres. Removed
 * questions (B-10) don't count: compose never draws them.
 */
const countType = (type: QuestionType) =>
  sql<number>`(select count(*)::int from jsonb_array_elements(case when jsonb_typeof(${lessonVersions.questions}) = 'array' then ${lessonVersions.questions} else '[]'::jsonb end) as q where q->>'type' = ${type} and not q ? 'removed')`;

/**
 * "Tạo từ bài có sẵn" (S5-07): every lesson with questions to draw from,
 * newest change first, with its questions per type in the version the draw
 * reads (published, else draft). Counts only: the questions stay in the
 * database until the teacher submits.
 */
export async function getComposeSources(
  owner: Owner,
): Promise<ComposeSource[]> {
  const rows = await db
    .select({
      id: lessons.id,
      title: lessons.title,
      status: lessons.status,
      grade: lessons.grade,
      mcq: countType("mcq"),
      tf: countType("tf"),
      short: countType("short"),
    })
    .from(lessons)
    .innerJoin(
      lessonVersions,
      eq(
        lessonVersions.id,
        sql`coalesce(${lessons.currentVersionId}, ${lessons.draftVersionId})`,
      ),
    )
    .where(and(ownedBy(owner), isNull(lessons.deletedAt)))
    .orderBy(desc(lessons.updatedAt), desc(lessons.id));
  return rows.filter((r) => r.mcq + r.tf + r.short > 0);
}

/** The teacher's own tags, for the AI tag suggestions (S7-05, B-03). */
export async function getOwnerTags(owner: Owner): Promise<string[]> {
  const rows = await db
    .selectDistinct({ tag: sql<string>`unnest(${lessons.tags})` })
    .from(lessons)
    .where(and(ownedBy(owner), isNull(lessons.deletedAt)));
  const vi = new Intl.Collator("vi").compare;
  return rows.map((r) => r.tag).sort(vi);
}

/**
 * The teacher's published lessons a class can be given (B-03), newest first,
 * for the class page. Small rows: no content.
 */
export async function getAssignableLessons(owner: Owner) {
  return db
    .select({
      id: lessons.id,
      title: lessons.title,
      grade: lessons.grade,
      subject: lessons.subject,
      questionCount: lessons.questionCount,
    })
    .from(lessons)
    .where(
      and(
        ownedBy(owner),
        eq(lessons.status, "published"),
        isNull(lessons.deletedAt),
      ),
    )
    .orderBy(asc(lessons.sortOrder), asc(lessons.id));
}

export type AssignableLesson = Awaited<
  ReturnType<typeof getAssignableLessons>
>[number];
