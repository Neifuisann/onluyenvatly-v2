import { describe, expect, it } from "vitest";
import { SESSION_COOKIE, sessionCookieOptions } from "./cookie";

describe("sessionCookieOptions", () => {
  it("matches 06 §1", () => {
    expect(SESSION_COOKIE).toBe("ovl_session");
    expect(sessionCookieOptions(true)).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });
  });

  it("can drop Secure for plain-http local dev", () => {
    expect(sessionCookieOptions(false).secure).toBe(false);
  });
});
