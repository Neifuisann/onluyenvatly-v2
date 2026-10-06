import { getCurrentUser } from "@/features/auth/queries";
import { RevSchema, RoomIdSchema } from "@/features/games/schemas";
import { pollRoom } from "@/features/games/service";
import { jsonResult } from "@/lib/api-response";
import { err, ok } from "@/lib/result";

/**
 * The live room poll (ADR-008): the lobby, the host screen and players at
 * the finish line. `?rev=` is the last state the caller has; when nothing
 * changed the answer is an empty 204, so a class waiting in the lobby costs
 * a session read and a shared one-second snapshot per request.
 */
export async function GET(
  req: Request,
  ctx: RouteContext<"/api/games/[id]/state">,
) {
  const user = await getCurrentUser();
  if (!user) return jsonResult(err("UNAUTHENTICATED"));
  const id = RoomIdSchema.safeParse((await ctx.params).id);
  if (!id.success) return jsonResult(err("NOT_FOUND"));
  const rev = RevSchema.parse(new URL(req.url).searchParams.get("rev"));

  const result = await pollRoom(user, id.data, rev);
  if (!result.ok) return jsonResult(result);
  if (result.data.kind === "unchanged")
    return new Response(null, {
      status: 204,
      headers: { "Cache-Control": "no-store" },
    });
  return jsonResult(ok(result.data.state));
}
