import { describe, expect, it } from "vitest";
import { fieldErrorsOf, LoginSchema, RegisterSchema } from "./schemas";

const valid = {
  fullName: "  Nguyễn   Văn An ",
  phone: "0912 345 678",
  dateOfBirth: "2009-05-17",
  grade: "12",
  className: "12a1",
  password: "vatly-2026",
};

describe("RegisterSchema", () => {
  it("normalizes a valid registration", () => {
    expect(RegisterSchema.parse(valid)).toEqual({
      fullName: "Nguyễn Văn An",
      phone: "0912345678",
      dateOfBirth: "2009-05-17",
      grade: 12,
      className: "12A1",
      password: "vatly-2026",
    });
  });

  it("makes grade and class optional", () => {
    const out = RegisterSchema.parse({ ...valid, grade: "", className: "" });
    expect(out.grade).toBeNull();
    expect(out.className).toBeNull();
  });

  it.each([
    [{ fullName: "A" }, "fullName"],
    [{ phone: "12345" }, "phone"],
    [{ phone: "" }, "phone"],
    [{ dateOfBirth: "2009-02-30" }, "dateOfBirth"],
    [{ dateOfBirth: "17/05/2009" }, "dateOfBirth"],
    [{ dateOfBirth: "2999-01-01" }, "dateOfBirth"],
    [{ dateOfBirth: "1900-01-01" }, "dateOfBirth"],
    [{ grade: "9" }, "grade"],
    [{ className: "x".repeat(21) }, "className"],
    [{ password: "12345678" }, "password"],
    [{ password: "a0912345678" }, "password"],
    [{ password: "short" }, "password"],
  ])("reports %j on its field", (patch, field) => {
    const result = RegisterSchema.safeParse({ ...valid, ...patch });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(Object.keys(fieldErrorsOf(result.error))).toContain(field);
  });
});

describe("LoginSchema", () => {
  it("requires both fields", () => {
    const result = LoginSchema.safeParse({ identifier: " ", password: "" });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(Object.keys(fieldErrorsOf(result.error)).sort()).toEqual([
        "identifier",
        "password",
      ]);
  });
});
