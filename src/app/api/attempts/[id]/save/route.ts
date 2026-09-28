import {
  AttemptIdSchema,
  MAX_BODY_BYTES,
  SaveProgressSchema,
} from "@/features/attempts/schemas";
import { saveProgress } from "@/features/attempts/service";
import { getCurrentUser } from "@/features/auth/queries";
import { jsonResult, readJsonBody } from "@/lib/api-response";
import { err } from "@/lib/result";
import { isSameOrigin } from "@/lib/same-origin";

/**
 * Autosave (05 §3): `fetch` with keepalive, or `sendBeacon` on page hide.
 * Owner + in progress + before deadline + grace, enforced in one UPDATE.
 */
export async function POST(
  req: Request,
  ctx: RouteContext<"/api/attempts/[id]/save">,
) {
  if (!isSameOrigin(req.headers, req.url)) return jsonResult(err("FORBIDDEN"));
  const user = await getCurrentUser();
  if (!user) return jsonResult(err("UNAUTHENTICATED"));

  const id = AttemptIdSchema.safeParse((await ctx.params).id);
  if (!id.success) return jsonResult(err("NOT_FOUND"));
  const body = await readJsonBody(req, MAX_BODY_BYTES);
  if (!body.ok) return jsonResult(body);
  const input = SaveProgressSchema.safeParse(body.data);
  if (!input.success) return jsonResult(err("VALIDATION"));

  return jsonResult(await saveProgress(user.id, id.data, input.data));
}
