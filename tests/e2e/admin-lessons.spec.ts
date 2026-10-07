import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { loginAdminOnce } from "./admin-helpers";
import { COMPOSED_TITLE_PREFIX } from "./fixtures/lessons";
import { emulateScheme, type StorageState } from "./runner-helpers";

/**
 * S5-01/S5-07 `/admin/lessons`: filters, sorting by the column arrows,
 * reorder in the manual order (keyboard and pointer drag), duplicate,
 * archive/restore and delete; "Tạo bài mới" and its three ways. Mutations
 * run in the desktop project only, on a copy of the seeded draft, so the
 * catalog specs never see them.
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

const PAGE_SIZE = 20;

async function titles(page: Page) {
  // The title links: the row's other links (statistics, "Sửa") are labelled.
  const links = page.locator("main tbody tr a:not([aria-label])");
  await expect(links.first()).toBeVisible();
  return links.allTextContents();
}

async function expectAccessible(page: Page) {
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(page.viewportSize()?.width ?? 0);
  for (const scheme of ["light", "dark"] as const) {
    await emulateScheme(page, scheme);
    const axe = await new AxeBuilder({ page }).analyze();
    expect(
      axe.violations.filter((v) =>
        ["serious", "critical"].includes(v.impact ?? ""),
      ),
      scheme,
    ).toEqual([]);
  }
}

/** Opens the page of the unfiltered manual order that shows `title`; its offset. */
async function openPageWith(page: Page, title: string) {
  for (let n = 1; n <= 50; n++) {
    await page.goto(`/admin/lessons?sort=manual${n > 1 ? `&page=${n}` : ""}`);
    if ((await titles(page)).includes(title)) return (n - 1) * PAGE_SIZE;
    const next = page.getByRole("link", { name: "Trang sau" });
    if ((await next.count()) === 0) break;
  }
  throw new Error(`“${title}” is not listed`);
}

test("lists every status with search, status filters and pages, accessible in light and dark", async ({
  page,
}) => {
  await page.goto("/admin/lessons");
  await expect(page.getByRole("heading", { name: "Bài tập" })).toBeVisible();
  const rows = page.locator("main tbody tr");
  await expect(rows.first()).toBeVisible();
  expect(await rows.count()).toBeLessThanOrEqual(PAGE_SIZE);
  const pager = page.getByRole("navigation", { name: "Phân trang" });
  if ((await pager.count()) > 0) {
    await expect(pager.getByRole("link", { name: "Trang 1" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await pager.getByRole("link", { name: "Trang 2" }).click();
    await expect(page).toHaveURL(/\/admin\/lessons\?page=2$/);
    await expect(rows.first()).toBeVisible();
  }

  await page.goto("/admin/lessons?status=archived");
  await expect(rows.filter({ hasText: "E2E – Đã lưu trữ" })).toBeVisible();

  await page.getByRole("link", { name: "Nháp", exact: true }).click();
  await expect(page).toHaveURL(/status=draft/);
  await expect(rows.first()).toBeVisible();
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
  await expectAccessible(page);
});

test("sorts by the newest change by default, and by name or creation from the column arrows", async ({
  page,
}, info) => {
  await page.goto("/admin/lessons?status=published");
  const mobile = info.project.name === "mobile";
  // Phones have no column headers: the order is a segmented switch there.
  const sortBy = async (column: string, mobileLabel: string) => {
    if (mobile)
      await page
        .getByRole("list", { name: "Sắp xếp danh sách" })
        .getByRole("link", { name: mobileLabel })
        .click();
    else await page.getByRole("link", { name: column, exact: true }).click();
  };
  if (!mobile)
    await expect(
      page.getByRole("columnheader", { name: "Cập nhật" }),
    ).toHaveAttribute("aria-sort", "descending");

  await sortBy("Tên bài", "Tên A–Z");
  await expect(page).toHaveURL(/status=published&sort=title$/);
  const collator = new Intl.Collator("vi", {
    sensitivity: "base",
    numeric: true,
  });
  const az = await titles(page);
  expect([...az].sort(collator.compare)).toEqual(az);

  if (!mobile) {
    await expect(
      page.getByRole("columnheader", { name: "Tên bài" }),
    ).toHaveAttribute("aria-sort", "ascending");
    // The same arrow again flips the direction.
    await page.getByRole("link", { name: "Tên bài", exact: true }).click();
    await expect(page).toHaveURL(/sort=title&dir=desc$/);
    const za = await titles(page);
    expect([...za].sort(collator.compare).reverse()).toEqual(za);
  }

  // A search keeps the order.
  await page.getByLabel("Tìm bài tập").fill("E2E");
  await page.getByRole("button", { name: "Tìm", exact: true }).click();
  await expect(page).toHaveURL(/q=E2E/);
  await expect(page).toHaveURL(/sort=title/);

  await sortBy("Ngày tạo", "Mới tạo");
  await expect(page).toHaveURL(/sort=created/);
  // Only the manual order can be dragged.
  await expect(
    page.getByRole("button", { name: /^Kéo để sắp xếp/ }),
  ).toHaveCount(0);
});

test("“Tạo bài mới” offers three ways; “Tạo từ bài có sẵn” draws a review draft", async ({
  page,
}, info) => {
  await page.goto("/admin/lessons");
  await page.getByRole("link", { name: "Tạo bài mới" }).click();
  await expect(page).toHaveURL(/\/admin\/lessons\/create$/);
  const ways = page.getByRole("list", { name: "Cách tạo bài" });
  await expect(ways.getByRole("heading")).toHaveText([
    "Tự soạn",
    "Nhập từ file bằng AI",
    "Tạo từ bài có sẵn",
  ]);
  await expectAccessible(page);

  await ways.getByRole("link", { name: "Chọn bài nguồn" }).click();
  await expect(page).toHaveURL(/mode=compose$/);
  await expect(
    page.getByRole("heading", { name: "Tạo đề từ bài có sẵn", level: 1 }),
  ).toBeVisible();
  // Nothing chosen yet.
  await page.getByRole("button", { name: "Bốc câu và tạo bài nháp" }).click();
  await expect(page.getByText("Chọn ít nhất một bài nguồn.")).toBeVisible();

  await page.getByLabel("Lọc bài nguồn").fill("ban nhap kin");
  await page
    .getByRole("checkbox", { name: /^E2E – Bản nháp kín Nháp/ })
    .check();
  await expect(page.getByText("Đã chọn 1 bài")).toBeVisible();
  await expect(page.getByLabel("3. Tên bài")).toHaveValue(
    "Ôn tập: E2E – Bản nháp kín",
  );
  await page.getByLabel(/^Trắc nghiệm/).fill("5");
  await page.getByRole("button", { name: "Bốc câu và tạo bài nháp" }).click();
  await expect(page.getByText(/^Cần 5 câu trắc nghiệm/)).toBeVisible();
  await page.getByRole("button", { name: "Tối đa: Trắc nghiệm" }).click();
  await expect(page.getByLabel(/^Trắc nghiệm/)).toHaveValue("1");
  await expectAccessible(page);

  test.skip(info.project.name !== "chromium", "creates a lesson");
  const title = `${COMPOSED_TITLE_PREFIX} (d)`;
  await page.getByLabel("3. Tên bài").fill(title);
  await page.getByRole("button", { name: "Bốc câu và tạo bài nháp" }).click();
  await expect(page).toHaveURL(/\/admin\/lessons\/\d+\/edit$/);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.locator(".cm-content")).toContainText("Câu 1:");

  await page.goto(`/admin/lessons?q=${encodeURIComponent(title)}`);
  expect(await titles(page)).toEqual([title]);
  await page.getByRole("button", { name: `Xóa: ${title}` }).click();
  await page.getByRole("button", { name: "Xóa bài" }).click();
  // The only match is gone: the empty search result replaces the table.
  await expect(page.getByText("Không có bài phù hợp")).toBeVisible();
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

  // The copy sits right below its source in the manual order (same page:
  // the seeded source is never the last row of a page).
  const offset = await openPageWith(page, SOURCE);
  let list = await titles(page);
  const source = list.indexOf(SOURCE);
  expect(list[source + 1]).toBe(COPY);

  // Keyboard: ↑ on the copy's handle swaps it above the source, and it sticks.
  await page
    .getByRole("button", { name: `Kéo để sắp xếp “${COPY}”` })
    .press("ArrowUp");
  await expect(status).toContainText(`tới vị trí ${offset + source + 1}/`);
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
  await expect(status).toContainText(`tới vị trí ${offset + source + 2}/`);
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

  // "Tạo bài mới" → "Tự soạn" opens step 1 of the editor on a new empty
  // draft, last in the manual order (an out-of-range page shows the last one).
  await page.getByRole("link", { name: "Tạo bài mới" }).click();
  await page.getByRole("button", { name: "Mở trình soạn" }).click();
  await expect(page).toHaveURL(/\/admin\/lessons\/\d+\/edit$/);
  const id = page.url().match(/lessons\/(\d+)\/edit/)?.[1];
  await expect(
    page.getByRole("heading", { name: "Bài tập mới" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Chưa có câu hỏi", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Bước 1: Soạn nội dung/ }),
  ).toHaveAttribute("aria-current", "step");
  // Other specs (compose, import) may append drafts meanwhile, so look for
  // this one on the last page rather than in its very last row.
  await page.goto("/admin/lessons?sort=manual&page=999");
  const created = page.locator("main tbody tr").filter({
    has: page.locator(`a[href="/admin/lessons/${id}/edit"]`),
  });
  await expect(
    created.getByRole("link", { name: "Bài tập mới", exact: true }),
  ).toBeVisible();
  await created.getByRole("button", { name: "Xóa: Bài tập mới" }).click();
  await dialog.getByRole("button", { name: "Xóa bài" }).click();
  await expect(status).toHaveText("Đã xóa bài.");
});
