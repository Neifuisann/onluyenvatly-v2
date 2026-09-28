import { describe, expect, it } from "vitest";
import {
  anonymize,
  createPseudonymizer,
  findPhoneLikeStrings,
} from "./anonymize";

describe("anonymize", () => {
  it("drops PII keys at any depth and pseudonymizes student refs", () => {
    const pseudo = createPseudonymizer();
    const row = {
      id: 7,
      student_id: "abc",
      ip_address: "1.2.3.4",
      students: { full_name: "Nguyễn Văn A" },
      questions: [{ question: "Câu 1", studentId: "abc", name: "x" }],
    };
    expect(anonymize(row, pseudo)).toEqual({
      id: 7,
      student_id: "student_001",
      questions: [{ question: "Câu 1", studentId: "student_001" }],
    });
  });

  it("keeps pseudonyms stable across rows", () => {
    const pseudo = createPseudonymizer();
    expect(pseudo("a")).toBe("student_001");
    expect(pseudo("b")).toBe("student_002");
    expect(pseudo(" a".trim())).toBe("student_001");
    expect(pseudo(null)).toBeNull();
  });

  it("serializes dates", () => {
    const d = new Date("2026-01-02T03:04:05Z");
    expect(anonymize({ t: d }, createPseudonymizer())).toEqual({
      t: "2026-01-02T03:04:05.000Z",
    });
  });
});

describe("findPhoneLikeStrings", () => {
  it("flags VN phone numbers left in free text", () => {
    expect(
      findPhoneLikeStrings({ a: "gọi 0912 345 678", b: ["+84912345678"] }),
    ).toEqual(["$.a", "$.b[0]"]);
  });

  it("ignores physics numbers", () => {
    expect(findPhoneLikeStrings({ q: "v = 3.10^8 m/s, t = 12,5 s" })).toEqual(
      [],
    );
  });
});
