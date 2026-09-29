import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { loginAdminOnce } from "./admin-helpers";
import type { StorageState } from "./runner-helpers";

/**
 * S5-01 `/admin/lessons`: filters, reorder (keyboard and pointer drag),
 * duplicate, archive/restore and delete. Mutations run in the desktop project
 * only, on a copy of the seeded draft, so the catalog specs never see them.
 */

let storageState: StorageState;
test.beforeAll(async ({ browser }, info) => {
  storageState = await loginAdminOnce(browser, info, "lessons");
});
test.use({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires destructured fixture dependencies.
  storageState: async ({}, use) => {
    await use(storageState);
  },
});

const SOURCE = "E2E – Bản nháp kín";
const COPY = `${SOURCE} (bản sao)`;

async function titles(page: Page) {
  // The title links (each row also links its statistics, S6-05).
  const links = page.locator('main tbody tr a[href$="/edit"]');
  await expect(links.first()).toBeVisible();
  return links.allTextContents();
}

test("lists every status with search and status filters, accessible in light and dark", async ({
  page,
}) => {
  await page.goto("/admin/lessons");
  await expect(page.getByRole("heading", { name: "Bài tập" })).toBeVisible();
  const rows = page.locator("main tbody tr");
  await expect(rows.filter({ hasText: SOURCE }).first()).toBeVisible();
  await expect(rows.filter({ hasText: "E2E – Đã lưu trữ" })).toBeVisible();

  await page.getByRole("link", { name: "Nháp", exact: true }).click();
  await expect(page).toHaveURL(/status=draft/);
  await expect(page.getByText(/Bỏ tìm kiếm và bộ lọc/)).toBeVisible();
  await expect(rows.filter({ hasText: "E2E – Đã lưu trữ" })).toHaveCount(0);

  await page.getByLabel("Tìm bài tập").fill("ban nhap kin");
  await page.getByRole("button", { name: "Tìm", exact: true }).click();
  await expect(page).toHaveURL(/q=ban\+nhap\+kin/);
  await expect(page).toHaveURL(/status=draft/);
  await expect(rows.first()).toContainText(SOURCE);

  await page.getByLabel("Tìm bài tập").fill("khong co bai nay");
  await page.getByRole("button", { name: "Tìm", exact: true }).click();
  await expect(page.getByText("Không có bài phù hợp")).toBeVisible();

  await page.goto("/admin/lessons");
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(page.viewportSize()?.width ?? 0);
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

test("duplicate, reorder (keys and drag), archive, restore and delete", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "chromium", "mutates shared lessons");
  await page.goto(`/admin/lessons?q=${encodeURIComponent(SOURCE)}`);
  const status = page.locator("main output");
  // Leftovers of an interrupted run would break the order checks.
  await titles(page);
  const leftover = page.getByRole("button", { name: `Xóa: ${COPY}` });
  while ((await leftover.count()) > 0) {
    await leftover.first().click();
    await page.getByRole("button", { name: "Xóa bài" }).click();
    await expect(status).toHaveText("Đã xóa bài.");
    await page.reload();
    await titles(page);
  }
  await page
    .getByRole("button", { name: `Nhân bản: ${SOURCE}`, exact: true })
    .click();
  await expect(status).toHaveText("Đã tạo bản sao (nháp).");

  // The copy sits right below its source in the manual order.
  await page.goto("/admin/lessons");
  let list = await titles(page);
  const source = list.indexOf(SOURCE);
  expect(list[source + 1]).toBe(COPY);

  // Keyboard: ↑ on the copy's handle swaps it above the source, and it sticks.
  await page
    .getByRole("button", { name: `Kéo để sắp xếp “${COPY}”` })
    .press("ArrowUp");
  await expect(status).toContainText(`tới vị trí ${source + 1}/`);
  await page.reload();
  list = await titles(page);
  expect(list.slice(source, source + 2)).toEqual([COPY, SOURCE]);

  // Pointer drag: the copy's handle dropped on the lower half of the source row.
  const handle = page.getByRole("button", { name: `Kéo để sắp xếp “${COPY}”` });
  const target = page.locator("main tbody tr").filter({
    has: page.getByRole("link", { name: SOURCE, exact: true }),
  });
  await target.first().scrollIntoViewIfNeeded();
  const from = await handle.boundingBox();
  const to = await target.first().boundingBox();
  if (!from || !to) throw new Error("rows not laid out");
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2, to.y + to.height * 0.9, {
    steps: 8,
  });
  await page.mouse.up();
  await expect(status).toContainText(`tới vị trí ${source + 2}/`);
  await page.reload();
  list = await titles(page);
  expect(list.slice(source, source + 2)).toEqual([SOURCE, COPY]);

  const copyRow = page.locator("main tbody tr").filter({ hasText: COPY });
  await page
    .getByRole("button", { name: `Lưu trữ: ${COPY}`, exact: true })
    .click();
  await expect(status).toHaveText(/Đã lưu trữ bài/);
  await expect(copyRow).toContainText("Lưu trữ");
  await page.getByRole("button", { name: `Khôi phục: ${COPY}` }).click();
  await expect(status).toHaveText(/Đã khôi phục bài/);
  await expect(copyRow).toContainText("Nháp");

  await page.getByRole("button", { name: `Xóa: ${COPY}` }).click();
  const dialog = page.getByRole("dialog", { name: "Xóa bài tập?" });
  await expect(dialog).toContainText("xóa vĩnh viễn");
  await dialog.getByRole("button", { name: "Xóa bài" }).click();
  await expect(status).toHaveText("Đã xóa bài.");
  await expect(copyRow).toHaveCount(0);
  await page.reload();
  expect(await titles(page)).not.toContain(COPY);

  // "Tạo bài mới" opens the editor on a new empty draft, last in the list.
  await page.getByRole("button", { name: "Tạo bài mới" }).click();
  await expect(page).toHaveURL(/\/admin\/lessons\/\d+\/edit$/);
  const id = page.url().match(/lessons\/(\d+)\/edit/)?.[1];
  await expect(
    page.getByRole("heading", { name: "Bài tập mới" }),
  ).toBeVisible();
  await expect(page.getByText("Chưa có câu hỏi")).toBeVisible();
  await page.goto("/admin/lessons");
  const created = page.locator("main tbody tr").last();
  await expect(
    created.getByRole("link", { name: "Bài tập mới", exact: true }),
  ).toHaveAttribute("href", `/admin/lessons/${id}/edit`);
  await created.getByRole("button", { name: "Xóa: Bài tập mới" }).click();
  await dialog.getByRole("button", { name: "Xóa bài" }).click();
  await expect(status).toHaveText("Đã xóa bài.");
});
