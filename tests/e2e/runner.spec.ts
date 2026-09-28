import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { ANSWER_MARKER } from "./fixtures/lessons";
import {
  loginOnce,
  openTest,
  type StorageState,
  singleView,
  visible,
} from "./runner-helpers";

/**
 * The test runner (S3-04…S3-06, 11 §3 journeys 2–5) on the seeded
 * `e2e-runner` lesson: mcq B (0.25), mcq B (0.25), tf Đ S Đ S (1),
 * short 0.63 (0.5) = 2 points. Needs `pnpm seed --profile e2e`.
 */
test.describe.configure({ mode: "serial" });

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

test("runner: every question type, flag, navigator, list view and keys", async ({
  page,
  isMobile,
}, testInfo) => {
  // Journey 4 (answer leakage): nothing the runner loads carries answers.
  const bodies: string[] = [];
  page.on("response", async (res) => {
    const type = res.headers()["content-type"] ?? "";
    if (/html|x-component|json/.test(type))
      bodies.push(await res.text().catch(() => ""));
  });
  await openTest(page, "e2e-runner");
  await expect(page.getByText("Đã làm 0/4 câu", { exact: true })).toBeVisible();

  // 1: mcq by tap; tapping again clears it.
  const optionB = page.getByRole("button", { name: /^B\. 5 cm/ });
  await optionB.click();
  await expect(optionB).toHaveAttribute("aria-pressed", "true");
  await optionB.click();
  await expect(optionB).toHaveAttribute("aria-pressed", "false");
  await optionB.click();
  await expect(page.getByText("Đã làm 1/4 câu", { exact: true })).toBeVisible();

  // 2: keyboard (→ next, 2 = B).
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("heading", { name: /^Câu 2 ·/ })).toBeVisible();
  await page.keyboard.press("2");
  await expect(page.getByRole("button", { name: /^B\. Hz/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  // 3: true/false, and flag it.
  await visible(page, "Sau").click();
  await expect(
    page.getByRole("heading", { name: "Câu 3 · Đúng/Sai · 1đ" }),
  ).toBeVisible();
  for (const name of ["a) Đúng", "b) Sai", "c) Đúng", "d) Sai"])
    await page.getByRole("button", { name, exact: true }).click();
  await expect(
    page.getByRole("button", { name: "b) Sai", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await visible(page, "Đánh dấu").click();
  await expect(visible(page, "Đã đánh dấu")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const shot = testInfo.outputPath("runner-tf-answered.png");
  await page.screenshot({ path: shot, scale: "css" });
  await testInfo.attach("runner-tf-answered", {
    path: shot,
    contentType: "image/png",
  });

  // 4: short answer with a comma decimal.
  await visible(page, "Sau").click();
  const input = page.getByLabel("Câu trả lời của bạn");
  await input.fill("0,63");
  await expect(page.getByText("Hệ thống ghi nhận: 0.63")).toBeVisible();
  await expect(page.getByText("Đã làm 4/4 câu", { exact: true })).toBeVisible();

  // Navigator: a bottom sheet on phones, a side panel on desktop.
  if (isMobile)
    await page.getByRole("button", { name: /Mở danh sách/ }).click();
  await expect(visible(page, "Câu 3, đã làm, đã đánh dấu")).toBeVisible();
  await visible(page, "Câu 1, đã làm").click();
  await expect(page.getByRole("heading", { name: /^Câu 1 ·/ })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // List view shows every question, with submit in reach.
  await page.getByRole("button", { name: "Xem tất cả" }).click();
  await expect(page.getByRole("heading", { name: /^Câu \d ·/ })).toHaveCount(4);

  // Submit dialog summarizes; "Làm tiếp" returns to the test.
  await visible(page, "Nộp bài").click();
  const dialog = page.getByRole("dialog", { name: "Nộp bài?" });
  await expect(dialog.getByText("Bạn đã làm 4/4 câu.")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Đến câu 3" })).toBeVisible();
  await dialog.getByRole("button", { name: "Làm tiếp" }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole("button", { name: "Xem từng câu" }).click();
  await expect(page.getByRole("heading", { name: /^Câu \d ·/ })).toHaveCount(1);

  for (const body of bodies) {
    expect(body).not.toContain(ANSWER_MARKER);
    expect(body).not.toMatch(/"(?:answer|explanation|tolerance)"\s*:/);
  }
});

test("runner fits the phone, passes axe in light and dark", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await openTest(page, "e2e-runner");
  for (const theme of ["light", "dark"] as const) {
    // Reduced motion zeroes transitions, so axe never samples mid-fade. The
    // theme class is set at load, hence the reload.
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await page.reload();
    await singleView(page);
    for (const view of ["single", "list"] as const) {
      if (view === "list")
        await page.getByRole("button", { name: "Xem tất cả" }).click();
      const issues = (
        await new AxeBuilder({ page }).analyze()
      ).violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical",
      );
      expect(issues).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const path = testInfo.outputPath(`runner-${view}-${theme}.png`);
      await page.screenshot({ path, scale: "css" });
      await testInfo.attach(`runner-${view}-${theme}`, {
        path,
        contentType: "image/png",
      });
      if (view === "list")
        await page.getByRole("button", { name: "Xem từng câu" }).click();
    }
  }
  expect(errors).toEqual([]);
});
