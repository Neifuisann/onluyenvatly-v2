import "server-only";
import { and, eq, gt, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { attempts, lessons, lessonVersions } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { err, ok, type Result } from "@/lib/result";
import { copyTitle, isReorderOf } from "./domain/admin-list";
import { summarizeLesson } from "./domain/summary";
import { adminLessonsCopy } from "./messages";
import { LessonConfigSchema, QuestionsSchema } from "./schema";

/**
 * Lesson list mutations for `/admin/lessons` (S5-01, 05 §2
 * `features/lessons/admin-actions.ts`). Each one writes its audit entry in
 * the same transaction. Callers check `requireAdmin()` first.
 */

export type Actor = { id: string };

const notDeleted = isNull(lessons.deletedAt);

/**
 * Saves the manual order. `ids` must be every lesson in the list (not
 * deleted), in the new order; a stale list (a lesson added or removed in
 * another tab) is refused so nothing jumps unexpectedly.
 */
export async function reorderLessons(
  actor: Actor,
  ids: readonly number[],
): Promise<Result<{ count: number }>> {
  return db.transaction(async (tx) => {
    const current = await tx
      .select({ id: lessons.id })
      .from(lessons)
      .where(notDeleted)
      .for("update");
    if (
      !isReorderOf(
        current.map((r) => r.id),
        ids,
      )
    )
      return err("CONFLICT", { message: adminLessonsCopy.staleList });
    const values = sql.join(
      ids.map((id, i) => sql`(${id}::bigint, ${i}::int)`),
      sql`, `,
    );
    await tx.execute(
      sql`update ${lessons} set sort_order = v.ord from (values ${values}) as v(id, ord) where ${lessons.id} = v.id and ${lessons.sortOrder} <> v.ord`,
    );
    await writeAudit(tx, {
      actorId: actor.id,
      action: "lesson.reorder",
      targetType: "lesson",
      data: { count: ids.length },
    });
    return ok({ count: ids.length });
  });
}

/**
 * Copies a lesson as a new draft right below it: metadata, config and the
 * content being worked on (the draft, else the published version). No
 * attempts, no published version.
 */
export async function duplicateLesson(
  actor: Actor,
  id: number,
): Promise<Result<{ id: number }>> {
  return db.transaction(async (tx) => {
    const [src] = await tx
      .select({
        title: lessons.title,
        description: lessons.description,
        grade: lessons.grade,
        chapter: lessons.chapter,
        tags: lessons.tags,
        coverPath: lessons.coverPath,
        config: lessons.config,
        sortOrder: lessons.sortOrder,
        versionId: sql<
          number | null
        >`coalesce(${lessons.draftVersionId}, ${lessons.currentVersionId})`,
      })
      .from(lessons)
      .where(and(eq(lessons.id, id), notDeleted))
      .limit(1);
    if (!src) return err("NOT_FOUND");

    const [version] = src.versionId
      ? await tx
          .select({
            sourceText: lessonVersions.sourceText,
            questions: lessonVersions.questions,
          })
          .from(lessonVersions)
          .where(eq(lessonVersions.id, Number(src.versionId)))
          .limit(1)
      : [];

    // Make room right below the source. Orders may tie (the list sorts by
    // order, then id), so rows tied with the source but after it move too.
    await tx
      .update(lessons)
      .set({
        sortOrder: sql`case when ${lessons.sortOrder} > ${src.sortOrder} then ${lessons.sortOrder} + 2 else ${src.sortOrder + 2} end`,
      })
      .where(
        or(
          gt(lessons.sortOrder, src.sortOrder),
          and(eq(lessons.sortOrder, src.sortOrder), gt(lessons.id, id)),
        ),
      );

    const config = LessonConfigSchema.safeParse(src.config);
    const questions = QuestionsSchema.safeParse(version?.questions);
    const summary =
      config.success && questions.success
        ? summarizeLesson(questions.data, config.data)
        : { questionCount: 0, typeCounts: {} };
    const [copy] = await tx
      .insert(lessons)
      .values({
        title: copyTitle(src.title),
        description: src.description,
        grade: src.grade,
        chapter: src.chapter,
        tags: src.tags,
        coverPath: src.coverPath,
        config: src.config,
        status: "draft",
        sortOrder: src.sortOrder + 1,
        createdBy: actor.id,
        ...summary,
      })
      .returning({ id: lessons.id });
    if (!copy) throw new Error("lesson insert returned no row");

    if (version) {
      const [draft] = await tx
        .insert(lessonVersions)
        .values({
          lessonId: copy.id,
          version: 1,
          sourceText: version.sourceText,
          questions: version.questions,
          createdBy: actor.id,
        })
        .returning({ id: lessonVersions.id });
      await tx
        .update(lessons)
        .set({ draftVersionId: draft?.id ?? null })
        .where(eq(lessons.id, copy.id));
    }
    await writeAudit(tx, {
      actorId: actor.id,
      action: "lesson.duplicate",
      targetType: "lesson",
      targetId: copy.id,
      data: { from: id },
    });
    return ok({ id: copy.id });
  });
}

/** Archived lessons disappear from the catalog; old results stay readable. */
export async function setArchived(
  actor: Actor,
  id: number,
  archived: boolean,
): Promise<Result<{ id: number }>> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(lessons)
      .set({
        // Restoring goes back to draft: publishing again is a deliberate step.
        status: archived ? "archived" : "draft",
        updatedAt: sql`now()`,
      })
      .where(
        and(
          eq(lessons.id, id),
          notDeleted,
          archived
            ? sql`${lessons.status} <> 'archived'`
            : eq(lessons.status, "archived"),
        ),
      )
      .returning({ id: lessons.id });
    if (!row) return err("NOT_FOUND");
    await writeAudit(tx, {
      actorId: actor.id,
      action: archived ? "lesson.archive" : "lesson.restore",
      targetType: "lesson",
      targetId: id,
    });
    return ok({ id });
  });
}

/**
 * Deletes a lesson. With attempts it is only soft-deleted (archived and
 * hidden from the admin list) so students keep their results and reviews;
 * without, the row and its versions are removed.
 */
export async function deleteLesson(
  actor: Actor,
  id: number,
): Promise<Result<{ id: number; soft: boolean }>> {
  return db.transaction(async (tx) => {
    const [lesson] = await tx
      .select({ id: lessons.id, title: lessons.title })
      .from(lessons)
      .where(and(eq(lessons.id, id), notDeleted))
      .for("update")
      .limit(1);
    if (!lesson) return err("NOT_FOUND");
    const [used] = await tx
      .select({ one: sql<number>`1` })
      .from(attempts)
      .where(eq(attempts.lessonId, id))
      .limit(1);
    const soft = Boolean(used);
    if (soft)
      await tx
        .update(lessons)
        .set({ status: "archived", deletedAt: sql`now()` })
        .where(eq(lessons.id, id));
    else await tx.delete(lessons).where(eq(lessons.id, id));
    await writeAudit(tx, {
      actorId: actor.id,
      action: "lesson.delete",
      targetType: "lesson",
      targetId: id,
      data: { soft },
    });
    return ok({ id, soft });
  });
}
