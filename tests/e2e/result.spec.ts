import { expect, test } from "@playwright/test";
import { ANSWER_MARKER } from "./fixtures/lessons";
import { loginOnce, openTest, type StorageState } from "./runner-helpers";

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
  test(`${key}: score only, no answers in the page`, async ({ page }) => {
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
    await expect(
      page.getByRole("region", { name: "Xem lại từng câu" }),
    ).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Làm lại" })).toBeVisible();
    await page.waitForLoadState("networkidle");
    expect(bodies.length).toBeGreaterThan(0);
    for (const body of bodies) {
      expect(body).not.toContain(ANSWER_MARKER);
      expect(body).not.toContain("q_run_mcq");
    }
  });
}
