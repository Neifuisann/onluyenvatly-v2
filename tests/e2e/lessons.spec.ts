import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { ANSWER_MARKER } from "./fixtures/lessons";
import { E2E_PASSWORD, e2eStudent } from "./fixtures/users";

// One login per project avoids consuming the auth rate-limit budget per case.
test.describe.configure({ mode: "default" });
let storageState: Awaited<
  ReturnType<import("@playwright/test").BrowserContext["storageState"]>
>;
test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.setExtraHTTPHeaders({
    "x-forwarded-for": `10.44.${Math.floor(Math.random() * 250)}.1`,
  });
  await page.goto("/lessons?tag=e2e");
  await expect(page).toHaveURL(/\/login\?next=/);
  await page.getByLabel("Số điện thoại").fill(e2eStudent("active3").phone);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/lessons\?tag=e2e$/);
  storageState = await context.storageState();
  await context.close();
});
test.use({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires destructured fixture dependencies.
  storageState: async ({}, use) => {
    await use(storageState);
  },
});

test("catalog search, grade, chapter, sort, pagination and browser history", async ({
  page,
}) => {
  await page.goto("/lessons?tag=e2e");
  const cards = page
    .locator('main a[href^="/lessons/"]')
    .filter({ visible: true });
  await expect(cards).toHaveCount(24);
  await page.getByRole("link", { name: "Xem thêm", exact: true }).click();
  await expect(cards).toHaveCount(27);
  await expect(page).toHaveURL(/page=2/);
  await page.getByRole("link", { name: "Lớp 11", exact: true }).click();
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText("Điện trường");
  await page.goBack();
  await expect(cards).toHaveCount(27);
  await expect(page.getByLabel("Thẻ", { exact: true })).toHaveValue("e2e");
  await page.getByLabel("Tìm bài tập", { exact: true }).fill("dao dong");
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText("Dao động điều hòa");
  await expect(page.getByLabel("Tìm bài tập", { exact: true })).toBeFocused();
  await expect(page).not.toHaveURL(/page=2/);
  await page.reload();
  await expect(page.getByLabel("Tìm bài tập", { exact: true })).toHaveValue(
    "dao dong",
  );
  await page.locator("main summary").click();
  await page.getByLabel("Chương", { exact: true }).selectOption("Điện trường");
  await expect(
    page.getByRole("heading", { name: "Không tìm thấy bài tập phù hợp" }),
  ).toBeVisible();
  await page.goto("/lessons?tag=e2e&sort=title");
  await expect(cards.first()).toContainText("Bài luyện 01");
});

test("old bookmarks redirect permanently; unpublished and missing lessons stay hidden", async ({
  page,
  request,
}) => {
  const old = await request.get("/lesson/1720000000000", { maxRedirects: 0 });
  expect(old.status()).toBe(308);
  expect(old.headers().location).toBe("/lessons/by-legacy/1720000000000");
  const lookup = await request.get(old.headers().location as string, {
    maxRedirects: 0,
  });
  expect(lookup.status()).toBe(308);
  expect(lookup.headers()["cache-control"]).toContain("no-store");
  await page.goto("/lesson/1720000000000");
  await expect(page).toHaveURL(/\/lessons\/\d+$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "E2E – Dao động điều hòa",
  );
  await expect(page.locator(".katex")).toBeVisible();
  await expect(page.getByText("50 phút", { exact: true })).toBeVisible();
  for (const key of ["e2e-draft", "e2e-archived", "missing"]) {
    expect((await request.get(`/lessons/by-legacy/${key}`)).status()).toBe(404);
  }
  for (const id of ["invalid", "9007199254740992", "999999999"]) {
    await page.goto(`/lessons/${id}`);
    await expect(
      page.getByRole("heading", { name: "Không tìm thấy bài tập" }),
    ).toBeVisible();
  }
});

test("student HTML and RSC navigation never contain question answers or source text", async ({
  page,
  request,
}) => {
  const catalog = await request.get("/lessons?tag=e2e");
  const catalogHtml = await catalog.text();
  await page.goto("/lessons?tag=e2e");
  // Buffer the actual navigation response before handing it to Next. Chromium
  // can discard a streamed response body after the router cancels its reader.
  const rscBodies: string[] = [];
  await page.route(/\/lessons\/\d+(?:\?|$)/, async (route) => {
    const response = await route.fetch();
    const body = await response.body();
    if ((response.headers()["content-type"] ?? "").includes("text/x-component"))
      rscBodies.push(body.toString());
    await route.fulfill({ response, body });
  });
  await page.getByRole("link", { name: /E2E – Dao động điều hòa/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "E2E – Dao động điều hòa",
  );
  expect(rscBodies.length).toBeGreaterThan(0);
  expect(rscBodies.join("")).toContain("E2E – Dao động điều hòa");
  const html = await request.get(page.url());
  for (const body of [catalogHtml, ...rscBodies, await html.text()]) {
    expect(body).not.toContain(ANSWER_MARKER);
    expect(body).not.toContain("Chu kì có đơn vị nào");
    expect(body).not.toMatch(
      /"(?:answer|explanation|sourceText|questions)"\s*:/,
    );
  }
});

test("catalog and overview fit the viewport and pass axe in light and dark", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const theme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: theme });
    for (const [name, path] of [
      ["catalog", "/lessons?tag=e2e"],
      ["overview", "/lesson/1720000000000"],
    ]) {
      await page.goto(path as string);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const issues = (
        await new AxeBuilder({ page }).analyze()
      ).violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical",
      );
      expect(issues).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const screenshot = testInfo.outputPath(`${name}-${theme}.png`);
      await page.screenshot({
        path: screenshot,
        fullPage: name === "overview",
        scale: "css",
      });
      await testInfo.attach(`${name}-${theme}`, {
        path: screenshot,
        contentType: "image/png",
      });
    }
  }
  expect(errors).toEqual([]);
});
