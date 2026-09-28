import AxeBuilder from "@axe-core/playwright";
import { type Browser, expect, type Page, test } from "@playwright/test";
import { loginAdminOnce } from "./admin-helpers";
import {
  E2E_PASSWORD,
  e2eStudent,
  projectStudentKey,
  REGISTERED_NAME_PREFIX,
} from "./fixtures/users";
import type { StorageState } from "./runner-helpers";

/**
 * S6-01 student admin: journey 1 in full (register → pending → the teacher
 * approves → login → dashboard), the pending queue with bulk actions, the
 * list and the detail page. Each project
 * has its own admin and its own students (fixtures/users); the seed puts them
 * back, so run `pnpm seed --profile e2e` before running this again. The tests
 * run in order because later ones use what earlier ones changed.
 */

test.describe.configure({ mode: "serial" });

let storageState: StorageState;
test.beforeAll(async ({ browser }, info) => {
  storageState = await loginAdminOnce(
    browser,
    info,
    "students",
    "/admin/students",
  );
});
test.use({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires destructured fixture dependencies.
  storageState: async ({}, use) => {
    await use(storageState);
  },
});

const rand = (n: number) => Math.floor(Math.random() * n);
const randomPhone = () => `09${String(rand(1e8)).padStart(8, "0")}`;
const mine = (
  base: "queueA" | "queueB" | "manage" | "access" | "remove",
  project: string,
) => e2eStudent(projectStudentKey(base, project));

/** A signed-out visitor in a fresh browser context, with its own client IP. */
async function visitor(browser: Browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.setExtraHTTPHeaders({
    "x-forwarded-for": `10.48.${rand(250)}.${rand(250) + 1}`,
  });
  return { context, page };
}

async function login(page: Page, identifier: string, password = E2E_PASSWORD) {
  await page.goto("/login");
  const form = page.locator("main form").filter({ visible: true });
  await form.getByLabel("Số điện thoại").fill(identifier);
  await form.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await form.getByRole("button", { name: "Đăng nhập", exact: true }).click();
}

async function loginToDashboard(page: Page, phone: string, password?: string) {
  await login(page, phone, password);
  await expect(page).toHaveURL(/\/dashboard$/);
}

/** Opens a student's detail page from the "Tất cả" search by phone. */
async function openStudent(page: Page, phone: string, fullName: string) {
  await page.goto(`/admin/students?view=all&q=${phone}`);
  await page.getByRole("link", { name: new RegExp(fullName) }).click();
  await expect(page).toHaveURL(/\/admin\/students\/[0-9a-f-]{36}$/);
  await expect(
    page.getByRole("heading", { level: 1, name: fullName }),
  ).toBeVisible();
}

/**
 * Toggles a queue row by its text, as a thumb does: the whole row is the
 * label, the 20 px box inside it is too small a target on a phone.
 */
const tap = (page: Page, text: string) =>
  page.getByText(text, { exact: true }).click();

const output = (page: Page) => page.locator("main output").first();

async function expectNoOverflow(page: Page) {
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(page.viewportSize()?.width ?? 0);
}

async function expectAccessible(page: Page) {
  for (const scheme of ["light", "dark"] as const) {
    // Reduced motion zeroes transitions, and the reload starts in the scheme,
    // so axe never samples mid-fade.
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    await page.reload();
    const axe = await new AxeBuilder({ page }).analyze();
    expect(
      axe.violations.filter((v) =>
        ["serious", "critical"].includes(v.impact ?? ""),
      ),
      scheme,
    ).toEqual([]);
  }
}

test("journey 1: register → pending → the teacher approves → login → dashboard", async ({
  page,
  browser,
}, info) => {
  const phone = randomPhone();
  const fullName = `${REGISTERED_NAME_PREFIX} ${info.project.name === "mobile" ? "M" : "D"}${rand(9000) + 1000}`;
  const student = await visitor(browser);
  const s = student.page;

  await s.goto("/register");
  await s.getByLabel("Họ và tên").fill(fullName);
  await s.getByLabel("Số điện thoại").fill(phone);
  await s.getByLabel("Ngày sinh").fill("2009-05-17");
  await s.getByLabel("Khối").selectOption("12");
  await s.getByLabel("Lớp").fill("12a1");
  await s.getByLabel("Mật khẩu", { exact: true }).fill("vatly-e2e-2026");
  await s.getByRole("button", { name: "Đăng ký", exact: true }).click();
  await expect(s).toHaveURL(/\/register\/pending$/);

  await login(s, phone, "vatly-e2e-2026");
  await expect(s.getByText(/đang chờ giáo viên duyệt/)).toBeVisible();

  // The teacher sees the new student in the queue, with the nav badge.
  await page.goto("/admin/students");
  await expect(
    page
      .getByRole("link", { name: /^Học sinh \(\d+ mục cần xử lý\)$/ })
      .filter({ visible: true }),
  ).toBeVisible();
  const row = page.getByRole("checkbox", { name: `Chọn ${fullName}` });
  await expect(row).toBeVisible();
  await expect(page.getByText(phone)).toBeVisible();
  await tap(page, fullName);
  await expect(row).toBeChecked();
  await page.getByRole("button", { name: "Duyệt", exact: true }).click();
  await expect(output(page)).toHaveText("Đã duyệt 1 học sinh.");
  await expect(row).toHaveCount(0);

  await loginToDashboard(s, phone, "vatly-e2e-2026");
  await expect(s.getByRole("heading", { level: 1 })).toBeVisible();
  await student.context.close();
});

test("the pending queue: select all, bulk approve and reject with a confirm", async ({
  page,
  browser,
}, info) => {
  const a = mine("queueA", info.project.name);
  const b = mine("queueB", info.project.name);
  await page.goto("/admin/students");
  const checkA = page.getByRole("checkbox", {
    name: `Chọn ${a.fullName}`,
    exact: true,
  });
  const checkB = page.getByRole("checkbox", {
    name: `Chọn ${b.fullName}`,
    exact: true,
  });
  await expect(checkA).toBeVisible();
  await expect(checkB).toBeVisible();
  await expect(page.getByText(a.phone)).toBeVisible();

  // Nothing selected: the bulk buttons are off.
  await expect(
    page.getByRole("button", { name: "Duyệt", exact: true }),
  ).toBeDisabled();
  await tap(page, "Chọn tất cả");
  await expect(checkA).toBeChecked();
  await expect(checkB).toBeChecked();
  await tap(page, "Chọn tất cả");
  await expect(checkA).not.toBeChecked();
  await expect(page.getByText("Đã chọn 0")).toBeVisible();

  await expectNoOverflow(page);
  await expectAccessible(page);

  await tap(page, a.fullName);
  await expect(checkA).toBeChecked();
  await page.getByRole("button", { name: "Duyệt", exact: true }).click();
  await expect(output(page)).toHaveText("Đã duyệt 1 học sinh.");
  await expect(checkA).toHaveCount(0);

  await tap(page, b.fullName);
  await expect(checkB).toBeChecked();
  await page.getByRole("button", { name: "Từ chối", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Từ chối đăng ký?" });
  await expect(dialog).toContainText("1 học sinh sẽ không đăng nhập được");
  await dialog.getByRole("button", { name: "Từ chối", exact: true }).click();
  await expect(output(page)).toHaveText("Đã từ chối 1 học sinh.");
  await expect(checkB).toHaveCount(0);

  // The decisions took effect at login.
  const approved = await visitor(browser);
  await loginToDashboard(approved.page, a.phone);
  await approved.context.close();
  const rejected = await visitor(browser);
  await login(rejected.page, b.phone);
  await expect(
    rejected.page.getByText(/không được phép đăng nhập/),
  ).toBeVisible();
  await rejected.context.close();
});

test("the list searches by name and phone, filters, and opens the detail page", async ({
  page,
}, info) => {
  const student = mine("manage", info.project.name);
  await page.goto("/admin/students?view=all");
  await expect(page.getByRole("link", { name: /Học Sinh Một/ })).toBeVisible();
  await expectNoOverflow(page);
  await expectAccessible(page);

  // Accent-insensitive name words, in any order.
  await page.getByLabel("Tìm học sinh").fill("sinh hoc mot");
  await page.getByRole("button", { name: "Tìm", exact: true }).click();
  await expect(page).toHaveURL(/q=sinh\+hoc\+mot/);
  const rows = page.getByRole("list", { name: "Danh sách học sinh" });
  await expect(rows.getByRole("link", { name: /Học Sinh Một/ })).toBeVisible();
  await expect(rows.getByRole("link", { name: /Học Sinh Hai/ })).toHaveCount(0);

  // Phone prefix, in the local or the +84 form.
  await page.getByLabel("Tìm học sinh").fill("+84 900 000 016");
  await page.getByRole("button", { name: "Tìm", exact: true }).click();
  await expect(rows.getByRole("link")).toHaveCount(1);
  await expect(
    rows.getByRole("link", { name: /Học Sinh Quản Lý/ }),
  ).toBeVisible();

  await page.getByLabel("Tìm học sinh").fill("khong co ai nhu the");
  await page.getByRole("button", { name: "Tìm", exact: true }).click();
  await expect(page.getByText("Không có học sinh phù hợp")).toBeVisible();

  // Status and grade chips keep the search.
  await page.goto("/admin/students?view=all");
  await page.getByRole("link", { name: "Từ chối", exact: true }).click();
  await expect(page).toHaveURL(/status=rejected/);
  await expect(
    rows.getByRole("link", { name: /Học Sinh Từ Chối/ }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Khối 10", exact: true }).click();
  await expect(page.getByText("Không có học sinh phù hợp")).toBeVisible();
  await page.getByRole("link", { name: "Xóa bộ lọc" }).click();
  await expect(page).toHaveURL(/view=all$/);

  await openStudent(page, student.phone, student.fullName);
  // The list page stays mounted (hidden) behind the detail page: look in the
  // profile fields only.
  await expect(page.locator("dd", { hasText: student.phone })).toBeVisible();
  await expect(page.locator("dd", { hasText: "Chưa xếp hạng" })).toBeVisible();
  await expect(
    page.getByText("Không có phiên đăng nhập nào đang hoạt động."),
  ).toBeVisible();
  await expect(page.getByText("Học sinh chưa nộp bài nào.")).toBeVisible();
  await expectNoOverflow(page);
  await expectAccessible(page);
});
