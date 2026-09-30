import { expect, test } from "@playwright/test";
import { expectAccessible } from "./a11y";
import { ANSWER_MARKER } from "./fixtures/lessons";
import { E2E_PASSWORD, e2eAdmin } from "./fixtures/users";
import {
  loginOnce,
  openTest,
  press,
  type StorageState,
  visible,
} from "./runner-helpers";

/**
 * S4-03 reveal policies on lessons of their own (so this file can run next
 * to runner.spec): until answers may be shown, the result page carries no
 * answer key, explanation or per-question marks.
 */
let storageState: StorageState;
test.beforeAll(async ({ browser }, info) => {
  storageState = await loginOnce(browser, info);
});
test.use({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires destructured fixture dependencies.
  storageState: async ({}, use) => {
    await use(storageState);
  },
});

for (const { key, message } of [
  {
    key: "e2e-reveal-never",
    message: "Giáo viên không công bố đáp án của bài này.",
  },
  {
    key: "e2e-reveal-later",
    message: /Đáp án sẽ hiển thị sau \d\d\/\d\d\/\d{4} \d\d:\d\d\./,
  },
]) {
  test(`${key}: score, questions and my choices only, no answers`, async ({
    page,
  }) => {
    const url = await openTest(page, key);
    const id = url.split("/").pop() as string;
    const submitted = await page.evaluate(async (attemptId) => {
      const r = await fetch(`/api/attempts/${attemptId}/submit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          answers: ["A", "B"],
          flagged: [],
          clientSubmitId: crypto.randomUUID(),
        }),
      });
      return r.json();
    }, id);
    expect(submitted.ok).toBe(true);

    const bodies: string[] = [];
    page.on("response", async (res) => {
      const type = res.headers()["content-type"] ?? "";
      if (/html|x-component|json/.test(type))
        bodies.push(await res.text().catch(() => ""));
    });
    await page.goto(submitted.data.resultUrl);
    const score = page.getByRole("region", { name: "Điểm" });
    await expect(score).toContainText("1/2 câu đúng");
    await expect(page.getByText(message)).toBeVisible();
    // Each question with my choice, but no marks, key or explanation.
    const choices = page.getByRole("region", { name: "Xem lại từng câu" });
    await expect(choices.getByRole("article")).toHaveCount(2);
    await expect(choices.getByText("Bạn chọn")).toHaveCount(2);
    for (const hint of ["Đáp án", "Sai", "Đúng", "Giải thích"])
      await expect(
        choices.getByRole("article").getByText(hint, { exact: true }),
      ).toHaveCount(0);
    await expect(choices.getByRole("button")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Làm lại" })).toBeVisible();
    // S8-06: the result screen, review hidden, in both themes.
    await expectAccessible(page);
    await page.waitForLoadState("networkidle");
    expect(bodies.length).toBeGreaterThan(0);
    for (const body of bodies) {
      expect(body).not.toContain(ANSWER_MARKER);
      expect(body).not.toContain("q_run_mcq");
    }
  });
}

test("exam guard: notice, blocked copy, events for the teacher only", async ({
  page,
  browser,
}) => {
  await openTest(page, "e2e-guard");
  await expect(page.getByText(/Bài có giám sát/)).toBeVisible();
  // A blocked copy is cancelled; a blur counts as leaving the page.
  const copied = await page.evaluate(() =>
    document.dispatchEvent(
      new Event("copy", { bubbles: true, cancelable: true }),
    ),
  );
  expect(copied).toBe(false);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await press(page, /^B\. 5 cm/);
  // One question per screen: submit sits on the last one.
  await visible(page, "Sau").click();
  await visible(page, "Nộp bài").click();
  await page
    .getByRole("dialog", { name: "Nộp bài?" })
    .getByRole("button", { name: "Nộp bài", exact: true })
    .click();
  await expect(page).toHaveURL(/\/result$/);
  const resultUrl = page.url();
  // Students never see the events.
  await expect(page.getByText(/Sự kiện giám sát/)).toHaveCount(0);

  const admin = await browser.newContext();
  const adminPage = await admin.newPage();
  await adminPage.goto("/login");
  await adminPage.getByLabel("Số điện thoại").fill(e2eAdmin.username);
  await adminPage.getByLabel("Mật khẩu", { exact: true }).fill(E2E_PASSWORD);
  await adminPage
    .getByRole("button", { name: "Đăng nhập", exact: true })
    .click();
  await expect(adminPage).toHaveURL(/\/admin$/);
  await adminPage.goto(resultUrl);
  // At least our two; a real focus change in the browser may add more.
  const timeline = adminPage.getByRole("region", {
    name: /^Sự kiện giám sát \([2-9]\d*\)$/,
  });
  await expect(timeline).toContainText("Thử sao chép đề");
  await expect(timeline).toContainText("Rời cửa sổ làm bài");
  await admin.close();
});

test("scheduled lessons: not open yet, and closed once answers are out", async ({
  page,
}) => {
  await page.goto("/lesson/e2e-not-open");
  await expect(
    page.getByText(/^Bài chưa mở\. Bạn có thể bắt đầu từ/),
  ).toBeVisible();
  await expect(page.getByText("Giờ bắt đầu: 01/01/2099 01:00")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Bắt đầu làm bài" }),
  ).toHaveCount(0);

  await page.goto("/lesson/e2e-closed");
  await expect(
    page.getByText("Bài đã đóng vì đáp án đã được công bố."),
  ).toBeVisible();
  await expect(page.getByText(/^Công bố đáp án và đóng bài:/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Bắt đầu làm bài" }),
  ).toHaveCount(0);
});
