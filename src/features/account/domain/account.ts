import { z } from "zod";
import {
  classNameField,
  dateOfBirthField,
  fullNameField,
  gradeField,
} from "@/features/auth/schemas";
import { fieldMessages } from "@/lib/messages";
import { AVATAR_SIDE, MAX_AVATAR_BYTES } from "./avatar-limits";

export { AVATAR_SIDE, MAX_AVATAR_BYTES } from "./avatar-limits";

/**
 * A student's own settings (S8-04, 05 §1 `/settings`): profile, privacy,
 * avatar, sessions, data export and the deletion request. Pure: inputs,
 * paths and the export's shape.
 */

/** Same rules as registration. The phone is the login and can't change here. */
export const ProfileSchema = z.strictObject({
  fullName: fullNameField,
  dateOfBirth: dateOfBirthField,
  grade: gradeField,
  className: classNameField,
});
export type ProfileInput = z.infer<typeof ProfileSchema>;
export type ProfileKey = keyof ProfileInput;

export const PrivacySchema = z.strictObject({
  leaderboardInitials: z.boolean(),
});
export type PrivacyInput = z.infer<typeof PrivacySchema>;

/** Asking to be deleted takes the password, so a borrowed phone can't. */
export const DeletionRequestSchema = z.strictObject({
  password: z.string().min(1, fieldMessages.required).max(200),
});

/**
 * A session is named to its owner by the first 16 hex characters of its id
 * (the id is a token hash; the full value never leaves the server).
 */
export const SESSION_HANDLE_LENGTH = 16;
export const SessionHandleSchema = z
  .string()
  .regex(new RegExp(`^[0-9a-f]{${SESSION_HANDLE_LENGTH}}$`));
export const sessionHandle = (sessionId: string) =>
  sessionId.slice(0, SESSION_HANDLE_LENGTH);

/** The keys whose value differs (only those are written and audited). */
export function changedKeys<T extends Record<string, unknown>>(
  before: T,
  after: T,
): Array<keyof T> {
  return (Object.keys(after) as Array<keyof T>).filter(
    (k) => before[k] !== after[k],
  );
}

// ------------------------------------------------------------------ avatar

/** The browser crops and resizes to a WebP square before uploading. */

export const AvatarUploadSchema = z.strictObject({
  contentType: z.literal("image/webp"),
  bytes: z.number().int().positive().max(MAX_AVATAR_BYTES),
  width: z.number().int().positive().max(AVATAR_SIDE),
  height: z.number().int().positive().max(AVATAR_SIDE),
});
export type AvatarUpload = z.infer<typeof AvatarUploadSchema>;

/** `avatars/<userId>/<uuid>.webp` in the public `media` bucket. */
export function avatarObjectPath(userId: string, id: string): string {
  return `avatars/${userId}/${id}.webp`;
}

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/** Only a path this user was given by `avatarObjectPath` can be saved. */
export function isOwnAvatarPath(userId: string, path: string): boolean {
  return (
    new RegExp(`^avatars/${UUID}/${UUID}\\.webp$`).test(path) &&
    path.startsWith(`avatars/${userId}/`)
  );
}

export const AvatarPathSchema = z.string().max(200);

// ------------------------------------------------------------------ export

export const EXPORT_FORMAT = "onluyenvatly.export.v1";

/** `du-lieu-cua-toi-2026-09-29.json`, dated in Vietnam time. */
export function exportFileName(vnDate: string): string {
  return `du-lieu-cua-toi-${vnDate}.json`;
}

export type ExportSource = {
  profile: {
    fullName: string;
    phone: string | null;
    username: string | null;
    dateOfBirth: string | null;
    grade: number | null;
    className: string | null;
    role: string;
    status: string;
    avatarPath: string | null;
    leaderboardInitials: boolean;
    deletionRequestedAt: Date | null;
    createdAt: Date;
    approvedAt: Date | null;
    lastLoginAt: Date | null;
  };
  sessions: Array<{
    createdAt: Date;
    lastSeenAt: Date;
    ip: string | null;
    userAgent: string | null;
  }>;
  attempts: Array<{
    id: string;
    lessonTitle: string | null;
    mode: string;
    status: string;
    startedAt: Date;
    submittedAt: Date | null;
    score: number | null;
    maxScore: number;
    score10: number | null;
    timeTakenSec: number | null;
    answers: unknown;
  }>;
  rating: { rating: number; peak: number; ratedAttempts: number } | null;
  ratingEvents: Array<{
    createdAt: Date;
    attemptId: string | null;
    before: number;
    delta: number;
    after: number;
  }>;
  mistakes: Array<{
    lessonTitle: string | null;
    questionId: string;
    questionType: string | null;
    wrongCount: number;
    status: string;
    updatedAt: Date;
  }>;
};

/**
 * The JSON a student downloads (06 §5): profile, sessions, attempts with
 * their own answers and scores, rating history and mistakes. Never the
 * password hash, session tokens, answer keys or per-question marks (marks
 * would give answers away where the teacher hides them).
 */
export function buildExport(source: ExportSource, exportedAt: Date) {
  return {
    format: EXPORT_FORMAT,
    exportedAt: exportedAt.toISOString(),
    profile: source.profile,
    sessions: source.sessions,
    attempts: source.attempts,
    rating: source.rating,
    ratingHistory: source.ratingEvents,
    mistakes: source.mistakes,
  };
}
