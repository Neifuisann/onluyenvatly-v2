import { AttemptIdSchema } from "@/features/attempts/schemas";
import { getCurrentUser } from "@/features/auth/queries";
import { GameMoveSchema, MAX_MOVE_BYTES } from "@/features/zombie/schemas";
import { playMove } from "@/features/zombie/service";
import { jsonResult, readJsonBody } from "@/lib/api-response";
import { err } from "@/lib/result";
import { isSameOrigin } from "@/lib/same-origin";

/**
 * A zombie game's moves (B-11): "begin", a shot, or a zombie reaching the
 * barricade. A JSON route like check and submit: it answers each shot fast,
 * without the Server Action floor or its one-at-a-time queue.
 */
export async function POST(
  req: Request,
  ctx: RouteContext<"/api/attempts/[id]/game">,
) {
  if (!isSameOrigin(req.headers, req.url)) return jsonResult(err("FORBIDDEN"));
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword)
    return jsonResult(err("UNAUTHENTICATED"));

  const id = AttemptIdSchema.safeParse((await ctx.params).id);
  if (!id.success) return jsonResult(err("NOT_FOUND"));
  const body = await readJsonBody(req, MAX_MOVE_BYTES);
  if (!body.ok) return jsonResult(body);
  const move = GameMoveSchema.safeParse(body.data);
  if (!move.success) return jsonResult(err("VALIDATION"));
  return jsonResult(await playMove(user.id, id.data, move.data));
}
