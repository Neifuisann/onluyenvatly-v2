import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";
import { emulateScheme } from "./runner-helpers";

/**
 * S8-06: the page as it is now has no serious or critical axe violation in
 * either theme, and nothing scrolls sideways at the project's width.
 */
export async function expectAccessible(page: Page): Promise<void> {
  for (const scheme of ["light", "dark"] as const) {
    await emulateScheme(page, scheme);
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(
      violations
        .filter((v) => v.impact === "serious" || v.impact === "critical")
        .map((v) => ({
          id: v.id,
          nodes: v.nodes.map(
            (n) => `${n.target.join(" ")}: ${n.any[0]?.message ?? ""}`,
          ),
        })),
      scheme,
    ).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `${scheme}: no horizontal scroll`,
    ).toBe(true);
  }
}
