/**
 * Rules of the Gemini wrapper (09 §2): model lists, retry/fallback, backoff
 * and the global daily budget. Pure.
 */

/** Total time a caller waits, retries included (09 §2). */
export const AI_TIMEOUT_MS = {
  explain: 25_000,
  /** Short admin helpers (description, tags). */
  short: 25_000,
  import: 280_000,
} as const;

/**
 * Longest one model may take to start answering (the first chunk, thought
 * summaries included) before the next model is tried. Import only: an
 * overloaded model can hang for 1.5–3 minutes before its 503, which alone
 * would use up the deadline, while a working model starts within seconds.
 */
export const AI_ATTEMPT_TIMEOUT_MS = { import: 100_000 } as const;

export type ThinkingLevel = "low" | "medium" | "high";

/**
 * How hard a model thinks before answering. Gemini 3 and later take a
 * `thinkingLevel`; older or unknown model names get nothing (a 2.x model
 * answers 400 to it, which would stop the fallback chain). Thought
 * summaries are streamed (`includeThoughts`) so a model that is thinking
 * shows it is alive; the SDK's `text` leaves them out.
 */
export function thinkingConfigFor(
  model: string,
  level: ThinkingLevel | undefined,
): { thinkingLevel: "LOW" | "MEDIUM" | "HIGH"; includeThoughts: true } | null {
  const major = Number(/^gemini-(\d+)(?:[.-]|$)/.exec(model)?.[1]);
  if (!level || !(major >= 3)) return null;
  return {
    thinkingLevel: level.toUpperCase() as "LOW" | "MEDIUM" | "HIGH",
    includeThoughts: true,
  };
}

/** Retries of one model on a transient error (429/5xx), after the first try. */
export const MAX_RETRIES = 2;

/**
 * `GEMINI_MODEL_*` may list fallbacks, comma-separated
 * (`gemini-3.5-flash-lite,gemini-3.5-flash`): each model has its own free-tier
 * quota and its own load, so a 429 or 503 moves to the next one instead of
 * waiting.
 */
export function parseModels(value: string | undefined): string[] {
  if (!value) return [];
  return [
    ...new Set(
      value
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean),
    ),
  ];
}

export type NextStep = "retry" | "next-model" | "fail";

/**
 * What to do after a failed call. `status` is the HTTP status (undefined for
 * a network error). 429 (quota) and 503 (model overloaded, "high demand")
 * prefer another model, whose quota and load are separate; other 5xx and
 * network errors retry the same model first; 404 (model gone) moves on;
 * anything else (400, 401, 403) is our fault and stops.
 */
export function nextStep(
  status: number | undefined,
  retriesSoFar: number,
  hasNextModel: boolean,
): NextStep {
  const canRetry = retriesSoFar < MAX_RETRIES;
  if (status === 429 || status === 503) {
    if (hasNextModel) return "next-model";
    return canRetry ? "retry" : "fail";
  }
  if (status === undefined || status >= 500) {
    if (canRetry) return "retry";
    return hasNextModel ? "next-model" : "fail";
  }
  if (status === 404) return hasNextModel ? "next-model" : "fail";
  return "fail";
}

/**
 * Exponential backoff with full jitter on the upper half: 0.5–1 s, 1–2 s…
 * `random` is in [0, 1).
 */
export function backoffMs(retry: number, random: number): number {
  const base = 1000 * 2 ** retry;
  return Math.round(base / 2 + (base / 2) * random);
}

/** The HTTP status of an SDK error (`ApiError.status`), if any. */
export function errorStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" && status >= 100 && status < 600
    ? status
    : undefined;
}

/**
 * Generations allowed today: the admin setting (`settings.ai_daily_budget`),
 * capped by `AI_DAILY_BUDGET` when that env var is set above 0 (a hard
 * ceiling for staging keys, 12 §2).
 */
export function effectiveBudget(settingBudget: number, envCap: number): number {
  const setting = Math.max(0, Math.floor(settingBudget));
  return envCap > 0 ? Math.min(setting, Math.floor(envCap)) : setting;
}

/** Counter row in `rate_limits` for one Vietnam day (`YYYY-MM-DD`). */
export function budgetKey(vnDay: string): string {
  return `ai:global:${vnDay}`;
}
