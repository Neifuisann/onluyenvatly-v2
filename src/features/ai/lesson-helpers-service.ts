import "server-only";
import { parseLessonText } from "@/features/lessons/domain/parser";
import { err, ok, type Result } from "@/lib/result";
import { ai as defaultAi } from "./client";
import {
  cleanDescription,
  descriptionPrompt,
  HELPERS_MAX_OUTPUT_TOKENS,
  HELPERS_SYSTEM,
  type LessonTopic,
  parseTags,
  tagsPrompt,
} from "./domain/lesson-helpers";
import { AI_TIMEOUT_MS } from "./domain/policy";
import type { Ai, AiFailure } from "./gemini";
import { lessonHelpersCopy as t } from "./messages";

/**
 * "Viết mô tả" and "Gợi ý thẻ" in the lesson editor (09 AI3/AI4, S7-05).
 * One-shot calls through the same gate and daily budget as everything else.
 * Nothing is written: the text goes back into the form, and the teacher
 * saves it with the other settings.
 */

export type HelperInput = {
  title: string;
  grade: number | null;
  chapter: string | null;
  /** The editor's current text, parsed here like `saveDraft` does. */
  sourceText: string;
};

type Deps = { ai?: Ai; knownTags?: () => Promise<string[]> };

const failure = (f: AiFailure) =>
  err(f.code, { message: f.code === "AI_QUOTA" ? t.quota : t.unavailable });

function topicOf(input: HelperInput): LessonTopic | null {
  const { questions } = parseLessonText(input.sourceText);
  if (questions.length === 0) return null;
  return { ...input, questions };
}

const request = (feature: string, contents: string) => ({
  feature,
  kind: "text" as const,
  system: HELPERS_SYSTEM,
  contents,
  timeoutMs: AI_TIMEOUT_MS.short,
  maxOutputTokens: HELPERS_MAX_OUTPUT_TOKENS,
  temperature: 0.4,
});

export async function generateDescription(
  input: HelperInput,
  deps: Deps = {},
): Promise<Result<{ description: string }>> {
  const topic = topicOf(input);
  if (!topic) return err("VALIDATION", { message: t.noQuestions });
  const out = await (deps.ai ?? defaultAi).generateText(
    request("describe", descriptionPrompt(topic)),
  );
  if (!out.ok) return failure(out);
  const description = cleanDescription(out.text);
  if (!out.complete || !description)
    return err("INTERNAL", { message: t.incomplete });
  return ok({ description });
}

export async function suggestTags(
  input: HelperInput,
  deps: Deps = {},
): Promise<Result<{ tags: string[] }>> {
  const topic = topicOf(input);
  if (!topic) return err("VALIDATION", { message: t.noQuestions });
  const known =
    await // The teacher's own tags (B-03); the action passes them in.
    (deps.knownTags ?? (async () => []))();
  const out = await (deps.ai ?? defaultAi).generateText(
    request("tags", tagsPrompt(topic, known)),
  );
  if (!out.ok) return failure(out);
  const tags = parseTags(out.text, known);
  if (!out.complete || tags.length === 0)
    return err("INTERNAL", { message: t.incomplete });
  return ok({ tags });
}
