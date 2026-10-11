"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireTeacher } from "@/features/auth/guards";
import { err, type FormState, ok, type Result } from "@/lib/result";
import { getRoom } from "./queries";
import { CreateGameSchema, RemovePlayerSchema, RoomIdSchema } from "./schemas";
import { createGame, endGame, hosts, removePlayer, startGame } from "./service";

/**
 * Host actions (B-05). Teachers, on their own rooms only (B-03); rooms are live class data, so nothing
 * here touches a shared cache tag. The host screen refreshes itself.
 */

/** `/admin/games/new`: draws the bank, then opens the host screen. */
export async function createGameAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireTeacher();
  const parsed = CreateGameSchema.safeParse({
    title: formData.get("title") ?? "",
    lessonIds: formData.getAll("lessonIds"),
    count: formData.get("count"),
    pace: formData.get("pace"),
    types: formData.getAll("types"),
  });
  if (!parsed.success) return err("VALIDATION");
  const result = await createGame(user, parsed.data);
  if (!result.ok) return result;
  redirect(`/host/${result.data.roomId}`);
}

/** "Chơi lại": a new room with the same lessons, size, pace and types. */
export async function replayGameAction(roomId: unknown): Promise<Result<null>> {
  const user = await requireTeacher();
  const id = RoomIdSchema.safeParse(roomId);
  if (!id.success) return err("VALIDATION");
  const room = await getRoom(id.data);
  if (!room || !hosts(user, room.hostId)) return err("NOT_FOUND");
  const result = await createGame(user, {
    title: room.title,
    lessonIds: room.lessonIds,
    count: room.bankTypes.length,
    pace: room.pace,
    types: [...new Set(room.bankTypes)],
  });
  if (!result.ok) return result;
  redirect(`/host/${result.data.roomId}`);
}

export async function startGameAction(roomId: unknown): Promise<Result<null>> {
  const user = await requireTeacher();
  const id = RoomIdSchema.safeParse(roomId);
  if (!id.success) return err("VALIDATION");
  const result = await startGame(user, id.data);
  if (!result.ok) return result;
  refresh();
  return ok(null);
}

export async function endGameAction(roomId: unknown): Promise<Result<null>> {
  const user = await requireTeacher();
  const id = RoomIdSchema.safeParse(roomId);
  if (!id.success) return err("VALIDATION");
  const result = await endGame(user, id.data);
  if (result.ok) refresh();
  return result;
}

export async function removePlayerAction(
  input: unknown,
): Promise<Result<null>> {
  const user = await requireTeacher();
  const parsed = RemovePlayerSchema.safeParse(input);
  if (!parsed.success) return err("VALIDATION");
  return removePlayer(user, parsed.data.roomId, parsed.data.playerId);
}
