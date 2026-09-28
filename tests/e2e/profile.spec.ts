import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { E2E_PASSWORD, e2eStudent } from "./fixtures/users";
import { openTest, type StorageState, visible } from "./runner-helpers";

/**
 * S4-07 profile, one student per project ("profile" / "profile2", seeded
 * with ratings 1 500 → 1 520 → 1 560 and no tests). Submitting a blank
 * "e2e-runner" test fills the history, accuracy and streak.
 */
test.describe.configure({ mode: "default" });
let storageState: StorageState;
test.beforeAll(async ({ browser }, info) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.setExtraHTTPHeaders({
    "x-forwarded-for": `10.48.${Math.floor(Math.random() * 250)}.1`,
  });
  await page.goto("/login?next=/profile");
  const key = info.project.name === "mobile" ? "profile2" : "profile";
  await page.getByLabel("Số điện thoại").fill(e2eStudent(key).phone);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/profile");
  storageState = await context.storageState();
  await context.close();
});
test.use({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires destructured fixture dependencies.
  storageState: async ({}, use) => {
    await use(storageState);
  },
});

const stat = (page: Page, name: string) =>
  page
    .getByRole("region", { name: "Tổng quan" })
    .getByRole("term")
    .filter({ hasText: name })
    .locator("xpath=following-sibling::dd[1]");

/** Script bodies the page loaded, to check which libraries shipped. */
function collectScripts(page: Page) {
  const bodies: string[] = [];
  page.on("response", async (res) => {
    if (res.request().resourceType() === "script")
      bodies.push(await res.text().catch(() => ""));
  });
  return bodies;
}

test("history, accuracy, streak and rating chart after a test", async ({
  page,
}) => {
  await page.goto("/profile");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    /^Học Sinh Hồ Sơ/,
  );
  await expect(stat(page, "Rating")).toContainText("1 560");
  await expect(stat(page, "Rating")).toContainText("Cao nhất 1 560");
  await expect(stat(page, "Bài đã làm")).toHaveText("0");
  await expect(stat(page, "Chuỗi ngày học")).toHaveText("0 ngày");
  await expect(page.getByText("Bạn chưa làm bài nào")).toBeVisible();
  await expect(
    page.getByText("Từ 1 520 đến 1 560 qua 2 lần tính rating."),
  ).toBeVisible();
  await expect(page.locator(".recharts-wrapper")).toBeVisible();

  // Submit "e2e-runner" blank: 4 questions, one mcq pair, one Đ/S, one short.
  await openTest(page, "e2e-runner");
  await page.getByRole("button", { name: "Xem tất cả" }).click();
  await visible(page, "Nộp bài").click();
  const dialog = page.getByRole("dialog", { name: "Nộp bài?" });
  await dialog.getByRole("button", { name: "Nộp bài", exact: true }).click();
  await expect(page).toHaveURL(/\/attempts\/[0-9a-f-]{36}\/result$/);
  const resultUrl = new URL(page.url()).pathname;

  await page.goto("/profile");
  await expect(stat(page, "Bài đã làm")).toHaveText("1");
  await expect(stat(page, "Điểm trung bình")).toHaveText("0");
  await expect(stat(page, "Chuỗi ngày học")).toHaveText("1 ngày");
  await expect(page.getByText(/qua 3 lần tính rating\.$/)).toBeVisible();

  const accuracy = page.getByRole("region", { name: "Độ chính xác" });
  for (const line of [
    /Trắc nghiệm\s*0%\s*· 2 câu/,
    /Đúng\/Sai\s*0%\s*· 1 câu/,
    /Trả lời ngắn\s*0%\s*· 1 câu/,
  ])
    await expect(
      accuracy.getByRole("listitem").filter({ hasText: line }),
    ).toHaveCount(1);

  const history = page.getByRole("region", { name: "Lịch sử làm bài" });
  const row = history.getByRole("link", { name: /E2E – Làm bài đủ dạng/ });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText(/Rating: giảm \d+/);
  await row.click();
  await expect(page).toHaveURL(resultUrl);
});

test("Recharts loads on /profile only, never on /dashboard", async ({
  page,
}) => {
  const onDashboard = collectScripts(page);
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(onDashboard.length).toBeGreaterThan(0);
  expect(onDashboard.some((js) => js.includes("recharts-wrapper"))).toBe(false);

  const onProfile = collectScripts(page);
  await page.goto("/profile");
  await expect(page.locator(".recharts-wrapper")).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(onProfile.some((js) => js.includes("recharts-wrapper"))).toBe(true);
});

test("profile fits the viewport and passes axe in light and dark", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const theme of ["light", "dark"] as const) {
    // Reduced motion zeroes transitions, so axe never samples mid-fade.
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await page.goto("/profile");
    await expect(page.locator(".recharts-wrapper")).toBeVisible();
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
      path: testInfo.outputPath(`profile-${theme}.png`),
      fullPage: true,
      scale: "css",
    });
  }
  expect(errors).toEqual([]);
});
