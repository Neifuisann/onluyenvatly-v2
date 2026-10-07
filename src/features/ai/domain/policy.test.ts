import { describe, expect, it } from "vitest";
import {
  backoffMs,
  budgetKey,
  effectiveBudget,
  errorStatus,
  MAX_RETRIES,
  nextStep,
  parseModels,
  thinkingConfigFor,
} from "./policy";

describe("parseModels", () => {
  it("splits, trims and dedupes a comma list", () => {
    expect(parseModels(" a , b,,a ,c ")).toEqual(["a", "b", "c"]);
  });

  it("gives an empty list when unset", () => {
    expect(parseModels(undefined)).toEqual([]);
    expect(parseModels(" , ")).toEqual([]);
  });
});

describe("nextStep", () => {
  it("moves to the next model on 429 when there is one", () => {
    expect(nextStep(429, 0, true)).toBe("next-model");
  });

  it("retries a 429 on the last model, then fails", () => {
    expect(nextStep(429, 0, false)).toBe("retry");
    expect(nextStep(429, MAX_RETRIES, false)).toBe("fail");
  });

  it("moves to the next model on 503 (overloaded), retries it on the last", () => {
    expect(nextStep(503, 0, true)).toBe("next-model");
    expect(nextStep(503, 0, false)).toBe("retry");
    expect(nextStep(503, MAX_RETRIES, false)).toBe("fail");
  });

  it("retries other 5xx and network errors on the same model first", () => {
    expect(nextStep(500, 0, true)).toBe("retry");
    expect(nextStep(undefined, 1, true)).toBe("retry");
    expect(nextStep(500, MAX_RETRIES, true)).toBe("next-model");
    expect(nextStep(504, MAX_RETRIES, false)).toBe("fail");
  });

  it("skips a missing model", () => {
    expect(nextStep(404, 0, true)).toBe("next-model");
    expect(nextStep(404, 0, false)).toBe("fail");
  });

  it("stops on client errors", () => {
    for (const status of [400, 401, 403]) {
      expect(nextStep(status, 0, true)).toBe("fail");
    }
  });
});

describe("backoffMs", () => {
  it("doubles per retry with jitter in the upper half", () => {
    expect(backoffMs(0, 0)).toBe(500);
    expect(backoffMs(0, 0.99)).toBe(995);
    expect(backoffMs(1, 0)).toBe(1000);
    expect(backoffMs(1, 0.5)).toBe(1500);
  });
});

describe("errorStatus", () => {
  it("reads a numeric HTTP status", () => {
    expect(errorStatus({ status: 429 })).toBe(429);
  });

  it("ignores anything else", () => {
    expect(errorStatus(new Error("x"))).toBeUndefined();
    expect(errorStatus({ status: "429" })).toBeUndefined();
    expect(errorStatus({ status: 42 })).toBeUndefined();
    expect(errorStatus(null)).toBeUndefined();
    expect(errorStatus("boom")).toBeUndefined();
  });
});

describe("effectiveBudget", () => {
  it("uses the setting when there is no env cap", () => {
    expect(effectiveBudget(200, 0)).toBe(200);
  });

  it("caps the setting with the env value", () => {
    expect(effectiveBudget(200, 20)).toBe(20);
    expect(effectiveBudget(10, 20)).toBe(10);
  });

  it("never goes below zero", () => {
    expect(effectiveBudget(-5, 0)).toBe(0);
  });
});

describe("budgetKey", () => {
  it("is one row per Vietnam day", () => {
    expect(budgetKey("2026-10-01")).toBe("ai:global:2026-10-01");
  });
});

describe("thinkingConfigFor", () => {
  it("sets the level, with thought summaries, on Gemini 3 and later", () => {
    for (const model of [
      "gemini-3.5-flash-lite",
      "gemini-3-flash-preview",
      "gemini-10.1-pro",
    ])
      expect(thinkingConfigFor(model, "high")).toEqual({
        thinkingLevel: "HIGH",
        includeThoughts: true,
      });
    expect(thinkingConfigFor("gemini-3.8-flash", "low")?.thinkingLevel).toBe(
      "LOW",
    );
  });

  it("sends nothing to older or unknown models, or without a level", () => {
    for (const model of [
      "gemini-2.5-flash",
      "gemini-flash-latest",
      "gemini-3x",
      "e2e-model",
    ])
      expect(thinkingConfigFor(model, "high")).toBeNull();
    expect(thinkingConfigFor("gemini-3.5-flash", undefined)).toBeNull();
  });
});
