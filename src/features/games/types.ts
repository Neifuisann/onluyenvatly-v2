/**
 * What the game screens receive from the server (B-05). Plain JSON shapes,
 * shared by the route handlers and the client components. Nothing here ever
 * carries a key before the player has answered.
 */
import type { AttemptAnswer } from "@/db/schema";
import type { GameMark, RoomStatus } from "./domain/scoring";
import type { PlayerView, Standing } from "./domain/standings";

export type { PlayerView, Standing };

/** `GET /api/games/[id]/state` when something changed. */
export type RoomState = {
  rev: number;
  status: RoomStatus;
  questionCount: number;
  startedAt: string | null;
  serverNow: string;
  /** Ranked; in the lobby everyone has 0 points, in join order. */
  players: Standing[];
  /** The viewer's `game_players.id`, null for the host. */
  meId: number | null;
};

/** `POST /api/games/[id]/answer`. */
export type AnswerOutcome = {
  index: number;
  mark: GameMark;
  /** The key in this player's display terms, now that they answered. */
  expected: AttemptAnswer;
  score: number;
  answered: number;
  correct: number;
  streak: number;
  /** This player has answered every question. */
  finished: boolean;
  /** The whole race is over (host ended it, or everyone finished). */
  raceOver: boolean;
  view: PlayerView;
  /** When the next question appears, server clock. */
  nextShownAt: string;
  serverNow: string;
};
