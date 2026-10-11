import { describe, expect, it } from "vitest";
import {
  afterJoinPath,
  generateJoinCode,
  JOIN_CODE_ALPHABET,
  JOIN_CODE_LENGTH,
  JoinClassSchema,
  JoinCodeSchema,
  JoinLessonParamSchema,
  joinPath,
} from "./invite";

describe("generateJoinCode", () => {
  it("draws eight characters from the unambiguous alphabet", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateJoinCode();
      expect(code).toHaveLength(JOIN_CODE_LENGTH);
      expect(JoinCodeSchema.parse(code)).toBe(code);
    }
  });

  it("skips bytes that would bias the draw and asks for more", () => {
    const batches = [
      new Uint8Array(16).fill(255),
      Uint8Array.from({ length: 16 }, (_, i) => i),
    ];
    const code = generateJoinCode(() => batches.shift() ?? new Uint8Array(16));
    expect(code).toBe(JOIN_CODE_ALPHABET.slice(0, 8));
  });
});

describe("JoinCodeSchema", () => {
  it("accepts any case and stray spaces or dashes", () => {
    expect(JoinCodeSchema.parse(" abcd-efgh ")).toBe("ABCDEFGH");
  });

  it("refuses ambiguous characters and wrong lengths", () => {
    expect(JoinCodeSchema.safeParse("ABCDEFG0").success).toBe(false);
    expect(JoinCodeSchema.safeParse("ABCDEFGI").success).toBe(false);
    expect(JoinCodeSchema.safeParse("ABCDEFG").success).toBe(false);
  });
});

describe("JoinLessonParamSchema", () => {
  it("reads a lesson id and ignores anything else", () => {
    expect(JoinLessonParamSchema.parse("186")).toBe(186);
    expect(JoinLessonParamSchema.parse(undefined)).toBeUndefined();
    expect(JoinLessonParamSchema.parse("abc")).toBeUndefined();
    expect(JoinLessonParamSchema.parse(["1", "2"])).toBeUndefined();
  });
});

describe("JoinClassSchema", () => {
  it("takes a code and an optional lesson", () => {
    expect(JoinClassSchema.parse({ code: "abcdefgh", lessonId: 7 })).toEqual({
      code: "ABCDEFGH",
      lessonId: 7,
    });
    expect(JoinClassSchema.parse({ code: "ABCDEFGH" })).toEqual({
      code: "ABCDEFGH",
    });
  });
});

describe("join paths", () => {
  it("builds the link a teacher sends", () => {
    expect(joinPath("ABCDEFGH")).toBe("/join/ABCDEFGH");
    expect(joinPath("ABCDEFGH", 186)).toBe("/join/ABCDEFGH?bai=186");
  });

  it("opens the lesson only when the class has it", () => {
    expect(afterJoinPath(3, 186, true)).toBe("/lessons/186");
    expect(afterJoinPath(3, 186, false)).toBe("/classes/3");
    expect(afterJoinPath(3, undefined, false)).toBe("/classes/3");
  });
});
