import "server-only";
import { jsonResult } from "./api-response";
import type { Result } from "./result";

/**
 * Form posts to route handlers that open a page (start a test, a review set).
 * With JavaScript the form sends `Accept: application/json` and navigates
 * itself, so the next page streams after its cached PPR shell. A plain form
 * post (no JavaScript, k6) follows a 303 instead.
 *
 * A Server Action that calls `redirect()` renders the next page inside the
 * action response, on the platform's PPR action path; that cost 400–750 ms
 * per start in production (docs/reviews/s9-hardening.md).
 */
export function wantsJson(req: Request): boolean {
  return req.headers.get("accept")?.includes("application/json") ?? false;
}

/** A same-site path (always starts with "/"), relative like Next's redirects. */
export function seeOther(path: string): Response {
  return new Response(null, {
    status: 303,
    headers: { Location: path, "Cache-Control": "no-store" },
  });
}

/** JSON `{ ok, data: { url } }` for scripts, or a 303 for plain forms. */
export function openPage(
  req: Request,
  result: Result<{ url: string }>,
  fallback: string,
): Response {
  if (wantsJson(req)) return jsonResult(result);
  return seeOther(result.ok ? result.data.url : fallback);
}

/** The body of a form post, or null when it isn't one. */
export async function readForm(req: Request): Promise<FormData | null> {
  try {
    return await req.formData();
  } catch {
    return null;
  }
}
