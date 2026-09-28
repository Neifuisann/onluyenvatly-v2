import {
  AttemptIdSchema,
  MAX_BODY_BYTES,
  SubmitAttemptSchema,
} from "@/features/attempts/schemas";
import { submitAttempt } from "@/features/attempts/service";
import { getCurrentUser } from "@/features/auth/queries";
import { jsonResult, readJsonBody } from "@/lib/api-response";
import { err, ok } from "@/lib/result";
import { isSameOrigin } from "@/lib/same-origin";

/**
 * Submit and grade (05 §3). Idempotent: a retry or a parallel request gets
 * the same `resultUrl`. No cache tags yet: the leaderboard (S4) has a 60 s
 * lifetime and the result page is per-user.
 */
export async function POST(
  req: Request,
  ctx: RouteContext<"/api/attempts/[id]/submit">,
) {
  if (!isSameOrigin(req.headers, req.url)) return jsonResult(err("FORBIDDEN"));
  const user = await getCurrentUser();
  if (!user) return jsonResult(err("UNAUTHENTICATED"));

  const id = AttemptIdSchema.safeParse((await ctx.params).id);
  if (!id.success) return jsonResult(err("NOT_FOUND"));
  const body = await readJsonBody(req, MAX_BODY_BYTES);
  if (!body.ok) return jsonResult(body);
  const input = SubmitAttemptSchema.safeParse(body.data);
  if (!input.success) return jsonResult(err("VALIDATION"));

  const result = await submitAttempt(user.id, id.data, input.data);
  if (!result.ok) return jsonResult(result);
  return jsonResult(
    ok({ ...result.data, resultUrl: `/attempts/${id.data}/result` }),
  );
}
