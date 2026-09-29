import { describe, expect, it } from "vitest";
import {
  AVATAR_SIDE,
  AvatarUploadSchema,
  avatarObjectPath,
  buildExport,
  changedKeys,
  DeletionRequestSchema,
  EXPORT_FORMAT,
  type ExportSource,
  exportFileName,
  isOwnAvatarPath,
  MAX_AVATAR_BYTES,
  PrivacySchema,
  ProfileSchema,
  SessionHandleSchema,
  sessionHandle,
} from "./account";

const ME = "0f8fad5b-d9cb-469f-a165-70867728950e";
const OTHER = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const FILE = "e3b0c442-98fc-4c14-9afb-f4c8996fb924";

describe("ProfileSchema", () => {
  it("normalizes like registration", () => {
    expect(
      ProfileSchema.parse({
        fullName: "  Nguyễn   Văn  An ",
        dateOfBirth: "2008-05-01",
        grade: "12",
        className: " 12a1 ",
      }),
    ).toEqual({
      fullName: "Nguyễn Văn An",
      dateOfBirth: "2008-05-01",
      grade: 12,
      className: "12A1",
    });
    expect(
      ProfileSchema.parse({
        fullName: "An Bình",
        dateOfBirth: "2008-05-01",
        grade: "",
        className: "",
      }),
    ).toMatchObject({ grade: null, className: null });
  });

  it("refuses bad fields and unknown keys (no phone change here)", () => {
    const base = {
      fullName: "An Bình",
      dateOfBirth: "2008-05-01",
      grade: "12",
      className: "12A1",
    };
    for (const patch of [
      { fullName: "A" },
      { dateOfBirth: "2008-02-30" },
      { grade: "9" },
      { className: "x".repeat(21) },
      { phone: "0912345678" },
    ])
      expect(ProfileSchema.safeParse({ ...base, ...patch }).success).toBe(
        false,
      );
  });
});

describe("small schemas", () => {
  it("privacy is one boolean", () => {
    expect(PrivacySchema.parse({ leaderboardInitials: true })).toEqual({
      leaderboardInitials: true,
    });
    expect(
      PrivacySchema.safeParse({ leaderboardInitials: "yes" }).success,
    ).toBe(false);
  });

  it("a deletion request needs the password", () => {
    expect(DeletionRequestSchema.safeParse({ password: "" }).success).toBe(
      false,
    );
    expect(DeletionRequestSchema.safeParse({ password: "x" }).success).toBe(
      true,
    );
  });

  it("names a session by 16 hex characters of its id", () => {
    const id = "a".repeat(64);
    expect(sessionHandle(id)).toBe("a".repeat(16));
    expect(SessionHandleSchema.safeParse(sessionHandle(id)).success).toBe(true);
    for (const bad of [id, "abc", "g".repeat(16), "%".repeat(16)])
      expect(SessionHandleSchema.safeParse(bad).success).toBe(false);
  });

  it("lists changed keys only", () => {
    expect(
      changedKeys({ a: 1, b: "x", c: null }, { a: 1, b: "y", c: null }),
    ).toEqual(["b"]);
    expect(changedKeys({ a: 1 }, { a: 1 })).toEqual([]);
  });
});

describe("avatar", () => {
  it("accepts a small WebP square only", () => {
    const ok = {
      contentType: "image/webp",
      bytes: 20_000,
      width: AVATAR_SIDE,
      height: AVATAR_SIDE,
    };
    expect(AvatarUploadSchema.safeParse(ok).success).toBe(true);
    for (const patch of [
      { contentType: "image/png" },
      { bytes: MAX_AVATAR_BYTES + 1 },
      { width: AVATAR_SIDE + 1 },
      { height: 0 },
    ])
      expect(AvatarUploadSchema.safeParse({ ...ok, ...patch }).success).toBe(
        false,
      );
  });

  it("only saves a path under the user's own folder", () => {
    const path = avatarObjectPath(ME, FILE);
    expect(path).toBe(`avatars/${ME}/${FILE}.webp`);
    expect(isOwnAvatarPath(ME, path)).toBe(true);
    expect(isOwnAvatarPath(OTHER, path)).toBe(false);
    for (const bad of [
      `avatars/${ME}/../${OTHER}/${FILE}.webp`,
      `avatars/${ME}/${FILE}.png`,
      `2026/09/${FILE}.webp`,
      `avatars/${ME}/${FILE}.webp?x=1`,
      "",
    ])
      expect(isOwnAvatarPath(ME, bad), bad).toBe(false);
  });
});

describe("export", () => {
  it("names the file by the Vietnam date", () => {
    expect(exportFileName("2026-09-29")).toBe(
      "du-lieu-cua-toi-2026-09-29.json",
    );
  });

  it("wraps the rows with a format and a timestamp", () => {
    const source: ExportSource = {
      profile: {
        fullName: "An",
        phone: "0912345678",
        username: null,
        dateOfBirth: "2008-05-01",
        grade: 12,
        className: "12A1",
        role: "student",
        status: "active",
        avatarPath: null,
        leaderboardInitials: false,
        deletionRequestedAt: null,
        createdAt: new Date("2026-01-01T00:00:00Z"),
        approvedAt: null,
        lastLoginAt: null,
      },
      sessions: [],
      attempts: [],
      rating: null,
      ratingEvents: [],
      mistakes: [],
    };
    const out = buildExport(source, new Date("2026-09-29T10:00:00Z"));
    expect(out).toMatchObject({
      format: EXPORT_FORMAT,
      exportedAt: "2026-09-29T10:00:00.000Z",
      profile: { fullName: "An" },
      ratingHistory: [],
    });
    expect(Object.keys(out)).toEqual([
      "format",
      "exportedAt",
      "profile",
      "sessions",
      "attempts",
      "rating",
      "ratingHistory",
      "mistakes",
    ]);
  });
});
