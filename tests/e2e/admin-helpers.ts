import type { Browser, TestInfo } from "@playwright/test";
import {
  E2E_PASSWORD,
  type E2eSpecAdmin,
  e2eSpecAdminUsername,
} from "./fixtures/users";
import type { StorageState } from "./runner-helpers";

/**
 * Logs in this spec's own admin (one per spec and project, see
 * fixtures/users) once and returns the cookies for `test.use`.
 */
export async function loginAdminOnce(
  browser: Browser,
  info: TestInfo,
  spec: E2eSpecAdmin,
  next = "/admin/lessons",
): Promise<StorageState> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.setExtraHTTPHeaders({
    "x-forwarded-for": `10.46.${Math.floor(Math.random() * 250)}.1`,
  });
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page
    .getByLabel("Số điện thoại")
    .fill(e2eSpecAdminUsername(spec, info.project.name));
  await page.getByLabel("Mật khẩu", { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.waitForURL((url) => url.pathname === next);
  const state = await context.storageState();
  await context.close();
  return state;
}
