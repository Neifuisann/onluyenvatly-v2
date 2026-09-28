import { describe, expect, it } from "vitest";
import { LegacyLessonIdSchema, LessonIdSchema } from "./lesson-params";

describe("lesson route parameters", () => {
  it("accepts safe positive ids and bounds legacy keys", () => {
    expect(LessonIdSchema.parse("123")).toBe(123);
    expect(LegacyLessonIdSchema.parse("1720000000000")).toBe("1720000000000");
    expect(LegacyLessonIdSchema.safeParse("").success).toBe(false);
    expect(LegacyLessonIdSchema.safeParse("x".repeat(101)).success).toBe(false);
  });
  it.each([
    "0",
    "-1",
    "1.5",
    "1e2",
    "01",
    "abc",
    "9007199254740992",
  ])("rejects invalid or unsafe id %s", (id) => {
    expect(LessonIdSchema.safeParse(id).success).toBe(false);
  });
});
