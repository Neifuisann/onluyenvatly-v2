import { expect, test } from "@playwright/test";
import { expectAccessible } from "./a11y";
import { E2E_PASSWORD, e2eStudent, projectStudentKey } from "./fixtures/users";
import type { StorageState } from "./runner-helpers";

/**
 * S8-04 `/settings`, one student per project ("account" / "account2"); the
 * seed resets name, class, privacy and the deletion request.
 */
test.describe.configure({ mode: "serial" });
let storageState: StorageState;
test.beforeAll(async ({ browser }, info) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.setExtraHTTPHeaders({
    "x-forwarded-for": `10.51.${Math.floor(Math.random() * 250)}.1`,
  });
  await page.goto("/login?next=/settings");
  const student = e2eStudent(projectStudentKey("account", info.project.name));
  await page.getByLabel("Số điện thoại").fill(student.phone);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/settings");
  storageState = await context.storageState();
  await context.close();
});
test.use({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires destructured fixture dependencies.
  storageState: async ({}, use) => {
    await use(storageState);
  },
});

test("every section renders and the page is accessible", async ({ page }) => {
  await page.goto("/settings");
  await expect(
    page.getByRole("heading", { level: 1, name: "Cài đặt tài khoản" }),
  ).toBeVisible();
  for (const name of [
    "Ảnh đại diện",
    "Thông tin cá nhân",
    "Mật khẩu",
    "Quyền riêng tư",
    "Thiết bị đăng nhập",
    "Dữ liệu của tôi",
    "Xóa tài khoản",
  ])
    await expect(page.getByRole("region", { name })).toBeVisible();
  await expect(page.getByText("Thiết bị này")).toBeVisible();
  await expectAccessible(page);
});

test("profile: a validation error, then a saved class", async ({ page }) => {
  await page.goto("/settings");
  const name = page.getByLabel("Họ và tên");
  await name.fill("A");
  await page.getByRole("button", { name: "Lưu thông tin" }).click();
  await expect(name).toHaveAttribute("aria-invalid", "true");
  await expect(name).toBeFocused();

  // A class this run has not saved yet, so a retry still changes something.
  const className = `10b${Math.floor(Math.random() * 90) + 10}`;
  await name.fill("Học Sinh Cài Đặt Mới");
  await page.getByLabel("Lớp", { exact: true }).fill(className);
  await page.getByRole("button", { name: "Lưu thông tin" }).click();
  await expect(page.getByText("Đã lưu thông tin.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Lớp", { exact: true })).toHaveValue(
    className.toUpperCase(),
  );
  await expect(page.getByLabel("Họ và tên")).toHaveValue(
    "Học Sinh Cài Đặt Mới",
  );
});

test("privacy is saved when toggled", async ({ page }) => {
  await page.goto("/settings");
  const box = page.getByLabel("Chỉ hiện tên viết tắt trên bảng xếp hạng");
  // Flip whatever is stored (the seed stores off), so a retry works too.
  const next = !(await box.isChecked());
  await box.setChecked(next);
  await expect(page.getByText("Đã lưu lựa chọn.")).toBeVisible();
  await page.reload();
  await expect(box).toBeChecked({ checked: next });
});

test("export downloads my data as JSON", async ({ page }) => {
  await page.goto("/settings");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Tải dữ liệu" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(
    /^du-lieu-cua-toi-\d{4}-\d{2}-\d{2}\.json$/,
  );
});

test("deletion: wrong password, request, then cancel", async ({ page }) => {
  await page.goto("/settings");
  const password = page.getByLabel("Nhập mật khẩu để xác nhận");
  await password.fill("wrong-password");
  await page.getByRole("button", { name: "Gửi yêu cầu xóa" }).click();
  const dialog = page.getByRole("dialog", { name: "Xóa tài khoản" });
  await dialog.getByRole("button", { name: "Gửi yêu cầu xóa" }).click();
  await expect(password).toHaveAttribute("aria-invalid", "true");

  await password.fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Gửi yêu cầu xóa" }).click();
  await dialog.getByRole("button", { name: "Gửi yêu cầu xóa" }).click();
  await expect(
    page.getByText(/Bạn đã gửi yêu cầu xóa tài khoản lúc/),
  ).toBeVisible();

  await page.getByRole("button", { name: "Hủy yêu cầu" }).click();
  await expect(page.getByText("Đã hủy yêu cầu xóa tài khoản.")).toBeVisible();
  await expect(password).toBeVisible();
});
