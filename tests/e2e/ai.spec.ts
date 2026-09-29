import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { FAKE_GEMINI_URL } from "./fake-gemini";
import {
  loginOnce,
  openTest,
  press,
  type StorageState,
  visible,
} from "./runner-helpers";

/**
 * S7-02 AI explanations on the result page, against the Gemini stand-in
 * (tests/e2e/fake-gemini.ts). Each project has its own lesson, so each
 * generates its own explanation exactly once.
 */
let storageState: StorageState;
test.beforeAll(async ({ browser }, info) => {
  storageState = await loginOnce(browser, info);
});
test.use({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires destructured fixture dependencies.
  storageState: async ({}, use) => {
    await use(storageState);
  },
});

async function expectAccessible(page: Page) {
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    await page.reload();
    const axe = await new AxeBuilder({ page }).analyze();
    expect(
      axe.violations.filter((v) =>
        ["serious", "critical"].includes(v.impact ?? ""),
      ),
      scheme,
    ).toEqual([]);
    const width = await page.evaluate(
      () => document.documentElement.scrollWidth,
    );
    expect(width).toBeLessThanOrEqual(page.viewportSize()?.width ?? 0);
  }
}

test("explain a question with AI, render it, vote, and never generate twice", async ({
  page,
  request,
}, info) => {
  const p = info.project.name === "mobile" ? "m" : "d";
  const generations = async () => {
    const { calls } = (await (
      await request.get(`${FAKE_GEMINI_URL}/__calls`)
    ).json()) as { calls: { prompt: string }[] };
    return calls.filter((c) => c.prompt.includes(`(${p})`)).length;
  };

  await openTest(page, `e2e-ai-${p}`);
  await press(page, /^A\. Giây/);
  await visible(page, "Sau").click();
  await press(page, /^A\. Giây/);
  await visible(page, "Nộp bài").click();
  await page
    .getByRole("dialog", { name: "Nộp bài?" })
    .getByRole("button", { name: "Nộp bài", exact: true })
    .click();
  await expect(page).toHaveURL(/\/result$/);

  const [aiItem, teacherItem] = [
    page.getByRole("article").nth(0),
    page.getByRole("article").nth(1),
  ];
  // The teacher's explanation wins: no AI offered there.
  await expect(teacherItem).toContainText("Lời giải của giáo viên");
  await expect(
    teacherItem.getByRole("button", { name: "Giải thích bằng AI" }),
  ).toHaveCount(0);

  const before = await generations();
  await aiItem.getByRole("button", { name: "Giải thích bằng AI" }).click();
  await expect(aiItem.getByText("AI đang soạn lời giải thích…")).toBeVisible();
  // After the stream, the page refreshes into the stored, rendered text.
  const panel = aiItem.getByRole("region", { name: "Giải thích của AI" });
  await expect(panel).toContainText("Tần số là số dao động trong một giây");
  await expect(panel.locator(".katex").first()).toBeVisible();
  await expect(panel).toContainText("• Mẹo");
  await expect(panel.getByText("Ý chính", { exact: true })).toBeVisible();
  await expect(panel).toContainText("AI có thể nhầm");
  expect(await generations()).toBe(before + 1);

  const up = panel.getByRole("button", { name: /^Hữu ích/ });
  await expect(up).toHaveAttribute("aria-pressed", "false");
  await up.click();
  await expect(up).toHaveAttribute("aria-pressed", "true");
  await expect(up).toHaveAccessibleName("Hữu ích (1)");

  await page.reload();
  await expect(
    panel.getByRole("button", { name: "Hữu ích (1)" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    aiItem.getByRole("button", { name: "Giải thích bằng AI" }),
  ).toHaveCount(0);
  expect(await generations()).toBe(before + 1);

  await expectAccessible(page);
});
