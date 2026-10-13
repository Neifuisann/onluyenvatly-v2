/**
 * What the game screens receive from the server (B-05). Plain JSON shapes,
 * shared by the route handlers and the client components. Nothing here ever
 * carries a key before the player has answered.
 */
import type { AttemptAnswer, ZombieState } from "@/db/schema";
import type { GameEvent } from "@/features/zombie/domain/engine";
import type { GameMode, GameSettings } from "./domain/rules";
import type { GameMark, RoomStatus } from "./domain/scoring";
import type { PlayerView, Standing } from "./domain/standings";

export type { PlayerView, Standing };

/** `GET /api/games/[id]/state` when something changed. */
export type RoomState = {
  rev: number;
  status: RoomStatus;
  questionCount: number;
  startedAt: string | null;
  /** "Hẹn giờ" (B-15): when the lobby starts itself; null if by hand. */
  scheduledAt: string | null;
  serverNow: string;
  /** Ranked; in the lobby everyone has 0 points, in join order. */
  players: Standing[];
  /** The viewer's `game_players.id`, null for the host. */
  meId: number | null;
  /** What the teacher turned on (B-12). */
  settings: GameSettings;
  /** A race (B-05) or a zombie room (B-14). */
  mode: GameMode;
  /** Zombie rooms only: waves per player and seconds per wave. */
  zombie: ZombieRoomRules | null;
};

/** A zombie room's rules (B-14); lives are in `settings.lives`. */
export type ZombieRoomRules = { waves: number; seconds: number | null };

/** Where a zombie player stands in the room (B-14), after every move. */
export type ZombieRoomInfo = {
  /** Players not knocked out, me included. */
  alive: number;
  total: number;
  /** My rank: waves survived first (`rankPlayers` with `survival`). */
  rank: number | null;
  score: number;
};

/** `POST /api/games/[id]/zombie`: one move in a zombie room (B-14). */
export type ZombieMoveOutcome = {
  state: ZombieState;
  event: GameEvent | null;
  /** Server clock (epoch ms). */
  now: number;
  room: ZombieRoomInfo;
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
  /** Lives left; null when the room has none (B-12). */
  lives: number | null;
  /** That was the last life: this player's race is over. */
  eliminated: boolean;
  /** This player has answered every question, or is out of lives. */
  finished: boolean;
  /** The whole race is over (host ended it, or everyone finished). */
  raceOver: boolean;
  view: PlayerView;
  /** When the next question appears, server clock. */
  nextShownAt: string;
  serverNow: string;
};
