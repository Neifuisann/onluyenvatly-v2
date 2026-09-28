import { describe, expect, it } from "vitest";
import { isSameOrigin } from "./same-origin";

const url = "https://onluyenvatly.vn/api/attempts/x/save";
const h = (init: Record<string, string>) => new Headers(init);

describe("isSameOrigin", () => {
  it("accepts our own Origin", () => {
    expect(isSameOrigin(h({ origin: "https://onluyenvatly.vn" }), url)).toBe(
      true,
    );
  });

  it("rejects other origins, lookalikes and null", () => {
    for (const origin of [
      "https://evil.example",
      "https://onluyenvatly.vn.evil.example",
      "http://onluyenvatly.vn",
      "null",
    ])
      expect(isSameOrigin(h({ origin }), url)).toBe(false);
  });

  it("falls back to Sec-Fetch-Site, refusing requests with neither", () => {
    expect(isSameOrigin(h({ "sec-fetch-site": "same-origin" }), url)).toBe(
      true,
    );
    expect(isSameOrigin(h({ "sec-fetch-site": "cross-site" }), url)).toBe(
      false,
    );
    expect(isSameOrigin(h({}), url)).toBe(false);
  });

  it("refuses when the request URL can't be parsed", () => {
    expect(isSameOrigin(h({ origin: "https://a.vn" }), "not a url")).toBe(
      false,
    );
  });
});
