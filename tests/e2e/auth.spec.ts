import { expect, type Page, test } from "@playwright/test";
import { expectAccessible } from "./a11y";
import { E2E_PASSWORD, e2eAdmin, e2eStudent } from "./fixtures/users";

/**
 * Journey 1 without the admin-approval step (S1-06): register → pending,
 * login states, role landing, ?next= handling, logout. Needs `pnpm seed
 * --profile e2e`.
 */

const randomPhone = () =>
  `09${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;

// Each test gets its own client IP so the per-IP limits (06 §4) don't leak
// between tests. On Vercel the edge overwrites x-forwarded-for.
test.beforeEach(async ({ page }) => {
  const octet = () => Math.floor(Math.random() * 254) + 1;
  await page.setExtraHTTPHeaders({
    "x-forwarded-for": `10.${octet()}.${octet()}.${octet()}`,
  });
});

async function login(page: Page, identifier: string, password = E2E_PASSWORD) {
  // Scope to the visible form: after a client-side navigation Next keeps the
  // previous page mounted but hidden (<Activity>).
  const form = page.locator("main form").filter({ visible: true });
  await form.getByLabel("Số điện thoại").fill(identifier);
  await form.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await form.getByRole("button", { name: "Đăng nhập", exact: true }).click();
}

async function logout(page: Page) {
  await page.locator("details > summary").filter({ visible: true }).click();
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
}

test("signed-out visitors are sent to login with ?next=", async ({ page }) => {
  await page.goto("/dashboard?tab=1");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard%3Ftab%3D1$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Đăng nhập");
});

test("register → pending screen → login says the account awaits approval", async ({
  page,
}) => {
  const phone = randomPhone();
  await page.goto("/register");
  await page.getByLabel("Họ và tên").fill("Nguyễn Văn Kiểm Thử");
  await page.getByLabel("Số điện thoại").fill(phone);
  await page.getByLabel("Ngày sinh").fill("2009-05-17");
  await page.getByLabel("Khối").selectOption("12");
  await page.getByLabel("Lớp").fill("12a1");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("vatly-e2e-2026");
  await page.getByRole("button", { name: "Đăng ký", exact: true }).click();

  await expect(page).toHaveURL(/\/register\/pending$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Đã gửi đăng ký",
  );

  await page.getByRole("link", { name: "Về trang đăng nhập" }).click();
  await login(page, phone, "vatly-e2e-2026");
  await expect(
    page.getByRole("status").filter({ hasText: /đang chờ giáo viên duyệt/ }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("register shows field errors and keeps what was typed", async ({
  page,
}) => {
  await page.goto("/register");
  await page.getByLabel("Họ và tên").fill("Trần Thị B");
  await page.getByLabel("Số điện thoại").fill("12345");
  await page.getByLabel("Ngày sinh").fill("2009-05-17");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("12345678");
  await page.getByRole("button", { name: "Đăng ký", exact: true }).click();

  await expect(page.getByText("Số điện thoại không hợp lệ")).toBeVisible();
  await expect(
    page.getByText("Mật khẩu không được chỉ gồm chữ số."),
  ).toBeVisible();
  await expect(page.getByLabel("Họ và tên")).toHaveValue("Trần Thị B");
  await expect(page.getByLabel("Số điện thoại")).toBeFocused();
  // S8-06: the form with its errors showing, in both themes.
  await expectAccessible(page);
});

test("a registered phone cannot register again", async ({ page }) => {
  await page.goto("/register");
  await page.getByLabel("Họ và tên").fill("Học Sinh Trùng");
  await page.getByLabel("Số điện thoại").fill(e2eStudent("active3").phone);
  await page.getByLabel("Ngày sinh").fill("2009-05-17");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("vatly-e2e-2026");
  await page.getByRole("button", { name: "Đăng ký", exact: true }).click();
  await expect(
    page.getByText("Số điện thoại này đã được đăng ký."),
  ).toBeVisible();
});

test("wrong password and rejected accounts get clear messages", async ({
  page,
}) => {
  await page.goto("/login");
  await login(page, e2eStudent("rejected").phone, "definitely-wrong");
  await expect(
    page.getByText("Sai số điện thoại hoặc mật khẩu."),
  ).toBeVisible();

  await login(page, e2eStudent("rejected").phone);
  await expect(page.getByText(/không được phép đăng nhập/)).toBeVisible();
});

test("a student logs in, lands on ?next=, and logs out", async ({ page }) => {
  await page.goto("/dashboard");
  await login(page, e2eStudent("active").phone);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Chào Một");
  await expect(
    page
      .getByRole("link", { name: "Bài tập", exact: true })
      .filter({ visible: true }),
  ).toBeVisible();

  // Students can't open admin pages.
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/dashboard$/);

  await logout(page);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?next=/);
});

test("?next= can't redirect off-site", async ({ page }) => {
  await page.goto("/login?next=//evil.example/x");
  await login(page, e2eStudent("active2").phone);
  await expect(page).toHaveURL(/localhost:\d+\/dashboard$/);
});

test("the seeded admin lands on the admin shell", async ({ page }) => {
  await page.goto("/login");
  await login(page, e2eAdmin.username);
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tổng quan");
  await expect(
    page
      .getByRole("navigation", { name: "Quản trị" })
      .filter({ visible: true }),
  ).toBeVisible();
});
