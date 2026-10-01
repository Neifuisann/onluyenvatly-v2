import { describe, expect, it } from "vitest";
import type { Question } from "../schema";
import { normalizeLegacyResult } from "./legacy-results";

const current: Question = {
  id: "q_1",
  type: "mcq",
  stem: "Synthetic?",
  options: [{ text: "one" }, { text: "two" }],
  answer: 0,
};
const row = {
  type: "abcd",
  question: "Synthetic? [2 pts]",
  optionsText: ["two", "one"],
  correctAnswer: "one",
  userAnswer: "two",
  earnedPoints: 0,
  points: 2,
};
const id = () => "q_history";
describe("legacy result preservation", () => {
  it("matches shuffled options and keeps recorded marks without re-grading", () => {
    const result = normalizeLegacyResult(
      [{ ...row, earnedPoints: 1 }],
      [current],
      id,
    );
    expect(result[0]).toEqual({
      question: current,
      historical: false,
      order: [1, 0],
      points: 2,
      answer: "A",
      earned: 1,
    });
  });
  it("preserves an edited answer key in a historical snapshot", () => {
    const result = normalizeLegacyResult(
      [{ ...row, correctAnswer: "two" }],
      [current],
      id,
    );
    expect(result[0]).toMatchObject({
      historical: true,
      question: { id: "q_1", answer: 1 },
      order: [1, 0],
    });
  });
  it("preserves partial true/false marks and blank statements", () => {
    const result = normalizeLegacyResult(
      [
        {
          type: "truefalse",
          question: "Synthetic",
          optionsText: ["one", "two"],
          correctAnswer: [true, false],
          userAnswer: [true, null],
          points: 1,
          earnedPoints: 0.25,
        },
      ],
      [],
      id,
    );
    expect(result[0]).toMatchObject({
      answer: [true, null],
      earned: 0.25,
      historical: true,
    });
  });
  it("preserves short answers and never invents missing keys or marks", () => {
    expect(
      normalizeLegacyResult(
        [
          {
            type: "number",
            question: "Synthetic",
            correctAnswer: "1,5",
            userAnswer: "1.50",
            points: 1,
            earnedPoints: 1,
          },
        ],
        [],
        id,
      )[0],
    ).toMatchObject({ answer: "1.50", question: { answer: "1.5" } });
    expect(() =>
      normalizeLegacyResult(
        [{ ...row, correctAnswer: undefined }],
        [current],
        id,
      ),
    ).toThrow("unresolved result key");
    expect(() =>
      normalizeLegacyResult(
        [{ ...row, earnedPoints: undefined }],
        [current],
        id,
      ),
    ).toThrow("invalid recorded marks");
    expect(() =>
      normalizeLegacyResult([{ ...row, userAnswer: "unknown" }], [current], id),
    ).toThrow("unresolved result choice");
  });
  it("recognizes the v1 runner's literal blank-answer marker", () => {
    expect(
      normalizeLegacyResult(
        [{ ...row, userAnswer: "No answer" }],
        [current],
        id,
      )[0]?.answer,
    ).toBeNull();
  });
});
