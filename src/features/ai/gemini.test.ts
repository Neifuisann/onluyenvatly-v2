import type {
  GenerateContentParameters,
  GenerateContentResponse,
} from "@google/genai";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type AiDeps,
  type AiLogEntry,
  type AiRequest,
  createAi,
  type GeminiModels,
} from "./gemini";

const res = (
  text: string,
  extra: { finishReason?: string; usage?: boolean } = {},
) =>
  ({
    text,
    candidates: [{ finishReason: extra.finishReason ?? "STOP" }],
    ...(extra.usage !== false && {
      usageMetadata: {
        promptTokenCount: 600,
        candidatesTokenCount: 450,
        thoughtsTokenCount: 12,
      },
    }),
  }) as unknown as GenerateContentResponse;

const apiError = (status: number) =>
  Object.assign(new Error(`HTTP ${status}`), { status });

async function* stream(
  parts: (string | Error)[],
  onReturn?: () => void,
): AsyncGenerator<GenerateContentResponse> {
  try {
    for (const [i, p] of parts.entries()) {
      if (p instanceof Error) throw p;
      yield i === parts.length - 1 ? res(p) : res(p, { usage: false });
    }
  } finally {
    onReturn?.();
  }
}

const req: AiRequest = {
  feature: "explain",
  kind: "text",
  system: "Bạn là giáo viên.",
  contents: "Câu hỏi",
  timeoutMs: 25_000,
  maxOutputTokens: 800,
};

function setup(models: Partial<GeminiModels>, overrides: Partial<AiDeps> = {}) {
  const logs: AiLogEntry[] = [];
  const sleep = vi.fn(async (_ms: number) => {});
  const gate = vi.fn(async () => ({ ok: true as const }));
  const client = {
    generateContent: vi.fn(async () => res("")),
    generateContentStream: vi.fn(async () => stream([])),
    ...models,
  } as GeminiModels;
  const ai = createAi({
    client: () => client,
    models: { text: ["m-1", "m-2"], import: ["i-1"] },
    gate,
    log: (e) => logs.push(e),
    sleep,
    random: () => 0,
    ...overrides,
  });
  return { ai, client, logs, sleep, gate };
}

const modelOf = (call: unknown[]) =>
  (call[0] as GenerateContentParameters).model;

afterEach(() => {
  vi.useRealTimers();
});

describe("generateText", () => {
  it("returns the text with token usage and logs counts, not content", async () => {
    const { ai, client, logs } = setup({
      generateContent: vi.fn(async () => res("Lời giải")),
    });
    const out = await ai.generateText(req);
    expect(out).toMatchObject({
      ok: true,
      text: "Lời giải",
      complete: true,
      usage: {
        model: "m-1",
        inputTokens: 600,
        outputTokens: 450,
        thoughtTokens: 12,
      },
    });
    const params = vi.mocked(client.generateContent).mock
      .calls[0]?.[0] as GenerateContentParameters;
    expect(params.config).toMatchObject({
      systemInstruction: "Bạn là giáo viên.",
      maxOutputTokens: 800,
    });
    expect(params.config?.abortSignal).toBeInstanceOf(AbortSignal);
    expect(logs).toEqual([
      expect.objectContaining({
        feature: "explain",
        model: "m-1",
        ok: true,
        retries: 0,
        inputTokens: 600,
        outputTokens: 450,
      }),
    ]);
    expect(JSON.stringify(logs)).not.toContain("Lời giải");
  });

  it("answers AI_UNAVAILABLE without a key, before the gate", async () => {
    const { ai, gate } = setup({}, { client: () => null });
    expect(await ai.generateText(req)).toEqual({
      ok: false,
      code: "AI_UNAVAILABLE",
      reason: "not_configured",
    });
    expect(gate).not.toHaveBeenCalled();
  });

  it("answers AI_UNAVAILABLE when no model is configured", async () => {
    const { ai } = setup({}, { models: { text: [], import: [] } });
    expect(await ai.generateText(req)).toMatchObject({
      code: "AI_UNAVAILABLE",
      reason: "not_configured",
    });
  });

  it("returns the gate's refusal without calling Gemini", async () => {
    const { ai, client, logs } = setup(
      {},
      {
        gate: async () => ({ ok: false, code: "AI_QUOTA", reason: "budget" }),
      },
    );
    expect(await ai.generateText(req)).toEqual({
      ok: false,
      code: "AI_QUOTA",
      reason: "budget",
    });
    expect(client.generateContent).not.toHaveBeenCalled();
    expect(logs[0]).toMatchObject({ ok: false, reason: "budget" });
  });

  it("retries a 503 with backoff and counts the gate once", async () => {
    const generateContent = vi
      .fn()
      .mockRejectedValueOnce(apiError(503))
      .mockRejectedValueOnce(apiError(503))
      .mockResolvedValue(res("ok"));
    const { ai, sleep, gate, logs } = setup({ generateContent });
    const out = await ai.generateText(req);
    expect(out).toMatchObject({ ok: true, text: "ok" });
    expect(generateContent.mock.calls.map(modelOf)).toEqual([
      "m-1",
      "m-1",
      "m-1",
    ]);
    expect(sleep.mock.calls).toEqual([[500], [1000]]);
    expect(gate).toHaveBeenCalledTimes(1);
    expect(logs.at(-1)).toMatchObject({ ok: true, retries: 2 });
  });

  it("moves to the next model on 429 without waiting", async () => {
    const generateContent = vi
      .fn()
      .mockRejectedValueOnce(apiError(429))
      .mockResolvedValue(res("ok"));
    const { ai, sleep } = setup({ generateContent });
    const out = await ai.generateText(req);
    expect(out).toMatchObject({ ok: true, usage: { model: "m-2" } });
    expect(generateContent.mock.calls.map(modelOf)).toEqual(["m-1", "m-2"]);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("answers AI_QUOTA when every model stays rate limited", async () => {
    const generateContent = vi.fn().mockRejectedValue(apiError(429));
    const { ai, logs } = setup({ generateContent });
    expect(await ai.generateText(req)).toEqual({
      ok: false,
      code: "AI_QUOTA",
      reason: "rate_limited",
    });
    // m-1 once, then m-2 with two retries.
    expect(generateContent.mock.calls.map(modelOf)).toEqual([
      "m-1",
      "m-2",
      "m-2",
      "m-2",
    ]);
    expect(logs.at(-1)).toMatchObject({
      ok: false,
      status: 429,
      retries: 3,
      model: "m-2",
    });
  });

  it("falls through to the next model after 5xx retries", async () => {
    const generateContent = vi
      .fn()
      .mockRejectedValueOnce(apiError(500))
      .mockRejectedValueOnce(new Error("socket hang up"))
      .mockRejectedValueOnce(apiError(503))
      .mockResolvedValue(res("ok"));
    const { ai } = setup({ generateContent });
    expect(await ai.generateText(req)).toMatchObject({
      ok: true,
      usage: { model: "m-2" },
    });
  });

  it("stops at once on a client error", async () => {
    const generateContent = vi.fn().mockRejectedValue(apiError(400));
    const { ai } = setup({ generateContent });
    expect(await ai.generateText(req)).toEqual({
      ok: false,
      code: "AI_UNAVAILABLE",
      reason: "error",
    });
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it("uses the import models for import requests", async () => {
    const generateContent = vi.fn(async () => res("ok"));
    const { ai } = setup({ generateContent });
    await ai.generateText({ ...req, kind: "import" });
    expect(generateContent.mock.calls.map(modelOf)).toEqual(["i-1"]);
  });

  it("flags a truncated answer as incomplete", async () => {
    const { ai } = setup({
      generateContent: vi.fn(async () =>
        res("Nửa câu", { finishReason: "MAX_TOKENS" }),
      ),
    });
    expect(await ai.generateText(req)).toMatchObject({
      ok: true,
      complete: false,
    });
  });

  it("flags an empty answer as incomplete", async () => {
    const { ai } = setup({
      generateContent: vi.fn(async () => res("  ")),
    });
    expect(await ai.generateText(req)).toMatchObject({ complete: false });
  });

  it("gives up at the deadline and aborts the request", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const generateContent = vi.fn(
      (p: GenerateContentParameters) =>
        new Promise<GenerateContentResponse>(() => {
          signal = p.config?.abortSignal;
        }),
    );
    const { ai } = setup({ generateContent }, { now: () => Date.now() });
    const pending = ai.generateText({ ...req, timeoutMs: 1000 });
    await vi.advanceTimersByTimeAsync(1000);
    expect(await pending).toEqual({
      ok: false,
      code: "AI_UNAVAILABLE",
      reason: "timeout",
    });
    expect(signal?.aborted).toBe(true);
  });

  it("does not start a backoff that would pass the deadline", async () => {
    let clock = 0;
    const generateContent = vi.fn(async () => {
      clock += 900;
      throw apiError(503);
    });
    const { ai, sleep } = setup(
      { generateContent },
      { now: () => clock, models: { text: ["m-1"], import: [] } },
    );
    expect(await ai.generateText({ ...req, timeoutMs: 1200 })).toMatchObject({
      reason: "timeout",
    });
    expect(sleep).not.toHaveBeenCalled();
  });
});

describe("streamText", () => {
  async function collect(chunks: AsyncIterable<string>) {
    const out: string[] = [];
    for await (const c of chunks) out.push(c);
    return out;
  }

  it("streams deltas and settles with the full text and usage", async () => {
    const { ai, logs } = setup({
      generateContentStream: vi.fn(async () => stream(["Ý ", "chính", ""])),
    });
    const s = await ai.streamText(req);
    if (!s.ok) throw new Error("expected a stream");
    expect(await collect(s.chunks)).toEqual(["Ý ", "chính"]);
    expect(await s.result).toMatchObject({
      ok: true,
      text: "Ý chính",
      complete: true,
      usage: { model: "m-1", inputTokens: 600, outputTokens: 450 },
    });
    expect(logs.at(-1)).toMatchObject({ ok: true, outputTokens: 450 });
  });

  it("retries a failure before the first chunk", async () => {
    const generateContentStream = vi
      .fn()
      .mockResolvedValueOnce(stream([apiError(503)]))
      .mockResolvedValue(stream(["ok"]));
    const { ai, gate } = setup({ generateContentStream });
    const s = await ai.streamText(req);
    if (!s.ok) throw new Error("expected a stream");
    expect(await collect(s.chunks)).toEqual(["ok"]);
    expect(generateContentStream).toHaveBeenCalledTimes(2);
    expect(gate).toHaveBeenCalledTimes(1);
  });

  it("returns the failure when no stream could start", async () => {
    const { ai } = setup({
      generateContentStream: vi.fn().mockRejectedValue(apiError(403)),
    });
    expect(await ai.streamText(req)).toEqual({
      ok: false,
      code: "AI_UNAVAILABLE",
      reason: "error",
    });
  });

  it("ends the stream on a mid-stream error and reports it", async () => {
    const { ai, logs } = setup({
      generateContentStream: vi.fn(async () => stream(["Ý ", apiError(429)])),
    });
    const s = await ai.streamText(req);
    if (!s.ok) throw new Error("expected a stream");
    expect(await collect(s.chunks)).toEqual(["Ý "]);
    expect(await s.result).toEqual({
      ok: false,
      code: "AI_QUOTA",
      reason: "rate_limited",
    });
    expect(logs.at(-1)).toMatchObject({ ok: false, reason: "rate_limited" });
  });

  it("cancels upstream when the reader stops early", async () => {
    const onReturn = vi.fn();
    const { ai } = setup({
      generateContentStream: vi.fn(async () =>
        stream(["a", "b", "c"], onReturn),
      ),
    });
    const s = await ai.streamText(req);
    if (!s.ok) throw new Error("expected a stream");
    for await (const _ of s.chunks) break;
    expect(await s.result).toMatchObject({ ok: false, reason: "error" });
    expect(onReturn).toHaveBeenCalled();
  });

  it("cuts a stalled stream at the deadline", async () => {
    vi.useFakeTimers();
    async function* stalled(): AsyncGenerator<GenerateContentResponse> {
      yield res("Ý ", { usage: false });
      await new Promise(() => {});
    }
    const { ai } = setup(
      { generateContentStream: vi.fn(async () => stalled()) },
      { now: () => Date.now() },
    );
    const s = await ai.streamText({ ...req, timeoutMs: 1000 });
    if (!s.ok) throw new Error("expected a stream");
    const read = collect(s.chunks);
    await vi.advanceTimersByTimeAsync(1000);
    expect(await read).toEqual(["Ý "]);
    expect(await s.result).toMatchObject({ ok: false, reason: "timeout" });
  });
});
