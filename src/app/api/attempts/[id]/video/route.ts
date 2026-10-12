import { AttemptIdSchema } from "@/features/attempts/schemas";
import { getCurrentUser } from "@/features/auth/queries";
import {
  MAX_VIDEO_MOVE_BYTES,
  VideoMoveSchema,
} from "@/features/video/schemas";
import { videoMove } from "@/features/video/service";
import { jsonResult, readJsonBody } from "@/lib/api-response";
import { err } from "@/lib/result";
import { isSameOrigin } from "@/lib/same-origin";

/**
 * A video lesson's steps: where the student is, one cue's answers, or the
 * end of the video. A JSON route like the zombie moves, so the position can
 * also be sent with `sendBeacon` when the page hides.
 */
export async function POST(
  req: Request,
  ctx: RouteContext<"/api/attempts/[id]/video">,
) {
  if (!isSameOrigin(req.headers, req.url)) return jsonResult(err("FORBIDDEN"));
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword)
    return jsonResult(err("UNAUTHENTICATED"));

  const id = AttemptIdSchema.safeParse((await ctx.params).id);
  if (!id.success) return jsonResult(err("NOT_FOUND"));
  const body = await readJsonBody(req, MAX_VIDEO_MOVE_BYTES);
  if (!body.ok) return jsonResult(body);
  const move = VideoMoveSchema.safeParse(body.data);
  if (!move.success) return jsonResult(err("VALIDATION"));
  return jsonResult(await videoMove(user.id, id.data, move.data));
}
