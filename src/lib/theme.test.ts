import { describe, expect, it } from "vitest";
import { nextThemePref, resolveDark, themeScript } from "./theme";

describe("theme", () => {
  it("cycles system → light → dark → system", () => {
    expect(nextThemePref("system")).toBe("light");
    expect(nextThemePref("light")).toBe("dark");
    expect(nextThemePref("dark")).toBe("system");
  });

  it("resolves dark mode from the preference and the system", () => {
    expect(resolveDark("dark", false)).toBe(true);
    expect(resolveDark("light", true)).toBe(false);
    expect(resolveDark("system", true)).toBe(true);
    expect(resolveDark("system", false)).toBe(false);
  });

  it("ships a boot script that is valid JavaScript", () => {
    expect(() => new Function(themeScript)).not.toThrow();
  });
});
