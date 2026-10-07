import "server-only";
import type {
  ThinkingLevel as ApiThinkingLevel,
  ContentListUnion,
  GenerateContentParameters,
  GenerateContentResponse,
} from "@google/genai";
import {
  backoffMs,
  errorStatus,
  nextStep,
  type ThinkingLevel,
  thinkingConfigFor,
} from "./domain/policy";

/**
 * The Gemini wrapper (09 §2, S7-01). Every generation goes through here:
 * the gate (kill switch + global daily budget) is checked once per call,
 * then the configured models are tried in order, with retries and jittered
 * backoff on 429/5xx, all inside one deadline. A model that does not start
 * answering within `attemptTimeoutMs` is cut and treated as overloaded.
 * Each call logs one line with the model, token counts and duration, never
 * the prompt or the output.
 *
 * `createAi` takes its dependencies so the rules are unit-tested with a fake
 * client; `client.ts` wires the real SDK, env and database.
 */

/** The part of `GoogleGenAI.models` we use. */
export type GeminiModels = {
  generateContent(
    p: GenerateContentParameters,
  ): Promise<GenerateContentResponse>;
  generateContentStream(
    p: GenerateContentParameters,
  ): Promise<AsyncGenerator<GenerateContentResponse>>;
};

export type AiModelKind = "text" | "import";

export type AiRequest = {
  /** Log label: `explain`, `pregenerate`, `import`… */
  feature: string;
  kind: AiModelKind;
  system?: string;
  contents: ContentListUnion;
  timeoutMs: number;
  /**
   * Longest one model may take to start answering (first chunk), after
   * which its request is aborted and the next model is tried (like a 503).
   * Unset: only `timeoutMs` applies.
   */
  attemptTimeoutMs?: number;
  /** Gemini 3+ only (see `thinkingConfigFor`); unset: the model's default. */
  thinking?: ThinkingLevel;
  maxOutputTokens?: number;
  temperature?: number;
};

export type AiFailureCode = "AI_UNAVAILABLE" | "AI_QUOTA";
export type AiFailureReason =
  | "disabled"
  | "not_configured"
  | "budget"
  | "rate_limited"
  | "timeout"
  | "error";
export type AiFailure = {
  ok: false;
  code: AiFailureCode;
  reason: AiFailureReason;
};

export type AiUsage = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  thoughtTokens: number;
  ms: number;
};

export type AiText = {
  ok: true;
  text: string;
  usage: AiUsage;
  /** false when the model stopped early (token limit, safety): don't store it. */
  complete: boolean;
};

export type AiStream =
  | {
      ok: true;
      model: string;
      /** Text deltas. Ends early, without throwing, if the stream fails. */
      chunks: AsyncIterable<string>;
      /** Settles once `chunks` is done or abandoned. Never rejects. */
      result: Promise<AiText | AiFailure>;
    }
  | AiFailure;

export type AiGate = () => Promise<{ ok: true } | AiFailure>;

export type AiLogEntry = {
  feature: string;
  model: string | null;
  ok: boolean;
  reason?: AiFailureReason;
  status?: number;
  retries: number;
  inputTokens?: number;
  outputTokens?: number;
  thoughtTokens?: number;
  ms: number;
};

export type AiDeps = {
  /** null when `GEMINI_API_KEY` is missing. */
  client: () => GeminiModels | null;
  models: Record<AiModelKind, readonly string[]>;
  gate: AiGate;
  log?: (entry: AiLogEntry) => void;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  now?: () => number;
};

const fail = (code: AiFailureCode, reason: AiFailureReason): AiFailure => ({
  ok: false,
  code,
  reason,
});

const failureOf = (reason: AiFailureReason): AiFailure =>
  fail(reason === "rate_limited" ? "AI_QUOTA" : "AI_UNAVAILABLE", reason);

class Timeout extends Error {}
/** One model took longer than `attemptTimeoutMs` to start answering. */
class Stalled extends Error {}

/** One deadline for a whole call: retries, backoff and the stream itself. */
function deadline(ms: number) {
  const controller = new AbortController();
  let rejectAborted: (e: unknown) => void = () => {};
  // Raced against every SDK promise, so a client that ignores the signal
  // still stops at the deadline.
  const aborted = new Promise<never>((_, reject) => {
    rejectAborted = reject;
  });
  aborted.catch(() => {});
  const timer = setTimeout(() => {
    controller.abort();
    rejectAborted(new Timeout());
  }, ms);
  return {
    signal: controller.signal,
    race: <T>(p: Promise<T>) => Promise.race([p, aborted]),
    clear: () => clearTimeout(timer),
  };
}

type Deadline = ReturnType<typeof deadline>;

/**
 * One model's try inside the call's deadline: its request is also aborted
 * if it has not settled within `ms`. `clear` disarms the cap once the
 * model has started answering (or failed by itself).
 */
function attemptDeadline(parent: Deadline, ms: number | undefined) {
  if (!ms) return { ...parent, clear: () => {} };
  const controller = new AbortController();
  let rejectStalled: (e: unknown) => void = () => {};
  const stalled = new Promise<never>((_, reject) => {
    rejectStalled = reject;
  });
  stalled.catch(() => {});
  const timer = setTimeout(() => {
    controller.abort();
    rejectStalled(new Stalled());
  }, ms);
  return {
    signal: AbortSignal.any([parent.signal, controller.signal]),
    race: <T>(p: Promise<T>) => Promise.race([parent.race(p), stalled]),
    clear: () => clearTimeout(timer),
  };
}

const defaultLog = (entry: AiLogEntry) =>
  console.info(JSON.stringify({ evt: "ai", ...entry }));

export function createAi(deps: AiDeps) {
  const log = deps.log ?? defaultLog;
  const sleep =
    deps.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const random = deps.random ?? Math.random;
  const now = deps.now ?? Date.now;

  type Run<T> =
    | {
        ok: true;
        value: T;
        model: string;
        retries: number;
        started: number;
        timer: Deadline;
      }
    | AiFailure;

  /**
   * Checks the configuration and the gate, then runs `attempt` over the
   * models. On success the deadline is still armed: the caller clears it.
   */
  async function run<T>(
    req: AiRequest,
    attempt: (client: GeminiModels, model: string, d: Deadline) => Promise<T>,
  ): Promise<Run<T>> {
    const started = now();
    const models = deps.models[req.kind];
    const client = deps.client();
    const early = (reason: AiFailureReason, code: AiFailureCode) => {
      log({
        feature: req.feature,
        model: null,
        ok: false,
        reason,
        retries: 0,
        ms: 0,
      });
      return fail(code, reason);
    };
    if (!client || models.length === 0)
      return early("not_configured", "AI_UNAVAILABLE");
    const gate = await deps.gate();
    if (!gate.ok) return early(gate.reason, gate.code);

    const timer = deadline(req.timeoutMs);
    const end = started + req.timeoutMs;
    let m = 0;
    let retries = 0;
    let retriesHere = 0;
    let status: number | undefined;
    let stalled = false;
    let reason: AiFailureReason = "error";
    while (true) {
      const model = models[m] as string;
      const tryTimer = attemptDeadline(timer, req.attemptTimeoutMs);
      try {
        const value = await tryTimer.race(attempt(client, model, tryTimer));
        tryTimer.clear();
        return { ok: true, value, model, retries, started, timer };
      } catch (error) {
        tryTimer.clear();
        if (error instanceof Timeout || timer.signal.aborted) {
          reason = "timeout";
          break;
        }
        stalled = error instanceof Stalled;
        status = stalled ? undefined : errorStatus(error);
      }
      // A model that never started answering is as good as overloaded.
      const step = nextStep(
        stalled ? 503 : status,
        retriesHere,
        m < models.length - 1,
      );
      if (step === "fail") {
        reason = stalled
          ? "timeout"
          : status === 429
            ? "rate_limited"
            : "error";
        break;
      }
      retries++;
      if (step === "next-model") {
        m++;
        retriesHere = 0;
        continue;
      }
      const wait = backoffMs(retriesHere, random());
      retriesHere++;
      if (now() + wait >= end) {
        reason = "timeout";
        break;
      }
      await sleep(wait);
    }
    timer.clear();
    log({
      feature: req.feature,
      model: models[m] ?? null,
      ok: false,
      reason,
      ...(status !== undefined && { status }),
      retries,
      ms: now() - started,
    });
    return failureOf(reason);
  }

  function params(
    req: AiRequest,
    model: string,
    signal: AbortSignal,
  ): GenerateContentParameters {
    const thinkingConfig = thinkingConfigFor(model, req.thinking);
    return {
      model,
      contents: req.contents,
      config: {
        abortSignal: signal,
        ...(req.system && { systemInstruction: req.system }),
        ...(req.maxOutputTokens && { maxOutputTokens: req.maxOutputTokens }),
        ...(req.temperature !== undefined && { temperature: req.temperature }),
        ...(thinkingConfig && {
          thinkingConfig: {
            ...thinkingConfig,
            thinkingLevel: thinkingConfig.thinkingLevel as ApiThinkingLevel,
          },
        }),
      },
    };
  }

  function usageOf(
    res: GenerateContentResponse | undefined,
    model: string,
    ms: number,
  ): AiUsage {
    const u = res?.usageMetadata;
    return {
      model,
      inputTokens: u?.promptTokenCount ?? 0,
      outputTokens: u?.candidatesTokenCount ?? 0,
      thoughtTokens: u?.thoughtsTokenCount ?? 0,
      ms,
    };
  }

  const stoppedNormally = (res: GenerateContentResponse | undefined) => {
    const reason = res?.candidates?.[0]?.finishReason;
    return reason === undefined || reason === "STOP";
  };

  /** One-shot generation (admin helpers, pre-generation). */
  async function generateText(req: AiRequest): Promise<AiText | AiFailure> {
    const out = await run(req, (client, model, d) =>
      client.generateContent(params(req, model, d.signal)),
    );
    if (!out.ok) return out;
    out.timer.clear();
    const res = out.value;
    const text = res.text ?? "";
    const usage = usageOf(res, out.model, now() - out.started);
    log({ feature: req.feature, ok: true, retries: out.retries, ...usage });
    return {
      ok: true,
      text,
      usage,
      complete: stoppedNormally(res) && text.trim().length > 0,
    };
  }

  /**
   * Streaming generation (explanations, import). Retries happen only until
   * the first chunk arrives; after that a failure ends the stream and
   * `result` says why. The deadline covers the whole stream.
   */
  async function streamText(req: AiRequest): Promise<AiStream> {
    const out = await run(req, async (client, model, d) => {
      const iterator = await client.generateContentStream(
        params(req, model, d.signal),
      );
      return { iterator, first: await d.race(iterator.next()) };
    });
    if (!out.ok) return out;
    const { iterator, first } = out.value;
    const { model, timer, retries, started } = out;

    let settle: (r: AiText | AiFailure) => void = () => {};
    const result = new Promise<AiText | AiFailure>((resolve) => {
      settle = resolve;
    });
    // Also settles if nobody ever reads the stream (resolving twice is a no-op).
    timer.signal.addEventListener("abort", () => settle(failureOf("timeout")));

    async function* chunks(): AsyncGenerator<string> {
      let text = "";
      let last: GenerateContentResponse | undefined;
      let outcome: AiText | AiFailure | null = null;
      try {
        let step = first;
        while (!step.done) {
          last = step.value;
          const delta = step.value.text ?? "";
          if (delta) {
            text += delta;
            yield delta;
          }
          step = await timer.race(iterator.next());
        }
        const usage = usageOf(last, model, now() - started);
        log({ feature: req.feature, ok: true, retries, ...usage });
        outcome = {
          ok: true,
          text,
          usage,
          complete: stoppedNormally(last) && text.trim().length > 0,
        };
      } catch (error) {
        const reason: AiFailureReason =
          error instanceof Timeout || timer.signal.aborted
            ? "timeout"
            : errorStatus(error) === 429
              ? "rate_limited"
              : "error";
        log({
          feature: req.feature,
          model,
          ok: false,
          reason,
          retries,
          ms: now() - started,
        });
        outcome = failureOf(reason);
      } finally {
        timer.clear();
        if (!outcome) {
          // The reader stopped early (the browser went away): stop upstream.
          void iterator.return(undefined).catch(() => {});
          outcome = failureOf("error");
        }
        settle(outcome);
      }
    }

    return { ok: true, model, chunks: chunks(), result };
  }

  return { generateText, streamText };
}

export type Ai = ReturnType<typeof createAi>;
