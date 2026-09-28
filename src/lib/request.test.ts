import { describe, expect, it } from "vitest";
import { parseClientIp } from "./request";

describe("parseClientIp", () => {
  it.each([
    ["1.2.3.4", "1.2.3.4"],
    ["1.2.3.4, 10.0.0.1", "1.2.3.4"],
    [" 203.0.113.9 ", "203.0.113.9"],
    ["2001:db8::1", "2001:db8::1"],
    ["::1", "::1"],
  ])("%j → %j", (input, expected) => {
    expect(parseClientIp(input)).toBe(expected);
  });

  it.each([
    null,
    "",
    "unknown",
    "999.1.1.1",
    "1.2.3",
    "a:b:zz",
    "<script>",
  ])("rejects %j", (input) => {
    expect(parseClientIp(input)).toBeNull();
  });
});
