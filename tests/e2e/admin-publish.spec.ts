import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { loginAdminOnce } from "./admin-helpers";
import { E2E_PASSWORD, e2eStudent } from "./fixtures/users";
import {
  emulateScheme,
  press,
  type StorageState,
  singleView,
  visible,
} from "./runner-helpers";

/**
 * Journey 7 (11 §3, S5-04): a student starts the seeded lesson; the teacher
 * pastes a new version with an error, follows the validation to its line,
 * fixes it and publishes. The attempt in progress is still graded on the
 * old version; a new attempt gets the new one. Each project has its own
 * lesson, student and admin, so the two run in parallel.
 */

const suffix = (project: string) => (project === "mobile" ? "m" : "d");

let adminState: StorageState;
test.beforeAll(async ({ browser }, info) => {
  adminState = await loginAdminOnce(browser, info, "publish");
});

async function loginStudent(page: Page, project: string) {
  const student = e2eStudent(project === "mobile" ? "publish2" : "publish");
  await page.setExtraHTTPHeaders({
    "x-forwarded-for": `10.47.${Math.floor(Math.random() * 250)}.1`,
  });
  await page.goto("/login?next=/dashboard");
  await page.getByLabel("Số điện thoại").fill(student.phone);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/dashboard");
}

// Version 2: question 1's key moves from B to A, and a third question.
// The first line has no "*": the error to fix.
const V2_WITH_ERROR = `Câu 1: Đơn vị đo biên độ là
A. 5 cm
B. 2 cm

Câu 2: Đơn vị của tần số là
A. s
*B. Hz

Câu 3: Tính $T$ (s) khi $f = 2$ Hz.
Answer: 0,5`;

test("journey 7: publish a new version; the old attempt keeps the old one", async ({
  page,
  browser,
}, info) => {
  const p = suffix(info.project.name);
  const title = `E2E – Xuất bản (${p})`;

  // The student starts version 1 and answers both questions correctly.
  await loginStudent(page, info.project.name);
  await page.goto(`/lesson/e2e-publish-${p}`);
  await expect(page).toHaveURL(/\/lessons\/\d+$/);
  const lessonUrl = page.url();
  await expect(page.getByText("2 câu").first()).toBeVisible();
  await page.getByRole("button", { name: "Bắt đầu làm bài" }).click();
  await expect(page).toHaveURL(/\/attempts\/[0-9a-f-]{36}$/);
  await singleView(page);
  await press(page, /^B\. 5 cm/);
  await visible(page, "Sau").click();
  await press(page, /^B\. Hz/);

  // The teacher publishes version 2 meanwhile.
  const admin = await browser.newContext({
    storageState: adminState,
    viewport: page.viewportSize(),
    ...(info.project.use.baseURL && { baseURL: info.project.use.baseURL }),
  });
  const editor = await admin.newPage();
  await editor.goto(
    `/admin/lessons?q=${encodeURIComponent(`xuat ban (${p})`)}`,
  );
  await editor.getByRole("link", { name: title, exact: true }).click();
  await expect(editor).toHaveURL(/\/admin\/lessons\/\d+\/edit$/);
  const phone = (editor.viewportSize()?.width ?? 0) < 1024;
  const cm = editor.locator(".cm-content");
  await cm.click();
  await editor.keyboard.press("ControlOrMeta+A");
  await editor.keyboard.insertText(V2_WITH_ERROR);
  // A draft saves with its error and survives a reload; students see nothing yet.
  await editor.getByRole("button", { name: "Lưu nháp" }).click();
  await expect(
    editor.getByRole("status").filter({ hasText: "Còn 1 lỗi" }),
  ).toBeVisible();
  await expect(editor.getByText("Chưa lưu")).toHaveCount(0);
  await editor.reload();
  await expect(editor.getByText("Đang sửa bản nháp")).toBeVisible();
  await expect(cm).toContainText("Đơn vị đo biên độ là");

  // Step 2 blocks "Xuất bản" while the text has an error and links back.
  await editor.getByRole("button", { name: "Tiếp tục" }).click();
  await expect(editor).toHaveURL(/\/edit\?step=settings$/);
  const publish = editor.getByRole("button", { name: "Xuất bản", exact: true });
  await expect(publish).toBeDisabled();
  await expect(
    editor.getByText("Nội dung còn 1 lỗi", { exact: true }),
  ).toBeVisible();
  await editor.getByRole("button", { name: "Sửa ở bước 1" }).click();
  await expect(editor).toHaveURL(/\/edit$/);
  if (phone) await editor.getByText("Xem trước", { exact: true }).click();
  await editor.getByRole("button", { name: /^Dòng 1, cột 1/ }).click();
  await expect(editor.locator(".cm-activeLine")).toContainText("Câu 1:");
  await editor.keyboard.press("ArrowDown");
  await editor.keyboard.type("*");
  // "Tiếp tục" saves the fixed draft first.
  await editor.getByRole("button", { name: "Tiếp tục" }).click();
  await expect(
    editor.getByRole("status").filter({ hasText: "Đã lưu bản nháp." }),
  ).toBeVisible();
  await expect(publish).toBeEnabled();
  await publish.click();
  const dialog = editor.getByRole("dialog", { name: "Xuất bản bài tập?" });
  await expect(dialog).toContainText("vẫn được chấm theo nội dung cũ");
  await dialog.getByRole("button", { name: "Xuất bản", exact: true }).click();
  // The full message: step 2's settings note also says "…bài đã xuất bản."
  // (hasText ignores case).
  await expect(
    editor.getByRole("status").filter({
      hasText: "Đã xuất bản. Học sinh thấy nội dung mới ngay.",
    }),
  ).toBeVisible();
  await expect(editor.getByText("Chưa lưu")).toHaveCount(0);
  for (const scheme of ["light", "dark"] as const) {
    await emulateScheme(editor, scheme);
    const axe = await new AxeBuilder({ page: editor }).analyze();
    expect(
      axe.violations.filter((v) =>
        ["serious", "critical"].includes(v.impact ?? ""),
      ),
    ).toEqual([]);
  }
  await admin.close();

  // The student submits: graded on version 1, where B is right.
  await visible(page, "Nộp bài").click();
  const submit = page.getByRole("dialog", { name: "Nộp bài?" });
  await submit.getByRole("button", { name: "Nộp bài", exact: true }).click();
  await expect(page).toHaveURL(/\/result$/);
  const score = page.getByRole("region", { name: "Điểm" });
  await expect(score).toContainText("2/2 câu đúng");
  await expect(score).toContainText("0,5/0,5 điểm");

  // The student now sees version 2: three questions.
  await page.goto(lessonUrl);
  await expect(page.getByText("3 câu").first()).toBeVisible();
  await page.getByRole("button", { name: "Bắt đầu làm bài" }).click();
  await expect(page).toHaveURL(/\/attempts\/[0-9a-f-]{36}$/);
  await singleView(page);
  await expect(page.getByText("Đơn vị đo biên độ là")).toBeVisible();
  await page.getByRole("button", { name: "Xem tất cả" }).click();
  await expect(page.getByRole("heading", { name: /^Câu \d ·/ })).toHaveCount(3);
});
