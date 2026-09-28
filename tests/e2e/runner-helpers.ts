import {
  type Browser,
  expect,
  type Page,
  type TestInfo,
} from "@playwright/test";
import { E2E_PASSWORD, e2eStudent } from "./fixtures/users";

/** Each Playwright project takes tests as its own student (fixtures/users). */
export const runnerStudent = (info: TestInfo) =>
  e2eStudent(info.project.name === "mobile" ? "runner2" : "runner");

export type StorageState = Awaited<
  ReturnType<import("@playwright/test").BrowserContext["storageState"]>
>;

/** Logs in once per project and returns the cookies for `test.use`. */
export async function loginOnce(
  browser: Browser,
  info: TestInfo,
): Promise<StorageState> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.setExtraHTTPHeaders({
    "x-forwarded-for": `10.45.${Math.floor(Math.random() * 250)}.1`,
  });
  await page.goto("/login?next=/dashboard");
  await page.getByLabel("Số điện thoại").fill(runnerStudent(info).phone);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/dashboard");
  const state = await context.storageState();
  await context.close();
  return state;
}

/**
 * Opens a lesson by its legacy key and starts (or continues) the test.
 * Returns the attempt URL.
 */
export async function openTest(page: Page, legacyKey: string) {
  await page.goto(`/lesson/${legacyKey}`);
  await expect(page).toHaveURL(/\/lessons\/\d+$/);
  const cont = page.getByRole("link", { name: "Tiếp tục làm bài" });
  const start = page.getByRole("button", { name: "Bắt đầu làm bài" });
  await expect(cont.or(start)).toBeVisible();
  await ((await cont.isVisible()) ? cont : start).click();
  await expect(page).toHaveURL(/\/attempts\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: /^Câu 1 ·/ })).toBeVisible();
  await singleView(page);
  return page.url();
}

/** Desktops open in the list view (07 §5.2); specs start one-per-screen. */
export async function singleView(page: Page) {
  const toggle = page.getByRole("button", { name: /^Xem (tất cả|từng câu)$/ });
  await expect(toggle).toBeVisible();
  if ((await toggle.textContent())?.includes("từng câu")) await toggle.click();
  await expect(page.getByRole("button", { name: "Xem tất cả" })).toBeVisible();
}

/** Visible copy of a control that exists in both the bottom bar and the side panel. */
export const visible = (page: Page, name: string | RegExp) =>
  page.getByRole("button", { name, exact: typeof name === "string" }).filter({
    visible: true,
  });
