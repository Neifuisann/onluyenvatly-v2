import { describe, expect, it } from "vitest";
import { foldVietnamese, lessonTopic } from "./topic";

describe("foldVietnamese", () => {
  it("drops diacritics, đ and case", () => {
    expect(foldVietnamese("  Dòng  ĐIỆN không đổi ")).toBe(
      "dong dien khong doi",
    );
  });
});

describe("lessonTopic", () => {
  it.each([
    ["Dao động cơ", "oscillation"],
    ["Dao động điện từ", "oscillation"],
    ["Sóng cơ", "wave"],
    ["Sóng điện từ", "wave"],
    ["Dòng điện không đổi", "current"],
    ["Điện trường", "electric"],
    ["Từ trường", "magnetic"],
    ["Cảm ứng điện từ", "magnetic"],
    ["Khúc xạ ánh sáng", "optics"],
    ["Vật lí nhiệt", "thermal"],
    ["Khí lí tưởng", "thermal"],
    ["Vật lí hạt nhân", "nuclear"],
    ["Động học", "kinematics"],
    ["Động lực học", "dynamics"],
    ["Năng lượng, công và công suất", "energy"],
    ["Ôn tập giữa kì 1", "review"],
  ] as const)("%s → %s", (chapter, topic) => {
    expect(lessonTopic(chapter)).toBe(topic);
  });

  it("falls back to the title, then to general", () => {
    expect(lessonTopic(null, "Đề ôn tập con lắc lò xo")).toBe("oscillation");
    expect(lessonTopic(null, "Bài luyện 01")).toBe("general");
    expect(lessonTopic("", "")).toBe("general");
  });

  it("matches whole words only", () => {
    expect(lessonTopic("Lucky")).toBe("general");
  });
});
