import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { loginAdminOnce } from "./admin-helpers";
import { STATS_LESSON } from "./fixtures/stats";
import type { StorageState } from "./runner-helpers";

/**
 * S6-05 lesson statistics. Read only: the seed
 * gives the archived stats lesson a current version 2 with the five
 * hand-computed attempts of fixtures/stats.ts (numbers checked here are the
 * same literals as `lessons/domain/stats.test.ts`) and one attempt on
 * version 1. Own admin per project.
 */

let storageState: StorageState;
test.beforeAll(async ({ browser }, info) => {
  storageState = await loginAdminOnce(browser, info, "stats");
});
test.use({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires destructured fixture dependencies.
  storageState: async ({}, use) => {
    await use(storageState);
  },
});

const tile = (page: Page, label: string) =>
  page
    .locator("dt", { hasText: label })
    .locator("xpath=following-sibling::dd[1]");

const questionHeadings = (page: Page) =>
  page
    .getByRole("region", { name: "Từng câu" })
    .getByRole("heading", { level: 3 });

async function expectNoOverflow(page: Page) {
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(page.viewportSize()?.width ?? 0);
}

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
    await expectNoOverflow(page);
  }
}

async function openStats(page: Page) {
  await page.goto("/admin/lessons?q=thong%20ke");
  await page
    .getByRole("link", { name: `Thống kê: ${STATS_LESSON.title}`, exact: true })
    .click();
  await expect(page).toHaveURL(/\/admin\/lessons\/\d+\/stats$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    `Thống kê: ${STATS_LESSON.title}`,
  );
}

test("lesson stats match the hand-computed fixture", async ({ page }) => {
  await openStats(page);
  // The current version is the default.
  await expect(page.getByLabel("Phiên bản", { exact: true })).toHaveValue(
    /\d+/,
  );
  await expect(
    page.getByLabel("Phiên bản", { exact: true }).locator("option:checked"),
  ).toHaveText("Phiên bản 2 (đang dùng) · 5 lượt");

  await expect(tile(page, "Lượt nộp")).toHaveText("5");
  await expect(tile(page, "Học sinh")).toHaveText("5");
  await expect(tile(page, "Điểm trung bình")).toHaveText("4,56");
  await expect(tile(page, "Trung vị")).toHaveText("3,33");

  const histogram = page.getByRole("region", { name: "Phân bố điểm" });
  await expect(histogram.getByRole("listitem")).toHaveCount(10);
  for (const text of [
    "Điểm từ 0 đến dưới 1: 2 lượt",
    "Điểm từ 1 đến dưới 2: 0 lượt",
    "Điểm từ 3 đến dưới 4: 1 lượt",
    "Điểm từ 8 đến dưới 9: 1 lượt",
    "Điểm từ 9 đến 10: 1 lượt",
  ])
    await expect(histogram.getByText(text, { exact: true })).toBeAttached();

  await expect(questionHeadings(page)).toHaveText([
    "Câu 1 · Trắc nghiệm",
    "Câu 2 · Đúng/Sai",
    "Câu 3 · Trả lời ngắn",
  ]);

  // mcq: letters mapped back through each attempt's option order.
  const mcq = page.getByRole("article", { name: "Câu 1 · Trắc nghiệm" });
  await expect(mcq).toContainText("Đúng hoàn toàn 40% (2/5)");
  await expect(mcq).toContainText("Điểm TB 40%");
  await expect(mcq).toContainText("Đã trả lời 4/5");
  const options = mcq
    .getByRole("list", { name: "Các phương án câu 1" })
    .getByRole("listitem");
  await expect(options).toHaveCount(5);
  await expect(options.nth(0)).toContainText("1 lượt · 20%");
  await expect(options.nth(1)).toContainText("1 lượt · 20%");
  await expect(options.nth(2)).toContainText("Đáp án");
  await expect(options.nth(2)).toContainText("2 lượt · 40%");
  await expect(options.nth(3)).toContainText("0 lượt · 0%");
  await expect(options.nth(4)).toHaveText(/Bỏ trống\s*1 lượt/);
  const students = mcq.getByText("Học sinh theo phương án");
  await students.click();
  await expect(
    mcq.getByText("Nguyễn Thống Kê An, Trần Thống Kê Bình", { exact: true }),
  ).toBeVisible();
  await expect(
    mcq.getByText("Hoàng Thống Kê Giang", { exact: true }),
  ).toBeVisible();

  const tf = page.getByRole("article", { name: "Câu 2 · Đúng/Sai" });
  await expect(tf).toContainText("Đúng hoàn toàn 20% (1/5)");
  await expect(tf).toContainText("Điểm TB 37%");
  const statements = tf
    .getByRole("list", { name: "Các mệnh đề câu 2" })
    .getByRole("listitem");
  await expect(statements.nth(0)).toContainText("Chọn đúng: 80% (4/5)");
  await expect(statements.nth(1)).toContainText("Chọn đúng: 60% (3/5)");
  await expect(statements.nth(2)).toContainText("Chọn đúng: 20% (1/5)");
  await expect(statements.nth(2)).toContainText("Bỏ trống: 2");
  await expect(statements.nth(3)).toContainText("Chọn đúng: 40% (2/5)");

  const short = page.getByRole("article", { name: "Câu 3 · Trả lời ngắn" });
  await expect(short).toContainText("Đúng hoàn toàn 60% (3/5)");
  const answers = short
    .getByRole("list", { name: "Câu trả lời thường gặp của câu 3" })
    .getByRole("listitem");
  await expect(answers).toHaveCount(4);
  await expect(answers.nth(0)).toHaveText(/^1\.5\s*Đúng\s*2 lượt$/);
  await expect(answers.nth(1)).toHaveText(/^1\.50\s*Đúng\s*1 lượt$/);
  await expect(answers.nth(2)).toHaveText(/^2\s*Sai\s*1 lượt$/);
  await expect(answers.nth(3)).toHaveText(/Bỏ trống\s*1 lượt/);
});

test("hardest-first sort and the version picker", async ({ page }) => {
  await openStats(page);
  const sort = page.getByRole("navigation", { name: "Sắp xếp câu hỏi" });
  await sort.getByRole("link", { name: "Khó nhất trước" }).click();
  await expect(page).toHaveURL(/version=\d+&sort=hardest/);
  await expect(
    sort.getByRole("link", { name: "Khó nhất trước" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(questionHeadings(page)).toHaveText([
    "Câu 2 · Đúng/Sai",
    "Câu 1 · Trắc nghiệm",
    "Câu 3 · Trả lời ngắn",
  ]);

  // Version 1: one perfect attempt; the sort is kept.
  await page
    .getByLabel("Phiên bản", { exact: true })
    .selectOption({ label: "Phiên bản 1 · 1 lượt" });
  await page.getByRole("button", { name: "Xem", exact: true }).click();
  await expect(tile(page, "Lượt nộp")).toHaveText("1");
  await expect(page).toHaveURL(/sort=hardest/);
  await expect(tile(page, "Điểm trung bình")).toHaveText("10");
  await expect(questionHeadings(page)).toHaveText([
    "Câu 1 · Trắc nghiệm",
    "Câu 2 · Trả lời ngắn",
  ]);

  await sort.getByRole("link", { name: "Theo thứ tự" }).click();
  await expect(page).not.toHaveURL(/sort=/);
  await expect(tile(page, "Lượt nộp")).toHaveText("1");
});

test("the editor links to the stats; accessible in light and dark, fits 360 px", async ({
  page,
}) => {
  await openStats(page);
  await page.getByRole("link", { name: "Sửa bài" }).click();
  await expect(page).toHaveURL(/\/edit$/);
  await page.getByRole("link", { name: "Thống kê", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/lessons\/\d+\/stats$/);
  await expect(tile(page, "Lượt nộp")).toHaveText("5");
  await page.getByText("Học sinh theo phương án").click();
  await expectAccessible(page);

  // A lesson without submitted attempts: the empty state.
  await page.goto("/admin/lessons?q=ban%20nhap%20kin");
  await page
    .getByRole("link", { name: "Thống kê: E2E – Bản nháp kín", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Chưa có bài nộp" }),
  ).toBeVisible();
  await expectNoOverflow(page);
});
