/**
 * v1 URLs that must keep working after the cutover (05 §1, S8-05): students
 * and the teacher have them bookmarked and shared in Zalo groups. Permanent
 * (308) redirects in `next.config.ts`; ids that changed go through lookup
 * handlers (`…/by-legacy/…`). Order matters: the first match wins, so a
 * fixed path comes before a `:param` one with the same prefix.
 */
export type LegacyRedirect = { source: string; destination: string };

export const LEGACY_REDIRECTS: readonly LegacyRedirect[] = [
  // Sign-in and sign-up
  { source: "/student/login", destination: "/login" },
  { source: "/admin/login", destination: "/login" },
  { source: "/student/register", destination: "/register" },

  // Lessons, shares and results (ids looked up by their v1 key)
  { source: "/lesson/last-incomplete", destination: "/dashboard" },
  { source: "/lesson/:legacyId", destination: "/lessons/by-legacy/:legacyId" },
  {
    source: "/share/lesson/:legacyId",
    destination: "/share/lessons/by-legacy/:legacyId",
  },
  {
    source: "/result/:legacyResultId",
    destination: "/attempts/by-legacy/:legacyResultId",
  },
  { source: "/result", destination: "/profile" },

  // Student pages
  { source: "/student/dashboard", destination: "/dashboard" },
  { source: "/student/profile", destination: "/profile" },
  { source: "/student/results", destination: "/profile" },
  { source: "/student/rating", destination: "/leaderboard" },
  { source: "/multiplechoice", destination: "/lessons" },
  { source: "/truefalse", destination: "/lessons" },
  { source: "/quizgame", destination: "/lessons" },
  { source: "/review-mistakes", destination: "/review" },
  { source: "/practice", destination: "/review" },
  { source: "/study-materials", destination: "/ly-thuyet" },

  // Teacher pages (v1 lesson ids don't carry over: land on the list)
  { source: "/history", destination: "/admin/results" },
  { source: "/admin/new", destination: "/admin/lessons" },
  { source: "/admin/new-legacy", destination: "/admin/lessons" },
  { source: "/admin/lessons/new", destination: "/admin/lessons" },
  { source: "/admin/edit/:id", destination: "/admin/lessons" },
  { source: "/admin/edit-legacy/:id", destination: "/admin/lessons" },
  { source: "/admin/configure/:id*", destination: "/admin/lessons" },
  { source: "/admin/lessons/:id/statistics", destination: "/admin/lessons" },
  { source: "/admin/statistics", destination: "/admin" },
  { source: "/admin/ratings", destination: "/admin/students" },
  { source: "/admin/adaptive-quiz", destination: "/admin/lessons" },
  { source: "/admin/quiz", destination: "/admin/lessons" },
  { source: "/admin/uploads", destination: "/admin/lessons" },
  { source: "/admin/ai-tools", destination: "/admin/import" },
];
