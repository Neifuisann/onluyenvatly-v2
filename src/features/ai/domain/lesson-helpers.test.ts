import { describe, expect, it } from "vitest";
import type { Question } from "../../lessons/schema.ts";
import {
  cleanDescription,
  DIGEST_MAX_CHARS,
  DIGEST_MAX_QUESTIONS,
  descriptionPrompt,
  lessonDigest,
  MAX_DESCRIPTION_CHARS,
  MAX_TAGS,
  mergeTags,
  parseTags,
  SUGGESTED_TAGS,
  tagsPrompt,
} from "./lesson-helpers";

const mcq = (id: string, stem: string): Question => ({
  id,
  type: "mcq",
  stem,
  options: [{ text: "Đáp án bí mật" }, { text: "b" }],
  answer: 0,
});
const topic = {
  title: "  Dao động   điều hòa ",
  grade: 12,
  chapter: "Dao động cơ",
  questions: [
    mcq("q_1", "Chu kì của con lắc ![](media:a.webp =10x10) là gì?"),
    {
      id: "q_2",
      type: "tf",
      stem: "",
      image: { path: "b.webp" },
      statements: [{ text: "s", answer: true }],
    },
    { id: "q_3", type: "short", stem: "Tính $f$.", answer: "2" },
  ] satisfies Question[],
};

describe("lessonDigest", () => {
  it("lists title, grade, chapter, counts and stems without answers", () => {
    const d = lessonDigest(topic);
    expect(d).toContain("Tên bài: Dao động điều hòa");
    expect(d).toContain("Khối: lớp 12");
    expect(d).toContain("Chương: Dao động cơ");
    expect(d).toContain(
      "Số câu: 3 (trắc nghiệm 1, đúng/sai 1, trả lời ngắn 1)",
    );
    expect(d).toContain("1. Chu kì của con lắc là gì?");
    expect(d).toContain("2. (hình)");
    expect(d).toContain("3. Tính $f$.");
    expect(d).not.toContain("bí mật");
    expect(d).not.toContain("media:");
  });

  it("leaves out a missing grade or chapter", () => {
    const d = lessonDigest({ ...topic, grade: null, chapter: "  " });
    expect(d).not.toContain("Khối");
    expect(d).not.toContain("Chương");
    expect(lessonDigest({ ...topic, chapter: null })).not.toContain("Chương");
  });

  it("caps the number of stems, their length and the total", () => {
    const many = Array.from({ length: 40 }, (_, i) =>
      mcq(`q_${i}`, `Câu ${i} ${"x".repeat(i === 0 ? 400 : 10)}`),
    );
    const d = lessonDigest({ ...topic, questions: many });
    expect(d).toContain("…");
    expect(d).not.toContain(`${DIGEST_MAX_QUESTIONS + 1}. Câu`);
    const long = Array.from({ length: 15 }, (_, i) =>
      mcq(`q_${i}`, "y".repeat(290)),
    );
    const capped = lessonDigest({ ...topic, questions: long });
    expect(capped.length).toBeLessThanOrEqual(DIGEST_MAX_CHARS);
    expect(capped.split("\n").filter((l) => /^\d+\. /.test(l)).length).toBe(9);
  });
});

describe("prompts", () => {
  it("asks for one short paragraph", () => {
    const p = descriptionPrompt(topic);
    expect(p).toContain("Tên bài: Dao động điều hòa");
    expect(p).toContain("tối đa 60 từ");
  });

  it("offers known tags only when there are some", () => {
    expect(tagsPrompt(topic, [])).not.toContain("Ưu tiên");
    const p = tagsPrompt(topic, ["dao động", "ôn tập"]);
    expect(p).toContain("Ưu tiên dùng lại đúng các thẻ đã có");
    expect(p).toContain("dao động, ôn tập");
    expect(p).toContain(`tối đa ${SUGGESTED_TAGS} thẻ`);
  });
});

describe("cleanDescription", () => {
  it("flattens markdown into one plain paragraph", () => {
    expect(
      cleanDescription(
        '"## Bài ôn\n- **Dao động** điều hòa\n1. con lắc `lò xo`\n![](media:x)"',
      ),
    ).toBe("Bài ôn Dao động điều hòa con lắc lò xo");
  });

  it("cuts a long text at a word", () => {
    const words = Array.from({ length: 200 }, (_, i) => `từ${i}`).join(" ");
    const out = cleanDescription(words);
    expect(out.length).toBeLessThanOrEqual(MAX_DESCRIPTION_CHARS);
    expect(out.endsWith("…")).toBe(true);
    expect(out).not.toMatch(/ …$/);
    const oneWord = cleanDescription("a".repeat(1000));
    expect(oneWord).toHaveLength(MAX_DESCRIPTION_CHARS);
  });
});

describe("parseTags", () => {
  it("splits, strips markers and keeps the catalog's spelling", () => {
    expect(
      parseTags(
        '- Dao Động, **ôn tập**;\n1. Con lắc lò xo.\n"Giữa kì", dao động',
        ["dao động", "Giữa kì"],
      ),
    ).toEqual(["dao động", "ôn tập", "con lắc lò xo", "Giữa kì"]);
  });

  it("drops empty and over-long tags and stops at the limit", () => {
    const text = [
      "",
      "x".repeat(51),
      ...Array.from({ length: 9 }, (_, i) => `t${i}`),
    ].join(",");
    const tags = parseTags(text, []);
    expect(tags).toHaveLength(SUGGESTED_TAGS);
    expect(tags[0]).toBe("t0");
  });
});

describe("mergeTags", () => {
  it("adds only new tags", () => {
    expect(mergeTags("ôn tập, Dao động", ["dao động", "con lắc", ""])).toEqual({
      value: "ôn tập, Dao động, con lắc",
      added: 1,
    });
    expect(mergeTags("", ["a", "a"])).toEqual({ value: "a", added: 1 });
  });

  it("stays within the form's tag limit", () => {
    const full = Array.from({ length: MAX_TAGS }, (_, i) => `t${i}`).join(", ");
    expect(mergeTags(full, ["mới"]).added).toBe(0);
  });
});
