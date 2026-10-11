import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import { auditLog, users } from "@/db/schema";
import { resetDb, type TestDb } from "@/test/db";
import type { SessionUser } from "./session";

/**
 * 06 §2 / 11 §3 (journey 8): every staff server action refuses anyone who
 * isn't a teacher or an admin, before it reads its input or writes
 * anything, and the platform actions also refuse teachers (B-03). The
 * actions are found on disk (the `admin-actions.ts` of every feature, plus
 * the class, media and settings actions), so a new staff action is covered
 * the day it is exported. Student- and visitor-facing actions
 * (`auth/actions`) are not in this list on purpose.
 */

vi.mock("@/db/client", async () => (await import("@/test/db")).mockDbModule());
const cache = vi.hoisted(() => ({
  updateTag: vi.fn(),
  refresh: vi.fn(),
  revalidateTag: vi.fn(),
}));
vi.mock("next/cache", () => ({
  ...cache,
  cacheTag: () => {},
  cacheLife: () => {},
}));
const current = vi.hoisted(() => ({ user: null as SessionUser | null }));
vi.mock("./queries", () => ({ getCurrentUser: async () => current.user }));

const tdb = db as unknown as TestDb;

const session = (patch: Partial<SessionUser>): SessionUser => ({
  id: "00000000-0000-4000-8000-000000000001",
  role: "student",
  fullName: "Học Sinh",
  grade: 12,
  mustChangePassword: false,
  sessionId: "s",
  ...patch,
});

const featuresDir = join(process.cwd(), "src", "features");
const moduleFiles = [
  ...readdirSync(featuresDir).flatMap((dir) =>
    existsSync(join(featuresDir, dir, "admin-actions.ts"))
      ? [`${dir}/admin-actions`]
      : [],
  ),
  "classes/actions",
  "media/actions",
  // Admin only today; the student settings actions (05 §2) will get their
  // own file.
  "settings/actions",
];

/**
 * Platform administration (B-03): an admin's, never a teacher's. Every
 * other staff action is a teacher's, scoped to their own lessons and
 * classes by the services.
 */
const ADMIN_ONLY = [
  "ai/admin-actions.pregenerateExplanations",
  "ai/admin-actions.updateExplanation",
  "ai/admin-actions.approveExplanation",
  "ai/admin-actions.regenerateExplanation",
  "students/admin-actions.resetPassword",
  "students/admin-actions.revokeSessions",
  "students/admin-actions.setStatus",
  "students/admin-actions.deleteStudent",
  "students/admin-actions.createAdmin",
  "settings/actions.updateSettings",
];

async function load() {
  const out: Array<[name: string, fn: (input?: unknown) => Promise<unknown>]> =
    [];
  for (const file of moduleFiles) {
    // An absolute path: Vite only bundles variable imports one level deep.
    const path = join(featuresDir, `${file}.ts`).replaceAll("\\", "/");
    const mod = (await import(/* @vite-ignore */ path)) as Record<
      string,
      unknown
    >;
    for (const [name, fn] of Object.entries(mod)) {
      expect(typeof fn, `${file}.${name} must be an action`).toBe("function");
      out.push([
        `${file}.${name}`,
        fn as (input?: unknown) => Promise<unknown>,
      ]);
    }
  }
  return out;
}

/** The path a thrown `redirect()` points at, or null if it threw something else. */
function redirectPath(error: unknown): string | null {
  const digest = (error as { digest?: unknown } | null)?.digest;
  if (typeof digest !== "string" || !digest.startsWith("NEXT_REDIRECT;"))
    return null;
  return digest.split(";")[2] ?? null;
}

beforeEach(async () => {
  await resetDb(tdb);
  vi.clearAllMocks();
});

describe("staff actions require a teacher or an admin", () => {
  it("finds the actions of attempts, classes, lessons, students, media and settings", async () => {
    const names = (await load()).map(([name]) => name);
    expect(moduleFiles).toEqual(
      expect.arrayContaining([
        "attempts/admin-actions",
        "classes/actions",
        "lessons/admin-actions",
        "students/admin-actions",
        "media/actions",
        "settings/actions",
      ]),
    );
    expect(names).toEqual(
      expect.arrayContaining([
        ...ADMIN_ONLY,
        "classes/actions.addMembers",
        "classes/actions.setLessons",
        "lessons/admin-actions.deleteLesson",
        "students/admin-actions.resetPassword",
        "students/admin-actions.deleteStudent",
        "students/admin-actions.createAdmin",
        "attempts/admin-actions.deleteAttempt",
        "media/actions.createUploadUrl",
        "settings/actions.updateSettings",
      ]),
    );
  });

  it("sends a student home from every action and writes nothing", async () => {
    // A real target, so an action missing its guard would have work to do.
    const [target] = await tdb
      .insert(users)
      .values({
        fullName: "Chờ Duyệt",
        phone: "0911111111",
        passwordHash: "keep",
        status: "pending",
      })
      .returning();
    if (!target) throw new Error("seed failed");
    current.user = session({ role: "student" });
    const actions = await load();
    const inputs = [
      {},
      target.id,
      { ids: [target.id] },
      { id: target.id, status: "disabled" },
      { id: target.id, confirmName: target.fullName },
    ];
    for (const [name, action] of actions)
      for (const input of inputs) {
        const error = await action(input).then(
          () => null,
          (e: unknown) => e,
        );
        expect(redirectPath(error), name).toBe("/dashboard");
      }
    expect(await tdb.select().from(users)).toEqual([target]);
    expect(await tdb.select().from(auditLog)).toHaveLength(0);
    expect(cache.updateTag).not.toHaveBeenCalled();
    expect(cache.refresh).not.toHaveBeenCalled();
    expect(cache.revalidateTag).not.toHaveBeenCalled();
  });

  it("sends a visitor to the login page from every action", async () => {
    current.user = null;
    for (const [name, action] of await load()) {
      const error = await action({}).then(
        () => null,
        (e: unknown) => e,
      );
      expect(redirectPath(error), name).toBe("/login");
    }
    expect(await tdb.select().from(auditLog)).toHaveLength(0);
  });

  it("sends an admin who must change the password to the change page", async () => {
    current.user = session({ role: "admin", mustChangePassword: true });
    for (const [name, action] of await load()) {
      const error = await action({}).then(
        () => null,
        (e: unknown) => e,
      );
      expect(redirectPath(error), name).toBe("/change-password");
    }
  });

  it("keeps a teacher out of the platform actions, writing nothing (B-03)", async () => {
    current.user = session({ role: "teacher" });
    const actions = new Map(await load());
    for (const name of ADMIN_ONLY) {
      const action = actions.get(name);
      expect(action, name).toBeDefined();
      const error = await action?.({}).then(
        () => null,
        (e: unknown) => e,
      );
      expect(redirectPath(error), name).toBe("/admin");
    }
    expect(await tdb.select().from(auditLog)).toHaveLength(0);
    expect(cache.updateTag).not.toHaveBeenCalled();
  });

  it("lets a teacher through to validation on teacher actions", async () => {
    current.user = session({ role: "teacher" });
    const actions = new Map(await load());
    for (const name of [
      "classes/actions.addMembers",
      "classes/actions.setLessons",
      "lessons/admin-actions.reorder",
      "students/admin-actions.grantExtraAttempts",
    ])
      expect(await actions.get(name)?.({ id: "nope" }), name).toMatchObject({
        ok: false,
        code: "VALIDATION",
      });
  });

  it("lets a real admin through to validation", async () => {
    current.user = session({ role: "admin" });
    const actions = new Map(await load());
    const grant = actions.get("students/admin-actions.grantExtraAttempts");
    expect(await grant?.({ userId: "nope" })).toMatchObject({
      ok: false,
      code: "VALIDATION",
    });
    const update = actions.get("settings/actions.updateSettings");
    expect(await update?.({ aiDailyBudget: 9999 })).toMatchObject({
      ok: false,
      code: "VALIDATION",
      fieldErrors: { aiDailyBudget: expect.any(String) },
    });
  });
});

describe("a user's own account actions need a usable session (S8-04)", () => {
  async function accountActions() {
    const path = join(featuresDir, "account/actions.ts").replaceAll("\\", "/");
    const mod = (await import(/* @vite-ignore */ path)) as Record<
      string,
      (input?: unknown) => Promise<unknown>
    >;
    return Object.entries(mod);
  }

  it.each([
    ["a visitor", null, "/login"],
    [
      "a student who must change the password",
      session({ mustChangePassword: true }),
      "/change-password",
    ],
  ])("sends %s away from every action, writing nothing", async (_who, user, to) => {
    current.user = user;
    const actions = await accountActions();
    expect(actions.map(([name]) => name).sort()).toEqual([
      "cancelAccountDeletion",
      "createAvatarUploadUrl",
      "removeMyAvatar",
      "requestAccountDeletion",
      "revokeMySession",
      "saveMyAvatar",
      "setMyPrivacy",
      "updateMyProfile",
    ]);
    for (const [name, action] of actions) {
      const error = await action({ leaderboardInitials: true }).then(
        () => null,
        (e: unknown) => e,
      );
      expect(redirectPath(error), name).toBe(to);
    }
    expect(await tdb.select().from(auditLog)).toHaveLength(0);
    expect(cache.updateTag).not.toHaveBeenCalled();
  });
});
