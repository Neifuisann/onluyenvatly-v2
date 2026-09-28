import { describe, expect, it } from "vitest";
import { mediaUrl } from "./media";

describe("mediaUrl", () => {
  it("joins the bucket URL and an encoded path", () => {
    expect(mediaUrl("2026/09/a b.webp", "https://x.supabase.co/m/")).toBe(
      "https://x.supabase.co/m/2026/09/a%20b.webp",
    );
  });

  it("returns null without a bucket URL", () => {
    expect(mediaUrl("a.webp", undefined)).toBeNull();
  });
});
