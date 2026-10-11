import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { loginAdminOnce } from "./admin-helpers";
import { CREATED_ADMIN_PREFIX } from "./fixtures/users";
import type { StorageState } from "./runner-helpers";

/**
 * S6-03 global settings: the announcement reaches the student shell (then
 * is cleared again), a new admin can log in, and the page is accessible in
 * light and dark and fits 360 px. Own admin per project (fixtures/users).
 * Registration and single-session are covered by the integration test
 * `features/settings/service.test.ts`: turning them off here would break the
 * specs running next to this one.
 */

let storageState: StorageState;
test.beforeAll(async ({ browser }, info) => {
  storageState = await loginAdminOnce(
    browser,
    info,
    "settings",
    "/admin/settings",
  );
});
test.use({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires destructured fixture dependencies.
  storageState: async ({}, use) => {
    await use(storageState);
  },
});

const rand = (n: number) => Math.floor(Math.random() * n);

const general = (page: Page) =>
  page.getByRole("region", { name: "Cài đặt chung" });

async function saveAnnouncement(page: Page, text: string) {
  await page.goto("/admin/settings");
  const form = general(page);
  await form.getByLabel("Thông báo cho học sinh").fill(text);
  await form.getByRole("button", { name: "Lưu cài đặt" }).click();
  await expect(form.locator("output")).toHaveText(
    /^(Đã lưu cài đặt\.|Không có thay đổi nào để lưu\.)$/,
  );
}

async function expectNoOverflow(page: Page) {
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(page.viewportSize()?.width ?? 0);
}

test("the announcement shows in the student shell, then goes away", async ({
  page,
}, info) => {
  // The setting is global: one project changes it, so the two never race.
  test.skip(info.project.name !== "chromium", "global setting, desktop only");
  const text = `Thông báo E2E ${rand(1e6)}: nghỉ học thứ Bảy`;
  try {
    await saveAnnouncement(page, `  ${text}\n`);
    await expect(general(page).locator("output")).toHaveText("Đã lưu cài đặt.");
    // Admins may open student pages, which carry the student shell.
    await page.goto("/lessons");
    await expect(page.getByText(text, { exact: true })).toBeVisible();

    // Over 300 characters is refused on the field, nothing saved.
    await page.goto("/admin/settings");
    const field = general(page).getByLabel("Thông báo cho học sinh");
    await expect(field).toHaveValue(text);
    await field.fill("a".repeat(301));
    await general(page).getByRole("button", { name: "Lưu cài đặt" }).click();
    await expect(field).toHaveAttribute("aria-invalid", "true");
    await expect(
      general(page).getByText("Thông báo tối đa 300 ký tự."),
    ).toBeVisible();
    await page.reload();
    await expect(
      general(page).getByLabel("Thông báo cho học sinh"),
    ).toHaveValue(text);
  } finally {
    await saveAnnouncement(page, "");
  }
  await page.goto("/lessons");
  await expect(page.getByText(text)).toHaveCount(0);
});

test("a new admin appears in the list and can log in", async ({
  page,
  browser,
}, info) => {
  const username = `${CREATED_ADMIN_PREFIX}${info.project.name === "mobile" ? "m" : "d"}${rand(1e6)}`;
  const fullName = `Quản trị E2E ${username.slice(-6)}`;
  const password = "Qtv-e2e-2026";
  await page.goto("/admin/settings");
  const create = page.getByRole("region", { name: "Thêm giáo viên" });
  // A teacher by default (B-03); this one is an admin.
  await expect(create.getByRole("radio", { name: /^Giáo viên/ })).toBeChecked();
  await create.getByRole("radio", { name: /^Quản trị viên/ }).check();

  // Policy errors come back on the fields.
  await create.getByLabel("Họ và tên").fill(fullName);
  await create.getByLabel("Tên đăng nhập").fill(username);
  await create.getByLabel("Mật khẩu", { exact: true }).fill("12345678");
  await create.getByRole("button", { name: "Tạo tài khoản" }).click();
  await expect(
    create.getByText("Mật khẩu không được chỉ gồm chữ số."),
  ).toBeVisible();
  await expect(create.getByLabel("Mật khẩu", { exact: true })).toHaveValue("");

  await create.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await create.getByRole("button", { name: "Tạo tài khoản" }).click();
  await expect(create.locator("output")).toHaveText(
    `Đã tạo tài khoản cho ${fullName}.`,
  );
  await expect(create.getByLabel("Tên đăng nhập")).toHaveValue("");
  const admins = page.getByRole("list", {
    name: "Danh sách giáo viên và quản trị viên",
  });
  await expect(admins.getByText(fullName)).toBeVisible();
  await expect(
    admins.getByRole("listitem").filter({ hasText: fullName }),
  ).toContainText("Quản trị viên");
  await expect(admins).toContainText(`Tên đăng nhập ${username}`);

  // The same username again is refused.
  await create.getByLabel("Họ và tên").fill(fullName);
  await create.getByLabel("Tên đăng nhập").fill(username.toUpperCase());
  await create.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await create.getByRole("button", { name: "Tạo tài khoản" }).click();
  await expect(
    create.getByText("Tên đăng nhập này đã được dùng."),
  ).toBeVisible();

  // The new admin logs in straight to the admin home (no forced change).
  const context = await browser.newContext();
  const other = await context.newPage();
  await other.setExtraHTTPHeaders({
    "x-forwarded-for": `10.45.${rand(250)}.${rand(250) + 1}`,
  });
  await other.goto("/login");
  await other.getByLabel("Số điện thoại").fill(username);
  await other.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await other.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(other).toHaveURL(/\/admin$/);
  await other.goto("/admin/settings");
  await expect(
    other
      .getByRole("list", { name: "Danh sách giáo viên và quản trị viên" })
      .getByRole("listitem")
      .filter({ hasText: fullName }),
  ).toContainText("Bạn");
  await context.close();
});

test("settings page: accessible in light and dark, fits 360 px", async ({
  page,
}) => {
  await page.goto("/admin/settings");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Cài đặt");
  const form = general(page);
  await expect(form.getByLabel("Mở đăng ký tài khoản mới")).toBeChecked();
  await expect(form.getByLabel("Bật tính năng AI")).toBeVisible();
  await expect(
    form.getByLabel("Số lượt gọi AI tối đa mỗi ngày"),
  ).toHaveAttribute("max", "5000");
  await expect(
    page.getByRole("list", { name: "Danh sách giáo viên và quản trị viên" }),
  ).toContainText("Bạn");
  await expectNoOverflow(page);
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
});
