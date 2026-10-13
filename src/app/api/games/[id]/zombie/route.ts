import { getCurrentUser } from "@/features/auth/queries";
import { RoomIdSchema } from "@/features/games/schemas";
import { zombieMove } from "@/features/games/service";
import { GameMoveSchema, MAX_MOVE_BYTES } from "@/features/zombie/schemas";
import { jsonResult, readJsonBody } from "@/lib/api-response";
import { err } from "@/lib/result";
import { isSameOrigin } from "@/lib/same-origin";

/**
 * A move in a zombie room (B-14): "begin", a shot, or a zombie reaching the
 * barricade. The response carries the player's game, the key of a wave only
 * once it has ended, and how many in the room are still standing, so
 * players never poll while they play.
 */
export async function POST(
  req: Request,
  ctx: RouteContext<"/api/games/[id]/zombie">,
) {
  if (!isSameOrigin(req.headers, req.url)) return jsonResult(err("FORBIDDEN"));
  const user = await getCurrentUser();
  if (!user) return jsonResult(err("UNAUTHENTICATED"));

  const id = RoomIdSchema.safeParse((await ctx.params).id);
  if (!id.success) return jsonResult(err("NOT_FOUND"));
  const body = await readJsonBody(req, MAX_MOVE_BYTES);
  if (!body.ok) return jsonResult(body);
  const move = GameMoveSchema.safeParse(body.data);
  if (!move.success) return jsonResult(err("VALIDATION"));
  return jsonResult(await zombieMove(user.id, id.data, move.data));
}
