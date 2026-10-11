"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireAdmin, requireTeacher } from "@/features/auth/guards";
import { createImportedLesson as createImportedLessonService } from "@/features/lessons/content-service";
import { SourceTextSchema } from "@/features/lessons/domain/content";
import { MAX_QUESTIONS, QuestionIdSchema } from "@/features/lessons/schema";
import { rateLimit } from "@/lib/rate-limit";
import { err, ok, type Result } from "@/lib/result";
import {
  approveExplanation as approveService,
  type PregenerateStep,
  pregenerateStep,
  regenerateExplanation as regenerateService,
  updateExplanation as updateService,
} from "./admin-service";
import {
  IMPORT_CONTENT_TYPES,
  IMPORT_MAX_BYTES,
  type ImportContentType,
} from "./domain/import";
import { ExplanationTextSchema, PREGEN_PER_MINUTE } from "./domain/pregenerate";
import { createImportUpload as createImportUploadService } from "./import-service";
import { ExplanationHashSchema } from "./schemas";

/**
 * Admin actions of `/admin/explanations` (05 §2, S7-03). Each starts with
 * `requireAdmin()`, then Zod, then one service call; the page is read per
 * request, so `refresh()` re-renders it. The AI import steps are a
 * teacher's (`requireTeacher()`, B-03). Explanations are never
 * shared-cached, so there is no tag to invalidate.
 */

const PregenerateSchema = z.strictObject({
  lessonId: z.number().int().positive(),
  skip: z.array(QuestionIdSchema).max(MAX_QUESTIONS).default([]),
});

/** One question of "Tạo giải thích cho cả bài"; the browser paces calls. */
export async function pregenerateExplanations(
  input: unknown,
): Promise<Result<PregenerateStep>> {
  const user = await requireAdmin();
  const parsed = PregenerateSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION");
  // The browser waits between steps; this holds even if it doesn't.
  const limit = await rateLimit(
    `ai:pregen:${user.id}`,
    PREGEN_PER_MINUTE + 2,
    "1m",
  );
  if (!limit.ok) return err("RATE_LIMITED");
  const result = await pregenerateStep(user, parsed.data);
  if (result.ok && result.data.generated) refresh();
  return result;
}

const UpdateSchema = z.strictObject({
  hash: ExplanationHashSchema,
  contentMd: ExplanationTextSchema,
});

export async function updateExplanation(
  input: unknown,
): Promise<Result<{ hash: string }>> {
  const user = await requireAdmin();
  const parsed = UpdateSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION");
  const result = await updateService(user, parsed.data);
  if (result.ok) refresh();
  return result;
}

const HashInputSchema = z.strictObject({ hash: ExplanationHashSchema });

export async function approveExplanation(
  input: unknown,
): Promise<Result<{ hash: string }>> {
  const user = await requireAdmin();
  const parsed = HashInputSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION");
  const result = await approveService(user, parsed.data);
  if (result.ok) refresh();
  return result;
}

export async function regenerateExplanation(
  input: unknown,
): Promise<Result<{ hash: string }>> {
  const user = await requireAdmin();
  const parsed = HashInputSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION");
  const result = await regenerateService(user, parsed.data);
  if (result.ok) refresh();
  return result;
}

const ImportUploadSchema = z.strictObject({
  contentType: z.enum(
    IMPORT_CONTENT_TYPES as [ImportContentType, ...ImportContentType[]],
  ),
  bytes: z.number().int().positive().max(IMPORT_MAX_BYTES),
});

/**
 * AI import step 1 (S7-04): a signed upload URL in the private `imports`
 * bucket; the browser PUTs the file there itself.
 */
export async function createImportUpload(
  input: unknown,
): Promise<Result<{ path: string; uploadUrl: string }>> {
  const user = await requireTeacher();
  const parsed = ImportUploadSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION");
  return createImportUploadService(user, parsed.data);
}

const ImportedLessonSchema = z.strictObject({
  title: z.string().trim().min(1).max(200),
  sourceText: SourceTextSchema.refine((s) => s.trim().length > 0),
});

/**
 * AI import step 3 (S7-04): the text the teacher accepted becomes a new
 * draft (audit `lesson.import`); the browser then opens the editor.
 */
export async function createImportedLesson(
  input: unknown,
): Promise<Result<{ id: number; questions: number; errors: number }>> {
  const user = await requireTeacher();
  const parsed = ImportedLessonSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION");
  // A draft is invisible to students: no shared tag changes (the admin
  // list is read per request).
  return ok(await createImportedLessonService(user, parsed.data));
}
