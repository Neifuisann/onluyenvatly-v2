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

  /** Runs the boot script against a fake <html>, storage and media query. */
  function boot(stored: string | null, systemDark: boolean) {
    const classes = new Set<string>();
    const root = {
      classList: {
        toggle: (c: string, on: boolean) =>
          on ? classes.add(c) : classes.delete(c),
      },
      dataset: {} as Record<string, string>,
      style: {} as Record<string, string>,
    };
    const listeners: (() => void)[] = [];
    const mq = {
      matches: systemDark,
      addEventListener: (_: string, fn: () => void) => listeners.push(fn),
    };
    const storage = {
      getItem: () => {
        if (stored === "throw") throw new Error("blocked");
        return stored;
      },
    };
    new Function("document", "matchMedia", "localStorage", themeScript)(
      { documentElement: root },
      () => mq,
      storage,
    );
    const osChange = (dark: boolean) => {
      mq.matches = dark;
      for (const fn of listeners) fn();
    };
    return { dark: () => classes.has("dark"), root, osChange };
  }

  it("applies the stored preference before paint", () => {
    const t = boot("dark", false);
    expect(t.dark()).toBe(true);
    expect(t.root.dataset.themePref).toBe("dark");
    expect(t.root.style.colorScheme).toBe("dark");
    expect(boot("light", true).dark()).toBe(false);
    expect(boot("bogus", true).root.dataset.themePref).toBe("system");
  });

  it("follows the OS while the preference is system, even without storage", () => {
    const t = boot("throw", false);
    expect(t.dark()).toBe(false);
    t.osChange(true);
    expect(t.dark()).toBe(true);
    expect(t.root.style.colorScheme).toBe("dark");
    t.osChange(false);
    expect(t.dark()).toBe(false);
  });

  it("ignores OS changes once a theme is chosen", () => {
    const t = boot("light", false);
    t.osChange(true);
    expect(t.dark()).toBe(false);
    // The toggle switching to system later hands control back to the OS.
    t.root.dataset.themePref = "system";
    t.osChange(true);
    expect(t.dark()).toBe(true);
  });
});
