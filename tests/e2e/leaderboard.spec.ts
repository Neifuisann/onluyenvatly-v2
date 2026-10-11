import AxeBuilder from "@axe-core/playwright";
import { type Browser, expect, type Page, test } from "@playwright/test";
import { E2E_PASSWORD, type E2eStudentKey, e2eStudent } from "./fixtures/users";
import type { StorageState } from "./runner-helpers";

/**
 * S4-05 leaderboard on the seeded ratings (fixtures/users `e2eRatings`):
 * "Học Sinh Một" 2100 (−12 this week, grade 12), "Học Sinh Hai" 1650 (+150,
 * grade 11); pending/rejected accounts have higher ratings but are never
 * listed. B-03: a board is one class's; the seed puts every student in "Lớp
 * E2E", and the grade-11 students plus "Học Sinh Một" in "Lớp E2E 11".
 * Runner students may add rows of their own while this runs.
 */
async function loginState(
  browser: Browser,
  key: E2eStudentKey,
): Promise<StorageState> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.setExtraHTTPHeaders({
    "x-forwarded-for": `10.46.${Math.floor(Math.random() * 250)}.1`,
  });
  await page.goto("/login?next=/leaderboard");
  await page.getByLabel("Số điện thoại").fill(e2eStudent(key).phone);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/leaderboard");
  const state = await context.storageState();
  await context.close();
  return state;
}

// One login per project, in one worker: the per-account login limit is
// 5/min and auth.spec logs "active" in too.
test.describe.configure({ mode: "default" });
let topStudent: StorageState;
test.beforeAll(async ({ browser }) => {
  topStudent = await loginState(browser, "active");
});
test.use({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires destructured fixture dependencies.
  storageState: async ({}, use) => {
    await use(topStudent);
  },
});

const board = (page: Page) =>
  page.getByRole("list", { name: "Bảng xếp hạng" }).getByRole("listitem");
const myRow = (page: Page) =>
  board(page).filter({ has: page.getByText("Bạn", { exact: true }) });

test("ranks classmates, marks my row, switches class and week (B-03)", async ({
  page,
}) => {
  await page.goto("/leaderboard");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Xếp hạng");
  // The first class by name; I'm also in "Lớp E2E 11".
  await expect(page.getByText(/Các bạn lớp Lớp E2E,/)).toBeVisible();
  const classes = page.getByRole("list", { name: "Lớp học" });
  await expect(classes.getByRole("link")).toHaveText(["Lớp E2E", "Lớp E2E 11"]);

  // Top of the board, with my rating and 7-day change.
  const first = board(page).first();
  await expect(first).toContainText("Học Sinh Một");
  await expect(first).toContainText("Hạng 1");
  await expect(first).toContainText("2 100");
  await expect(first).toContainText("7 ngày: giảm 12");
  await expect(myRow(page)).toHaveCount(1);
  await expect(myRow(page)).toHaveCSS("position", "sticky");
  await expect(page.getByRole("list", { name: "Bảng xếp hạng" })).toContainText(
    "Học Sinh Hai",
  );
  for (const hidden of ["Học Sinh Chờ", "Học Sinh Từ Chối"])
    await expect(page.getByText(hidden)).toHaveCount(0);

  // The other class: grade 11 and me, nobody else.
  await classes.getByRole("link", { name: "Lớp E2E 11" }).click();
  await expect(page).toHaveURL(/\/leaderboard\?class=\d+$/);
  await expect(
    classes.getByRole("link", { name: "Lớp E2E 11" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("list", { name: "Bảng xếp hạng" })).toContainText(
    "Học Sinh Hai",
  );
  await expect(myRow(page)).toHaveCount(1);
  await expect(
    page.getByRole("list", { name: "Bảng xếp hạng" }),
  ).not.toContainText("Học Sinh Ba");

  // Most improved this week, in that class.
  await page.getByRole("link", { name: "7 ngày qua", exact: true }).click();
  await expect(page).toHaveURL(/\/leaderboard\?class=\d+&period=week$/);
  await expect(page.getByRole("link", { name: "7 ngày qua" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(board(page).first()).toContainText("7 ngày: tăng 150");
  await expect(myRow(page)).toContainText("7 ngày: giảm 12");
});

test("an unrated student is nudged to take a test", async ({ browser }) => {
  const context = await browser.newContext({
    storageState: await loginState(browser, "active3"),
  });
  const page = await context.newPage();
  await page.goto("/leaderboard");
  await expect(
    page.getByText("Bạn chưa có rating", { exact: false }),
  ).toBeVisible();
  await expect(myRow(page)).toHaveCount(0);
  await page.goto("/leaderboard?period=week");
  await expect(
    page.getByText("Bạn chưa làm bài tính rating nào trong 7 ngày qua."),
  ).toBeVisible();
  // Garbage params, and a class I'm not in, fall back to the defaults.
  await page.goto("/leaderboard?class=999999&period=year");
  await expect(page.getByRole("link", { name: "Tổng" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await context.close();
});

test("leaderboard fits the viewport and passes axe in light and dark", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const theme of ["light", "dark"] as const) {
    // Reduced motion zeroes transitions, so axe never samples mid-fade.
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    for (const path of ["/leaderboard", "/leaderboard?period=week"]) {
      await page.goto(path);
      await expect(myRow(page)).toBeVisible();
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
    }
    await page.screenshot({
      path: testInfo.outputPath(`leaderboard-${theme}.png`),
      scale: "css",
    });
  }
  expect(errors).toEqual([]);
});
