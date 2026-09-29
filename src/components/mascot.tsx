import { cn } from "@/lib/utils";
import { MASCOT_SIZES } from "./mascot-sizes";

/**
 * The Physics Bunny (07 §3.4). Each pose has one job, so the same situation
 * always shows the same bunny:
 *
 * - wave: sign-in · teacher: onboarding, closing CTA · rocket: landing, sign-up
 * - waiting: registration waiting for approval · key: passwords
 * - laptop: taking a test, empty history · stopwatch: timed tests
 * - sleeping: a test not open yet or closed
 * - celebrate / ok / keep-going: a great / decent / low score (never blame)
 * - all-clear: nothing left to review · studying: lessons, review
 * - idea: hints, explanations · graph: stats, progress · podium: leaderboard
 * - broken: errors · space: pages that don't exist · telescope: no results
 * - equation, lab, prism, magnet, cradle: landing and feature illustrations
 *
 * Files and sizes come from `scripts/optimize-mascot.ts` (WebP, ≤ 512 px).
 */
export type MascotPose = keyof typeof MASCOT_SIZES;

export function Mascot({
  pose,
  size = 160,
  className,
  priority = false,
  alt = "",
}: {
  pose: MascotPose;
  /** Rendered width in CSS px; the height follows the pose's aspect ratio. */
  size?: number;
  className?: string;
  /** Above the fold: load eagerly. */
  priority?: boolean;
  /** Decorative by default. */
  alt?: string;
}) {
  const [w, h] = MASCOT_SIZES[pose];
  return (
    // Static art is pre-sized WebP; next/image would spend the optimization quota (ADR-006).
    // biome-ignore lint/performance/noImgElement: see ADR-006
    <img
      src={`/mascot/${pose}.webp`}
      width={size}
      height={Math.round((size * h) / w)}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      draggable={false}
      className={cn("pointer-events-none select-none", className)}
    />
  );
}
