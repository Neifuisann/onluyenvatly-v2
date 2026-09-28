import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  requireAdmin,
  requireSessionUser,
  requireStudent,
  requireUser,
} from "./guards";
import type { SessionUser } from "./session";

const current = vi.hoisted(() => ({ user: null as SessionUser | null }));
vi.mock("./queries", () => ({ getCurrentUser: async () => current.user }));

const user = (patch: Partial<SessionUser> = {}): SessionUser => ({
  id: "u1",
  role: "student",
  fullName: "Học Sinh",
  grade: 12,
  mustChangePassword: false,
  sessionId: "s",
  ...patch,
});

/** Where a guard sends the caller: the `redirect()` target, or null if it returned. */
async function target(guard: () => Promise<unknown>): Promise<string | null> {
  try {
    await guard();
    return null;
  } catch (error) {
    const digest = (error as { digest?: string }).digest ?? "";
    if (!digest.startsWith("NEXT_REDIRECT;")) throw error;
    return digest.split(";")[2] ?? null;
  }
}

beforeEach(() => {
  current.user = null;
});

describe("guards", () => {
  it("send visitors to login", async () => {
    for (const guard of [
      requireUser,
      requireStudent,
      requireAdmin,
      requireSessionUser,
    ])
      expect(await target(guard)).toBe("/login");
  });

  it("let students into student pages and keep them out of admin pages", async () => {
    current.user = user();
    expect(await target(requireUser)).toBeNull();
    expect(await target(requireStudent)).toBeNull();
    expect(await target(requireAdmin)).toBe("/dashboard");
  });

  it("let admins into both", async () => {
    current.user = user({ role: "admin" });
    expect(await target(requireStudent)).toBeNull();
    expect(await target(requireAdmin)).toBeNull();
  });

  it("send a user with must_change_password to the change page, from every guard but the change page's own", async () => {
    for (const role of ["student", "admin"] as const) {
      current.user = user({ role, mustChangePassword: true });
      expect(await target(requireUser)).toBe("/change-password");
      expect(await target(requireStudent)).toBe("/change-password");
      expect(await target(requireAdmin)).toBe("/change-password");
      // The change page and its action use this one.
      expect(await target(requireSessionUser)).toBeNull();
    }
  });
});
