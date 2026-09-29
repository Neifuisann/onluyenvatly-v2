import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { loginAdminOnce } from "./admin-helpers";
import { FAKE_GEMINI_URL } from "./fake-gemini";
import type { StorageState } from "./runner-helpers";

/**
 * S7-03 `/admin/explanations` against the Gemini stand-in: the 👎 queue,
 * "Tạo sẵn cho cả bài" on a lesson of each project's own, edit and
 * regenerate. Each project has its own admin, lesson and flagged row.
 */
let storageState: StorageState;
test.beforeAll(async ({ browser }, info) => {
  storageState = await loginAdminOnce(
    browser,
    info,
    "explanations",
    "/admin/explanations",
  );
});
test.use({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires destructured fixture dependencies.
  storageState: async ({}, use) => {
    await use(storageState);
  },
});
test.describe.configure({ mode: "serial" });

const project = (name: string) => (name === "mobile" ? "m" : "d");

async function expectAccessible(page: Page) {
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

test("the 👎 queue lists a flagged explanation until it is approved", async ({
  page,
}, info) => {
  const p = project(info.project.name);
  await page.goto("/admin/explanations");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Giải thích AI",
  );
  await expect(
    page.getByRole("link", { name: /^Cần xem lại/ }),
  ).toHaveAttribute("aria-current", "page");
  const item = page
    .getByRole("listitem")
    .filter({ hasText: `Lời giải bị đánh giá chưa tốt (${p}).` });
  await expect(item).toContainText(`E2E – Giải thích AI quản trị (${p})`);
  await expect(item).toContainText("Nhiều đánh giá chưa tốt");
  await expect(item).toContainText("0 hữu ích · 3 chưa tốt");
  await expectAccessible(page);
  await item.getByRole("button", { name: "Duyệt" }).click();
  await expect(item).toHaveCount(0);
});

test("pre-generate a lesson, then edit and regenerate its explanations", async ({
  page,
  request,
}, info) => {
  test.setTimeout(90_000);
  const p = project(info.project.name);
  const calls = async () =>
    (
      (await (await request.get(`${FAKE_GEMINI_URL}/__calls`)).json()) as {
        calls: { prompt: string }[];
      }
    ).calls.filter((c) => c.prompt.includes(`(${p})`)).length;

  await page.goto("/admin/explanations");
  await page.getByRole("link", { name: "Theo bài" }).click();
  await page
    .getByLabel("Bài", { exact: true })
    .selectOption({ label: `E2E – Giải thích AI quản trị (${p})` });
  await page.getByRole("button", { name: "Xem", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/explanations\?lesson=\d+$/);
  await expect(
    page.getByText(
      "3 câu · 1 câu có lời giải của giáo viên · 0 câu có giải thích AI · 2 câu còn thiếu",
    ),
  ).toBeVisible();
  const teacher = page.getByRole("article", { name: /^Câu 3 ·/ });
  await expect(teacher).toContainText("Lời giải của giáo viên (trong bài)");
  await expect(teacher.getByRole("button")).toHaveCount(0);

  const before = await calls();
  await page.getByRole("button", { name: "Tạo giải thích cho 2 câu" }).click();
  // One question every 6 s.
  await expect(page.getByText("Xong: đã tạo 2 câu.")).toBeVisible({
    timeout: 30_000,
  });
  expect(await calls()).toBe(before + 2);
  await expect(
    page.getByText(
      "3 câu · 1 câu có lời giải của giáo viên · 2 câu có giải thích AI · 0 câu còn thiếu",
    ),
  ).toBeVisible();
  const first = page.getByRole("article", { name: /^Câu 1 ·/ });
  const second = page.getByRole("article", { name: /^Câu 2 ·/ });
  await expect(first).toContainText("AI (gemini-e2e)");
  await expect(first).toContainText("Tần số là số dao động");
  await expect(second.locator(".katex").first()).toBeVisible();

  await first.getByRole("button", { name: "Sửa" }).click();
  await first
    .getByLabel("Nội dung giải thích")
    .fill("Giáo viên sửa: biên độ kí hiệu là $A$.");
  await first.getByRole("button", { name: "Lưu" }).click();
  await expect(first).toContainText("Giáo viên đã sửa");
  await expect(first).toContainText("Đã duyệt");
  await expect(first).toContainText("Giáo viên sửa: biên độ kí hiệu là");
  await expect(first.getByRole("button", { name: "Duyệt" })).toHaveCount(0);

  await second.getByRole("button", { name: "Tạo lại" }).click();
  const dialog = page.getByRole("dialog", { name: "Tạo lại lời giải thích?" });
  await dialog.getByRole("button", { name: "Tạo lại" }).click();
  await expect(second.getByRole("button", { name: "Tạo lại" })).toBeEnabled();
  await expect.poll(calls).toBe(before + 3);
  await expect(second).toContainText("AI (gemini-e2e)");

  await expectAccessible(page);
});
