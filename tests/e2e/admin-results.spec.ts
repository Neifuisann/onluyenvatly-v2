import { readFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { loginAdminOnce } from "./admin-helpers";
import { e2eStudent, projectStudentKey } from "./fixtures/users";
import type { StorageState } from "./runner-helpers";

/**
 * S6-04 results: filters, the exam-guard timeline, the CSV export and
 * deleting an attempt (which replays the student's rating). Own admin and
 * own student per project; the seed gives each results student three
 * submitted attempts (fixtures/results.ts) and puts them back on every run.
 * Only the desktop project deletes, last: run `pnpm seed --profile e2e`
 * before running this again. Serial, because the delete changes what the
 * other tests read.
 */

test.describe.configure({ mode: "serial" });

let storageState: StorageState;
test.beforeAll(async ({ browser }, info) => {
  storageState = await loginAdminOnce(
    browser,
    info,
    "results",
    "/admin/results",
  );
});
test.use({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires destructured fixture dependencies.
  storageState: async ({}, use) => {
    await use(storageState);
  },
});

const RUNNER = "E2E – Làm bài đủ dạng";
const TIMER = "E2E – Hẹn giờ 1 phút";

const mine = (project: string) =>
  e2eStudent(projectStudentKey("results", project));
/** The name as a teacher types it: no accents, lower case. */
const plain = (name: string) =>
  name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();

const list = (page: Page) =>
  page.getByRole("list", { name: "Danh sách bài làm" }).getByRole("listitem");

const vnDay = (offsetDays: number) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(Date.now() + offsetDays * 86_400_000));

async function filter(
  page: Page,
  {
    lesson,
    q,
    from,
    to,
  }: { lesson?: string; q?: string; from?: string; to?: string },
) {
  const form = page.getByRole("search", { name: "Lọc kết quả" });
  if (lesson !== undefined)
    await form.getByLabel("Bài tập").selectOption({ label: lesson });
  if (q !== undefined) await form.getByLabel("Tên học sinh").fill(q);
  if (from !== undefined) await form.getByLabel("Từ ngày").fill(from);
  if (to !== undefined) await form.getByLabel("Đến ngày").fill(to);
  await form.getByRole("button", { name: "Lọc", exact: true }).click();
  // The form remounts with the new URL: wait for it before touching it again.
  await page.waitForURL((url) => {
    const p = url.searchParams;
    return (
      (q === undefined || p.get("q") === q) &&
      (from === undefined || p.get("from") === from) &&
      (to === undefined || p.get("to") === to) &&
      (lesson === undefined || /^\d+$/.test(p.get("lesson") ?? ""))
    );
  });
}

async function expectNoOverflow(page: Page) {
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(page.viewportSize()?.width ?? 0);
}

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
    await expectNoOverflow(page);
  }
}

test("filters by student name, lesson and Vietnam dates", async ({
  page,
}, info) => {
  const student = mine(info.project.name);
  await page.goto("/admin/results");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Kết quả");
  await expect(list(page).first()).toBeVisible();

  // Accent-free name words: this project's student only, newest first.
  await filter(page, { q: plain(student.fullName) });
  await expect(page).toHaveURL(/[?&]q=/);
  await expect(list(page)).toHaveCount(3);
  await expect(list(page).nth(0)).toContainText(RUNNER);
  await expect(list(page).nth(0)).toContainText("2,5");
  await expect(list(page).nth(1)).toContainText(TIMER);
  await expect(list(page).nth(2)).toContainText("10");
  await expect(list(page).nth(2)).toContainText("3 cảnh báo");
  await expect(list(page).nth(2)).toContainText("Làm trong 02:00");
  await expect(list(page).nth(2)).toContainText("10A1 · Khối 10");
  await expect(
    list(page)
      .nth(2)
      .getByRole("link", { name: student.fullName, exact: true }),
  ).toHaveAttribute("href", /^\/admin\/students\/[0-9a-f-]{36}$/);

  // Plus a lesson: the one timed attempt.
  await filter(page, { lesson: TIMER });
  await expect(list(page)).toHaveCount(1);
  await expect(list(page).first()).toContainText(TIMER);
  await expect(
    page.getByRole("search", { name: "Lọc kết quả" }).getByLabel("Bài tập"),
  ).toHaveValue(/^\d+$/);

  // A date range around today keeps it, one in the future finds nothing.
  await filter(page, { from: vnDay(-2), to: vnDay(0) });
  await expect(list(page)).toHaveCount(1);
  await filter(page, { from: vnDay(2), to: vnDay(3) });
  await expect(
    page.getByRole("heading", { name: "Không có bài làm phù hợp" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Xóa bộ lọc" }).first().click();
  await expect(page).toHaveURL(/\/admin\/results$/);
  await expect(list(page).first()).toBeVisible();
});

test("the result page shows the guard timeline to the teacher", async ({
  page,
}, info) => {
  const student = mine(info.project.name);
  await page.goto(
    `/admin/results?q=${encodeURIComponent(plain(student.fullName))}`,
  );
  await list(page)
    .nth(2)
    .getByRole("link", { name: /^Xem bài làm của / })
    .click();
  await expect(page).toHaveURL(/\/attempts\/[0-9a-f-]{36}\/result$/);
  const timeline = page.getByRole("region", {
    name: "Sự kiện giám sát (3)",
  });
  const events = timeline.getByRole("list", {
    name: "Dòng thời gian giám sát",
  });
  await expect(events.getByRole("listitem")).toHaveText([
    /00:15\s*Rời cửa sổ làm bài/,
    /00:42\s*Thử sao chép đề/,
    /01:15\s*Ẩn tab hoặc chuyển ứng dụng/,
  ]);
  await expect(page.getByRole("button", { name: "Xóa bài làm" })).toBeVisible();
  await expectAccessible(page);

  // An attempt without events says so.
  await page.goBack();
  await page.goto(
    `/admin/results?q=${encodeURIComponent(plain(student.fullName))}`,
  );
  await list(page)
    .nth(0)
    .getByRole("link", { name: /^Xem bài làm của / })
    .click();
  await expect(
    page
      .getByRole("region", { name: "Sự kiện giám sát (0)" })
      .getByText("Không có sự kiện nào trong lúc làm bài."),
  ).toBeVisible();
});

test("the CSV export keeps the filters", async ({ page }, info) => {
  const student = mine(info.project.name);
  await page.goto("/admin/results");
  await filter(page, { q: plain(student.fullName), lesson: RUNNER });
  await expect(list(page)).toHaveCount(2);
  const link = page.getByRole("link", { name: "Xuất CSV" });
  await expect(link).toHaveAttribute(
    "href",
    /^\/admin\/results\/export\?lesson=\d+&q=/,
  );
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    link.click(),
  ]);
  expect(download.suggestedFilename()).toMatch(
    /^ket-qua-\d{4}-\d{2}-\d{2}\.csv$/,
  );
  const bytes = await readFile((await download.path()) as string);
  expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  const lines = bytes.subarray(3).toString("utf8").split("\r\n");
  expect(lines[0]).toBe(
    "Họ tên,Lớp,Khối,Bài,Điểm (/10),Điểm,Tối đa,Thời gian (giây),Nộp lúc,Cảnh báo",
  );
  expect(lines).toHaveLength(4);
  expect(lines[1]).toMatch(
    new RegExp(
      `^${student.fullName},10A1,10,${RUNNER},2\\.5,0\\.5,2,300,\\d\\d/\\d\\d/\\d{4} \\d\\d:\\d\\d,0$`,
    ),
  );
  expect(lines[2]).toMatch(
    new RegExp(
      `^${student.fullName},10A1,10,${RUNNER},10,2,2,120,\\d\\d/\\d\\d/\\d{4} \\d\\d:\\d\\d,3$`,
    ),
  );
  expect(lines[3]).toBe("");
  // No phone number anywhere.
  expect(bytes.toString("utf8")).not.toContain(student.phone);
});

test("results page: accessible in light and dark, fits 360 px", async ({
  page,
}) => {
  await page.goto("/admin/results");
  await expect(list(page).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Xuất CSV" })).toBeVisible();
  await expectAccessible(page);
  await page.goto("/admin/results?from=2099-01-01");
  await expect(
    page.getByRole("heading", { name: "Không có bài làm phù hợp" }),
  ).toBeVisible();
  await expectNoOverflow(page);
});

test("deleting an attempt removes it and replays the rating", async ({
  page,
}, info) => {
  // Data the seed re-creates on every run; one project changes it.
  test.skip(info.project.name !== "chromium", "deletes seeded data");
  const student = mine(info.project.name);
  const byName = `/admin/results?q=${encodeURIComponent(plain(student.fullName))}`;
  await page.goto(byName);
  await expect(list(page)).toHaveCount(3);

  // The rating before, on the student's page.
  await list(page)
    .first()
    .getByRole("link", { name: student.fullName, exact: true })
    .click();
  const rating = page.getByRole("region", { name: "Xếp hạng" });
  await expect(rating).toContainText("Bài tính điểm");
  const before = await rating.innerText();
  expect(before).toMatch(/Bài tính điểm\s*3/);

  // Delete the middle attempt (the timed one) from its result page.
  await page.goto(byName);
  await list(page)
    .nth(1)
    .getByRole("link", { name: /^Xem bài làm của / })
    .click();
  await page.getByRole("button", { name: "Xóa bài làm" }).click();
  const dialog = page.getByRole("dialog", { name: "Xóa bài làm này?" });
  await dialog.getByRole("button", { name: "Hủy" }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole("button", { name: "Xóa bài làm" }).click();
  await dialog.getByRole("button", { name: "Xóa vĩnh viễn" }).click();
  await expect(page).toHaveURL(/\/admin\/results$/);

  await page.goto(byName);
  await expect(list(page)).toHaveCount(2);
  await expect(list(page).filter({ hasText: TIMER })).toHaveCount(0);

  await list(page)
    .first()
    .getByRole("link", { name: student.fullName, exact: true })
    .click();
  await expect(rating).toContainText(/Bài tính điểm\s*2/);
  expect(await rating.innerText()).not.toBe(before);
});
