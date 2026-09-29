import "server-only";
import { and, eq, isNull, max, sql } from "drizzle-orm";
import type { Tx } from "@/db/client";
import { db } from "@/db/client";
import { attempts, lessons, lessonVersions, mistakes } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { err, ok, type Result } from "@/lib/result";
import { type Actor, insertLesson } from "./admin-service";
import { checkPublishable, draftContent } from "./domain/content";
import { summarizeLesson } from "./domain/summary";
import { publishCopy } from "./messages";
import {
  DEFAULT_LESSON_CONFIG,
  LessonConfigSchema,
  type Question,
  QuestionsSchema,
} from "./schema";

/**
 * Lesson content versioning (S5-04, 04 `lesson_versions`):
 * - saving a draft overwrites the draft version in place (one draft row);
 * - publishing makes the draft current. The version it replaces is kept
 *   only when attempts use it; otherwise it is deleted in the same
 *   transaction and the new one takes over its number, so a version number
 *   is used up only when students took the previous content;
 * - an attempt keeps `lesson_version_id`, so it is always graded against
 *   the content it was started on.
 * Callers check `requireAdmin()` first.
 */

async function lockLesson(tx: Tx, id: number) {
  const [row] = await tx
    .select({
      status: lessons.status,
      config: lessons.config,
      currentVersionId: lessons.currentVersionId,
      draftVersionId: lessons.draftVersionId,
    })
    .from(lessons)
    .where(and(eq(lessons.id, id), isNull(lessons.deletedAt)))
    .for("update")
    .limit(1);
  return row ?? null;
}

type LockedLesson = NonNullable<Awaited<ReturnType<typeof lockLesson>>>;

async function readVersion(tx: Tx, versionId: number | null) {
  if (!versionId) return null;
  const [row] = await tx
    .select({
      version: lessonVersions.version,
      sourceText: lessonVersions.sourceText,
      questions: lessonVersions.questions,
    })
    .from(lessonVersions)
    .where(eq(lessonVersions.id, versionId))
    .limit(1);
  if (!row) return null;
  const questions = QuestionsSchema.safeParse(row.questions);
  return {
    version: row.version,
    sourceText: row.sourceText,
    // A draft may hold no questions yet; ids are reused when they parse.
    questions: questions.success ? questions.data : ([] as Question[]),
  };
}

/** The draft row, overwritten in place, or a new one numbered after the others. */
async function writeDraft(
  tx: Tx,
  actor: { id: string },
  lessonId: number,
  lesson: LockedLesson,
  content: { sourceText: string; questions: Question[] },
): Promise<number> {
  if (lesson.draftVersionId) {
    await tx
      .update(lessonVersions)
      .set({
        sourceText: content.sourceText,
        questions: content.questions,
        createdBy: actor.id,
      })
      .where(eq(lessonVersions.id, lesson.draftVersionId));
    return lesson.draftVersionId;
  }
  const [last] = await tx
    .select({ n: max(lessonVersions.version) })
    .from(lessonVersions)
    .where(eq(lessonVersions.lessonId, lessonId));
  const [row] = await tx
    .insert(lessonVersions)
    .values({
      lessonId,
      version: (last?.n ?? 0) + 1,
      sourceText: content.sourceText,
      questions: content.questions,
      createdBy: actor.id,
    })
    .returning({ id: lessonVersions.id });
  if (!row) throw new Error("lesson version insert returned no row");
  await tx
    .update(lessons)
    .set({ draftVersionId: row.id })
    .where(eq(lessons.id, lessonId));
  return row.id;
}

/** Questions whose ids a new parse should reuse: the draft's, else the published ones. */
async function previousQuestions(tx: Tx, lesson: LockedLesson) {
  const draft = await readVersion(tx, lesson.draftVersionId);
  if (draft && draft.questions.length > 0)
    return { draft, questions: draft.questions };
  const current = await readVersion(tx, lesson.currentVersionId);
  return { draft, questions: current?.questions ?? [] };
}

/**
 * AI import (S7-04): a new draft lesson holding the imported text, in one
 * transaction, so a failure leaves no empty lesson behind. Students see
 * nothing until it is published.
 */
export async function createImportedLesson(
  actor: Actor,
  input: { title: string; sourceText: string },
): Promise<{ id: number; questions: number; errors: number }> {
  return db.transaction(async (tx) => {
    const id = await insertLesson(tx, actor, input.title);
    const content = draftContent(input.sourceText);
    const versionId = await writeDraft(
      tx,
      actor,
      id,
      {
        status: "draft",
        config: DEFAULT_LESSON_CONFIG,
        currentVersionId: null,
        draftVersionId: null,
      },
      content,
    );
    const counts = {
      questions: content.questions.length,
      errors: content.errors,
    };
    await writeAudit(tx, {
      actorId: actor.id,
      action: "lesson.import",
      targetType: "lesson",
      targetId: id,
      data: { versionId, ...counts },
    });
    return { id, ...counts };
  });
}

export type SaveDraftResult = {
  /** Nothing written: no draft, and the text equals the published one. */
  unchanged: boolean;
  errors: number;
};

/** "Lưu nháp": students see nothing of it until it is published. */
export async function saveDraft(
  actor: Actor,
  id: number,
  sourceText: string,
): Promise<Result<SaveDraftResult>> {
  return db.transaction(async (tx) => {
    const lesson = await lockLesson(tx, id);
    if (!lesson) return err("NOT_FOUND");
    if (!lesson.draftVersionId && lesson.currentVersionId) {
      const current = await readVersion(tx, lesson.currentVersionId);
      if (current?.sourceText === sourceText)
        return ok({ unchanged: true, errors: 0 });
    }
    const { questions: previous } = await previousQuestions(tx, lesson);
    const content = draftContent(sourceText, { previous });
    const versionId = await writeDraft(tx, actor, id, lesson, content);
    await tx
      .update(lessons)
      .set({ updatedAt: sql`now()` })
      .where(eq(lessons.id, id));
    await writeAudit(tx, {
      actorId: actor.id,
      action: "lesson.save_draft",
      targetType: "lesson",
      targetId: id,
      data: { versionId, errors: content.errors },
    });
    return ok({ unchanged: false, errors: content.errors });
  });
}

export type PublishResult = {
  versionId: number;
  version: number;
  /** The replaced version was deleted (no attempt used it). */
  retired: boolean;
};

/**
 * "Xuất bản". With `sourceText`, that text is checked and saved as the draft
 * first, in the same transaction. Without a draft, re-publishes the current
 * version (after "Ngừng xuất bản").
 */
export async function publishLesson(
  actor: Actor,
  id: number,
  sourceText?: string,
): Promise<Result<PublishResult>> {
  return db.transaction(async (tx) => {
    const lesson = await lockLesson(tx, id);
    if (!lesson) return err("NOT_FOUND");
    if (lesson.status === "archived")
      return err("CONFLICT", { message: publishCopy.archived });
    const config = LessonConfigSchema.safeParse(lesson.config);
    if (!config.success) return err("INTERNAL");

    const { draft, questions: previous } = await previousQuestions(tx, lesson);
    let text = sourceText ?? draft?.sourceText;
    if (!draft && text !== undefined && lesson.currentVersionId) {
      // The published text itself: re-publish rather than use up a version.
      const current = await readVersion(tx, lesson.currentVersionId);
      if (current?.sourceText === text) text = undefined;
    }

    if (text === undefined) {
      // No draft: bring the current version back, if there is one.
      const current = await readVersion(tx, lesson.currentVersionId);
      if (!lesson.currentVersionId || !current)
        return err("VALIDATION", { message: publishCopy.nothingToPublish });
      await tx
        .update(lessons)
        .set({
          status: "published",
          publishedAt: sql`coalesce(${lessons.publishedAt}, now())`,
          updatedAt: sql`now()`,
        })
        .where(eq(lessons.id, id));
      await writeAudit(tx, {
        actorId: actor.id,
        action: "lesson.publish",
        targetType: "lesson",
        targetId: id,
        data: { versionId: lesson.currentVersionId, republish: true },
      });
      return ok({
        versionId: lesson.currentVersionId,
        version: current.version,
        retired: false,
      });
    }

    const check = checkPublishable(text, config.data, { previous });
    if (!check.ok) return err("VALIDATION", { message: check.message });
    const draftId = await writeDraft(tx, actor, id, lesson, {
      sourceText: text,
      questions: check.questions,
    });

    const old = lesson.currentVersionId;
    await tx
      .update(lessons)
      .set({
        currentVersionId: draftId,
        draftVersionId: null,
        status: "published",
        publishedAt: sql`coalesce(${lessons.publishedAt}, now())`,
        updatedAt: sql`now()`,
        ...summarizeLesson(check.questions, config.data),
      })
      .where(eq(lessons.id, id));

    let retired = false;
    if (old && old !== draftId) {
      // The row lock waits for any attempt insert already pointing at it
      // (its foreign-key check holds a key-share lock); the NOT EXISTS then
      // sees every committed attempt.
      await tx
        .select({ id: lessonVersions.id })
        .from(lessonVersions)
        .where(eq(lessonVersions.id, old))
        .for("update");
      const [gone] = await tx
        .delete(lessonVersions)
        .where(
          and(
            eq(lessonVersions.id, old),
            sql`not exists (select 1 from ${attempts} where ${attempts.lessonVersionId} = ${old})`,
            // The mistakes bank and personalized practice (S7-06) point at
            // versions too: a mistake by FK, a review item through its `v`.
            sql`not exists (select 1 from ${mistakes} where ${mistakes.lessonVersionId} = ${old})`,
            sql`not exists (select 1 from ${attempts} where ${attempts.lessonId} is null and ${attempts.items} @> ${JSON.stringify([{ v: old }])}::jsonb)`,
          ),
        )
        .returning({ version: lessonVersions.version });
      if (gone) {
        retired = true;
        await tx
          .update(lessonVersions)
          .set({ version: gone.version })
          .where(eq(lessonVersions.id, draftId));
      }
    }
    const [published] = await tx
      .select({ version: lessonVersions.version })
      .from(lessonVersions)
      .where(eq(lessonVersions.id, draftId));
    const version = published?.version ?? 0;
    await writeAudit(tx, {
      actorId: actor.id,
      action: "lesson.publish",
      targetType: "lesson",
      targetId: id,
      data: { versionId: draftId, version, replaced: old, retired },
    });
    return ok({ versionId: draftId, version, retired });
  });
}

/** "Ngừng xuất bản": back to draft status; the content stays for later. */
export async function unpublishLesson(
  actor: Actor,
  id: number,
): Promise<Result<{ id: number }>> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(lessons)
      .set({ status: "draft", updatedAt: sql`now()` })
      .where(
        and(
          eq(lessons.id, id),
          isNull(lessons.deletedAt),
          eq(lessons.status, "published"),
        ),
      )
      .returning({ id: lessons.id });
    if (!row) return err("CONFLICT", { message: publishCopy.notPublished });
    await writeAudit(tx, {
      actorId: actor.id,
      action: "lesson.unpublish",
      targetType: "lesson",
      targetId: id,
    });
    return ok({ id });
  });
}

/** "Bỏ bản nháp": only when a published version remains to fall back to. */
export async function discardDraft(
  actor: Actor,
  id: number,
): Promise<Result<{ id: number }>> {
  return db.transaction(async (tx) => {
    const lesson = await lockLesson(tx, id);
    if (!lesson) return err("NOT_FOUND");
    if (!lesson.draftVersionId || !lesson.currentVersionId)
      return err("CONFLICT", { message: publishCopy.noDraft });
    await tx
      .update(lessons)
      .set({ draftVersionId: null, updatedAt: sql`now()` })
      .where(eq(lessons.id, id));
    // A draft never has attempts (they start on the current version).
    await tx
      .delete(lessonVersions)
      .where(eq(lessonVersions.id, lesson.draftVersionId));
    await writeAudit(tx, {
      actorId: actor.id,
      action: "lesson.discard_draft",
      targetType: "lesson",
      targetId: id,
      data: { versionId: lesson.draftVersionId },
    });
    return ok({ id });
  });
}
