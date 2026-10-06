import {
  type Browser,
  type BrowserContextOptions,
  expect,
  type Page,
  type TestInfo,
  test,
} from "@playwright/test";
import { expectAccessible } from "./a11y";
import { loginAdminOnce } from "./admin-helpers";
import { ANSWER_MARKER, GAME_RIGHT } from "./fixtures/lessons";
import { E2E_PASSWORD, e2eStudent } from "./fixtures/users";
import { attachShot, type StorageState } from "./runner-helpers";

/**
 * B-05 game rooms: a teacher hosts a race on a projector-sized screen while
 * two students play on the project's device. One student answers every
 * question right and wins; the other answers wrong. Each project uses its
 * own admin, students and lesson (`e2e-game-d/m`); needs a fresh seed.
 */

test.describe.configure({ mode: "serial" });

const project = (info: TestInfo): "d" | "m" =>
  info.project.name === "mobile" ? "m" : "d";

/** The project's device settings, for contexts opened by hand. */
function deviceOptions(info: TestInfo): BrowserContextOptions {
  const { viewport, userAgent, isMobile, hasTouch, deviceScaleFactor } =
    info.project.use;
  return {
    ...(viewport !== undefined && { viewport }),
    ...(userAgent !== undefined && { userAgent }),
    ...(isMobile !== undefined && { isMobile }),
    ...(hasTouch !== undefined && { hasTouch }),
    ...(deviceScaleFactor !== undefined && { deviceScaleFactor }),
  };
}

async function loginStudent(
  browser: Browser,
  info: TestInfo,
  phone: string,
): Promise<StorageState> {
  const context = await browser.newContext(deviceOptions(info));
  const page = await context.newPage();
  await page.setExtraHTTPHeaders({
    "x-forwarded-for": `10.47.${Math.floor(Math.random() * 250)}.1`,
  });
  await page.goto("/login?next=/dashboard");
  await page.getByLabel("Số điện thoại").fill(phone);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/dashboard");
  const state = await context.storageState();
  await context.close();
  return state;
}

/** Everything a player's browser receives; checked for keys at the end. */
function watchBodies(page: Page) {
  const bodies: { url: string; body: string }[] = [];
  page.on("response", async (res) => {
    const type = res.headers()["content-type"] ?? "";
    if (/html|x-component|json/.test(type))
      bodies.push({ url: res.url(), body: await res.text().catch(() => "") });
  });
  return bodies;
}

/** Answers all five questions, right or wrong, and checks each feedback. */
async function race(
  page: Page,
  right: boolean,
  shoot: (
    step: "question" | "feedback",
    i: number,
  ) => Promise<void> = async () => {},
) {
  for (let i = 1; i <= 5; i++) {
    await expect(page.getByRole("region", { name: `Câu ${i}/5` })).toBeVisible({
      timeout: 20_000,
    });
    const tiles = page.locator("button[data-option]");
    await expect(tiles).toHaveCount(4);
    await shoot("question", i);
    const target = right
      ? tiles.filter({ hasText: GAME_RIGHT })
      : tiles.filter({ hasNotText: GAME_RIGHT }).first();
    await target.click();
    await expect(
      page.getByText(right ? "Chính xác!" : "Chưa đúng", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
    await shoot("feedback", i);
    // The key lights up after answering, in this player's own shuffle.
    await expect(tiles.filter({ hasText: GAME_RIGHT })).toHaveAccessibleName(
      /Đáp án đúng/,
    );
  }
}

/** Opens `/admin/games/new` and creates a 5-question room from the project lesson. */
async function createRoom(host: Page, p: "d" | "m") {
  await host.goto("/admin/games/new");
  await host.getByLabel("Tìm bài").fill(`dua toc do (${p})`);
  await host.getByText(`E2E – Đua tốc độ (${p})`).click();
  // The default size is 10, more than the lesson has: the summary says so.
  const summary = host.getByRole("status").filter({ hasText: /câu/ });
  await expect(summary).toHaveText("Chỉ có 5 câu phù hợp: bộ đề sẽ có 5 câu.");
  await host
    .locator("label", { has: host.locator('input[name="count"][value="5"]') })
    .click();
  await expect(summary).toHaveText("Rút ngẫu nhiên 5 câu từ 5 câu.");
  await host.getByText("Thong thả").click();
  await host.getByRole("button", { name: "Tạo phòng" }).click();
  await host.waitForURL(/\/host\/[0-9a-f-]{36}$/);
  const pin = await host.locator("[data-pin]").getAttribute("data-pin");
  expect(pin).toMatch(/^[1-9]\d{5}$/);
  return pin ?? "";
}

/** Follows the PIN link and joins with the default racer: ends in the lobby. */
async function joinRoom(page: Page, pin: string) {
  await page.goto(`/play/${pin}`);
  await page.getByRole("button", { name: "Vào phòng" }).click();
  await expect(
    page.getByRole("heading", { name: "Bạn đã vào phòng!" }),
  ).toBeVisible();
}

/** The host, A and B, each in their own browser context. */
async function openRoles(browser: Browser, info: TestInfo) {
  const p = project(info);
  const a = e2eStudent(p === "m" ? "gameA2" : "gameA");
  const b = e2eStudent(p === "m" ? "gameB2" : "gameB");
  const hostState = await loginAdminOnce(
    browser,
    info,
    "games",
    "/admin/games",
  );
  const aState = await loginStudent(browser, info, a.phone);
  const bState = await loginStudent(browser, info, b.phone);
  const hostContext = await browser.newContext({
    storageState: hostState,
    viewport: { width: 1280, height: 800 },
  });
  const aContext = await browser.newContext({
    ...deviceOptions(info),
    storageState: aState,
  });
  const bContext = await browser.newContext({
    ...deviceOptions(info),
    storageState: bState,
  });
  return {
    p,
    a,
    b,
    host: await hostContext.newPage(),
    playerA: await aContext.newPage(),
    playerB: await bContext.newPage(),
    close: () =>
      Promise.all([hostContext.close(), aContext.close(), bContext.close()]),
  };
}

test("a class race: create, join, lobby, race, podium and report", async ({
  browser,
}, info) => {
  test.setTimeout(240_000);
  const p = project(info);
  const a = e2eStudent(p === "m" ? "gameA2" : "gameA");
  const b = e2eStudent(p === "m" ? "gameB2" : "gameB");
  const [hostState, aState, bState] = [
    await loginAdminOnce(browser, info, "games", "/admin/games"),
    await loginStudent(browser, info, a.phone),
    await loginStudent(browser, info, b.phone),
  ];

  // The teacher: a projector, whatever the project's device.
  const hostContext = await browser.newContext({
    storageState: hostState,
    viewport: { width: 1280, height: 800 },
  });
  const host = await hostContext.newPage();
  const pin = await createRoom(host, p);
  await expect(host.getByText("Đang chờ học sinh vào phòng…")).toBeVisible();
  await expect(
    host.getByRole("button", { name: "Bắt đầu đua" }),
  ).toBeDisabled();

  // Student A follows the link and picks a racer.
  const aContext = await browser.newContext({
    ...deviceOptions(info),
    storageState: aState,
  });
  const playerA = await aContext.newPage();
  const bodiesA = watchBodies(playerA);
  await playerA.goto(`/play/${pin}`);
  await expect(
    playerA.getByRole("heading", { name: "Chọn tay đua của bạn" }),
  ).toBeVisible();
  await attachShot(playerA, info, "player-join");
  await expectAccessible(playerA);
  await playerA.getByText("Tên lửa").click();
  await playerA.getByRole("button", { name: "Vào phòng" }).click();
  await expect(
    playerA.getByRole("heading", { name: "Bạn đã vào phòng!" }),
  ).toBeVisible();

  // Student B types the PIN, with a wrong one first.
  const bContext = await browser.newContext({
    ...deviceOptions(info),
    storageState: bState,
  });
  const playerB = await bContext.newPage();
  const bodiesB = watchBodies(playerB);
  // A malformed PIN in the URL is explained; in the form, the browser
  // refuses it before sending.
  await playerB.goto("/play?pin=12a45");
  await expect(playerB.getByText("Mã phòng gồm 6 chữ số.")).toBeVisible();
  await playerB.getByLabel("Mã phòng").fill("12345");
  await playerB.getByRole("button", { name: "Vào phòng" }).click();
  await expect(playerB).toHaveURL(/\/play\?pin=12a45$/);
  expect(
    await playerB
      .getByLabel("Mã phòng")
      .evaluate((el) => (el as HTMLInputElement).validity.patternMismatch),
  ).toBe(true);
  await playerB.getByLabel("Mã phòng").fill(pin ?? "");
  await playerB.getByRole("button", { name: "Vào phòng" }).click();
  await playerB.waitForURL(`/play/${pin}`);
  await playerB.getByRole("button", { name: "Vào phòng" }).click();
  await expect(
    playerB.getByRole("heading", { name: "Bạn đã vào phòng!" }),
  ).toBeVisible();
  // A's lobby sees B arrive (poll).
  await expect(playerA.getByText("2 người chơi trong phòng")).toBeVisible();
  await attachShot(playerA, info, "player-lobby");
  await expectAccessible(playerA);

  // The host sees both and starts.
  await expect(host.getByText("2 người chơi")).toBeVisible();
  await attachShot(host, info, "host-lobby");
  await expect(
    host.getByRole("button", { name: `Mời ${a.fullName} rời phòng` }),
  ).toBeVisible();
  await host.getByRole("button", { name: "Bắt đầu đua" }).click();
  await expect(host.getByRole("heading", { name: "Đường đua" })).toBeVisible();

  // Both race at once: A right every time, B wrong every time.
  await expect(playerA.getByText("Chuẩn bị…")).toBeVisible();
  await Promise.all([
    race(playerA, true, async (step, i) => {
      if (i === 1) await attachShot(playerA, info, `player-${step}`);
      if (i === 3 && step === "feedback")
        await attachShot(host, info, "host-race");
    }),
    race(playerB, false, async (step, i) => {
      if (i === 1 && step === "feedback")
        await attachShot(playerB, info, "player-wrong");
    }),
  ]);

  // Over for everyone: the podium, my rank, and the teacher's report.
  for (const [page, rank] of [
    [playerA, 1],
    [playerB, 2],
  ] as const) {
    await expect(
      page.getByRole("heading", { name: "Kết quả chung cuộc" }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByText(`Hạng ${rank}`, { exact: false }).first(),
    ).toBeVisible();
  }
  await expect(playerA.getByText("5/5 câu đúng")).toBeVisible();
  await expect(playerB.getByText("0/5 câu đúng")).toBeVisible();
  await attachShot(playerA, info, "player-final");
  await expectAccessible(playerA);

  await expect(
    host.getByRole("heading", { name: "Bục vinh quang" }),
  ).toBeVisible({ timeout: 20_000 });
  await expect(
    host.getByRole("heading", { name: "Câu cả lớp hay sai" }),
  ).toBeVisible();
  await expect(host.getByText("0% đúng").first()).toBeVisible();
  await attachShot(host, info, "host-final");
  await host.screenshot({
    path: info.outputPath("host-final-full.png"),
    fullPage: true,
  });

  // Journey 4 for races: no key or explanation before (or after) answering,
  // except the one key each answer response carries as `expected`.
  for (const { url, body } of [...bodiesA, ...bodiesB]) {
    expect(body, url).not.toContain(ANSWER_MARKER);
    expect(body, url).not.toMatch(/"(?:answer|explanation|tolerance)"\s*:/);
  }

  await Promise.all([hostContext.close(), aContext.close(), bContext.close()]);
});

test("host controls: change racer, remove a player, end mid-race, play again", async ({
  browser,
}, info) => {
  test.setTimeout(180_000);
  const { p, b, host, playerA, playerB, close } = await openRoles(
    browser,
    info,
  );
  const pin = await createRoom(host, p);
  const firstRoom = host.url();

  // A joins, then changes racer from the lobby.
  await joinRoom(playerA, pin);
  await playerA.getByRole("button", { name: "Đổi tay đua" }).click();
  await playerA.getByText("Rùa", { exact: true }).click();
  await playerA.getByRole("button", { name: "Lưu" }).click();
  await expect(
    playerA.getByRole("heading", { name: "Bạn đã vào phòng!" }),
  ).toBeVisible();

  // B joins and the teacher removes B: B's lobby says so, and so does a reload.
  await joinRoom(playerB, pin);
  await expect(host.getByText("2 người chơi")).toBeVisible();
  await host
    .getByRole("button", { name: `Mời ${b.fullName} rời phòng` })
    .click();
  const removeDialog = host.getByRole("dialog");
  await expect(removeDialog).toContainText(b.fullName);
  await removeDialog.getByRole("button", { name: "Mời rời phòng" }).click();
  await expect(host.getByText("1 người chơi")).toBeVisible();
  await expect(
    playerB.getByText("Giáo viên đã mời bạn rời phòng này."),
  ).toBeVisible({ timeout: 10_000 });
  await playerB.reload();
  await expect(
    playerB.getByText("Giáo viên đã mời bạn rời phòng này."),
  ).toBeVisible();

  // The race starts; A answers one question, then the teacher ends it.
  await host.getByRole("button", { name: "Bắt đầu đua" }).click();
  await expect(playerA.getByRole("region", { name: "Câu 1/5" })).toBeVisible({
    timeout: 20_000,
  });
  await playerA
    .locator("button[data-option]")
    .filter({ hasText: GAME_RIGHT })
    .click();
  await expect(playerA.getByRole("region", { name: "Câu 2/5" })).toBeVisible({
    timeout: 15_000,
  });
  await host.getByRole("button", { name: "Kết thúc" }).click();
  await host
    .getByRole("dialog")
    .getByRole("button", { name: "Kết thúc" })
    .click();
  await expect(
    host.getByRole("heading", { name: "Bục vinh quang" }),
  ).toBeVisible({ timeout: 15_000 });

  // A learns at the next tap: the answer is refused and the podium opens.
  await playerA.locator("button[data-option]").first().click();
  await expect(
    playerA.getByRole("heading", { name: "Kết quả chung cuộc" }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(playerA.getByText("1/5 câu đúng")).toBeVisible();

  // "Chơi lại" opens a fresh lobby with the same settings.
  await host.getByRole("button", { name: "Chơi lại" }).click();
  await host.waitForURL(
    (url) =>
      /\/host\/[0-9a-f-]{36}$/.test(url.pathname) && url.href !== firstRoom,
  );
  await expect(host.getByText("Đang chờ học sinh vào phòng…")).toBeVisible();
  await expect(host.getByText("5 câu · Nhịp Thong thả")).toBeVisible();
  await close();
});
