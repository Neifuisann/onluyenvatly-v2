import { describe, expect, it } from "vitest";
import {
  AddMembersSchema,
  ClassFormSchema,
  lessonChanges,
  parsePhoneList,
  SetLessonsSchema,
} from "./classes";

describe("parsePhoneList", () => {
  it("reads one phone per line or separated by commas and semicolons", () => {
    expect(
      parsePhoneList("0912 345 678\n+84 987 654 321, 0912.345.679;\n\n"),
    ).toEqual({
      phones: ["0912345678", "0987654321", "0912345679"],
      invalid: [],
    });
  });

  it("drops duplicates, keeping the first position", () => {
    expect(
      parsePhoneList("0912345678\n0912 345 678\n84912345678").phones,
    ).toEqual(["0912345678"]);
  });

  it("returns what isn't a phone number as typed", () => {
    expect(parsePhoneList("Nguyễn Văn A\n0912345678\n12345")).toEqual({
      phones: ["0912345678"],
      invalid: ["Nguyễn Văn A", "12345"],
    });
  });

  it("is empty for blank input", () => {
    expect(parsePhoneList(" \n , ; ")).toEqual({ phones: [], invalid: [] });
  });
});

describe("ClassFormSchema", () => {
  const valid = {
    name: "  Vật lý   12A1 ",
    subject: "physics",
    grade: "12",
    description: "",
  };

  it("cleans the name and maps grade and an empty description", () => {
    expect(ClassFormSchema.parse(valid)).toEqual({
      name: "Vật lý 12A1",
      subject: "physics",
      grade: 12,
      description: null,
    });
    expect(ClassFormSchema.parse({ ...valid, grade: "" }).grade).toBeNull();
  });

  it.each([
    { name: "   " },
    { name: "x".repeat(81) },
    { subject: "alchemy" },
    { grade: "9" },
    { description: "x".repeat(301) },
  ])("refuses %o", (patch) => {
    expect(ClassFormSchema.safeParse({ ...valid, ...patch }).success).toBe(
      false,
    );
  });
});

describe("action inputs", () => {
  it("coerce the class id and refuse duplicate lessons", () => {
    expect(AddMembersSchema.parse({ id: "7", phones: "" }).id).toBe(7);
    expect(
      SetLessonsSchema.safeParse({ id: 1, lessonIds: [1, 2, 1] }).success,
    ).toBe(false);
    expect(SetLessonsSchema.safeParse({ id: 0, lessonIds: [] }).success).toBe(
      false,
    );
  });
});

describe("lessonChanges", () => {
  it("lists what to give and what to take back", () => {
    expect(lessonChanges([1, 2, 3], [3, 4, 1])).toEqual({
      add: [4],
      remove: [2],
    });
    expect(lessonChanges([], [])).toEqual({ add: [], remove: [] });
  });
});
