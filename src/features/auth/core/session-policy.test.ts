import { describe, expect, it } from "vitest";
import {
  checkSession,
  LAST_SEEN_INTERVAL_MS,
  SESSION_TTL_MS,
  sessionExpiry,
} from "./session-policy";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-10-12T08:00:00Z");
const at = (offsetMs: number) => new Date(now.getTime() + offsetMs);

describe("sessionExpiry", () => {
  it("is 30 days from now", () => {
    expect(sessionExpiry(now).getTime() - now.getTime()).toBe(SESSION_TTL_MS);
    expect(SESSION_TTL_MS).toBe(30 * DAY);
  });
});

describe("checkSession", () => {
  it("expires at or after expires_at", () => {
    expect(checkSession({ expiresAt: now, lastSeenAt: at(-DAY) }, now)).toEqual(
      {
        kind: "expired",
      },
    );
    expect(
      checkSession({ expiresAt: at(-1), lastSeenAt: at(-DAY) }, now).kind,
    ).toBe("expired");
  });

  it("does nothing for a fresh session seen recently", () => {
    expect(
      checkSession({ expiresAt: at(29 * DAY), lastSeenAt: at(-60_000) }, now),
    ).toEqual({
      kind: "valid",
    });
  });

  it("touches last_seen_at at most once an hour", () => {
    expect(
      checkSession(
        { expiresAt: at(29 * DAY), lastSeenAt: at(-LAST_SEEN_INTERVAL_MS + 1) },
        now,
      ),
    ).toEqual({ kind: "valid" });
    expect(
      checkSession(
        { expiresAt: at(29 * DAY), lastSeenAt: at(-LAST_SEEN_INTERVAL_MS) },
        now,
      ),
    ).toEqual({ kind: "valid", lastSeenAt: now });
  });

  it("slides the expiry when fewer than 15 days remain", () => {
    expect(
      checkSession({ expiresAt: at(15 * DAY), lastSeenAt: now }, now),
    ).toEqual({
      kind: "valid",
    });
    expect(
      checkSession({ expiresAt: at(15 * DAY - 1), lastSeenAt: now }, now),
    ).toEqual({
      kind: "valid",
      expiresAt: sessionExpiry(now),
      lastSeenAt: now,
    });
  });
});
