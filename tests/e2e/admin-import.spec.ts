import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { loginAdminOnce } from "./admin-helpers";
import { FAKE_GEMINI_URL } from "./fake-gemini";
import { FAKE_STORAGE_URL } from "./fake-storage";
import { IMPORTED_TITLE_PREFIX } from "./fixtures/lessons";
import type { StorageState } from "./runner-helpers";

/**
 * S7-04 AI import against the Storage and Gemini stand-ins: a PDF goes
 * straight to the private `imports` bucket, `POST /api/ai/import` streams
 * the lesson text (with a missing key and a `[Hình]`), and "Tạo bài nháp"
 * opens the editor on a new draft whose validation flags the missing key.
 * Own admin per project (`e2e-import-d/m`); the seed removes the drafts.
 */
let storageState: StorageState;
test.beforeAll(async ({ browser }, info) => {
  storageState = await loginAdminOnce(browser, info, "import", "/admin/import");
});
test.use({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires destructured fixture dependencies.
  storageState: async ({}, use) => {
    await use(storageState);
  },
});

async function expectAccessible(page: Page) {
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
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

test("a PDF becomes a draft lesson through the AI, flagged where the key is missing", async ({
  page,
  request,
}, info) => {
  const p = info.project.name === "mobile" ? "m" : "d";
  const pdf = Buffer.from(`%PDF-1.4\n% E2E exam (${p})\n%%EOF\n`);
  const importCalls = async () => {
    const { calls } = (await (
      await request.get(`${FAKE_GEMINI_URL}/__calls`)
    ).json()) as { calls: { prompt: string; files: string[] }[] };
    return calls.filter((c) => c.prompt.includes("Chuyển đề sau"));
  };
  const before = (await importCalls()).length;

  await page.goto("/admin/import");
  await expect(
    page.getByRole("heading", { name: "Nhập đề bằng AI", level: 1 }),
  ).toBeVisible();
  await expectAccessible(page);

  // Nothing picked yet.
  await page.getByRole("button", { name: "Nhập bằng AI" }).click();
  await expect(page.getByText("Chọn file đề trước.")).toBeVisible();

  await page.getByLabel("File đề").setInputFiles({
    name: `De_kiem_tra_${p}.pdf`,
    mimeType: "application/pdf",
    buffer: pdf,
  });
  const title = page.getByLabel("Tên bài");
  await expect(title).toHaveValue(`De kiem tra ${p}`);
  await title.fill(`${IMPORTED_TITLE_PREFIX} (${p})`);
  await page.getByRole("button", { name: "Nhập bằng AI" }).click();

  await expect(page.getByText("AI đã chuyển xong")).toBeVisible();
  await expect(
    page.getByText("3 câu: 2 trắc nghiệm, 1 đúng/sai, 0 trả lời ngắn."),
  ).toBeVisible();
  await expect(page.getByText(/^1 lỗi cần sửa/)).toBeVisible();
  await expect(page.getByText(/^1 chỗ có hình/)).toBeVisible();
  const output = page.getByRole("region", { name: "Văn bản AI trả về" });
  await expect(output).toContainText("Câu 1: Đơn vị của chu kì dao động là");
  // One Gemini call with the PDF inline; the file went to `imports`.
  const calls = await importCalls();
  expect(calls.length).toBe(before + 1);
  expect(calls.at(-1)?.files).toEqual(["application/pdf"]);
  const stored = (await (
    await request.get(`${FAKE_STORAGE_URL}/__imports`)
  ).json()) as { path: string; bytes: number }[];
  expect(stored.some((f) => f.bytes === pdf.byteLength)).toBe(true);
  await expectAccessible(page);

  await page
    .getByRole("button", { name: "Tạo bài nháp và mở trình soạn" })
    .click();
  await expect(page).toHaveURL(/\/admin\/lessons\/\d+\/edit$/);
  await expect(
    page.getByRole("heading", { name: `${IMPORTED_TITLE_PREFIX} (${p})` }),
  ).toBeVisible();
  // The fence is gone and the missing key is flagged on its line.
  await expect(page.locator(".cm-content")).not.toContainText("```");
  // (The issue list sits in the preview pane on phones; the bar shows everywhere.)
  await expect(page.getByText(/^Nội dung còn 1 lỗi./)).toBeVisible();
});
