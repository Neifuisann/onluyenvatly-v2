/**
 * The only place cache tag names are defined (ADR-005). Mutations invalidate
 * exactly the tags of the data they changed.
 */
export const tags = {
  settings: "settings",
  lessons: "lessons",
  lesson: (id: number) => `lesson:${id}`,
  lessonPublic: (id: number) => `lesson:${id}:public`,
  lessonAnswers: (id: number) => `lesson:${id}:answers`,
  /** Admin lesson statistics (S6-05); deleting an attempt invalidates it (S6-04). */
  lessonStats: (id: number) => `lesson:${id}:stats`,
  leaderboard: "leaderboard",
  /** Admin nav badge: students waiting for approval. */
  pendingStudents: "pendingStudents",
  /** Admin dashboard aggregates (S6-06, 5 min); deleting an attempt invalidates it. */
  adminOverview: "adminOverview",
} as const;
