import { describe, expect, it } from "vitest";
import {
  BOM,
  csvCell,
  exportFilename,
  RESULTS_CSV_HEADER,
  type ResultCsvRow,
  resultsCsv,
  toCsv,
} from "./csv";

describe("csvCell", () => {
  it("writes plain values as they are", () => {
    expect(csvCell("Nguyễn Văn An")).toBe("Nguyễn Văn An");
    expect(csvCell(7.75)).toBe("7.75");
    expect(csvCell(0)).toBe("0");
    expect(csvCell(-2)).toBe("-2");
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
    expect(csvCell(Number.NaN)).toBe("");
  });

  it("quotes commas, quotes and line breaks (RFC 4180)", () => {
    expect(csvCell("Dao động, sóng")).toBe('"Dao động, sóng"');
    expect(csvCell('Bài "khó"')).toBe('"Bài ""khó"""');
    expect(csvCell("a\nb")).toBe('"a\nb"');
    expect(csvCell("a;b")).toBe("a;b");
  });

  it("neutralizes cells a spreadsheet would run as a formula", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("+84912")).toBe("'+84912");
    expect(csvCell("-Minh")).toBe("'-Minh");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell("\tx")).toBe("'\tx");
    expect(csvCell("\rx")).toBe('"\'\rx"');
    expect(csvCell('=1+"2",3')).toBe('"\'=1+""2"",3"');
    expect(csvCell("An = 1")).toBe("An = 1");
  });
});

describe("toCsv", () => {
  it("starts with the BOM and ends every line with CRLF", () => {
    const csv = toCsv(
      ["a", "b"],
      [
        ["x,y", 1],
        [null, "z"],
      ],
    );
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toBe(`${BOM}a,b\r\n"x,y",1\r\n,z\r\n`);
  });

  it("has only the header without rows", () => {
    expect(toCsv(["a"], [])).toBe(`${BOM}a\r\n`);
  });
});

describe("resultsCsv", () => {
  const row: ResultCsvRow = {
    fullName: "=Trần Thị B",
    className: "12A1",
    grade: 12,
    lessonTitle: "Dao động, sóng",
    score10: 7.75,
    score: 7.75,
    maxScore: 10,
    timeTakenSec: 1234,
    submittedAt: new Date("2026-10-01T14:30:00Z"),
    guardCount: 3,
  };

  it("writes the documented columns in order, no phone or birth date", () => {
    const [header, line, end] = resultsCsv([row], "Ôn tập")
      .slice(1)
      .split("\r\n");
    expect(header).toBe(RESULTS_CSV_HEADER.join(","));
    expect(header).toBe(
      "Họ tên,Lớp,Khối,Bài,Điểm (/10),Điểm,Tối đa,Thời gian (giây),Nộp lúc,Cảnh báo",
    );
    expect(line).toBe(
      `'=Trần Thị B,12A1,12,"Dao động, sóng",7.75,7.75,10,1234,01/10/2026 21:30,3`,
    );
    expect(end).toBe("");
  });

  it("names personalized practice and leaves unknown values empty", () => {
    const csv = resultsCsv(
      [
        {
          ...row,
          fullName: "An",
          className: null,
          grade: null,
          lessonTitle: null,
          score10: null,
          score: null,
          timeTakenSec: null,
          submittedAt: null,
          guardCount: 0,
        },
      ],
      "Ôn tập cá nhân",
    );
    expect(csv.split("\r\n")[1]).toBe("An,,,Ôn tập cá nhân,,,10,,,0");
  });
});

describe("exportFilename", () => {
  it("uses the Vietnam date", () => {
    expect(exportFilename(new Date("2026-09-30T18:00:00Z"))).toBe(
      "ket-qua-2026-10-01.csv",
    );
  });
});
