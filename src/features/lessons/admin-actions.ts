"use server";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { renderTex } from "@/components/math-text/render";
import { HELPER_CALLS_PER_10_MIN } from "@/features/ai/domain/lesson-helpers";
import {
  generateDescription as generateDescriptionService,
  suggestTags as suggestTagsService,
} from "@/features/ai/lesson-helpers-service";
import { requireAdmin } from "@/features/auth/guards";
import { tags } from "@/lib/cache-tags";
import { rateLimit } from "@/lib/rate-limit";
import { err, ok, type Result } from "@/lib/result";
import {
  createLesson as createLessonService,
  deleteLesson as deleteLessonService,
  duplicateLesson as duplicateLessonService,
  reorderLessons,
  setArchived,
  setLessonCover,
  updateLessonSettings,
} from "./admin-service";
import {
  discardDraft as discardDraftService,
  type PublishResult,
  publishLesson,
  type SaveDraftResult,
  saveDraft as saveDraftService,
  unpublishLesson,
} from "./content-service";
import { type CorrectionOutcome, correctLesson } from "./correction-service";
import { LessonIdSchema, ReorderSchema } from "./domain/admin-list";
import { SourceTextSchema } from "./domain/content";
import { parseSingleQuestion } from "./domain/corrections";
import { SettingsFormSchema } from "./domain/settings-form";
import { MAX_QUESTIONS, MediaPathSchema, QuestionIdSchema } from "./schema";

/**
 * Admin lesson actions (05 §2). Every one: `requireAdmin()` first, Zod, the
 * service (one transaction with its audit entry), then the cache tags of what
 * changed and a router refresh for the uncached admin list.
 */

/** Tags a status or content change of one lesson touches. */
function invalidateLesson(id: number) {
  updateTag(tags.lessons);
  updateTag(tags.lesson(id));
}

export async function reorder(
  input: unknown,
): Promise<Result<{ count: number }>> {
  const user = await requireAdmin();
  const parsed = ReorderSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION");
  const result = await reorderLessons(user, parsed.data.ids);
  if (result.ok) {
    // The catalog's default sort is the teacher's order.
    updateTag(tags.lessons);
    refresh();
  }
  return result;
}

export async function duplicate(
  input: unknown,
): Promise<Result<{ id: number }>> {
  const user = await requireAdmin();
  const id = LessonIdSchema.safeParse(input);
  if (!id.success) return err("VALIDATION");
  const result = await duplicateLessonService(user, id.data);
  // A new draft is invisible to students: no shared tag changes.
  if (result.ok) refresh();
  return result;
}

export async function archive(input: unknown): Promise<Result<{ id: number }>> {
  return changeArchived(input, true);
}

export async function restore(input: unknown): Promise<Result<{ id: number }>> {
  return changeArchived(input, false);
}

async function changeArchived(
  input: unknown,
  archived: boolean,
): Promise<Result<{ id: number }>> {
  const user = await requireAdmin();
  const id = LessonIdSchema.safeParse(input);
  if (!id.success) return err("VALIDATION");
  const result = await setArchived(user, id.data, archived);
  if (result.ok) {
    invalidateLesson(id.data);
    refresh();
  }
  return result;
}

export async function deleteLesson(
  input: unknown,
): Promise<Result<{ id: number; soft: boolean }>> {
  const user = await requireAdmin();
  const id = LessonIdSchema.safeParse(input);
  if (!id.success) return err("VALIDATION");
  const result = await deleteLessonService(user, id.data);
  if (result.ok) {
    invalidateLesson(id.data);
    if (!result.data.soft) {
      updateTag(tags.lessonPublic(id.data));
      updateTag(tags.lessonAnswers(id.data));
    }
    refresh();
  }
  return result;
}

/** Form action on the list: a new empty draft, opened in the editor. */
export async function createLesson(): Promise<void> {
  const user = await requireAdmin();
  const { id } = await createLessonService(user);
  // Drafts are invisible to students: no shared tag changes.
  redirect(`/admin/lessons/${id}/edit`);
}

const TexBatchSchema = z
  .array(z.strictObject({ tex: z.string().max(5_000), display: z.boolean() }))
  .max(300);

/**
 * KaTeX HTML for the editor's live preview (S5-02). KaTeX stays on the
 * server (06 §4); the editor asks only for formulas it hasn't seen yet.
 */
export async function renderTexBatch(
  input: unknown,
): Promise<Result<string[]>> {
  await requireAdmin();
  const parsed = TexBatchSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION");
  return ok(parsed.data.map(({ tex, display }) => renderTex(tex, display)));
}

const SaveSettingsSchema = z.strictObject({
  id: LessonIdSchema,
  form: SettingsFormSchema,
});

/** "Cài đặt" tab (S5-03): metadata + config, live at once. */
export async function saveSettings(
  input: unknown,
): Promise<Result<{ id: number }>> {
  const user = await requireAdmin();
  const parsed = SaveSettingsSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION");
  const result = await updateLessonSettings(
    user,
    parsed.data.id,
    parsed.data.form,
  );
  if (result.ok) {
    // Cards (title, grade, time, counts) and the overview's rules.
    invalidateLesson(parsed.data.id);
    refresh();
  }
  return result;
}

const ContentSchema = z.strictObject({
  id: LessonIdSchema,
  sourceText: SourceTextSchema,
});

/**
 * "Lưu nháp" (S5-04): the server re-parses the text itself. A draft is
 * invisible to students, so no shared tag changes; the refresh gives the
 * editor the saved text and question ids.
 */
export async function saveDraft(
  input: unknown,
): Promise<Result<SaveDraftResult>> {
  const user = await requireAdmin();
  const parsed = ContentSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION");
  const result = await saveDraftService(
    user,
    parsed.data.id,
    parsed.data.sourceText,
  );
  if (result.ok) refresh();
  return result;
}

const PublishSchema = z.strictObject({
  id: LessonIdSchema,
  sourceText: SourceTextSchema.optional(),
});

/** "Xuất bản": the draft (or the given text) becomes what students take. */
export async function publish(input: unknown): Promise<Result<PublishResult>> {
  const user = await requireAdmin();
  const parsed = PublishSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION");
  const { id, sourceText } = parsed.data;
  const result = await publishLesson(user, id, sourceText);
  if (result.ok) {
    // Cards and counts, the overview, and both content views: the replaced
    // version may have been deleted.
    invalidateLesson(id);
    updateTag(tags.lessonPublic(id));
    updateTag(tags.lessonAnswers(id));
    refresh();
  }
  return result;
}

/** "Ngừng xuất bản": hidden from the catalog; attempts in progress can still submit. */
export async function unpublish(
  input: unknown,
): Promise<Result<{ id: number }>> {
  const user = await requireAdmin();
  const id = LessonIdSchema.safeParse(input);
  if (!id.success) return err("VALIDATION");
  const result = await unpublishLesson(user, id.data);
  if (result.ok) {
    invalidateLesson(id.data);
    refresh();
  }
  return result;
}

/** "Bỏ bản nháp": back to the published content. Nothing students see changes. */
export async function discardDraft(
  input: unknown,
): Promise<Result<{ id: number }>> {
  const user = await requireAdmin();
  const id = LessonIdSchema.safeParse(input);
  if (!id.success) return err("VALIDATION");
  const result = await discardDraftService(user, id.data);
  if (result.ok) refresh();
  return result;
}

const CoverSchema = z.strictObject({
  id: LessonIdSchema,
  path: MediaPathSchema.nullable(),
});

/** Cover image (S5-05): live at once, like the settings. */
export async function setCover(
  input: unknown,
): Promise<Result<{ id: number }>> {
  const user = await requireAdmin();
  const parsed = CoverSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION");
  const result = await setLessonCover(user, parsed.data.id, parsed.data.path);
  if (result.ok) {
    // Catalog cards show the cover.
    invalidateLesson(parsed.data.id);
    refresh();
  }
  return result;
}

const HelperSchema = z.strictObject({
  title: z.string().trim().min(1).max(200),
  grade: z.union([z.literal(10), z.literal(11), z.literal(12)]).nullable(),
  chapter: z.string().trim().max(100).nullable(),
  sourceText: SourceTextSchema,
});

/** 09 AI3/AI4: each one is a Gemini call, so admins get a few a minute. */
async function helperLimit(userId: string) {
  return rateLimit(`ai:helper:${userId}`, HELPER_CALLS_PER_10_MIN, "10m");
}

/**
 * "Viết mô tả bằng AI" (S7-05): a description from the editor's current
 * title and text. Nothing is saved; the form takes it and the teacher saves.
 */
export async function generateDescription(
  input: unknown,
): Promise<Result<{ description: string }>> {
  const user = await requireAdmin();
  const parsed = HelperSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION");
  if (!(await helperLimit(user.id)).ok) return err("RATE_LIMITED");
  return generateDescriptionService(parsed.data);
}

/** "Gợi ý thẻ" (S7-05): tags for the form, preferring the catalog's own. */
export async function suggestTags(
  input: unknown,
): Promise<Result<{ tags: string[] }>> {
  const user = await requireAdmin();
  const parsed = HelperSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION");
  if (!(await helperLimit(user.id)).ok) return err("RATE_LIMITED");
  return suggestTagsService(parsed.data);
}

const CorrectionInputSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("mcq-answer"),
    questionId: QuestionIdSchema,
    answer: z.number().int().min(0).max(5),
  }),
  z.strictObject({
    kind: z.literal("tf-answer"),
    questionId: QuestionIdSchema,
    answers: z.array(z.boolean()).min(2).max(8),
  }),
  z.strictObject({
    kind: z.literal("short-answer"),
    questionId: QuestionIdSchema,
    answer: z.string().max(100),
  }),
  z.strictObject({
    kind: z.literal("points"),
    questionId: QuestionIdSchema,
    points: z.number().min(0).max(100),
  }),
  z.strictObject({
    kind: z.literal("free"),
    questionId: QuestionIdSchema,
    free: z.boolean(),
  }),
  z.strictObject({ kind: z.literal("remove"), questionId: QuestionIdSchema }),
]);

const CorrectSchema = z.strictObject({
  id: LessonIdSchema,
  corrections: z
    .array(CorrectionInputSchema)
    .min(1)
    .max(MAX_QUESTIONS * 4),
});

/** Everything a correction can change: content, counts, scores, ratings. */
function invalidateCorrection(id: number, rated: boolean) {
  invalidateLesson(id);
  updateTag(tags.lessonPublic(id));
  updateTag(tags.lessonAnswers(id));
  updateTag(tags.lessonStats(id));
  updateTag(tags.adminOverview);
  if (rated) updateTag(tags.leaderboard);
}

/**
 * "Lưu" on `/admin/lessons/[id]/questions` (B-10): keys, points, free and
 * removed questions, applied to the published version in place, then every
 * attempt on it is regraded in the same transaction.
 */
export async function correctQuestions(
  input: unknown,
): Promise<Result<CorrectionOutcome>> {
  const user = await requireAdmin();
  const parsed = CorrectSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION");
  const result = await correctLesson(
    user,
    parsed.data.id,
    parsed.data.corrections,
  );
  if (result.ok) {
    invalidateCorrection(parsed.data.id, result.data.rated);
    refresh();
  }
  return result;
}

const QuestionTextSchema = z.strictObject({
  id: LessonIdSchema,
  questionId: QuestionIdSchema,
  sourceText: z.string().max(50_000),
});

/**
 * "Lưu" in the one-question editor (B-10): the text must hold that one
 * question, of the same shape; it replaces the published one and the
 * attempts are regraded. The client then goes back to the questions page.
 */
export async function saveQuestionText(
  input: unknown,
): Promise<Result<CorrectionOutcome>> {
  const user = await requireAdmin();
  const parsed = QuestionTextSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION");
  const { id, questionId, sourceText } = parsed.data;
  const question = parseSingleQuestion(sourceText, questionId);
  if (!question.ok) return err("VALIDATION", { message: question.message });
  const result = await correctLesson(user, id, [
    { kind: "content", question: question.question },
  ]);
  if (result.ok) invalidateCorrection(id, result.data.rated);
  return result;
}
