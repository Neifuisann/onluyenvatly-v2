import { describe, expect, it } from "vitest";
import { parseLessonText } from "@/features/lessons/domain/parser";
import {
  fitWithin,
  imageMarkup,
  MAX_UPLOAD_BYTES,
  mediaObjectPath,
  UploadRequestSchema,
} from "./upload";

describe("fitWithin", () => {
  it("scales the longest side down to 1280 and keeps the ratio", () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1280, height: 960 });
    expect(fitWithin(1000, 5000)).toEqual({ width: 256, height: 1280 });
  });
  it("never scales up and never reaches zero", () => {
    expect(fitWithin(640, 360)).toEqual({ width: 640, height: 360 });
    expect(fitWithin(100_000, 10)).toEqual({ width: 1280, height: 1 });
  });
});

describe("mediaObjectPath", () => {
  it("files by UTC year and month with the type's extension", () => {
    const id = "0b6c3f0e-8a55-4d0c-9a0f-6a1f0c2b7d11";
    expect(
      mediaObjectPath(new Date("2026-09-30T23:30:00Z"), id, "image/webp"),
    ).toBe(`2026/09/${id}.webp`);
    expect(
      mediaObjectPath(new Date("2026-10-01T00:00:00Z"), id, "image/jpeg"),
    ).toBe(`2026/10/${id}.jpg`);
  });
});

describe("imageMarkup", () => {
  it("writes a line the lesson parser reads back as the stem image", () => {
    const line = imageMarkup("2026/09/a.webp", { width: 640, height: 360 });
    expect(line).toBe("![](media:2026/09/a.webp =640x360)");
    const { questions, issues } = parseLessonText(
      `Câu 1: Hình bên\n${line}\nAnswer: 1`,
    );
    expect(issues).toEqual([]);
    expect(questions[0]?.image).toEqual({
      path: "2026/09/a.webp",
      w: 640,
      h: 360,
    });
    expect(imageMarkup("x.png", undefined, "hình")).toBe(
      "![hình](media:x.png)",
    );
  });
});

describe("UploadRequestSchema", () => {
  const ok = { contentType: "image/webp", bytes: 1000, width: 10, height: 10 };
  it("accepts resized images only", () => {
    expect(UploadRequestSchema.safeParse(ok).success).toBe(true);
    for (const bad of [
      { ...ok, contentType: "image/svg+xml" },
      { ...ok, bytes: MAX_UPLOAD_BYTES + 1 },
      { ...ok, width: 1281 },
      { ...ok, bytes: 0 },
      { ...ok, extra: 1 },
    ])
      expect(UploadRequestSchema.safeParse(bad).success).toBe(false);
  });
});
