import {
  AttemptIdSchema,
  CheckPracticeSchema,
  MAX_BODY_BYTES,
} from "@/features/attempts/schemas";
import { checkPracticeAnswer } from "@/features/attempts/service";
import { getCurrentUser } from "@/features/auth/queries";
import { jsonResult, readJsonBody } from "@/lib/api-response";
import { rateLimit } from "@/lib/rate-limit";
import { err } from "@/lib/result";
import { isSameOrigin } from "@/lib/same-origin";

/**
 * "Kiểm tra" in practice mode (05 `checkPracticeAnswer`, S7-06): one item's
 * score and key, then the answer is locked. Refused for tests (ADR-004).
 * A JSON route like save and submit: a Server Action posted to the PPR
 * runner page pays the platform's action floor on every check.
 */
export async function POST(
  req: Request,
  ctx: RouteContext<"/api/attempts/[id]/check">,
) {
  if (!isSameOrigin(req.headers, req.url)) return jsonResult(err("FORBIDDEN"));
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword)
    return jsonResult(err("UNAUTHENTICATED"));

  const id = AttemptIdSchema.safeParse((await ctx.params).id);
  if (!id.success) return jsonResult(err("NOT_FOUND"));
  const body = await readJsonBody(req, MAX_BODY_BYTES);
  if (!body.ok) return jsonResult(body);
  const input = CheckPracticeSchema.safeParse(
    typeof body.data === "object" && body.data !== null
      ? { ...body.data, attemptId: id.data }
      : null,
  );
  if (!input.success) return jsonResult(err("VALIDATION"));

  // A set has at most 30 questions; this only stops scripted hammering.
  const limit = await rateLimit(`practice:check:${user.id}`, 120, "10m");
  if (!limit.ok) return jsonResult(err("RATE_LIMITED"));
  return jsonResult(await checkPracticeAnswer(user.id, input.data));
}
