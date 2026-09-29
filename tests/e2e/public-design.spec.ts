import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// S8-01/S8-07: the public journey has no fixture or login dependency.
for (const route of [
  "/",
  "/login",
  "/register",
  "/register/pending",
  "/missing-page",
]) {
  test(`${route}: responsive and accessible in both themes`, async ({
    page,
  }, info) => {
    for (const theme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.goto(route);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      // A passing base color is insufficient: the primary hover fill must
      // also keep its white label readable on light form surfaces.
      if (route === "/login") {
        await page
          .getByRole("button", { name: "Đăng nhập", exact: true })
          .hover();
      }
      const { violations } = await new AxeBuilder({ page }).analyze();
      expect(
        violations.filter(
          (v) => v.impact === "serious" || v.impact === "critical",
        ),
      ).toEqual([]);
      await page.screenshot({
        path: info.outputPath(`${theme}.png`),
        fullPage: true,
      });
    }
  });
}

test("landing CTA opens registration and social preview is a real image", async ({
  page,
  request,
}) => {
  await page.goto("/");
  const image = await page
    .locator('meta[property="og:image"]')
    .getAttribute("content");
  expect(image).toBeTruthy();
  const response = await request.get(new URL(image ?? "", page.url()).pathname);
  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toContain("image/png");
  const body = await response.body();
  expect(body.subarray(1, 4).toString()).toBe("PNG");
  expect(body.readUInt32BE(16)).toBe(1200);
  expect(body.readUInt32BE(20)).toBe(630);
  await page
    .getByRole("link", { name: "Tạo tài khoản", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByLabel("Họ và tên")).toBeVisible();
});
