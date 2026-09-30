import { expect, test } from "@playwright/test";
import { E2E_PASSWORD, e2eStudent } from "./fixtures/users";
import type { StorageState } from "./runner-helpers";

/**
 * Journey 8 (11 §3), started in S6-02: who reaches which protected page.
 * Visitors go to `/login`, students are sent to their own home and never see
 * an admin page. Every admin server action refusing a non-admin is covered
 * for all actions at once by `features/auth/authz.test.ts`, which finds them
 * on disk. Later sprints add their admin routes here.
 */

const UUID = "00000000-0000-4000-8000-000000000000";
const ADMIN_PAGES = [
  "/admin",
  "/admin/lessons",
  "/admin/lessons/1/edit",
  "/admin/lessons/1/stats",
  "/admin/lessons/1/stats?version=1&sort=hardest",
  "/admin/students",
  `/admin/students/${UUID}`,
  "/admin/settings",
  "/admin/results",
  "/admin/results?lesson=1&q=an&from=2026-01-01",
  "/admin/explanations",
  "/admin/explanations?lesson=1",
  "/admin/import",
  "/admin/audit",
  "/admin/audit?area=students&page=2",
];
/** A download: answers JSON, never a redirect (S6-04). */
const EXPORT = "/admin/results/export?q=an";
const STUDENT_PAGES = [
  "/dashboard",
  "/lessons",
  "/review",
  "/leaderboard",
  "/profile",
  "/settings",
];
/** AI import (S7-04): a same-origin POST, so only the session decides. */
const IMPORT_BODY = { path: `2026/10/${UUID}.pdf` };

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({
    "x-forwarded-for": `10.49.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250) + 1}`,
  });
});

test.describe("a visitor", () => {
  for (const path of [...ADMIN_PAGES, ...STUDENT_PAGES, "/change-password"]) {
    test(`is sent from ${path} to the login page`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        "Đăng nhập",
      );
    });
  }

  test("gets 401 from the AI import and the daily cron", async ({
    request,
    baseURL,
  }) => {
    const res = await request.post("/api/ai/import", {
      headers: { origin: baseURL ?? "" },
      data: IMPORT_BODY,
    });
    expect(res.status()).toBe(401);
    // 503 where CRON_SECRET is unset (CI), 401 otherwise; never the job.
    const cron = await request.get("/api/cron/daily");
    expect([401, 503]).toContain(cron.status());
  });

  test("gets 401 JSON from the results export", async ({ request }) => {
    const res = await request.get(EXPORT, { maxRedirects: 0 });
    expect(res.status()).toBe(401);
    expect(res.headers()["content-type"]).toContain("application/json");
    expect(await res.json()).toMatchObject({
      ok: false,
      code: "UNAUTHENTICATED",
    });
  });
});

test.describe("a student", () => {
  // One login for the group: the per-identifier login limit is 5 a minute.
  let storageState: StorageState;
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.setExtraHTTPHeaders({
      "x-forwarded-for": `10.49.${Math.floor(Math.random() * 250)}.1`,
    });
    await page.goto("/login");
    await page.getByLabel("Số điện thoại").fill(e2eStudent("active3").phone);
    await page.getByLabel("Mật khẩu", { exact: true }).fill(E2E_PASSWORD);
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await page.waitForURL((url) => url.pathname === "/dashboard");
    storageState = await context.storageState();
    await context.close();
  });
  test.use({
    // biome-ignore lint/correctness/noEmptyPattern: Playwright requires destructured fixture dependencies.
    storageState: async ({}, use) => {
      await use(storageState);
    },
  });

  for (const path of ADMIN_PAGES) {
    test(`is sent from ${path} to the dashboard`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/dashboard$/);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(
        "Chào",
      );
    });
  }

  test("gets 403 JSON from the results export", async ({ page }) => {
    const res = await page.request.get(EXPORT, { maxRedirects: 0 });
    expect(res.status()).toBe(403);
    expect(res.headers()["cache-control"]).toContain("no-store");
    expect(await res.json()).toMatchObject({ ok: false, code: "FORBIDDEN" });
  });

  test("gets 403 from the AI import", async ({ page, baseURL }) => {
    const res = await page.request.post("/api/ai/import", {
      headers: { origin: baseURL ?? "" },
      data: IMPORT_BODY,
    });
    expect(res.status()).toBe(403);
    expect(await res.json()).toMatchObject({ ok: false, code: "FORBIDDEN" });
  });

  test("opens the student pages", async ({ page }) => {
    for (const path of STUDENT_PAGES) {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`${path}$`));
    }
  });
});
