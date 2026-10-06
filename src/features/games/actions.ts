"use server";

import { refresh } from "next/cache";
import { requireStudent } from "@/features/auth/guards";
import { err, type FormState, ok } from "@/lib/result";
import { JoinGameSchema } from "./schemas";
import { joinGame } from "./service";

/**
 * Player actions (B-05). Answers and polls go through the JSON route
 * handlers under `/api/games/[id]/*` instead: Server Actions run one at a
 * time per page, and a poll must never hold up an answer (ADR-008).
 */

/** Join, or change racer in the lobby; the page then shows the lobby. */
export async function joinGameAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireStudent();
  const parsed = JoinGameSchema.safeParse({
    roomId: formData.get("roomId"),
    racer: formData.get("racer"),
    color: formData.get("color"),
  });
  if (!parsed.success) return err("VALIDATION");
  const result = await joinGame(user, parsed.data);
  if (!result.ok) return result;
  // Per-class live data: no cache tags, just this page again.
  refresh();
  return ok(null);
}
