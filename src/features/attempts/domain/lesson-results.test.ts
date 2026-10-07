import { describe, expect, it } from "vitest";
import {
  filterStudents,
  type LessonStudent,
  summarizeStudents,
} from "./lesson-results";

const student = (
  fullName: string,
  latestScore10: number | null,
  submitted: string,
  attempts = 1,
): LessonStudent => ({
  userId: fullName,
  fullName,
  className: null,
  grade: null,
  attempts,
  latestScore10,
  bestScore10: latestScore10,
  latestTimeTakenSec: 60,
  latestSubmittedAt: new Date(submitted),
});

const rows = [
  student("Nguyễn Thị Thu Hương", 0, "2025-04-22T08:00:00Z", 2),
  student("Lê Thị Tú Uyên", 8.77, "2025-04-21T05:54:00Z"),
  student("Nguyễn Huy Hoàng", 8.63, "2025-04-21T05:55:00Z"),
  student("Đỗ Nhật Băng", null, "2025-04-20T05:00:00Z", 3),
];

const names = (r: LessonStudent[]) => r.map((s) => s.fullName);

describe("filterStudents", () => {
  it("sorts by newest submission by default", () => {
    expect(names(filterStudents(rows, "", "recent"))).toEqual([
      "Nguyễn Thị Thu Hương",
      "Nguyễn Huy Hoàng",
      "Lê Thị Tú Uyên",
      "Đỗ Nhật Băng",
    ]);
  });

  it("sorts by given name, Vietnamese style", () => {
    expect(names(filterStudents(rows, "", "name"))).toEqual([
      "Đỗ Nhật Băng",
      "Nguyễn Huy Hoàng",
      "Nguyễn Thị Thu Hương",
      "Lê Thị Tú Uyên",
    ]);
  });

  it("sorts by latest score, missing scores last", () => {
    expect(names(filterStudents(rows, "", "score"))).toEqual([
      "Lê Thị Tú Uyên",
      "Nguyễn Huy Hoàng",
      "Nguyễn Thị Thu Hương",
      "Đỗ Nhật Băng",
    ]);
  });

  it("matches every word without accents", () => {
    expect(names(filterStudents(rows, "nguyen huong", "recent"))).toEqual([
      "Nguyễn Thị Thu Hương",
    ]);
    expect(names(filterStudents(rows, "  DO bang ", "recent"))).toEqual([
      "Đỗ Nhật Băng",
    ]);
    expect(filterStudents(rows, "xyz", "recent")).toEqual([]);
  });

  it("does not reorder its input", () => {
    const input = [...rows];
    filterStudents(input, "", "name");
    expect(input).toEqual(rows);
  });
});

describe("summarizeStudents", () => {
  it("counts students and tries and averages the latest scores", () => {
    expect(summarizeStudents(rows)).toEqual({
      students: 4,
      attempts: 7,
      average: 5.8,
      passed: 2,
      low: 1,
    });
  });

  it("has no average without scores", () => {
    expect(summarizeStudents([]).average).toBeNull();
  });
});
