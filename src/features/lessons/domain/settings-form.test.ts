import { describe, expect, it } from "vitest";
import { DEFAULT_LESSON_CONFIG, type LessonConfig } from "../schema";
import {
  fromSettingsForm,
  isoToVnLocal,
  type LessonMeta,
  type SettingsForm,
  toSettingsForm,
  vnLocalToIso,
} from "./settings-form";

const meta: LessonMeta = {
  title: "Đề ôn GK1",
  description: null,
  grade: 12,
  chapter: "Dao động cơ",
  tags: ["giữa kì", "ôn tập"],
};
const available = { mcq: 18, tf: 4, short: 6 };
const base = toSettingsForm(meta, DEFAULT_LESSON_CONFIG);
const form = (patch: Partial<SettingsForm>): SettingsForm => ({
  ...base,
  ...patch,
});
const errorsOf = (f: SettingsForm, counts = available) => {
  const r = fromSettingsForm(f, counts);
  return r.ok ? {} : r.errors;
};

describe("Vietnam time helpers", () => {
  it("converts both ways at UTC+7", () => {
    expect(isoToVnLocal("2026-10-20T00:30:00Z")).toBe("2026-10-20T07:30");
    expect(isoToVnLocal("2026-10-20T07:30:00+07:00")).toBe("2026-10-20T07:30");
    expect(vnLocalToIso("2026-10-20T07:30")).toBe("2026-10-20T07:30:00+07:00");
    expect(vnLocalToIso("2026-10-20T07:30:15")).toBe(
      "2026-10-20T07:30:00+07:00",
    );
  });

  it("rejects junk", () => {
    expect(isoToVnLocal(null)).toBe("");
    expect(isoToVnLocal("không phải ngày")).toBe("");
    expect(vnLocalToIso("20/10/2026 07:30")).toBeNull();
    expect(vnLocalToIso("2026-13-45T99:99")).toBeNull();
  });
});

describe("round trip", () => {
  it("gives back the same metadata and config", () => {
    expect(fromSettingsForm(base, available)).toEqual({
      ok: true,
      meta,
      config: DEFAULT_LESSON_CONFIG,
    });
  });

  it("keeps every option through the form", () => {
    const config: LessonConfig = {
      timeLimitSec: 2730,
      shuffleQuestions: true,
      shuffleOptions: true,
      pool: { enabled: true, byType: { mcq: 12, short: 4 } },
      points: { mode: "per-type-total", mcq: 3, tf: 4, short: 3 },
      maxAttempts: 2,
      startsAt: "2026-10-20T07:30:00+07:00",
      revealAnswers: "after_deadline",
      countsForRating: false,
      examGuard: true,
      tfScoring: "proportional",
    };
    const f = toSettingsForm({ ...meta, description: "Mô tả" }, config);
    expect(f.timeLimitMin).toBe("45,5");
    expect(f.poolMode).toBe("byType");
    expect(fromSettingsForm(f, available)).toEqual({
      ok: true,
      meta: { ...meta, description: "Mô tả" },
      config,
    });
    const sized = toSettingsForm(meta, {
      ...config,
      pool: { enabled: true, size: 20 },
    });
    expect(sized.poolMode).toBe("size");
    expect(fromSettingsForm(sized, available)).toMatchObject({
      ok: true,
      config: { pool: { enabled: true, size: 20 } },
    });
  });

  it("cleans metadata: spaces, empty values, duplicate tags", () => {
    const r = fromSettingsForm(
      form({
        title: "  Đề   ôn ",
        description: "  ",
        grade: "",
        chapter: " ",
        tags: " a, b ,, a ",
      }),
    );
    expect(r).toMatchObject({
      ok: true,
      meta: {
        title: "Đề ôn",
        description: null,
        grade: null,
        chapter: null,
        tags: ["a", "b"],
      },
    });
  });
});

describe("blocked with messages", () => {
  it("metadata limits", () => {
    expect(errorsOf(form({ title: "  " })).title).toBe("Nhập tên bài.");
    expect(errorsOf(form({ title: "x".repeat(201) })).title).toBeDefined();
    expect(
      errorsOf(form({ description: "x".repeat(2001) })).description,
    ).toBeDefined();
    expect(errorsOf(form({ chapter: "x".repeat(101) })).chapter).toBeDefined();
    expect(errorsOf(form({ tags: "x".repeat(51) })).tags).toBeDefined();
  });

  it("time limit, attempts and start time", () => {
    expect(errorsOf(form({ timeLimitMin: "0" })).timeLimitMin).toBeDefined();
    expect(errorsOf(form({ timeLimitMin: "361" })).timeLimitMin).toBeDefined();
    expect(errorsOf(form({ timeLimitMin: "abc" })).timeLimitMin).toBeDefined();
    expect(errorsOf(form({ maxAttempts: "1,5" })).maxAttempts).toBeDefined();
    expect(errorsOf(form({ maxAttempts: "0" })).maxAttempts).toBeDefined();
    expect(errorsOf(form({ startsAt: "mai" })).startsAt).toBeDefined();
  });

  it("a pool bigger than the content", () => {
    expect(errorsOf(form({ poolMode: "size", poolSize: "29" })).poolSize).toBe(
      "Bài chỉ có 28 câu, không lấy được nhiều hơn.",
    );
    expect(errorsOf(form({ poolMode: "size", poolSize: "" })).poolSize).toBe(
      "Số câu mỗi lượt là số nguyên từ 1 đến 200.",
    );
    expect(
      errorsOf(
        form({
          poolMode: "byType",
          poolByType: { mcq: "19", tf: "", short: "x" },
        }),
      ),
    ).toEqual({
      "poolByType.mcq": "Loại này chỉ có 18 câu.",
      "poolByType.short": "Nhập số nguyên từ 0.",
    });
    // Unknown content (nothing saved yet): only the shape is checked.
    expect(
      fromSettingsForm(form({ poolMode: "size", poolSize: "40" })).ok,
    ).toBe(true);
  });

  it("an empty pool or points split", () => {
    expect(
      errorsOf(
        form({
          poolMode: "byType",
          poolByType: { mcq: "0", tf: "", short: "" },
        }),
      ).poolMode,
    ).toBeDefined();
    expect(
      errorsOf(form({ pointsMode: "per-type-total" })).pointsMode,
    ).toBeDefined();
    expect(
      errorsOf(
        form({
          pointsMode: "per-type-total",
          pointsByType: { mcq: "0,255", tf: "101", short: "0,29" },
        }),
      ),
    ).toEqual({
      "pointsByType.mcq": "Tổng điểm từ 0 đến 100, tối đa 2 chữ số thập phân.",
      "pointsByType.tf": "Tổng điểm từ 0 đến 100, tối đa 2 chữ số thập phân.",
    });
  });

  it("answers after a shared deadline need a start and a limit", () => {
    expect(errorsOf(form({ revealAnswers: "after_deadline" }))).toEqual({
      startsAt: "Công bố đáp án sau giờ làm bài chung cần có giờ mở bài.",
      timeLimitMin:
        "Công bố đáp án sau giờ làm bài chung cần có thời gian làm bài.",
    });
    expect(
      fromSettingsForm(
        form({
          revealAnswers: "after_deadline",
          startsAt: "2026-10-20T07:30",
          timeLimitMin: "45",
        }),
      ),
    ).toMatchObject({
      ok: true,
      config: {
        startsAt: "2026-10-20T07:30:00+07:00",
        timeLimitSec: 2700,
      },
    });
  });
});
