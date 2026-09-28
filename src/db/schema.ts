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
  bigint,
  boolean,
  check,
  date,
  index,
  inet,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
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
    approvedAt: timestamptz("approved_at"),
    approvedBy: uuid("approved_by"),
    lastLoginAt: timestamptz("last_login_at"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("users_pending_idx").on(t.status).where(sql`${t.status} = 'pending'`),
    index("users_role_idx").on(t.role),
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
  (t) => [index("audit_log_created_at_idx").on(t.createdAt)],
).enableRLS();

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type Settings = typeof settings.$inferSelect;
