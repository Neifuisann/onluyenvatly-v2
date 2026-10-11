import "server-only";
import {
  downloadObject,
  IMPORTS_BUCKET,
  type StorageConfig,
  storageConfig,
} from "@/features/media/storage";
import { env } from "@/lib/env.server";
import { rateLimit } from "@/lib/rate-limit";
import { err, ok, type Result } from "@/lib/result";
import { reserveAiCall } from "./budget";
import { IMPORT_MAX_BYTES, sniffImport } from "./domain/import";
import {
  applySolvedAnswers,
  parseSolveReply,
  readChatCompletion,
  SOLVE_MAX_OUTPUT_TOKENS,
  SOLVE_SYSTEM,
  SOLVE_TIMEOUT_MS,
  SOLVES_PER_HOUR,
  solvePrompt,
  unansweredQuestions,
} from "./domain/solve";
import type { AiGate } from "./gemini";
import { solveCopy as t } from "./messages";

/**
 * AI solve (09 AI8). After an import, the teacher asks a stronger model
 * (OpenAI-compatible endpoint, `SOLVER_*`) to answer the questions without
 * a key. The model gets the lesson text and, for a PDF or image, the
 * uploaded file (figures and tables); its answers are written into the text
 * and returned. Nothing is stored: the teacher reviews before creating the
 * draft. Counted against the daily AI budget like a Gemini call.
 */

export type SolverConfig = {
  url: string;
  key: string;
  model: string;
  effort: "low" | "medium" | "high";
};

export function solverConfig(): SolverConfig | null {
  const { SOLVER_API_URL, SOLVER_API_KEY, SOLVER_MODEL, SOLVER_EFFORT } = env;
  return SOLVER_API_URL && SOLVER_API_KEY && SOLVER_MODEL
    ? {
        url: SOLVER_API_URL.replace(/\/+$/, ""),
        key: SOLVER_API_KEY,
        model: SOLVER_MODEL,
        effort: SOLVER_EFFORT,
      }
    : null;
}

type Deps = {
  solver?: SolverConfig | null;
  storage?: StorageConfig | null;
  gate?: AiGate;
  now?: Date;
  fetchFn?: typeof fetch;
  log?: (entry: Record<string, unknown>) => void;
};

const defaultLog = (entry: Record<string, unknown>) =>
  console.info(JSON.stringify({ evt: "ai", feature: "solve", ...entry }));

/** The uploaded exam as a chat content part, when it is a PDF or an image. */
async function filePart(
  storage: StorageConfig | null,
  path: string | undefined,
  fetchFn: typeof fetch,
) {
  if (!storage || !path) return null;
  const bytes = await downloadObject(
    storage,
    IMPORTS_BUCKET,
    path,
    IMPORT_MAX_BYTES,
    fetchFn,
  );
  const file = bytes && sniffImport(bytes);
  if (!bytes || !file || file.kind === "docx") return null;
  const data = `data:${file.mimeType};base64,${Buffer.from(bytes).toString("base64")}`;
  return file.kind === "pdf"
    ? { type: "file", file: { filename: "de-thi.pdf", file_data: data } }
    : { type: "image_url", image_url: { url: data } };
}

/** `POST /api/ai/solve`: the text with the unanswered questions answered. */
export async function solveImport(
  admin: { id: string },
  input: { text: string; path?: string | undefined },
  {
    solver = solverConfig(),
    storage = storageConfig(),
    gate = () => reserveAiCall(),
    now = new Date(),
    fetchFn = fetch,
    log = defaultLog,
  }: Deps = {},
): Promise<Result<{ text: string; filled: number[] }>> {
  if (!solver) return err("AI_UNAVAILABLE", { message: t.unavailable });
  const todo = unansweredQuestions(input.text);
  if (todo.length === 0) return ok({ text: input.text, filled: [] });

  const limit = await rateLimit(
    `ai:solve:${admin.id}`,
    SOLVES_PER_HOUR,
    "1h",
    now,
  );
  if (!limit.ok) return err("RATE_LIMITED");
  const open = await gate();
  if (!open.ok)
    return err(open.code, {
      message: open.code === "AI_QUOTA" ? t.quota : t.unavailable,
    });

  const file = await filePart(storage, input.path, fetchFn);
  const started = Date.now();
  const body = {
    model: solver.model,
    stream: true,
    max_tokens: SOLVE_MAX_OUTPUT_TOKENS,
    // Each gateway reads its own field; the others are ignored.
    reasoning_effort: solver.effort,
    reasoning: { effort: solver.effort },
    thinking: { type: "adaptive" },
    output_config: { effort: solver.effort },
    messages: [
      { role: "system", content: SOLVE_SYSTEM },
      {
        role: "user",
        content: [
          ...(file ? [file] : []),
          { type: "text", text: solvePrompt(input.text, todo) },
        ],
      },
    ],
  };

  let reply = "";
  let status: number | undefined;
  try {
    const res = await fetchFn(`${solver.url}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${solver.key}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(SOLVE_TIMEOUT_MS),
    });
    status = res.status;
    if (res.ok) reply = readChatCompletion(await res.text());
  } catch {
    // Timeout or network: reported below like an empty reply.
  }
  const answers = reply ? parseSolveReply(reply) : null;
  const result = answers && applySolvedAnswers(input.text, todo, answers);
  log({
    model: solver.model,
    ok: Boolean(result),
    ...(status !== undefined && { status }),
    asked: todo.length,
    filled: result?.filled.length ?? 0,
    file: Boolean(file),
    ms: Date.now() - started,
  });
  if (!result)
    return err(status === 429 ? "AI_QUOTA" : "AI_UNAVAILABLE", {
      message: status === 429 ? t.busy : t.failed,
    });
  return ok(result);
}
