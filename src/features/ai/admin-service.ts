import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { explanationVotes, questionExplanations } from "@/db/schema";
import type { SessionUser } from "@/features/auth/session";
import { writeAudit } from "@/lib/audit";
import { err, ok, type Result } from "@/lib/result";
import { getExplanationsByHash, getPublishedQuestions } from "./admin-queries";
import { ai as defaultAi } from "./client";
import {
  cleanExplanation,
  PROMPT_VERSION,
  questionHash,
} from "./domain/explain";
import { nextMissing, planRows, remainingCount } from "./domain/pregenerate";
import { explainRequest, storeExplanation } from "./explain-service";
import type { Ai, AiFailure } from "./gemini";
import { adminExplanationsCopy as t } from "./messages";

type Admin = Pick<SessionUser, "id">;
type Deps = { ai?: Ai; now?: Date };

const failure = (f: AiFailure) =>
  err(f.code, { message: f.code === "AI_QUOTA" ? t.quota : t.unavailable });

export type PregenerateStep = {
  /** The question tried, or null when nothing is left. */
  questionId: string | null;
  /** false: the model's answer was incomplete; the caller skips it. */
  generated: boolean;
  /** Distinct questions still missing after this step (skips excluded). */
  remaining: number;
};

/**
 * One step of "Tạo giải thích cho cả bài" (S7-03): generates the next
 * missing explanation of the lesson's published version, one-shot (no
 * stream), through the same gate and budget as students. The browser calls
 * it again every `PREGEN_INTERVAL_MS` until `remaining` is 0, so one step
 * is one Gemini call and the pace stays under the per-minute limit.
 */
export async function pregenerateStep(
  admin: Admin,
  input: { lessonId: number; skip: readonly string[] },
  deps: Deps = {},
): Promise<Result<PregenerateStep>> {
  const found = await getPublishedQuestions(input.lessonId);
  if (!found) return err("NOT_FOUND");
  const rows = planRows(found.questions);
  const skip = new Set(input.skip);
  const stored = new Set(
    (
      await getExplanationsByHash(rows.flatMap((r) => (r.hash ? [r.hash] : [])))
    ).keys(),
  );
  const next = nextMissing(rows, stored, skip);
  if (!next?.hash)
    return ok({ questionId: null, generated: false, remaining: 0 });

  const out = await (deps.ai ?? defaultAi).generateText(
    explainRequest(next.question, "pregenerate"),
  );
  if (!out.ok) return failure(out);
  const questionId = next.question.id;
  if (!out.complete) {
    skip.add(questionId);
    return ok({
      questionId,
      generated: false,
      remaining: remainingCount(rows, stored, skip),
    });
  }
  const target = {
    question: next.question,
    hash: next.hash,
    lessonId: found.lesson.id,
  };
  await db.transaction(async (tx) => {
    await storeExplanation(tx, target, out);
    await writeAudit(tx, {
      actorId: admin.id,
      action: "explanation.pregenerate",
      targetType: "lesson",
      targetId: found.lesson.id,
      data: { questionId },
    });
  });
  stored.add(next.hash);
  return ok({
    questionId,
    generated: true,
    remaining: remainingCount(rows, stored, skip),
  });
}

/**
 * The teacher's edit (S7-03): replaces the text, marks it `teacher` and
 * reviewed (out of the 👎 queue). Votes stay.
 */
export async function updateExplanation(
  admin: Admin,
  input: { hash: string; contentMd: string },
  now = new Date(),
): Promise<Result<{ hash: string }>> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(questionExplanations)
      .set({
        contentMd: input.contentMd,
        source: "teacher",
        reviewedAt: now,
        reviewedBy: admin.id,
        updatedAt: now,
      })
      .where(eq(questionExplanations.questionHash, input.hash))
      .returning({ hash: questionExplanations.questionHash });
    if (!row) return err("NOT_FOUND");
    await writeAudit(tx, {
      actorId: admin.id,
      action: "explanation.update",
      targetType: "explanation",
      targetId: input.hash,
    });
    return ok(row);
  });
}

/** "Duyệt": the teacher checked it; it leaves the 👎 queue as it is. */
export async function approveExplanation(
  admin: Admin,
  input: { hash: string },
  now = new Date(),
): Promise<Result<{ hash: string }>> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(questionExplanations)
      .set({ reviewedAt: now, reviewedBy: admin.id })
      .where(eq(questionExplanations.questionHash, input.hash))
      .returning({ hash: questionExplanations.questionHash });
    if (!row) return err("NOT_FOUND");
    await writeAudit(tx, {
      actorId: admin.id,
      action: "explanation.approve",
      targetType: "explanation",
      targetId: input.hash,
    });
    return ok(row);
  });
}

/**
 * "Tạo lại" (S7-03): asks Gemini again for the same question and replaces
 * the text, clearing votes and review. The question is looked up in the
 * published version of the lesson it was generated for, by its hash (a
 * question edited since has a new hash: `NOT_FOUND`, nothing to redo).
 */
export async function regenerateExplanation(
  admin: Admin,
  input: { hash: string },
  deps: Deps = {},
): Promise<Result<{ hash: string }>> {
  const [row] = await db
    .select({
      lessonId: questionExplanations.lessonId,
      questionId: questionExplanations.questionId,
    })
    .from(questionExplanations)
    .where(eq(questionExplanations.questionHash, input.hash))
    .limit(1);
  if (!row) return err("NOT_FOUND");
  const found = row.lessonId ? await getPublishedQuestions(row.lessonId) : null;
  const question = found?.questions.find((q) => questionHash(q) === input.hash);
  if (!question) return err("NOT_FOUND", { message: t.questionChanged });

  const out = await (deps.ai ?? defaultAi).generateText(
    explainRequest(question, "regenerate"),
  );
  if (!out.ok) return failure(out);
  if (!out.complete) return err("AI_UNAVAILABLE", { message: t.incomplete });
  const now = deps.now ?? new Date();
  return db.transaction(async (tx) => {
    await tx
      .delete(explanationVotes)
      .where(eq(explanationVotes.questionHash, input.hash));
    const [updated] = await tx
      .update(questionExplanations)
      .set({
        contentMd: cleanExplanation(out.text),
        source: "ai",
        model: out.usage.model,
        promptVersion: PROMPT_VERSION,
        votesUp: 0,
        votesDown: 0,
        reviewedAt: null,
        reviewedBy: null,
        questionId: question.id,
        updatedAt: now,
      })
      .where(eq(questionExplanations.questionHash, input.hash))
      .returning({ hash: questionExplanations.questionHash });
    if (!updated) return err("NOT_FOUND");
    await writeAudit(tx, {
      actorId: admin.id,
      action: "explanation.regenerate",
      targetType: "explanation",
      targetId: input.hash,
    });
    return ok(updated);
  });
}
