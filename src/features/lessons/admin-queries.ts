import "server-only";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { lessons } from "@/db/schema";
import type { AdminListFilters } from "./domain/admin-list";
import { searchTerms } from "./domain/catalog";

/**
 * Admin reads (S5-01). Per request and uncached: only the teacher uses them,
 * and the list must show a change as soon as it is made.
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
  updatedAt: Date;
};

/** Every lesson not deleted, in the teacher's order (~170 rows, no paging). */
export async function getAdminLessons(
  f: AdminListFilters,
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
      updatedAt: lessons.updatedAt,
    })
    .from(lessons)
    .where(
      and(
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
