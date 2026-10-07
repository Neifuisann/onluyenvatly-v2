/**
 * Drizzle schema (04 §2). Migrations are generated from this file with
 * `pnpm db:generate` and committed to `src/db/migrations/`.
 *
 * RLS is enabled on every table with no policies (04 §5), so the public
 * Supabase REST API can't read anything. The app role bypasses RLS.
 *
 * No path aliases or local imports here: `scripts/seed.ts` imports this file
 * directly with Node's type stripping.
 */
import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  boolean,
  check,
  date,
  foreignKey,
  index,
  inet,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const timestamptz = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date" });

export const userRole = pgEnum("user_role", ["student", "admin"]);
export const userStatus = pgEnum("user_status", [
  "pending",
  "active",
  "rejected",
  "disabled",
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    legacyId: text("legacy_id").unique(),
    role: userRole("role").notNull().default("student"),
    status: userStatus("status").notNull().default("pending"),
    fullName: text("full_name").notNull(),
    /** Normalized `0xxxxxxxxx`. Required for students. */
    phone: text("phone").unique(),
    /** Lowercase. Admins may log in with a username. */
    username: text("username").unique(),
    dateOfBirth: date("date_of_birth", { mode: "string" }),
    grade: smallint("grade"),
    className: text("class_name"),
    passwordHash: text("password_hash").notNull(),
    mustChangePassword: boolean("must_change_password")
      .notNull()
      .default(false),
    avatarPath: text("avatar_path"),
    /** Public surfaces (leaderboard) show initials only (S8-04, 06 §5). */
    leaderboardInitials: boolean("leaderboard_initials")
      .notNull()
      .default(false),
    /** The student asked to delete the account; an admin decides (06 §5). */
    deletionRequestedAt: timestamptz("deletion_requested_at"),
    approvedAt: timestamptz("approved_at"),
    approvedBy: uuid("approved_by"),
    lastLoginAt: timestamptz("last_login_at"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("users_pending_idx").on(t.status).where(sql`${t.status} = 'pending'`),
    index("users_role_idx").on(t.role),
    index("users_deletion_requested_idx")
      .on(t.deletionRequestedAt)
      .where(sql`${t.deletionRequestedAt} is not null`),
    // Accent-insensitive admin search on names (S2-01).
    index("users_full_name_trgm_idx").using(
      "gin",
      sql`lower(immutable_unaccent(${t.fullName})) gin_trgm_ops`,
    ),
    check(
      "users_login_id_check",
      sql`${t.phone} is not null or ${t.username} is not null`,
    ),
    check(
      "users_grade_check",
      sql`${t.grade} is null or ${t.grade} between 10 and 12`,
    ),
  ],
).enableRLS();

export const sessions = pgTable(
  "sessions",
  {
    /** sha256(token ‖ SESSION_PEPPER), hex. The raw token only lives in the cookie. */
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamptz("expires_at").notNull(),
    ip: inet("ip"),
    userAgent: text("user_agent"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    lastSeenAt: timestamptz("last_seen_at").notNull().defaultNow(),
  },
  (t) => [
    index("sessions_user_id_idx").on(t.userId),
    index("sessions_expires_at_idx").on(t.expiresAt),
  ],
).enableRLS();

/** Single row, `id = 1`. */
export const settings = pgTable(
  "settings",
  {
    id: smallint("id").primaryKey().default(1),
    registrationOpen: boolean("registration_open").notNull().default(true),
    singleSession: boolean("single_session").notNull().default(true),
    aiEnabled: boolean("ai_enabled").notNull().default(true),
    aiDailyBudget: integer("ai_daily_budget").notNull().default(200),
    announcement: text("announcement"),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
    updatedBy: uuid("updated_by").references(() => users.id, {
      onDelete: "set null",
    }),
  },
  (t) => [check("settings_single_row", sql`${t.id} = 1`)],
).enableRLS();

export const rateLimits = pgTable("rate_limits", {
  /** e.g. `login:ip:1.2.3.4@10m` */
  key: text("key").primaryKey(),
  windowStart: timestamptz("window_start").notNull(),
  count: integer("count").notNull(),
}).enableRLS();

export const auditLog = pgTable(
  "audit_log",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    actorId: uuid("actor_id").references(() => users.id, {
      onDelete: "set null",
    }),
    /** `student.approve`, `lesson.publish`, `attempt.delete`… */
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    data: jsonb("data"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("audit_log_created_at_idx").on(t.createdAt),
    // `/admin/audit?area=` newest first (migration 0011): the area is the
    // action's prefix, the same expression as `features/audit/queries.ts`.
    // NULLS FIRST is what a plain `ORDER BY … DESC` means, so the unfiltered
    // read (the index above, scanned backward) uses the same ORDER BY.
    index("audit_log_area_created_idx").on(
      sql`split_part(${t.action}, '.', 1)`,
      t.createdAt.desc().nullsFirst(),
      t.id.desc().nullsFirst(),
    ),
  ],
).enableRLS();

export const lessonStatus = pgEnum("lesson_status", [
  "draft",
  "published",
  "archived",
]);

/**
 * `search_text` is generated by `lesson_search_text()` (migration 0002), an
 * IMMUTABLE SQL function: lower(unaccent(title ‖ description ‖ tags)). Search
 * with `search_text ILIKE '%' || lower(immutable_unaccent($q)) || '%'`, which
 * the trigram index serves, so "dao dong" matches "Dao động".
 */
export const lessons = pgTable(
  "lessons",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    /** v1 `Date.now()` id, for redirects and the re-runnable migration. */
    legacyId: text("legacy_id").unique(),
    title: text("title").notNull(),
    description: text("description"),
    grade: smallint("grade"),
    /** e.g. "Dao động cơ" (v1 `subject`). */
    chapter: text("chapter"),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    coverPath: text("cover_path"),
    status: lessonStatus("status").notNull().default("draft"),
    sortOrder: integer("sort_order").notNull().default(0),
    /** Published content. */
    currentVersionId: bigint("current_version_id", {
      mode: "number",
    }).references((): AnyPgColumn => lessonVersions.id, {
      onDelete: "set null",
    }),
    /** Work in progress. */
    draftVersionId: bigint("draft_version_id", { mode: "number" }).references(
      (): AnyPgColumn => lessonVersions.id,
      { onDelete: "set null" },
    ),
    /** `LessonConfig` (04 §3.2), validated by `LessonConfigSchema`. */
    config: jsonb("config").notNull(),
    /** Denormalized from the current version, after pool selection. */
    questionCount: smallint("question_count").notNull().default(0),
    /** `{ mcq, tf, short }` after pool selection, for cards. */
    typeCounts: jsonb("type_counts")
      .$type<Partial<Record<"mcq" | "tf" | "short", number>>>()
      .notNull()
      .default({}),
    attemptCount: integer("attempt_count").notNull().default(0),
    searchText: text("search_text").generatedAlwaysAs(
      sql`lesson_search_text(title, description, tags)`,
    ),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
    publishedAt: timestamptz("published_at"),
    /**
     * Soft delete (S5-01): a lesson with attempts is archived and hidden from
     * the admin list instead of deleted, so old results keep their review.
     */
    deletedAt: timestamptz("deleted_at"),
  },
  (t) => [
    index("lessons_status_sort_idx").on(t.status, t.sortOrder),
    index("lessons_tags_idx").using("gin", t.tags),
    index("lessons_search_text_trgm_idx").using(
      "gin",
      sql`${t.searchText} gin_trgm_ops`,
    ),
    check(
      "lessons_grade_check",
      sql`${t.grade} is null or ${t.grade} between 10 and 12`,
    ),
  ],
).enableRLS();

/**
 * Lesson content snapshots. `questions` INCLUDES ANSWERS: read it only
 * server-side, through the stripped or grading queries (14 §3).
 */
export const lessonVersions = pgTable(
  "lesson_versions",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    lessonId: bigint("lesson_id", { mode: "number" })
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    /** Content-addressed migration snapshot; null for native editor versions. */
    legacyHash: text("legacy_hash"),
    /** Editor text format (04 §3.3). */
    sourceText: text("source_text").notNull(),
    /** `Question[]` (04 §3.1). */
    questions: jsonb("questions").notNull(),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [
    unique("lesson_versions_lesson_version_uq").on(t.lessonId, t.version),
    unique("lesson_versions_legacy_hash_uq").on(t.lessonId, t.legacyHash),
  ],
).enableRLS();

/** Uploaded files in the Storage `media` bucket (quota check, orphan cleanup). */
export const media = pgTable("media", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Object path inside the bucket, e.g. `2026/09/<uuid>.webp`. */
  path: text("path").notNull().unique(),
  bytes: integer("bytes").notNull(),
  width: integer("width"),
  height: integer("height"),
  uploadedBy: uuid("uploaded_by").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
}).enableRLS();

export const attemptMode = pgEnum("attempt_mode", [
  "test",
  "practice",
  "review",
]);
export const attemptStatus = pgEnum("attempt_status", [
  "in_progress",
  "submitted",
  "expired",
]);

/**
 * One question of an attempt, in display order: question id, lesson version
 * (omitted when equal to the attempt's), mcq option order (original indexes in
 * display order) and the points it is worth, fixed at start.
 */
export type AttemptItem = { q: string; v?: number; o?: number[]; p: number };
/** mcq: displayed letter "A"–"F"; tf: one boolean or null per statement; short: text. */
export type AttemptAnswer = string | (boolean | null)[] | null;
/** Seconds since start + kind (S4-04). Capped at 200. */
export type GuardEvent = { t: number; k: string };

const score = (name: string, precision: number) =>
  numeric(name, { precision, scale: 2, mode: "number" });

export const attempts = pgTable(
  "attempts",
  {
    /** Unguessable, used in URLs. */
    id: uuid("id").primaryKey().defaultRandom(),
    legacyResultId: text("legacy_result_id").unique(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** null for personalized practice (`review`). */
    lessonId: bigint("lesson_id", { mode: "number" }).references(
      () => lessons.id,
      { onDelete: "cascade" },
    ),
    // NO ACTION (not RESTRICT): deleting a lesson cascades to both its
    // versions and its attempts in one statement.
    lessonVersionId: bigint("lesson_version_id", {
      mode: "number",
    }).references(() => lessonVersions.id),
    mode: attemptMode("mode").notNull().default("test"),
    status: attemptStatus("status").notNull().default("in_progress"),
    items: jsonb("items").$type<AttemptItem[]>().notNull(),
    /** Aligned with `items`. */
    answers: jsonb("answers").$type<AttemptAnswer[]>().notNull(),
    /** Item indexes flagged for review. */
    flagged: smallint("flagged").array().notNull().default(sql`'{}'`),
    /**
     * Practice and review attempts (S7-06): item indexes whose answer was
     * checked with `checkPracticeAnswer`. Their answers are locked: saves and
     * the submit keep the checked answer.
     */
    checked: smallint("checked").array().notNull().default(sql`'{}'`),
    guardEvents: jsonb("guard_events")
      .$type<GuardEvent[]>()
      .notNull()
      .default([]),
    /** Aligned with `items`, set on submit. */
    earned: score("earned", 5).array(),
    score: score("score", 7),
    maxScore: score("max_score", 7).notNull(),
    /** Normalized to 10 for display and stats. */
    score10: score("score10", 4),
    startedAt: timestamptz("started_at").notNull().defaultNow(),
    /** null = no limit. The server allows a 30 s grace after it. */
    deadlineAt: timestamptz("deadline_at"),
    submittedAt: timestamptz("submitted_at"),
    timeTakenSec: integer("time_taken_sec"),
    lastSavedAt: timestamptz("last_saved_at"),
    /** Idempotency key of the submit that closed the attempt. */
    clientSubmitId: uuid("client_submit_id"),
    /** Idempotent analytics update after grading has committed (S9-01). */
    counterRecorded: boolean("counter_recorded").notNull().default(false),
    ip: inet("ip"),
  },
  (t) => [
    // One open attempt per (student, lesson); `review` attempts have no lesson.
    uniqueIndex("attempts_one_in_progress_uq")
      .on(t.userId, t.lessonId)
      .where(sql`${t.status} = 'in_progress'`),
    // …and one open personalized practice per student (S7-06).
    uniqueIndex("attempts_one_open_review_uq")
      .on(t.userId)
      .where(sql`${t.status} = 'in_progress' and ${t.lessonId} is null`),
    index("attempts_user_submitted_idx").on(t.userId, t.submittedAt.desc()),
    index("attempts_lesson_submitted_idx")
      .on(t.lessonId, t.submittedAt.desc())
      .where(sql`${t.status} = 'submitted'`),
    // Newest submitted attempts first: `/admin/results`, its CSV export and
    // the admin dashboard (S6-04, migration 0007).
    index("attempts_submitted_idx")
      .on(t.submittedAt.desc())
      .where(sql`${t.status} = 'submitted'`),
    // A version's attempts, every status: the regrade after a correction
    // (B-10) and publish's "does an attempt still use it" check.
    index("attempts_lesson_version_idx").on(t.lessonVersionId),
    index("attempts_expiry_idx")
      .on(t.status, t.deadlineAt)
      .where(sql`${t.status} = 'in_progress'`),
    index("attempts_private_retention_idx")
      .on(t.startedAt)
      .where(
        sql`${t.ip} is not null or jsonb_array_length(${t.guardEvents}) > 0`,
      ),
    index("attempts_pending_counter_idx")
      .on(t.lessonId)
      .where(
        sql`${t.status} = 'submitted' and ${t.lessonId} is not null and not ${t.counterRecorded}`,
      ),
    check(
      "attempts_answers_aligned",
      sql`jsonb_array_length(${t.answers}) = jsonb_array_length(${t.items})`,
    ),
  ],
).enableRLS();

export const ratings = pgTable(
  "ratings",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull().default(1500),
    peak: integer("peak").notNull().default(1500),
    ratedAttempts: integer("rated_attempts").notNull().default(0),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (t) => [index("ratings_rating_idx").on(t.rating.desc())],
).enableRLS();

export const ratingEvents = pgTable(
  "rating_events",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    legacyHistoryId: text("legacy_history_id").unique(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** null for migrated history that matched no result. */
    attemptId: uuid("attempt_id")
      .unique()
      .references(() => attempts.id, { onDelete: "cascade" }),
    lessonId: bigint("lesson_id", { mode: "number" }).references(
      () => lessons.id,
      { onDelete: "set null" },
    ),
    before: integer("before").notNull(),
    delta: integer("delta").notNull(),
    after: integer("after").notNull(),
    performance: numeric("performance", {
      precision: 4,
      scale: 3,
      mode: "number",
    }),
    /** v2 inputs are stored so a replay reproduces the delta; null for v1. */
    timeBonus: numeric("time_bonus", {
      precision: 4,
      scale: 3,
      mode: "number",
    }),
    /** `v2`, or `v1-legacy` for migrated rows. */
    formula: text("formula").notNull(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("rating_events_user_created_idx").on(t.userId, t.createdAt.desc()),
    index("rating_events_created_idx").on(t.createdAt),
  ],
).enableRLS();

/**
 * Extra tries a teacher grants one student on one lesson (S4-03 follow-up):
 * they reopen a scheduled lesson after its answers are out and add to
 * `maxAttempts`. Granted from the student admin pages (S6-02).
 */
export const attemptOverrides = pgTable(
  "attempt_overrides",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lessonId: bigint("lesson_id", { mode: "number" })
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    extraAttempts: smallint("extra_attempts").notNull(),
    grantedBy: uuid("granted_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.lessonId] }),
    check(
      "attempt_overrides_extra_check",
      sql`${t.extraAttempts} between 1 and 100`,
    ),
  ],
).enableRLS();

export const mistakeStatus = pgEnum("mistake_status", ["open", "resolved"]);

export const mistakes = pgTable(
  "mistakes",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lessonId: bigint("lesson_id", { mode: "number" })
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    /** Stable id inside the lesson. */
    questionId: text("question_id").notNull(),
    /**
     * `mcq` | `tf` | `short`, copied from the question so `/review` filters
     * by type without reading version content (S7-06, backfilled in 0009).
     */
    questionType: text("question_type").$type<"mcq" | "tf" | "short">(),
    /** Latest version where it was seen. */
    lessonVersionId: bigint("lesson_version_id", { mode: "number" })
      .notNull()
      .references(() => lessonVersions.id),
    wrongCount: smallint("wrong_count").notNull().default(0),
    /** Reset on a wrong answer; resolved at 2. */
    correctStreak: smallint("correct_streak").notNull().default(0),
    status: mistakeStatus("status").notNull().default("open"),
    lastAttemptId: uuid("last_attempt_id").references(() => attempts.id, {
      onDelete: "set null",
    }),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.lessonId, t.questionId] }),
    index("mistakes_user_status_idx").on(
      t.userId,
      t.status,
      t.updatedAt.desc(),
    ),
    check(
      "mistakes_question_type_check",
      sql`${t.questionType} in ('mcq', 'tf', 'short')`,
    ),
  ],
).enableRLS();

export const explanationSource = pgEnum("explanation_source", [
  "ai",
  "teacher",
]);

/**
 * AI explanations, generated once per question content and shared by every
 * student (ADR-007, S7-02). The key is a hash of the question with its
 * answer, so an edited question gets a new explanation and a copied one
 * reuses it. `lesson_id`/`question_id` say where it was first generated.
 */
export const questionExplanations = pgTable(
  "question_explanations",
  {
    /** sha256 hex of the normalized question + answer (`ai/domain/explain.ts`). */
    questionHash: text("question_hash").primaryKey(),
    lessonId: bigint("lesson_id", { mode: "number" }).references(
      () => lessons.id,
      { onDelete: "set null" },
    ),
    questionId: text("question_id").notNull(),
    /** `teacher` once an admin has edited it. */
    source: explanationSource("source").notNull().default("ai"),
    /** Gemini model that wrote it; null for teacher text. */
    model: text("model"),
    /** `PROMPT_VERSION` it was generated with (09 §5). */
    promptVersion: text("prompt_version"),
    /** Markdown-lite + LaTeX, rendered by `MathText`. */
    contentMd: text("content_md").notNull(),
    votesUp: integer("votes_up").notNull().default(0),
    votesDown: integer("votes_down").notNull().default(0),
    /** Set when an admin edits or approves it: leaves the 👎 queue. */
    reviewedAt: timestamptz("reviewed_at"),
    reviewedBy: uuid("reviewed_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("question_explanations_lesson_idx").on(t.lessonId),
    // The 👎 queue (S7-03): unreviewed explanations with 3+ down votes.
    index("question_explanations_flagged_idx")
      .on(t.votesDown.desc())
      .where(sql`${t.reviewedAt} is null and ${t.votesDown} >= 3`),
  ],
).enableRLS();

/** One vote per student per explanation (05 `voteExplanation`). */
export const explanationVotes = pgTable(
  "explanation_votes",
  {
    questionHash: text("question_hash").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    up: boolean("up").notNull(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.questionHash, t.userId] }),
    // Named here: the generated name is longer than Postgres allows (63).
    foreignKey({
      name: "explanation_votes_question_hash_fk",
      columns: [t.questionHash],
      foreignColumns: [questionExplanations.questionHash],
    }).onDelete("cascade"),
  ],
).enableRLS();

export const gameStatus = pgEnum("game_status", [
  "lobby",
  "running",
  "finished",
]);

/** A bank question: lesson, version, question id (B-05). */
export type GameBankItem = { l: number; v: number; q: string };
/** One answered bank question: outcome kind and points (B-05). */
export type GameMarkRow = {
  k: "correct" | "partial" | "wrong" | "blank" | "timeout";
  s: number;
};

/**
 * Live races a teacher hosts (B-05, ADR-008). Players join with the PIN; the
 * bank is drawn once at creation and holds references only, never content.
 * `rev` goes up on every change players can see, so a poll that already has
 * the latest state is answered 204 without reading the players.
 */
export const gameRooms = pgTable(
  "game_rooms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Six digits; unique among rooms not finished. */
    pin: text("pin").notNull(),
    hostId: uuid("host_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    status: gameStatus("status").notNull().default("lobby"),
    /** `fast` | `normal` | `relaxed` (`games/domain/rules.ts`). */
    pace: text("pace").notNull(),
    bank: jsonb("bank").$type<GameBankItem[]>().notNull(),
    /** Aligned with `bank`: `mcq` | `tf` | `short`, for timers and reports. */
    bankTypes: text("bank_types")
      .array()
      .$type<("mcq" | "tf" | "short")[]>()
      .notNull(),
    /** The lessons chosen, for "Chơi lại" and the list. */
    lessonIds: bigint("lesson_ids", { mode: "number" }).array().notNull(),
    rev: integer("rev").notNull().default(0),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    startedAt: timestamptz("started_at"),
    /** Past it a running room counts as finished (`raceHardEnd`). */
    hardEndAt: timestamptz("hard_end_at"),
    finishedAt: timestamptz("finished_at"),
  },
  (t) => [
    uniqueIndex("game_rooms_open_pin_uq")
      .on(t.pin)
      .where(sql`${t.status} <> 'finished'`),
    index("game_rooms_pin_created_idx").on(t.pin, t.createdAt.desc()),
    index("game_rooms_host_created_idx").on(t.hostId, t.createdAt.desc()),
    check("game_rooms_pin_check", sql`${t.pin} ~ '^[1-9][0-9]{5}$'`),
    check(
      "game_rooms_bank_aligned",
      sql`jsonb_array_length(${t.bank}) = cardinality(${t.bankTypes})`,
    ),
  ],
).enableRLS();

/**
 * One student in one race. `seed` rebuilds their question order and option
 * shuffles; `answered` is how far they are, and the guarded
 * `WHERE answered = i` update makes a retried answer count once.
 */
export const gamePlayers = pgTable(
  "game_players",
  {
    /** Public id in standings, so user ids never reach other browsers. */
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => gameRooms.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    racer: text("racer").notNull(),
    color: smallint("color").notNull(),
    seed: bigint("seed", { mode: "number" }).notNull(),
    answered: smallint("answered").notNull().default(0),
    correct: smallint("correct").notNull().default(0),
    score: integer("score").notNull().default(0),
    streak: smallint("streak").notNull().default(0),
    bestStreak: smallint("best_streak").notNull().default(0),
    /** Bank-aligned; null where not reached yet. */
    marks: jsonb("marks").$type<(GameMarkRow | null)[]>().notNull(),
    joinedAt: timestamptz("joined_at").notNull().defaultNow(),
    lastAnsweredAt: timestamptz("last_answered_at"),
    finishedAt: timestamptz("finished_at"),
    /** Removed by the host: hidden from standings, can't rejoin. */
    removedAt: timestamptz("removed_at"),
  },
  (t) => [
    unique("game_players_room_user_uq").on(t.roomId, t.userId),
    index("game_players_user_idx").on(t.userId),
  ],
).enableRLS();

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type Settings = typeof settings.$inferSelect;
export type Lesson = typeof lessons.$inferSelect;
export type NewLesson = typeof lessons.$inferInsert;
export type LessonVersion = typeof lessonVersions.$inferSelect;
export type Media = typeof media.$inferSelect;
export type Attempt = typeof attempts.$inferSelect;
export type NewAttempt = typeof attempts.$inferInsert;
export type Rating = typeof ratings.$inferSelect;
export type RatingEvent = typeof ratingEvents.$inferSelect;
export type Mistake = typeof mistakes.$inferSelect;
export type AttemptOverride = typeof attemptOverrides.$inferSelect;
export type GameRoom = typeof gameRooms.$inferSelect;
export type GamePlayer = typeof gamePlayers.$inferSelect;
