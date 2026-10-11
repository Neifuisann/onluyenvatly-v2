/**
 * Art for "Bắn zombie" (B-11), served from `public/games/zombie/` (made by
 * `scripts/zombie-art.ts`; prompts in docs/games/zombie-art-prompts.md). A
 * name missing from `AVAILABLE` falls back to its drawn placeholder in
 * `components/art.tsx`.
 */
export type HeroPose = "idle" | "aim" | "shoot" | "hurt" | "win" | "lose";
export type ZombiePose = "walk" | "hit";
export type ZombieKind = 1 | 2 | 3;

export type ArtName =
  | `hero-${HeroPose}`
  | `zombie-${ZombieKind}-${ZombiePose}`
  | "bg-sky"
  | "ground"
  | "barricade"
  | "ink-shot"
  | "ammo"
  | "ammo-empty"
  | "splat-1"
  | "splat-2"
  | "paper-bits"
  | "title"
  | "win"
  | "lose";

const BASE = "/games/zombie";

/** Files that exist in `public/games/zombie/`. */
const AVAILABLE: readonly ArtName[] = [
  "hero-idle",
  "hero-aim",
  "hero-shoot",
  "hero-hurt",
  "hero-win",
  "hero-lose",
  "zombie-1-walk",
  "zombie-1-hit",
  "zombie-2-walk",
  "zombie-2-hit",
  "zombie-3-walk",
  "zombie-3-hit",
  "bg-sky",
  "ground",
  "barricade",
  "ink-shot",
  "ammo",
  "ammo-empty",
  "splat-1",
  "splat-2",
  "paper-bits",
  "title",
  "win",
  "lose",
];

export function artUrl(name: ArtName): string | null {
  return AVAILABLE.includes(name) ? `${BASE}/${name}.webp` : null;
}

/**
 * What the game screen needs during play, fetched up front so a pose or an
 * effect never pops in late. The intro and end art load with their screens.
 */
export const PLAY_ART: readonly ArtName[] = AVAILABLE.filter(
  (n) => n !== "title" && n !== "win" && n !== "lose",
);

/** Which of the three zombies holds a lane: varied, but stable per wave. */
export function zombieKind(wave: number, lane: number): ZombieKind {
  return (((wave * 7 + lane * 5) % 3) + 1) as ZombieKind;
}
