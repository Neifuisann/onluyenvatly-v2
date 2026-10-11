import type {
  GenerateContentParameters,
  GenerateContentResponse,
} from "@google/genai";
import { describe, expect, it, vi } from "vitest";
import { type AiGate, createAi, type GeminiModels } from "./gemini";
import { generateDescription, suggestTags } from "./lesson-helpers-service";
import { lessonHelpersCopy } from "./messages";

/** Answers every call with `reply` (`null` = truncated). */
function fakeAi(reply: string | null, gate?: AiGate) {
  const client = {
    generateContent: vi.fn(
      async (_p: GenerateContentParameters) =>
        ({
          text: reply ?? "Nửa câu",
          candidates: [
            { finishReason: reply === null ? "MAX_TOKENS" : "STOP" },
          ],
        }) as unknown as GenerateContentResponse,
    ),
    generateContentStream: vi.fn(),
  };
  const ai = createAi({
    client: () => client as unknown as GeminiModels,
    models: { text: ["gemini-test"], import: [] },
    gate: gate ?? (async () => ({ ok: true })),
    log: () => {},
  });
  return { ai, client };
}

const input = {
  title: "Con lắc lò xo",
  grade: 12,
  chapter: "Dao động cơ",
  sourceText: "Câu 1: Chu kì con lắc lò xo?\n*A. 2π√(m/k)\nB. 2π√(k/m)\n",
};

const promptOf = (client: ReturnType<typeof fakeAi>["client"]) =>
  String(client.generateContent.mock.calls[0]?.[0].contents);

describe("generateDescription", () => {
  it("sends the stems (not the key) and returns a cleaned paragraph", async () => {
    const { ai, client } = fakeAi('"**Ôn tập** con lắc lò xo."');
    const result = await generateDescription(input, { ai });
    expect(result).toEqual({
      ok: true,
      data: { description: "Ôn tập con lắc lò xo." },
    });
    const prompt = promptOf(client);
    expect(prompt).toContain("Chu kì con lắc lò xo?");
    expect(prompt).not.toContain("2π√(m/k)");
  });

  it("refuses a lesson without questions without calling Gemini", async () => {
    const { ai, client } = fakeAi("x");
    const result = await generateDescription(
      { ...input, sourceText: "chỉ có lời dẫn" },
      { ai },
    );
    expect(result).toMatchObject({
      ok: false,
      code: "VALIDATION",
      message: lessonHelpersCopy.noQuestions,
    });
    expect(client.generateContent).not.toHaveBeenCalled();
  });

  it("reports quota, unavailability and truncated answers", async () => {
    const quota = await generateDescription(input, {
      ai: fakeAi("x", async () => ({
        ok: false,
        code: "AI_QUOTA",
        reason: "budget",
      })).ai,
    });
    expect(quota).toMatchObject({
      code: "AI_QUOTA",
      message: lessonHelpersCopy.quota,
    });
    const off = await generateDescription(input, {
      ai: fakeAi("x", async () => ({
        ok: false,
        code: "AI_UNAVAILABLE",
        reason: "disabled",
      })).ai,
    });
    expect(off).toMatchObject({
      code: "AI_UNAVAILABLE",
      message: lessonHelpersCopy.unavailable,
    });
    const cut = await generateDescription(input, { ai: fakeAi(null).ai });
    expect(cut).toMatchObject({
      code: "INTERNAL",
      message: lessonHelpersCopy.incomplete,
    });
  });
});

describe("suggestTags", () => {
  it("reuses the teacher's own tags", async () => {
    const { ai, client } = fakeAi("dao động, con lắc lò xo, ôn tập");
    const result = await suggestTags(input, {
      ai,
      knownTags: async () => ["Dao động"],
    });
    expect(result).toEqual({
      ok: true,
      data: { tags: ["Dao động", "con lắc lò xo", "ôn tập"] },
    });
    expect(promptOf(client)).toContain("Dao động");
  });

  it("uses injected known tags and fails on an empty answer", async () => {
    const { ai } = fakeAi(" , ");
    const result = await suggestTags(input, {
      ai,
      knownTags: async () => [],
    });
    expect(result).toMatchObject({ ok: false, code: "INTERNAL" });
    const none = await suggestTags(
      { ...input, sourceText: "" },
      { ai, knownTags: async () => [] },
    );
    expect(none).toMatchObject({ ok: false, code: "VALIDATION" });
    const quota = await suggestTags(input, {
      ai: fakeAi("x", async () => ({
        ok: false,
        code: "AI_QUOTA",
        reason: "budget",
      })).ai,
      knownTags: async () => [],
    });
    expect(quota).toMatchObject({ code: "AI_QUOTA" });
  });
});
