import { explainQuestion } from "@/features/ai/explain-service";
import { ExplainInputSchema } from "@/features/ai/schemas";
import { getCurrentUser } from "@/features/auth/queries";
import { jsonResult, readJsonBody } from "@/lib/api-response";
import { err } from "@/lib/result";
import { isSameOrigin } from "@/lib/same-origin";

/** Gemini's deadline is 25 s (09 §2); leave room for the store. */
export const maxDuration = 60;

const TEXT_HEADERS = {
  "Content-Type": "text/plain; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

/**
 * `POST /api/ai/explain` `{ attemptId, index }` (05 §3, S7-02). A route
 * handler rather than a Server Action so the text can stream. Errors known
 * before the first byte are `Result` JSON with a status (401, 403, 404, 429
 * `AI_QUOTA`/`RATE_LIMITED`, 503 `AI_UNAVAILABLE`); a cached explanation is
 * the whole text at once (`X-Explanation: cached`); a new one streams as
 * plain text and the body errors if generation fails midway. The response
 * ends only after the text is stored, so the page can refresh straight
 * into the rendered version.
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req.headers, req.url)) return jsonResult(err("FORBIDDEN"));
  const user = await getCurrentUser();
  if (!user) return jsonResult(err("UNAUTHENTICATED"));
  if (user.mustChangePassword) return jsonResult(err("FORBIDDEN"));

  const body = await readJsonBody(req, 1024);
  if (!body.ok) return jsonResult(body);
  const input = ExplainInputSchema.safeParse(body.data);
  if (!input.success) return jsonResult(err("VALIDATION"));

  const result = await explainQuestion(user, input.data);
  if (!result.ok) return jsonResult(result);
  const outcome = result.data;
  if (outcome.kind === "cached")
    return new Response(outcome.contentMd, {
      headers: { ...TEXT_HEADERS, "X-Explanation": "cached" },
    });

  const encoder = new TextEncoder();
  // If the student leaves mid-stream, keep reading so the finished text is
  // still stored: the quota is already spent.
  let open = true;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      for await (const chunk of outcome.chunks) {
        if (!open) continue;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          open = false;
        }
      }
      const done = await outcome.done;
      if (!open) return;
      if (done.ok) controller.close();
      else controller.error(new Error(done.code));
    },
    cancel() {
      open = false;
    },
  });
  return new Response(stream, {
    headers: { ...TEXT_HEADERS, "X-Explanation": "generated" },
  });
}
