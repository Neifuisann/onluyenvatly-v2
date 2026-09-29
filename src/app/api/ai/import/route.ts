import { z } from "zod";
import { IMPORT_PATH_PATTERN } from "@/features/ai/domain/import";
import { startImport } from "@/features/ai/import-service";
import { getCurrentUser } from "@/features/auth/queries";
import { jsonResult, readJsonBody } from "@/lib/api-response";
import { err } from "@/lib/result";
import { isSameOrigin } from "@/lib/same-origin";

/** Gemini's deadline is 280 s (09 §2); Vercel allows 300. */
export const maxDuration = 300;

const ImportInputSchema = z.strictObject({
  path: z.string().regex(IMPORT_PATH_PATTERN),
});

/**
 * `POST /api/ai/import` `{ path }` (05 §3, S7-04): admin only. Reads the
 * file the browser uploaded to `imports`, then streams Gemini's lesson text
 * as plain chunks. Errors known before the first byte are `Result` JSON
 * with a status (401, 403, 404 file missing, 400 unreadable, 429, 503); a
 * failure midway (or a truncated answer) errors the body, and the browser
 * keeps what arrived (09 §6).
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req.headers, req.url)) return jsonResult(err("FORBIDDEN"));
  const user = await getCurrentUser();
  if (!user) return jsonResult(err("UNAUTHENTICATED"));
  if (user.role !== "admin" || user.mustChangePassword)
    return jsonResult(err("FORBIDDEN"));

  const body = await readJsonBody(req, 1024);
  if (!body.ok) return jsonResult(body);
  const input = ImportInputSchema.safeParse(body.data);
  if (!input.success) return jsonResult(err("VALIDATION"));

  const result = await startImport(user, input.data);
  if (!result.ok) return jsonResult(result);
  const { chunks, result: done } = result.data;

  const encoder = new TextEncoder();
  let open = true;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      for await (const chunk of chunks) {
        if (!open) break;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          open = false;
        }
      }
      const outcome = await done;
      if (!open) return;
      if (outcome.ok && outcome.complete) controller.close();
      else
        controller.error(new Error(outcome.ok ? "INCOMPLETE" : outcome.code));
    },
    cancel() {
      // Nothing is stored: stop reading, which cancels the Gemini stream.
      open = false;
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
