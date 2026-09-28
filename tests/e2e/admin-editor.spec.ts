import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { normalizeV1Questions } from "../../src/features/lessons/domain/legacy.ts";
import { serializeLesson } from "../../src/features/lessons/domain/serializer.ts";
import { loginAdminOnce } from "./admin-helpers";
import {
  press,
  type StorageState,
  singleView,
  visible,
} from "./runner-helpers";

/**
 * S5-02 editor on the seeded draft: live parse → validation panel linking to
 * lines → preview with server KaTeX → stats. Nothing is saved (S5-04), so
 * both projects can run it next to the list specs.
 */

let storageState: StorageState;
test.beforeAll(async ({ browser }, info) => {
  storageState = await loginAdminOnce(browser, info, "editor");
});
test.use({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires destructured fixture dependencies.
  storageState: async ({}, use) => {
    await use(storageState);
  },
});

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 0) < 1024;

async function openDraftEditor(page: Page) {
  await page.goto("/admin/lessons?q=ban+nhap+kin");
  await page
    .getByRole("link", { name: "E2E – Bản nháp kín", exact: true })
    .click();
  await expect(page).toHaveURL(/\/admin\/lessons\/\d+\/edit$/);
  await expect(page.locator(".cm-content")).toBeVisible();
}

/** Replaces the whole text, like selecting all and pasting. */
async function paste(page: Page, text: string) {
  if (isPhone(page)) await page.getByText("Soạn thảo", { exact: true }).click();
  await page.locator(".cm-content").click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.insertText(text);
}

async function showPreview(page: Page) {
  if (isPhone(page)) await page.getByText("Xem trước", { exact: true }).click();
}

// Short first line: at 360 px a wrapped line would change what ↓ does.
const WITH_ERROR = `Câu 1: Chu kì $T$?
A. khối lượng
B. biên độ

Câu 2: Tính $T = 2\\pi\\sqrt{m/k}$ (s).
Answer: 0,63
[1 pt]`;

test("an error links to its line; fixing it updates preview and stats", async ({
  page,
}) => {
  await openDraftEditor(page);
  await paste(page, WITH_ERROR);
  await expect(page.getByText("Chưa lưu")).toBeVisible();
  await showPreview(page);

  const issues = page.locator("section[aria-labelledby=editor-issues]");
  await expect(issues).toContainText("1 lỗi");
  const issue = issues.getByRole("button", { name: /^Dòng 1, cột 1/ });
  await expect(issue).toContainText("Chưa đánh dấu đáp án đúng");
  await expect(page.getByText(/^Tổng: \d+ câu/)).toHaveText(
    "Tổng: 2 câu · 1/0/1 · 2đ",
  );

  // The issue puts the cursor on its line; "*" on the next line fixes it.
  await issue.click();
  await expect(page.locator(".cm-activeLine")).toContainText("Câu 1:");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.type("*");
  await showPreview(page);
  await expect(issues).toContainText("Không có lỗi.");
  const first = page.locator("main article").first();
  await expect(first).toContainText("Đáp án đúng");
  // Formulas come back as server-rendered KaTeX.
  await expect(first.locator(".katex").first()).toBeVisible();
  await expect(page.locator("main article").nth(1)).toContainText("0,63");

  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    const axe = await new AxeBuilder({ page }).analyze();
    expect(
      axe.violations.filter((v) =>
        ["serious", "critical"].includes(v.impact ?? ""),
      ),
    ).toEqual([]);
  }
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(page.viewportSize()?.width ?? 0);
});

test("pasting a real v1 lesson previews every question without errors", async ({
  page,
}) => {
  const lessons = JSON.parse(
    readFileSync("tests/fixtures/v1/lessons.json", "utf8"),
  ) as { questions: unknown }[];
  // The smallest real lesson (28 questions, all three types, formulas).
  const lesson = lessons.reduce((a, b) =>
    JSON.stringify(a.questions).length < JSON.stringify(b.questions).length
      ? a
      : b,
  );
  const { questions } = normalizeV1Questions(lesson.questions);
  const counts = { mcq: 0, tf: 0, short: 0 };
  for (const q of questions) counts[q.type] += 1;

  await openDraftEditor(page);
  await paste(page, serializeLesson(questions));
  await showPreview(page);
  await expect(page.getByText("Không có lỗi.")).toBeVisible();
  await expect(page.getByText(/^Tổng: \d+ câu/)).toContainText(
    `Tổng: ${questions.length} câu · ${counts.mcq}/${counts.tf}/${counts.short}`,
  );
  await expect(page.locator("main article")).toHaveCount(questions.length);
  // Every formula arrives from the server; no source placeholders remain.
  await expect(page.locator("main article code")).toHaveCount(0);
});

async function openSettings(page: Page) {
  // Reloading with unsaved changes asks first; accept like a teacher would.
  page.on("dialog", (d) => d.accept());
  await openDraftEditor(page);
  await page.getByRole("tab", { name: "Cài đặt" }).click();
  await expect(page.getByLabel("Tên bài")).toHaveValue("E2E – Bản nháp kín");
}

test("settings: invalid combinations are blocked with messages", async ({
  page,
}) => {
  await openSettings(page);
  await page.getByLabel(/^Sau giờ làm bài chung/).check();
  await page.getByLabel("Lấy ngẫu nhiên theo tổng số câu").check();
  await page.getByLabel("Số câu mỗi lượt").fill("9");
  await page.getByRole("button", { name: "Lưu cài đặt" }).click();
  // (Next's route announcer is an alert too.)
  await expect(
    page.getByRole("alert").filter({ hasText: "Cài đặt chưa hợp lệ" }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Giờ mở bài", { exact: true }),
  ).toHaveAccessibleDescription(/cần có giờ mở bài/);
  await expect(
    page.getByLabel("Thời gian làm bài (phút)"),
  ).toHaveAccessibleDescription(/cần có thời gian làm bài/);
  await expect(page.getByLabel("Số câu mỗi lượt")).toHaveAccessibleDescription(
    /Bài chỉ có 1 câu/,
  );
  await expect(page.getByLabel("Số câu mỗi lượt")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  // Nothing was sent: a reload shows the saved settings.
  await page.reload();
  await page.getByRole("tab", { name: "Cài đặt" }).click();
  await expect(page.getByLabel("Ngay sau khi nộp")).toBeChecked();
  await expect(page.getByLabel("Tắt: làm tất cả các câu")).toBeChecked();

  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    const axe = await new AxeBuilder({ page }).analyze();
    expect(
      axe.violations.filter((v) =>
        ["serious", "critical"].includes(v.impact ?? ""),
      ),
    ).toEqual([]);
  }
});

test("settings: a valid change saves and survives a reload; stats follow live", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "chromium", "writes the shared draft");
  await openSettings(page);
  // Live: the stats bar follows valid settings before they are saved.
  await page.getByLabel("Chia đều tổng điểm của từng loại").check();
  await page.getByLabel("Tổng điểm trắc nghiệm").fill("2,5");
  await page.getByRole("tab", { name: "Nội dung" }).click();
  if (isPhone(page)) await page.getByText("Xem trước", { exact: true }).click();
  await expect(page.getByText(/^Tổng: 1 câu/)).toHaveText(/· 2,5đ$/);
  await page.getByRole("tab", { name: "Cài đặt" }).click();
  await page.getByLabel(/^Theo điểm của từng câu/).check();

  // Saved: only fields no other spec reads, restored at the end.
  const saved = page.getByRole("status").filter({ hasText: "Đã lưu cài đặt." });
  await page.getByLabel("Thời gian làm bài (phút)").fill("50");
  await page.getByLabel("Theo tỉ lệ số ý đúng").check();
  await page.getByRole("button", { name: "Lưu cài đặt" }).click();
  await expect(saved).toBeVisible();
  await expect(page.getByText("Chưa lưu")).toHaveCount(0);
  await page.reload();
  await page.getByRole("tab", { name: "Cài đặt" }).click();
  await expect(page.getByLabel("Thời gian làm bài (phút)")).toHaveValue("50");
  await expect(page.getByLabel("Theo tỉ lệ số ý đúng")).toBeChecked();

  await page.getByLabel("Thời gian làm bài (phút)").fill("");
  await page.getByLabel(/^Theo thang THPT 2025/).check();
  await page.getByRole("button", { name: "Lưu cài đặt" }).click();
  await expect(saved).toBeVisible();
});

const TRY_TEXT = `Câu 1: Đơn vị của chu kì là
*A. giây
B. mét

Câu 2: Tính $T$ (s) khi $f = 0,5$ Hz.
Answer: 2
Giải thích: $T = 1/f = 2$ s.`;

test("Làm thử: the real runner in preview mode, keys shown, nothing saved", async ({
  page,
}) => {
  const posts: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST") posts.push(new URL(r.url()).pathname);
  });
  await openDraftEditor(page);
  await paste(page, TRY_TEXT);
  await page.getByRole("tab", { name: "Làm thử" }).click();
  const panel = page.getByRole("tabpanel", { name: "Làm thử" });
  await expect(panel).toContainText("Xem trước · không lưu bài làm");
  await singleView(page);

  // Question 1: the key is shown; a wrong choice says so, the right one too.
  await expect(panel).toContainText("Đáp án: A");
  await press(page, /^B\. mét/);
  await expect(panel.getByText("Trả lời sai")).toBeVisible();
  await press(page, /^A\. giây/);
  await expect(panel.getByText("Trả lời đúng")).toBeVisible();

  // Question 2: short answer with the explanation and server-rendered KaTeX.
  await visible(page, "Sau").click();
  await expect(panel).toContainText("Đáp án: 2");
  await expect(panel).toContainText("Giải thích");
  await expect(panel.locator(".katex").first()).toBeVisible();
  await page.getByLabel("Câu trả lời của bạn").fill("2,0");
  await expect(panel.getByText("Trả lời đúng")).toBeVisible();

  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    const axe = await new AxeBuilder({ page }).analyze();
    expect(
      axe.violations.filter((v) =>
        ["serious", "critical"].includes(v.impact ?? ""),
      ),
    ).toEqual([]);
  }
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(page.viewportSize()?.width ?? 0);

  await visible(page, "Nộp bài").click();
  await page
    .getByRole("dialog", { name: "Nộp bài?" })
    .getByRole("button", { name: "Nộp bài", exact: true })
    .click();
  const result = page.getByRole("dialog", { name: "Kết quả xem trước" });
  await expect(result).toContainText("2/2 điểm");
  await expect(result).toContainText("2/2 câu đúng");
  await result.getByRole("button", { name: "Làm lại" }).click();
  await expect(panel.getByText("Chưa trả lời").first()).toBeVisible();

  // No attempt: nothing went to the attempt endpoints; the page stayed.
  expect(posts.filter((p) => p.startsWith("/api/attempts"))).toEqual([]);
  await expect(page).toHaveURL(/\/admin\/lessons\/\d+\/edit$/);
});
