import { expect, test } from "@playwright/test";
import { expectAccessible } from "./a11y";

/**
 * S8-02/S8-03 public pages: theory, gallery, policies and the share page.
 * No login; the share page uses the seeded "E2E – Điện trường" (practice)
 * and "E2E – Dao động điều hòa" (exam mode) through their v1 share links.
 */

test("theory index: grades, search, and a topic page with its pager", async ({
  page,
}) => {
  await page.goto("/ly-thuyet");
  await expect(
    page.getByRole("heading", { level: 1, name: "Lý thuyết Vật lý" }),
  ).toBeVisible();
  for (const grade of [10, 11, 12])
    await expect(
      page.getByRole("heading", { level: 2, name: `Lớp ${grade}` }),
    ).toBeVisible();
  await expectAccessible(page);

  const search = page.getByRole("searchbox", { name: "Tìm bài lý thuyết" });
  await search.fill("roi tu do");
  const results = page.getByRole("search");
  await expect(results.getByText(/bài khớp với/)).toBeVisible();
  await results.getByRole("link", { name: /Sự rơi tự do/ }).click();
  await expect(page).toHaveURL(/\/ly-thuyet\/10\/chuyen-dong\/roi-tu-do$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Sự rơi tự do" }),
  ).toBeVisible();
  // Formulas are server-rendered KaTeX with MathML for screen readers.
  await expect(
    page.locator(".theory-content .katex math").first(),
  ).toBeAttached();
  await expect(
    page.getByRole("navigation", { name: "Bài trong chương" }),
  ).toBeVisible();
  await expectAccessible(page);

  const response = await page.goto("/ly-thuyet/10/chuyen-dong/khong-co");
  expect(response?.status()).toBe(404);
});

test("a v1 materials link lands on its theory page", async ({ page }) => {
  await page.goto("/materials/grade10/motion_kinematics/roi_tu_do");
  await expect(page).toHaveURL(/\/ly-thuyet\/10\/chuyen-dong\/roi-tu-do$/);
});

for (const [path, heading] of [
  ["/gallery", "Thư viện ảnh"],
  ["/privacy", "Quyền riêng tư"],
  ["/terms", "Điều khoản sử dụng"],
] as const)
  test(`${path}: renders and is accessible`, async ({ page }) => {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { level: 1, name: heading }),
    ).toBeVisible();
    await expectAccessible(page);
  });

test("share page: answer-free preview, CTA and a real OG image", async ({
  page,
  request,
}) => {
  const html: string[] = [];
  page.on("response", async (res) => {
    if (res.request().resourceType() === "document")
      html.push(await res.text().catch(() => ""));
  });
  await page.goto("/share/lesson/1720000000001");
  await expect(page).toHaveURL(/\/share\/lessons\/\d+$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "E2E – Điện trường" }),
  ).toBeVisible();
  await expect(page.getByText("Chu kì có đơn vị nào?")).toBeVisible();
  // ADR-004: the page carries no key (the stored field is `answer`).
  expect(html.join("")).not.toMatch(/"answer"|"explanation"/);
  await expect(page.getByRole("link", { name: "Làm bài" })).toHaveAttribute(
    "href",
    /^\/lessons\/\d+$/,
  );
  await expectAccessible(page);

  const image = await page
    .locator('meta[property="og:image"]')
    .getAttribute("content");
  expect(image).toBeTruthy();
  const res = await request.get(new URL(image ?? "", page.url()).pathname);
  expect(res.ok()).toBe(true);
  expect(res.headers()["content-type"]).toContain("image/png");
  const body = await res.body();
  expect(body.readUInt32BE(16)).toBe(1200);
  expect(body.readUInt32BE(20)).toBe(630);
});

test("share page: exam-mode lessons show no questions", async ({ page }) => {
  await page.goto("/share/lesson/1720000000000");
  await expect(
    page.getByRole("heading", { level: 1, name: "E2E – Dao động điều hòa" }),
  ).toBeVisible();
  await expect(page.getByText(/không có câu xem trước/)).toBeVisible();
});

test("share page: an unknown lesson shows the not-found page", async ({
  page,
}) => {
  // The lesson streams in after the static shell, so `notFound()` can no
  // longer set the status: Next renders the 404 page and adds noindex.
  await page.goto("/share/lessons/999999999");
  await expect(
    page.getByRole("heading", { level: 1, name: "Không tìm thấy trang" }),
  ).toBeVisible();
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute(
    "content",
    /noindex/,
  );
});

test("keyboard only: skip link, search and open a topic", async ({ page }) => {
  await page.goto("/ly-thuyet");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Bỏ qua điều hướng" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main$/);

  await page.getByRole("searchbox", { name: "Tìm bài lý thuyết" }).focus();
  await page.keyboard.type("con lac don");
  const hit = page.getByRole("search").getByRole("link").first();
  await expect(hit).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(hit).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/ly-thuyet\/1[12]\/dao-dong/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
