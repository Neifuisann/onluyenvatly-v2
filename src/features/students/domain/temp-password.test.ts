import { randomInt } from "node:crypto";
import { describe, expect, it } from "vitest";
import { passwordIssue } from "../../auth/core/password";
import { generateTempPassword, TEMP_PASSWORD_LENGTH } from "./temp-password";

/** A `randomInt` that returns `values` in turn (indexes into the alphabet). */
const sequence = (values: number[]) => {
  let i = 0;
  return (max: number) => (values[i++] ?? 0) % max;
};

// Alphabet: 24 upper case, 24 lower case, then the digits 2–9 at 48–55.
const GOOD = [0, 48, 1, 49, 2, 50, 3, 51, 4, 52]; // A2B3C4D5E6

describe("generateTempPassword", () => {
  it("is 10 characters without look-alikes, with a letter and a digit", () => {
    for (let i = 0; i < 200; i++) {
      const p = generateTempPassword(randomInt);
      expect(p).toHaveLength(TEMP_PASSWORD_LENGTH);
      expect(p).toMatch(/^[A-HJ-NP-Za-km-np-z2-9]+$/);
      expect(p).toMatch(/[A-Za-z]/);
      expect(p).toMatch(/\d/);
      expect(passwordIssue(p)).toBeNull();
    }
  });

  it("draws every character from the random source", () => {
    expect(generateTempPassword(sequence(GOOD))).toBe("A2B3C4D5E6");
  });

  it("throws away a draw without a digit", () => {
    const noDigit = Array(10).fill(0); // AAAAAAAAAA
    expect(generateTempPassword(sequence([...noDigit, ...GOOD]))).toBe(
      "A2B3C4D5E6",
    );
  });

  it("throws away a draw without a letter", () => {
    const noLetter = Array(10).fill(48); // 2222222222
    expect(generateTempPassword(sequence([...noLetter, ...GOOD]))).toBe(
      "A2B3C4D5E6",
    );
  });

  it("throws away a draw that contains the student's phone", () => {
    // "A922334455" holds the phone without its leading zero.
    const withPhone = [0, 55, 48, 48, 49, 49, 50, 50, 51, 51];
    expect(
      generateTempPassword(sequence([...withPhone, ...GOOD]), "0922334455"),
    ).toBe("A2B3C4D5E6");
    expect(generateTempPassword(sequence(withPhone))).toBe("A922334455");
  });
});
