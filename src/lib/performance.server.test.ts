import { afterEach, expect, it, vi } from "vitest";
import { measureOperation } from "./performance.server";

const config = vi.hoisted(() => ({
  VERCEL_ENV: "preview",
  PERFORMANCE_DIAGNOSTICS: "0",
}));
vi.mock("./env.server", () => ({ env: config }));
afterEach(() => {
  vi.restoreAllMocks();
  config.VERCEL_ENV = "preview";
  config.PERFORMANCE_DIAGNOSTICS = "0";
});

it("stays silent unless explicitly enabled in preview", async () => {
  const output = vi.spyOn(console, "info").mockImplementation(() => {});
  await measureOperation("attempt.start", async () => "private result");
  config.VERCEL_ENV = "production";
  config.PERFORMANCE_DIAGNOSTICS = "1";
  await measureOperation("attempt.start", async () => "private result");
  expect(output).not.toHaveBeenCalled();
});

it("logs only fixed operation, timing and success; errors and results stay private", async () => {
  config.PERFORMANCE_DIAGNOSTICS = "1";
  const output = vi.spyOn(console, "info").mockImplementation(() => {});
  expect(
    await measureOperation("attempt.start", async () => "private result"),
  ).toBe("private result");
  await expect(
    measureOperation("attempt.start", async () => {
      throw new Error("private error");
    }),
  ).rejects.toThrow("private error");
  for (const [line] of output.mock.calls) {
    const event = JSON.parse(String(line));
    expect(Object.keys(event).sort()).toEqual([
      "durationMs",
      "evt",
      "operation",
      "succeeded",
    ]);
    expect(String(line)).not.toContain("private");
    expect(event.durationMs).toBeGreaterThanOrEqual(0);
  }
});
