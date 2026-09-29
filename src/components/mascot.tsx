import { cn } from "@/lib/utils";

/**
 * The Physics Bunny (07 §3.4). Each pose has one job, so the same situation
 * always shows the same bunny. Files come from `scripts/optimize-mascot.ts`
 * (WebP, ≤ 512 px); the intrinsic sizes below keep the layout from shifting.
 */
const POSES = {
  /** Sign-in and the first-run welcome. */
  wave: [435, 512],
  /** The landing page: "start your journey". */
  rocket: [512, 512],
  /** Teaching: the onboarding tour, lesson structure. */
  teacher: [432, 397],
  /** Hints, AI explanations, tips. */
  idea: [381, 362],
  /** Done, approved, a decent score. */
  ok: [377, 346],
  /** An excellent score. */
  celebrate: [490, 512],
  /** A low score: encouragement, never blame (07 §1.5). */
  "keep-going": [512, 490],
  /** Nothing left to review. */
  "all-clear": [512, 503],
  /** Registration waiting for the teacher. */
  waiting: [451, 512],
  /** Passwords. */
  key: [512, 394],
  /** Timed tests. */
  stopwatch: [512, 453],
  /** Leaderboard. */
  podium: [437, 512],
  /** Errors: "something broke". */
  broken: [512, 480],
  /** Pages that don't exist. */
  space: [512, 465],
  /** Confusion: a question the student got wrong several times. */
  equation: [380, 357],
  /** Search with no results. */
  telescope: [418, 369],
  /** Lessons, study, review. */
  studying: [423, 381],
  /** Stats, rating, progress. */
  graph: [387, 358],
  /** Taking a test. */
  laptop: [335, 356],
  lab: [399, 345],
  prism: [371, 386],
  magnet: [357, 412],
  cradle: [404, 347],
} as const;

export type MascotPose = keyof typeof POSES;

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
  const [w, h] = POSES[pose];
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
