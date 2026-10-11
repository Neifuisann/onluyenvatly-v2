import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { E2E_PASSWORD, e2eStudent } from "./fixtures/users";
import type { StorageState } from "./runner-helpers";

/**
 * S4-06 dashboard as "Học Sinh Hai" (grade 11, seeded rating 1650 after a
 * +150 change). Starting the grade-11 lesson "E2E – Điện trường" moves it
 * from the recommendations to the continue card.
 */
test.describe.configure({ mode: "default" });
let storageState: StorageState;
test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.setExtraHTTPHeaders({
    "x-forwarded-for": `10.47.${Math.floor(Math.random() * 250)}.1`,
  });
  await page.goto("/login?next=/dashboard");
  await page.getByLabel("Số điện thoại").fill(e2eStudent("active2").phone);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/dashboard");
  storageState = await context.storageState();
  await context.close();
});
test.use({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires destructured fixture dependencies.
  storageState: async ({}, use) => {
    await use(storageState);
  },
});

test("rating, rank, mistakes, recommendation, then the continue card", async ({
  page,
}, info) => {
  // Starting a test changes this student's dashboard; one project does it.
  test.skip(info.project.name === "mobile", "desktop project starts the test");
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Chào Hai");

  const rating = page.getByRole("region", { name: "Rating của bạn" });
  await expect(rating).toContainText("1 650");
  await expect(rating).toContainText("Lần gần nhất: tăng 150");
  await expect(rating).toContainText("Platinum");
  await expect(
    rating.getByRole("img", {
      name: /^Rating các lần gần nhất: 1 500, 1 650$/,
    }),
  ).toBeVisible();
  // B-03: the rank among the classmates of the first class.
  await expect(
    page.getByRole("link", { name: /Hạng #\d+\s*Lớp E2E/ }),
  ).toHaveAttribute("href", "/leaderboard");
  await expect(
    page.getByRole("link", { name: /Không có câu sai/ }),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "Đang làm dở" })).toHaveCount(
    0,
  );

  const recommended = page.getByRole("region", { name: "Gợi ý cho bạn" });
  await recommended.getByRole("link", { name: /E2E – Điện trường/ }).click();
  await expect(page).toHaveURL(/\/lessons\/\d+$/);
  await page.getByRole("button", { name: "Bắt đầu làm bài" }).click();
  await expect(page).toHaveURL(/\/attempts\/[0-9a-f-]{36}$/);
  const attemptUrl = page.url();

  await page.goto("/dashboard");
  const card = page.getByRole("region", { name: "E2E – Điện trường" });
  await expect(card).toContainText("Đang làm dở");
  await expect(card).toContainText(/0\/\d+ câu/);
  // A test in progress has its own card, not a recommendation.
  await expect(recommended).not.toContainText("E2E – Điện trường");
  await card.getByRole("link", { name: "Tiếp tục làm bài" }).click();
  await expect(page).toHaveURL(attemptUrl);
});

test("dashboard fits the viewport and passes axe in light and dark", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const theme of ["light", "dark"] as const) {
    // Reduced motion zeroes transitions, so axe never samples mid-fade.
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await page.goto("/dashboard");
    await expect(
      page.getByRole("region", { name: "Rating của bạn" }),
    ).toBeVisible();
    const issues = (await new AxeBuilder({ page }).analyze()).violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(issues).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`dashboard-${theme}.png`),
      fullPage: true,
      scale: "css",
    });
  }
  expect(errors).toEqual([]);
});
