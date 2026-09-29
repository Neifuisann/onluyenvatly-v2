import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { REVIEW_RIGHT } from "./fixtures/lessons";
import { E2E_PASSWORD, e2eStudent, projectStudentKey } from "./fixtures/users";
import {
  openTest,
  press,
  type StorageState,
  singleView,
  visible,
} from "./runner-helpers";

/**
 * Journey 6 (11 §3, S7-06): wrong answers appear in `/review`; a
 * personalized practice checks each answer at once; two correct rounds
 * resolve the mistakes. One student and one lesson per project
 * (`review`/`review2`, `e2e-review-d/m`); needs a fresh seed to run again.
 */
test.describe.configure({ mode: "serial" });

let storageState: StorageState;
test.beforeAll(async ({ browser }, info) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.setExtraHTTPHeaders({
    "x-forwarded-for": `10.47.${Math.floor(Math.random() * 250)}.1`,
  });
  await page.goto("/login?next=/dashboard");
  await page
    .getByLabel("Số điện thoại")
    .fill(e2eStudent(projectStudentKey("review", info.project.name)).phone);
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

const project = (name: string) => (name === "mobile" ? "m" : "d");

async function expectAccessible(page: Page) {
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
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

async function submit(page: Page) {
  await visible(page, "Nộp bài").click();
  await page
    .getByRole("dialog", { name: "Nộp bài?" })
    .getByRole("button", { name: "Nộp bài", exact: true })
    .click();
  await expect(page).toHaveURL(/\/result$/);
}

/** Starts a set of 10 from `/review`, answers every question right, submits. */
async function practiseAllRight(page: Page, expected: number) {
  await page.goto("/review");
  await page.getByRole("button", { name: "Bắt đầu ôn tập" }).click();
  await expect(page).toHaveURL(/\/attempts\/[0-9a-f-]{36}$/);
  await singleView(page);
  for (let i = 0; i < expected; i++) {
    await expect(
      page.getByRole("heading", { name: new RegExp(`^Câu ${i + 1} ·`) }),
    ).toBeVisible();
    await press(page, new RegExp(REVIEW_RIGHT));
    await page.getByRole("button", { name: "Kiểm tra" }).click();
    await expect(page.getByText("Chính xác!", { exact: true })).toBeVisible();
    if (i < expected - 1) await visible(page, "Sau").click();
  }
  await submit(page);
  await expect(
    page.getByRole("heading", { name: "Ôn tập cá nhân" }),
  ).toBeVisible();
}

test("journey 6: mistakes → practice with instant feedback → resolved", async ({
  page,
}, info) => {
  const p = project(info.project.name);

  // Nothing to review yet.
  await page.goto("/review");
  await expect(page.getByText("Chưa có câu nào cần ôn.")).toBeVisible();

  // The test: 1 right, 1 wrong, 1 blank.
  await openTest(page, `e2e-review-${p}`);
  await press(page, /^A\. Chọn phương án này/);
  await visible(page, "Sau").click();
  await press(page, /^B\. Sai một/);
  // Phones show "Nộp bài" on the last question.
  await visible(page, "Sau").click();
  await submit(page);

  // Both misses are in the bank, with their stems (KaTeX on the server).
  await page.goto("/review");
  const list = page.getByRole("region", { name: /^Câu cần ôn/ });
  await expect(list.getByRole("listitem")).toHaveCount(2);
  await expect(list).toContainText(`Câu ôn tập số 2 (${p})`);
  await expect(list).toContainText(`Câu ôn tập số 3 (${p})`);
  await expect(list.locator(".katex").first()).toBeVisible();
  await expect(list).not.toContainText(REVIEW_RIGHT);
  await expect(
    page.getByText("Có 2 câu có thể ôn theo bộ lọc này."),
  ).toBeVisible();
  // Filters: the lesson's chapter, then a type with nothing in it.
  await page.getByLabel("Chương").selectOption(`Ôn tập E2E (${p}) (2)`);
  await page.getByRole("button", { name: "Lọc" }).click();
  await expect(page).toHaveURL(/chapter=/);
  await expect(list.getByRole("listitem")).toHaveCount(2);
  await page.getByRole("link", { name: "Đúng/Sai (0)" }).click();
  await expect(page.getByText("Không có câu nào khớp bộ lọc.")).toBeVisible();
  await page.getByRole("link", { name: "Xóa bộ lọc" }).click();
  await expectAccessible(page);

  // Round 1: a wrong check first, which locks that answer.
  await page.getByRole("button", { name: "Bắt đầu ôn tập" }).click();
  await expect(page).toHaveURL(/\/attempts\/[0-9a-f-]{36}$/);
  const runnerUrl = page.url();
  await singleView(page);
  await expect(page.getByText("Trả lời rồi bấm Kiểm tra")).toBeVisible();
  await press(page, /Sai hai/);
  await page.getByRole("button", { name: "Kiểm tra" }).click();
  await expect(page.getByText("Chưa đúng", { exact: true })).toBeVisible();
  await expect(page.getByText(/^Đáp án: [A-D]$/)).toBeVisible();
  const right = page.getByRole("button", { name: new RegExp(REVIEW_RIGHT) });
  await right.click();
  await expect(right).toHaveAttribute("aria-pressed", "false");
  // After a reload the feedback and the lock are still there.
  await page.reload();
  await singleView(page);
  await expect(page.getByText("Chưa đúng", { exact: true })).toBeVisible();
  await expectAccessible(page);
  await visible(page, "Sau").click();
  await press(page, new RegExp(REVIEW_RIGHT));
  await page.getByRole("button", { name: "Kiểm tra" }).click();
  await expect(page.getByText("Chính xác!", { exact: true })).toBeVisible();
  await submit(page);
  await expect(
    page.getByRole("heading", { name: "Ôn tập cá nhân" }),
  ).toBeVisible();
  await expect(page.getByText("Bài này không tính rating.")).toBeVisible();
  expect(page.url()).toBe(`${runnerUrl}/result`);

  // Two right rounds in a row resolve both.
  await practiseAllRight(page, 2);
  await page.getByRole("link", { name: "Về trang ôn tập" }).click();
  await expect(page).toHaveURL(/\/review$/);
  // One mistake had a wrong round: it needs one more.
  await expect(
    page.getByRole("region", { name: /^Câu cần ôn/ }).getByRole("listitem"),
  ).toHaveCount(1);
  await practiseAllRight(page, 1);
  await page.goto("/review");
  await expect(page.getByText("Chưa có câu nào cần ôn.")).toBeVisible();
});
