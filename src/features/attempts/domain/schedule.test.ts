import { describe, expect, it } from "vitest";
import { DEADLINE_GRACE_MS } from "./deadline";
import { attemptDeadline, canStart, revealAt, type Schedule } from "./schedule";

const start = new Date("2026-10-20T01:00:00Z");
const at = (min: number) => new Date(start.getTime() + min * 60_000);
const exam: Schedule & { maxAttempts: number | null } = {
  startsAt: start.toISOString(),
  timeLimitSec: 45 * 60,
  revealAnswers: "after_deadline",
  maxAttempts: 1,
};
const none = { used: 0, usedSinceClose: 0, extra: 0 };

describe("revealAt", () => {
  it("is startsAt + limit + grace for a scheduled after_deadline lesson", () => {
    expect(revealAt(exam)).toEqual(
      new Date(at(45).getTime() + DEADLINE_GRACE_MS),
    );
  });

  it("is null otherwise", () => {
    expect(revealAt({ ...exam, revealAnswers: "after_submit" })).toBeNull();
    expect(revealAt({ ...exam, startsAt: null })).toBeNull();
    expect(revealAt({ ...exam, timeLimitSec: null })).toBeNull();
    expect(revealAt({ ...exam, startsAt: "not a date" })).toBeNull();
  });
});

describe("attemptDeadline", () => {
  it("has none without a limit", () => {
    expect(attemptDeadline({ ...exam, timeLimitSec: null }, at(0))).toBeNull();
  });

  it("gives the full limit when unscheduled", () => {
    const s = { ...exam, revealAnswers: "after_submit" as const };
    expect(attemptDeadline(s, at(30))).toEqual(at(75));
  });

  it("ends inside the shared window at startsAt + limit", () => {
    expect(attemptDeadline(exam, at(0))).toEqual(at(45));
    expect(attemptDeadline(exam, at(30))).toEqual(at(45));
  });

  it("gives extra tries after the close their own full time", () => {
    expect(attemptDeadline(exam, at(60))).toEqual(at(105));
  });
});

describe("canStart", () => {
  it("waits for startsAt, for every reveal policy", () => {
    expect(canStart(exam, none, at(-1), false)).toEqual({
      ok: false,
      code: "NOT_OPEN_YET",
      at: start,
    });
    const open = { ...exam, revealAnswers: "after_submit" as const };
    expect(canStart(open, none, at(-1), false)).toMatchObject({
      code: "NOT_OPEN_YET",
    });
    expect(canStart(open, none, at(500), false)).toEqual({ ok: true });
  });

  it("is open inside the window, closed once answers are out", () => {
    expect(canStart(exam, none, at(44), false)).toEqual({ ok: true });
    const close = revealAt(exam) as Date;
    expect(canStart(exam, none, close, false)).toEqual({
      ok: false,
      code: "LESSON_CLOSED",
    });
  });

  it("lets extra tries reopen a closed lesson and lift maxAttempts", () => {
    const took = { used: 1, usedSinceClose: 0, extra: 1 };
    expect(canStart(exam, took, at(60), false)).toEqual({ ok: true });
    expect(
      canStart(exam, { ...took, used: 2, usedSinceClose: 1 }, at(90), false),
    ).toEqual({ ok: false, code: "ATTEMPT_LIMIT" });
    // Missed the exam: one extra try is one attempt.
    expect(canStart(exam, { ...none, extra: 1 }, at(60), false)).toEqual({
      ok: true,
    });
  });

  it("enforces maxAttempts (plus extras) while open", () => {
    expect(canStart(exam, { ...none, used: 1 }, at(10), false)).toEqual({
      ok: false,
      code: "ATTEMPT_LIMIT",
    });
    expect(
      canStart(exam, { ...none, used: 1, extra: 1 }, at(10), false),
    ).toEqual({ ok: true });
    expect(
      canStart(
        { ...exam, maxAttempts: null },
        { ...none, used: 9 },
        at(10),
        false,
      ),
    ).toEqual({ ok: true });
  });

  it("never limits admins", () => {
    expect(canStart(exam, none, at(-10), true)).toEqual({ ok: true });
    expect(canStart(exam, { ...none, used: 5 }, at(600), true)).toEqual({
      ok: true,
    });
  });
});
