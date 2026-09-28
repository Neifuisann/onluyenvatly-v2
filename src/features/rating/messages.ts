/** Vietnamese copy for ratings and tiers (07 §4). */
import type { Tier } from "./domain/rating";

/** Tier names stay as students know them from v1. */
export const tierNames: Record<Tier, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  platinum: "Platinum",
  diamond: "Diamond",
  master: "Master",
};

export const ratingCopy = {
  label: "Rating",
  change: (before: string, after: string) => `${before} → ${after}`,
  up: (n: number) => `tăng ${n}`,
  down: (n: number) => `giảm ${n}`,
  same: "không đổi",
  tierPrefix: "Hạng ",
  notRated: "Bài này không tính rating.",
} as const;

/** `1 684`: thin grouping like 07's wireframes, no locale surprises. */
export const formatRating = (n: number) =>
  String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
