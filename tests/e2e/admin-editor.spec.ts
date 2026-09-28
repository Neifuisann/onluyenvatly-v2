import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { normalizeV1Questions } from "../../src/features/lessons/domain/legacy.ts";
import { serializeLesson } from "../../src/features/lessons/domain/serializer.ts";
import { loginAdminOnce } from "./admin-helpers";
import type { StorageState } from "./runner-helpers";

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
