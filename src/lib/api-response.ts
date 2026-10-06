import type { ErrorCode } from "./messages";
import { err, type Result } from "./result";

/** HTTP status for each error code in JSON route handlers (05 §3, §5). */
const STATUS: Partial<Record<ErrorCode, number>> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 400,
  RATE_LIMITED: 429,
  CONFLICT: 409,
  ATTEMPT_CLOSED: 409,
  DEADLINE_PASSED: 409,
  GAME_OVER: 409,
  GAME_FULL: 409,
  AI_QUOTA: 429,
  AI_UNAVAILABLE: 503,
  INTERNAL: 500,
};

/** The same `Result` shape Server Actions return, never cached. */
export function jsonResult<T>(result: Result<T>): Response {
  return Response.json(result, {
    status: result.ok ? 200 : (STATUS[result.code] ?? 400),
    headers: { "Cache-Control": "no-store" },
  });
}

/**
 * Reads a small JSON body. Accepts any content type: `sendBeacon` posts
 * text/plain. Oversized or malformed bodies are a `VALIDATION` error.
 */
export async function readJsonBody(
  req: Request,
  maxBytes: number,
): Promise<Result<unknown>> {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > maxBytes) return err("VALIDATION");
  const text = await req.text();
  if (new TextEncoder().encode(text).length > maxBytes)
    return err("VALIDATION");
  try {
    return { ok: true, data: JSON.parse(text) as unknown };
  } catch {
    return err("VALIDATION");
  }
}
