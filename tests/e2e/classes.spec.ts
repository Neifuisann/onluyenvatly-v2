import AxeBuilder from "@axe-core/playwright";
import { type Browser, expect, type Page, test } from "@playwright/test";
import {
  CREATED_CLASS_PREFIX,
  E2E_PASSWORD,
  e2eTeacherUsername,
  REGISTERED_NAME_PREFIX,
} from "./fixtures/users";
import type { StorageState } from "./runner-helpers";

/**
 * B-03 multi-teacher classes, journey 1 as it is now: a student registers
 * and is signed in at once with no class; the teacher (role `teacher`, one
 * per project, `e2e-teacher-d/m`) creates a class, adds the student by phone,
 * gives it their lesson; the student opens the class and the lesson; the
 * teacher takes the student out again and deletes the class. Plus what a
 * teacher must not reach: the admin's lessons and the platform pages. The
 * seed removes the registered students and the classes made here
 * (`CREATED_CLASS_PREFIX`), so it can run again after `pnpm seed --profile
 * e2e`.
 */

test.describe.configure({ mode: "serial" });

const rand = (n: number) => Math.floor(Math.random() * n);
const randomPhone = () => `09${String(rand(1e8)).padStart(8, "0")}`;
const tag = (project: string) => (project === "mobile" ? "m" : "d");

let teacherState: StorageState;
test.beforeAll(async ({ browser }, info) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.setExtraHTTPHeaders({
    "x-forwarded-for": `10.49.${rand(250)}.1`,
  });
  await page.goto("/login?next=/admin/classes");
  await page
    .getByLabel("Số điện thoại")
    .fill(e2eTeacherUsername(info.project.name));
  await page.getByLabel("Mật khẩu", { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/admin/classes");
  teacherState = await context.storageState();
  await context.close();
});
test.use({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires destructured fixture dependencies.
  storageState: async ({}, use) => {
    await use(teacherState);
  },
});

/** A signed-out visitor in a fresh browser context, with its own client IP. */
async function visitor(browser: Browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.setExtraHTTPHeaders({
    "x-forwarded-for": `10.50.${rand(250)}.${rand(250) + 1}`,
  });
  return { context, page };
}

async function expectGood(page: Page) {
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
    const width = await page.evaluate(
      () => document.documentElement.scrollWidth,
    );
    expect(width).toBeLessThanOrEqual(page.viewportSize()?.width ?? 0);
  }
}

test("journey 1: register → no class → the teacher adds the student and a lesson → the student takes it", async ({
  page,
  browser,
}, info) => {
  const p = tag(info.project.name);
  const phone = randomPhone();
  const fullName = `${REGISTERED_NAME_PREFIX} ${p.toUpperCase()}${rand(9000) + 1000}`;
  const className = `${CREATED_CLASS_PREFIX} ${p}${rand(9000) + 1000}`;
  const lessonTitle = `E2E – Bài của cô (${p})`;

  // The student registers and is in, with no class yet.
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
  await expect(s).toHaveURL(/\/classes$/);
  await expect(s.getByText("Bạn chưa ở lớp nào")).toBeVisible();
  await expect(s.getByText(phone)).toBeVisible();
  await expectGood(s);

  // The teacher creates a class…
  await page.goto("/admin/classes");
  await expectGood(page);
  await page.getByLabel("Tên lớp").fill(className);
  await page.getByLabel("Môn học").selectOption("physics");
  await page.getByRole("button", { name: "Tạo lớp", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/classes\/\d+$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(className);

  // …adds the student by phone (an unknown number is reported back)…
  const box = page.getByLabel("Số điện thoại học sinh");
  await box.fill(`${phone.replace(/^0/, "+84 ")}\n0399999990\nabc`);
  await page
    .getByRole("button", { name: "Thêm học sinh", exact: true })
    .click();
  await expect(page.getByText("Đã thêm 1 học sinh.")).toBeVisible();
  await expect(
    page.getByText(/Chưa có tài khoản học sinh: 0399999990/),
  ).toBeVisible();
  await expect(
    page.getByText(/Không đọc được số điện thoại: abc/),
  ).toBeVisible();
  await expect(box).toHaveValue("0399999990\nabc");
  const members = page.getByRole("list", { name: "Học sinh trong lớp" });
  await expect(members).toContainText(fullName);
  await expect(members).toContainText(phone);

  // …and gives it their lesson; the admin's lessons are not offered.
  const lessons = page.getByRole("group", { name: "Bài có thể giao" });
  await expect(lessons.getByRole("checkbox")).toHaveCount(1);
  await expect(page.getByText("E2E – Điện trường")).toHaveCount(0);
  await lessons
    .getByLabel(new RegExp(lessonTitle.replace(/[()]/g, "\\$&")))
    .check();
  await page.getByRole("button", { name: "Lưu bài của lớp" }).click();
  await expect(page.getByText("Đã giao 1 bài, thu về 0 bài.")).toBeVisible();
  await expectGood(page);
  const classUrl = page.url();

  // The student now sees the class, its lesson, and can open it.
  await s.goto("/classes");
  await s.getByRole("link", { name: `Vào lớp ${className}` }).click();
  await expect(s).toHaveURL(/\/classes\/\d+$/);
  await expect(s.getByRole("heading", { level: 1 })).toHaveText(className);
  // The class list stays mounted (hidden) behind it: the visible copy only.
  await expect(
    s
      .getByText("Giáo viên: Cô giáo", { exact: false })
      .filter({ visible: true }),
  ).toBeVisible();
  await expectGood(s);
  const studentClassUrl = s.url();
  await s
    .getByRole("link", {
      name: new RegExp(lessonTitle.replace(/[()]/g, "\\$&")),
    })
    .click();
  await expect(s).toHaveURL(/\/lessons\/\d+$/);
  await expect(
    s.getByRole("button", { name: "Bắt đầu làm bài" }),
  ).toBeVisible();
  const lessonUrl = s.url();
  // Her single class is where /lessons leads.
  await s.goto("/lessons");
  await expect(s).toHaveURL(studentClassUrl);

  // The teacher takes the student out: the class and the lesson are gone for her.
  await page.goto(classUrl);
  await page.getByRole("button", { name: `Xóa ${fullName} khỏi lớp` }).click();
  const dialog = page.getByRole("dialog", { name: "Xóa khỏi lớp" });
  await expect(dialog).toContainText(fullName);
  await dialog.getByRole("button", { name: "Xóa khỏi lớp" }).click();
  await expect(page.getByText("Đã xóa khỏi lớp.")).toBeVisible();
  await expect(page.getByText("Lớp chưa có học sinh nào.")).toBeVisible();

  await s.goto("/classes");
  await expect(s.getByText("Bạn chưa ở lớp nào")).toBeVisible();
  await s.goto(studentClassUrl);
  await expect(s.getByText("Không tìm thấy lớp")).toBeVisible();
  await s.goto(lessonUrl);
  await expect(s.getByRole("button", { name: "Bắt đầu làm bài" })).toHaveCount(
    0,
  );
  await student.context.close();

  // Deleting the class goes back to the list.
  await page.getByRole("button", { name: "Xóa lớp" }).click();
  await page
    .getByRole("dialog", { name: "Xóa lớp" })
    .getByRole("button", { name: "Xóa lớp" })
    .click();
  await expect(page).toHaveURL(/\/admin\/classes$/);
  // The class page may stay mounted (hidden) behind the list, and the route
  // announcer may still read its title: look in the visible page only.
  await expect(
    page.locator("main").getByText(className).filter({ visible: true }),
  ).toHaveCount(0);
});

test("a teacher sees only their own lessons and none of the platform pages", async ({
  page,
}, info) => {
  const p = tag(info.project.name);
  await page.goto("/admin/lessons");
  await expect(page.getByText(`E2E – Bài của cô (${p})`)).toBeVisible();
  await expect(page.getByText("E2E – Điện trường")).toHaveCount(0);
  await expect(
    page.getByText(`E2E – Bài của cô (${p === "d" ? "m" : "d"})`),
  ).toHaveCount(0);

  // The nav has no platform pages, and their URLs go back to the workspace.
  const nav = page.getByRole("navigation", { name: "Quản trị" }).first();
  await expect(nav.getByRole("link", { name: "Lớp học" })).toHaveCount(1);
  for (const name of ["Cài đặt", "Nhật ký", "Giải thích AI"])
    await expect(nav.getByRole("link", { name })).toHaveCount(0);
  for (const path of [
    "/admin/settings",
    "/admin/audit",
    "/admin/explanations",
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/admin$/);
  }

  // Students of nobody's class of theirs are not listed.
  await page.goto("/admin/students");
  await expect(page.getByText("Học Sinh Một")).toHaveCount(0);
});
