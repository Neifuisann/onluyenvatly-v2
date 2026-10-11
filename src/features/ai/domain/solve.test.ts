import { describe, expect, it } from "vitest";
import { parseLessonText } from "../../lessons/domain/parser.ts";
import {
  applySolvedAnswers,
  parseSolveReply,
  readChatCompletion,
  solvePrompt,
  unansweredQuestions,
} from "./solve.ts";

const LESSON = `Câu 1: Đã có đáp án
A. x
*B. y

Câu 2: Trắc nghiệm chưa có đáp án
[Hình]
A. 1 cm
B. 2 cm
C. 3 cm
D. 4 cm

Câu 3: Đúng sai chưa có đáp án
a) một
b) hai
c) ba
d) bốn

Câu 4: Trả lời ngắn chưa có đáp án
Answer:

Câu 5: Trả lời ngắn đã có
Answer: 0,63

Câu 6: Đúng sai đã có
*a) một
b) hai`;

describe("unansweredQuestions", () => {
  it("finds mcq without *, true/false without *, empty Answer:", () => {
    expect(unansweredQuestions(LESSON)).toEqual([
      { number: 2, type: "mcq" },
      { number: 3, type: "tf" },
      { number: 4, type: "short" },
    ]);
    expect(unansweredQuestions("")).toEqual([]);
  });
});

describe("solvePrompt", () => {
  it("sends the whole text and the numbers to solve", () => {
    const prompt = solvePrompt(LESSON, unansweredQuestions(LESSON));
    expect(prompt).toContain("Câu 6: Đúng sai đã có");
    expect(prompt).toMatch(/Hãy giải các câu: 2, 3, 4\.$/);
  });
});

describe("parseSolveReply", () => {
  it("reads fenced JSON and skips entries that don't fit", () => {
    expect(
      parseSolveReply(
        '```json\n{"answers":[{"q":2,"choice":"C"},{"q":3,"statements":[true,false,true,false]},{"q":4,"value":2.8},{"q":"x"}]}\n```',
      ),
    ).toEqual([
      { q: 2, choice: "C" },
      { q: 3, statements: [true, false, true, false] },
      { q: 4, value: 2.8 },
    ]);
  });

  it("is null without JSON", () => {
    expect(parseSolveReply("Xin lỗi")).toBeNull();
    expect(parseSolveReply("{oops}")).toBeNull();
    expect(parseSolveReply('{"other":1}')).toBeNull();
  });
});

describe("applySolvedAnswers", () => {
  const todo = unansweredQuestions(LESSON);

  it("marks the answers and the result parses with no errors", () => {
    const { text, filled } = applySolvedAnswers(LESSON, todo, [
      { q: 2, choice: "c" },
      { q: 3, statements: [true, false, true, false] },
      { q: 4, value: "2.8" },
    ]);
    expect(filled).toEqual([2, 3, 4]);
    expect(text).toContain("*C. 3 cm");
    expect(text).toContain("*a) một\nb) hai\n*c) ba\nd) bốn");
    expect(text).toContain("Câu 4: Trả lời ngắn chưa có đáp án\nAnswer: 2,8");
    expect(unansweredQuestions(text)).toEqual([]);
    const parsed = parseLessonText(text);
    expect(parsed.issues.filter((i) => i.severity === "error")).toEqual([]);
    expect(parsed.questions[1]).toMatchObject({ type: "mcq", answer: 2 });
  });

  it("never touches answered questions or answers that don't fit", () => {
    const { text, filled } = applySolvedAnswers(LESSON, todo, [
      { q: 1, choice: "A" },
      { q: 2, choice: "F" },
      { q: 3, statements: [true] },
      { q: 4, choice: "A" },
      { q: 5, value: "9" },
    ]);
    expect(filled).toEqual([]);
    expect(text).toBe(LESSON);
  });
});

describe("readChatCompletion", () => {
  it("joins streamed deltas and skips keep-alives", () => {
    const body = [
      'data: {"choices":[{"delta":{"role":"assistant"}}]}',
      ": keep-alive",
      'data: {"choices":[{"delta":{"content":"{\\"answers\\""}}]}',
      'data: {"choices":[{"delta":{"content":":[]}"}}]}',
      "data: [DONE]",
    ].join("\r\n");
    expect(readChatCompletion(body)).toBe('{"answers":[]}');
  });

  it("reads a plain JSON completion", () => {
    expect(
      readChatCompletion('{"choices":[{"message":{"content":"hi"}}]}'),
    ).toBe("hi");
    expect(readChatCompletion("<html>")).toBe("");
  });
});
