import { describe, expect, it } from "vitest";
import type { PublicQuestion } from "./public-question";
import {
  previewQuestions,
  SHARE_PREVIEW_COUNT,
  sharesQuestions,
} from "./share";

const q = (id: string): PublicQuestion => ({ id, type: "short", stem: id });

describe("sharesQuestions", () => {
  it("shows questions of an ordinary lesson only", () => {
    expect(sharesQuestions({ examGuard: false, startsAt: null })).toBe(true);
    expect(sharesQuestions({ examGuard: true, startsAt: null })).toBe(false);
    expect(
      sharesQuestions({
        examGuard: false,
        startsAt: "2026-10-01T07:00:00+07:00",
      }),
    ).toBe(false);
  });
});

describe("previewQuestions", () => {
  it("takes the first two in order", () => {
    expect(SHARE_PREVIEW_COUNT).toBe(2);
    expect(previewQuestions([q("a"), q("b"), q("c")]).map((x) => x.id)).toEqual(
      ["a", "b"],
    );
    expect(previewQuestions([q("a")])).toHaveLength(1);
    expect(previewQuestions([q("a")], -1)).toEqual([]);
  });
});
