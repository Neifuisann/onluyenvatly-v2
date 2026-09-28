import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { ANSWER_MARKER } from "./fixtures/lessons";
import {
  attachShot,
  loginOnce,
  openTest,
  press,
  type StorageState,
  singleView,
  visible,
} from "./runner-helpers";

/**
 * The test runner (S3-04…S3-06, 11 §3 journeys 2–5) on the seeded
 * `e2e-runner` lesson: mcq B (0.25), mcq B (0.25), tf Đ S Đ S (1),
 * short 0.63 (0.5) = 2 points. Needs `pnpm seed --profile e2e`.
 */
test.describe.configure({ mode: "serial" });

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

test("runner: every question type, flag, navigator, list view and keys", async ({
  page,
  isMobile,
}, testInfo) => {
  // Journey 4 (answer leakage): nothing the runner loads carries answers.
  const bodies: string[] = [];
  page.on("response", async (res) => {
    const type = res.headers()["content-type"] ?? "";
    if (/html|x-component|json/.test(type))
      bodies.push(await res.text().catch(() => ""));
  });
  await openTest(page, "e2e-runner");
  await expect(
    page.getByRole("progressbar", { name: "Đã làm 0/4 câu" }),
  ).toBeVisible();

  // 1: mcq by tap; tapping again clears it.
  const optionB = page.getByRole("button", { name: /^B\. 5 cm/ });
  await optionB.click();
  await expect(optionB).toHaveAttribute("aria-pressed", "true");
  await optionB.click();
  await expect(optionB).toHaveAttribute("aria-pressed", "false");
  await optionB.click();
  await expect(
    page.getByRole("progressbar", { name: "Đã làm 1/4 câu" }),
  ).toBeVisible();

  // 2: keyboard (→ next, 2 = B).
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("heading", { name: /^Câu 2 ·/ })).toBeVisible();
  await page.keyboard.press("2");
  await expect(page.getByRole("button", { name: /^B\. Hz/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  // 3: true/false, and flag it.
  await visible(page, "Sau").click();
  await expect(
    page.getByRole("heading", { name: "Câu 3 · Đúng/Sai · 1đ" }),
  ).toBeVisible();
  for (const name of ["a) Đúng", "b) Sai", "c) Đúng", "d) Sai"])
    await page.getByRole("button", { name, exact: true }).click();
  await expect(
    page.getByRole("button", { name: "b) Sai", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await visible(page, "Đánh dấu").click();
  await expect(visible(page, "Đã đánh dấu")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await attachShot(page, testInfo, "runner-tf-answered");

  // 4: short answer with a comma decimal.
  await visible(page, "Sau").click();
  const input = page.getByLabel("Câu trả lời của bạn");
  await input.fill("0,63");
  await expect(page.getByText("Hệ thống ghi nhận: 0.63")).toBeVisible();
  await expect(
    page.getByRole("progressbar", { name: "Đã làm 4/4 câu" }),
  ).toBeVisible();

  // Navigator: a bottom sheet on phones, a side panel on desktop.
  if (isMobile)
    await page.getByRole("button", { name: /Mở danh sách/ }).click();
  await expect(visible(page, "Câu 3, đã làm, đã đánh dấu")).toBeVisible();
  await visible(page, "Câu 1, đã làm").click();
  await expect(page.getByRole("heading", { name: /^Câu 1 ·/ })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // List view shows every question, with submit in reach.
  await page.getByRole("button", { name: "Xem tất cả" }).click();
  await expect(page.getByRole("heading", { name: /^Câu \d ·/ })).toHaveCount(4);

  // Submit dialog summarizes; "Làm tiếp" returns to the test.
  await visible(page, "Nộp bài").click();
  const dialog = page.getByRole("dialog", { name: "Nộp bài?" });
  await expect(dialog.getByText("Bạn đã làm 4/4 câu.")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Đến câu 3" })).toBeVisible();
  await dialog.getByRole("button", { name: "Làm tiếp" }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole("button", { name: "Xem từng câu" }).click();
  await expect(page.getByRole("heading", { name: /^Câu \d ·/ })).toHaveCount(1);

  for (const body of bodies) {
    expect(body).not.toContain(ANSWER_MARKER);
    expect(body).not.toMatch(/"(?:answer|explanation|tolerance)"\s*:/);
  }
});

test("journey 2: reload keeps answers; offline answers sync when back online", async ({
  page,
  context,
  request,
}) => {
  const url = await openTest(page, "e2e-runner");
  const saveState = page.getByRole("status").filter({ hasText: /lưu|kết nối/ });

  // Offline: kept on the device, banner shown; online again: synced.
  await context.setOffline(true);
  await press(page, /^C\. 10 cm/);
  await expect(saveState).toHaveText("Mất kết nối – đã lưu trên máy");
  await expect(page.getByText(/bài làm vẫn được lưu trên máy/)).toBeVisible();
  await context.setOffline(false);
  await expect(saveState).toHaveText("Đã lưu");

  // The server has it: without the local copy, a reload still shows C.
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(
    page.getByRole("button", { name: /^C\. 10 cm/ }),
  ).toHaveAttribute("aria-pressed", "true");

  // Unsynced changes survive a reload through localStorage.
  await press(page, /^A\. 2 cm/);
  await expect(saveState).toHaveText("Đã lưu trên máy");
  await page.reload();
  await expect(page.getByRole("button", { name: /^A\. 2 cm/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  // The save endpoint refuses other origins.
  const id = url.split("/").pop();
  const forged = await request.post(`/api/attempts/${id}/save`, {
    headers: { origin: "https://evil.example" },
    data: { answers: [null, null, null, null], flagged: [] },
  });
  expect(forged.status()).toBe(403);
});

test("runner fits the phone, passes axe in light and dark", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await openTest(page, "e2e-runner");
  for (const theme of ["light", "dark"] as const) {
    // Reduced motion zeroes transitions, so axe never samples mid-fade. The
    // theme class is set at load, hence the reload.
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await page.reload();
    await singleView(page);
    for (const view of ["single", "list"] as const) {
      if (view === "list")
        await page.getByRole("button", { name: "Xem tất cả" }).click();
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
      const path = testInfo.outputPath(`runner-${view}-${theme}.png`);
      await page.screenshot({ path, scale: "css" });
      await testInfo.attach(`runner-${view}-${theme}`, {
        path,
        contentType: "image/png",
      });
      if (view === "list")
        await page.getByRole("button", { name: "Xem từng câu" }).click();
    }
  }
  expect(errors).toEqual([]);
});

test("journey 2 end + 5: the server grades; a double submit gives one result", async ({
  page,
}, testInfo) => {
  const runnerUrl = await openTest(page, "e2e-runner");
  await press(page, /^A\. 2 cm/); // wrong
  await visible(page, "Sau").click();
  await press(page, /^B\. Hz/); // 0.25
  await visible(page, "Sau").click();
  for (const name of ["a) Đúng", "b) Sai", "c) Sai", "d) Sai"])
    await press(page, name); // 3 of 4 → 0.5 × 1
  await visible(page, "Sau").click();
  await page.getByLabel("Câu trả lời của bạn").fill("0,63"); // 0.5
  await visible(page, "Nộp bài").click();
  const dialog = page.getByRole("dialog", { name: "Nộp bài?" });
  await dialog.getByRole("button", { name: "Nộp bài", exact: true }).click();
  await expect(page).toHaveURL(/\/attempts\/[0-9a-f-]{36}\/result$/);
  const score = page.getByRole("region", { name: "Điểm" });
  await expect(score).toContainText("6,25");
  await expect(score).toContainText("2/4 câu đúng");
  await expect(score).toContainText("1,25/2 điểm");
  await attachShot(page, testInfo, "result");

  // S4-03: rating change, then the review (revealAnswers: after_submit).
  await expect(score).toContainText(/Rating [\d\s]+ → [\d\s]+/);
  const review = page.getByRole("region", { name: "Xem lại từng câu" });
  await expect(review.getByRole("article")).toHaveCount(4);
  await expect(
    review.getByRole("article", { name: "Câu 1 · Trắc nghiệm" }),
  ).toContainText("Sai");
  await expect(
    review.getByRole("article", { name: "Câu 3 · Đúng/Sai" }),
  ).toContainText("Đúng một phần");
  await expect(review.getByText(ANSWER_MARKER).first()).toBeVisible();
  await review.getByRole("button", { name: "Sai 2" }).click();
  await expect(review.getByRole("article")).toHaveCount(2);
  await review.getByRole("button", { name: "Đúng 2" }).click();
  await expect(review.getByRole("article")).toHaveCount(2);
  await expect(
    review.getByRole("article", { name: "Câu 2 · Trắc nghiệm" }),
  ).toBeVisible();
  await review.getByRole("button", { name: "Tất cả 4" }).click();
  for (const theme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await page.reload();
    await expect(review.getByRole("article")).toHaveCount(4);
    const issues = (await new AxeBuilder({ page }).analyze()).violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(issues).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await attachShot(page, testInfo, `result-review-${theme}`);
  }
  await page.emulateMedia({ colorScheme: "light", reducedMotion: null });

  // The runner of a submitted attempt leads to its result.
  await page.goto(runnerUrl);
  await expect(page).toHaveURL(/\/result$/);

  // Journey 5: two parallel submits → the same graded result.
  const url = await openTest(page, "e2e-runner");
  expect(url).not.toBe(runnerUrl);
  const id = url.split("/").pop() as string;
  const [a, b] = await page.evaluate(async (attemptId) => {
    const post = () =>
      fetch(`/api/attempts/${attemptId}/submit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          answers: ["B", "B", [true, false, true, false], "0.63"],
          flagged: [],
          clientSubmitId: crypto.randomUUID(),
        }),
      }).then((r) => r.json());
    return Promise.all([post(), post()]);
  }, id);
  expect(a.ok && b.ok).toBe(true);
  expect(a.data.resultUrl).toBe(b.data.resultUrl);
  expect([a.data.score, b.data.score]).toEqual([2, 2]);
  expect([a.data.alreadySubmitted, b.data.alreadySubmitted].sort()).toEqual([
    false,
    true,
  ]);
  await page.goto(a.data.resultUrl);
  await expect(page.getByRole("region", { name: "Điểm" })).toContainText("10");
});

test("journey 3: the timer auto-submits at 0 and later saves are refused", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  const url = await openTest(page, "e2e-timer");
  const timer = page.getByRole("timer");
  await expect(timer).toHaveText(/0[01]:\d\d/);
  await expect(timer).toHaveClass(/bg-danger/);
  await press(page, /^B\. 5 cm/); // 0.25 of 0.5
  await attachShot(page, testInfo, "timer");
  await expect(page).toHaveURL(/\/result$/, { timeout: 90_000 });
  await expect(page.getByRole("region", { name: "Điểm" })).toContainText(
    "0,25/0,5 điểm",
  );
  const id = url.split("/").pop();
  const late = await page.request.post(`/api/attempts/${id}/save`, {
    headers: { origin: new URL(url).origin },
    data: { answers: [null, null], flagged: [] },
  });
  expect(late.status()).toBe(409);
  expect((await late.json()).code).toBe("ATTEMPT_CLOSED");
});
