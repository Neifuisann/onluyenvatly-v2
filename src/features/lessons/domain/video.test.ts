import { describe, expect, it } from "vitest";
import { parseLessonText } from "./parser";
import { serializeLesson } from "./serializer";
import {
  formatVideoTime,
  orderByVideoTime,
  parseVideoTime,
  parseYoutubeId,
  videoTimeOf,
  youtubeThumbnail,
  youtubeWatchUrl,
} from "./video";

const ID = "dQw4w9WgXcQ";

describe("parseYoutubeId", () => {
  it.each([
    [ID],
    [`https://www.youtube.com/watch?v=${ID}`],
    [`https://youtube.com/watch?v=${ID}&t=42s&list=PL1`],
    [`http://m.youtube.com/watch?feature=share&v=${ID}`],
    [`www.youtube.com/watch?v=${ID}`],
    [`https://youtu.be/${ID}`],
    [`https://youtu.be/${ID}?si=abc&t=10`],
    [`https://www.youtube.com/embed/${ID}?start=3`],
    [`https://www.youtube-nocookie.com/embed/${ID}`],
    [`https://www.youtube.com/shorts/${ID}`],
    [`https://www.youtube.com/live/${ID}?feature=share`],
    [`https://music.youtube.com/watch?v=${ID}`],
    [`  https://youtu.be/${ID}  `],
  ])("reads %s", (input) => {
    expect(parseYoutubeId(input)).toBe(ID);
  });

  it.each([
    [""],
    ["not a link"],
    ["dQw4w9WgXc"],
    [`https://vimeo.com/${ID}`],
    [`https://evil.com/watch?v=${ID}`],
    [`https://youtube.com.evil.com/watch?v=${ID}`],
    ["https://www.youtube.com/watch?v=short"],
    ["https://www.youtube.com/watch"],
    ["https://youtu.be/"],
    [`https://www.youtube.com/channel/${ID}`],
    [`javascript://youtube.com/watch?v=${ID}`],
    [`ftp://youtube.com/watch?v=${ID}`],
    ["https://[bad"],
  ])("refuses %s", (input) => {
    expect(parseYoutubeId(input)).toBeNull();
  });

  it("builds the watch and thumbnail links", () => {
    expect(youtubeWatchUrl(ID)).toBe(`https://www.youtube.com/watch?v=${ID}`);
    expect(youtubeThumbnail(ID)).toBe(
      `https://i.ytimg.com/vi/${ID}/hqdefault.jpg`,
    );
  });
});

describe("video times", () => {
  it.each([
    ["0", 0],
    ["83", 83],
    ["1:23", 83],
    [" 01:05 ", 65],
    ["1:02:03", 3723],
    ["12:00:00", 43_200],
  ])("parses %s", (raw, seconds) => {
    expect(parseVideoTime(raw)).toBe(seconds);
  });

  it.each([
    [""],
    ["1:60"],
    ["1:2:60"],
    ["1.5"],
    ["-3"],
    ["a:bc"],
    ["1:2:3:4"],
    ["12:00:01"],
  ])("refuses %s", (raw) => {
    expect(parseVideoTime(raw)).toBeNull();
  });

  it.each([
    [0, "0:00"],
    [5.9, "0:05"],
    [83, "1:23"],
    [600, "10:00"],
    [3723, "1:02:03"],
    [-4, "0:00"],
  ])("formats %d as %s", (seconds, text) => {
    expect(formatVideoTime(seconds)).toBe(text);
  });
});

describe("orderByVideoTime", () => {
  const qs = [
    { id: "end1" },
    { id: "b", at: 90 },
    { id: "a", at: 30 },
    { id: "b2", at: 90 },
    { id: "late", at: 700 },
    { id: "end2" },
  ];

  it("orders by time, keeps the teacher's order within a time, untimed last", () => {
    expect(orderByVideoTime(qs).map((q) => q.id)).toEqual([
      "a",
      "b",
      "b2",
      "late",
      "end1",
      "end2",
    ]);
  });

  it("treats a time past the video's length as its end", () => {
    expect(orderByVideoTime(qs, 600).map((q) => q.id)).toEqual([
      "a",
      "b",
      "b2",
      "end1",
      "late",
      "end2",
    ]);
    expect(videoTimeOf({ at: 600 }, 600)).toBeNull();
    expect(videoTimeOf({ at: 599 }, 600)).toBe(599);
    expect(videoTimeOf({}, null)).toBeNull();
  });
});

describe("[Video m:ss] in the text format", () => {
  it("parses the marker in its forms and writes it back", () => {
    const text = [
      "Câu 1: Hai cộng hai?",
      "A. 3",
      "*B. 4",
      "[Video 1:23]",
      "",
      "Câu 2: Đơn vị lực?",
      "Answer: N",
      "[video: 1:02:03]",
      "",
      "Câu 3: Không có mốc",
      "Answer: 1",
    ].join("\n");
    const { questions, issues } = parseLessonText(text);
    expect(issues).toEqual([]);
    expect(questions.map((q) => q.at)).toEqual([83, 3723, undefined]);
    const again = serializeLesson(questions);
    expect(again).toContain("[Video 1:23]");
    expect(again).toContain("[Video 1:02:03]");
    expect(parseLessonText(again, { previous: questions }).questions).toEqual(
      questions,
    );
  });

  it("reports a bad time and warns about a second marker", () => {
    const { questions, issues } = parseLessonText(
      ["Câu 1: ?", "Answer: 1", "[Video 1:99]", "[Video 5]", "[Video 7]"].join(
        "\n",
      ),
    );
    expect(issues.map((i) => [i.code, i.line, i.severity])).toEqual([
      ["INVALID_VIDEO_TIME", 3, "error"],
      ["DUPLICATE_VIDEO_TIME", 5, "warning"],
    ]);
    expect(questions[0]?.at).toBe(7);
  });
});
