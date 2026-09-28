import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { loginAdminOnce } from "./admin-helpers";
import { FAKE_STORAGE_URL } from "./fake-storage";
import type { StorageState } from "./runner-helpers";

/**
 * S5-05 against the Storage stand-in (fake-storage.ts): a pasted 5 MB PNG
 * is resized in the browser, uploaded straight to Storage as a WebP under
 * 200 KB and inserted as `![](media:…)`; the cover is set and removed.
 * The editor text is never saved, so both projects can paste.
 */

let storageState: StorageState;
test.beforeAll(async ({ browser }, info) => {
  storageState = await loginAdminOnce(browser, info, "media");
});
test.use({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires destructured fixture dependencies.
  storageState: async ({}, use) => {
    await use(storageState);
  },
});

type Upload = { path: string; contentType: string; bytes: number };

/**
 * The stand-in's record of one object. Tests find their own upload by path:
 * specs and projects run in parallel against the same stand-in.
 */
async function uploaded(page: Page, path: string): Promise<Upload | undefined> {
  const all: Upload[] = await (
    await page.request.get(`${FAKE_STORAGE_URL}/__uploads`)
  ).json();
  return all.find((u) => u.path === path);
}

const SIGNED_PUT =
  /\/storage\/v1\/object\/upload\/sign\/media\/([^?]+)\?token=/;

async function openDraftEditor(page: Page) {
  await page.goto("/admin/lessons?q=ban+nhap+kin");
  await page
    .getByRole("link", { name: "E2E – Bản nháp kín", exact: true })
    .click();
  await expect(page).toHaveURL(/\/admin\/lessons\/\d+\/edit$/);
  await expect(page.locator(".cm-content")).toBeVisible();
}

/**
 * A photo-like PNG over 5 MB (gradients, shapes and sensor-like noise),
 * pasted into the editor as a file, the way a screenshot paste arrives.
 */
async function pasteBigPng(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const w = 2600;
    const h = 2000;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas");
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "rgb(30, 60, 120)");
    g.addColorStop(1, "rgb(230, 200, 150)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `hsl(${i * 37} 60% 55%)`;
      ctx.beginPath();
      ctx.arc((i * 331) % w, (i * 197) % h, 60 + (i % 7) * 30, 0, Math.PI * 2);
      ctx.fill();
    }
    const img = ctx.getImageData(0, 0, w, h);
    let seed = 1;
    for (let p = 0; p < img.data.length; p += 4)
      for (let c = 0; c < 3; c++) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        img.data[p + c] = Math.min(255, (img.data[p + c] ?? 0) + (seed % 10));
      }
    ctx.putImageData(img, 0, 0);
    const blob = await new Promise<Blob | null>((r) =>
      canvas.toBlob(r, "image/png"),
    );
    if (!blob) throw new Error("no png");
    const file = new File([blob], "hinh.png", { type: "image/png" });
    const data = new DataTransfer();
    data.items.add(file);
    const target = document.querySelector(".cm-content");
    target?.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData: data,
        bubbles: true,
        cancelable: true,
      }),
    );
    return file.size;
  });
}

test("a pasted 5 MB PNG becomes a small WebP in Storage and a media line", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (r) => {
    if (r.method() !== "GET") requests.push(`${r.method()} ${r.url()}`);
  });
  await openDraftEditor(page);
  const phone = (page.viewportSize()?.width ?? 0) < 1024;
  if (phone) await page.getByText("Soạn thảo", { exact: true }).click();
  await page.locator(".cm-content").click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.insertText("\n\nCâu 9: Hình bên là\n");

  const size = await pasteBigPng(page);
  expect(size).toBeGreaterThan(5_000_000);
  await expect(
    page.getByRole("status").filter({ hasText: "Đã chèn ảnh." }),
  ).toBeVisible({ timeout: 20_000 });

  // The bytes went straight to Storage in one PUT, never through the app.
  const put = requests.filter((r) => r.startsWith("PUT "));
  expect(put).toHaveLength(1);
  expect(put[0]).toContain(
    `${FAKE_STORAGE_URL}/storage/v1/object/upload/sign/`,
  );
  const path = decodeURIComponent(SIGNED_PUT.exec(put[0] ?? "")?.[1] ?? "");
  expect(path).toMatch(/^\d{4}\/\d{2}\/[0-9a-f-]{36}\.webp$/);
  const upload = (await uploaded(page, path)) as Upload;
  expect(upload.contentType).toBe("image/webp");
  expect(upload.bytes).toBeLessThan(200_000);

  await expect(page.locator(".cm-content")).toContainText(
    `![](media:${upload.path} =1280x985)`,
  );
  if (phone) await page.getByText("Xem trước", { exact: true }).click();
  const image = page.locator(`main article img[src$="${upload.path}"]`);
  await expect(image).toBeVisible();
  await expect(image).toHaveAttribute("width", "1280");
  expect(
    await image.evaluate((el) => (el as HTMLImageElement).naturalWidth),
  ).toBe(1280);
});

test("cover: upload, show, remove", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium", "writes the shared draft");
  page.on("dialog", (d) => d.accept());
  await openDraftEditor(page);
  await page.getByRole("tab", { name: "Cài đặt" }).click();
  const cover = page.getByRole("region", { name: "Ảnh bìa" });
  // A retry after an interrupted run finds the cover still set: clear it.
  const leftover = cover.getByRole("button", { name: "Bỏ ảnh bìa" });
  if (await leftover.isVisible()) await leftover.click();
  await expect(cover).toContainText("Chưa có ảnh bìa.");

  const png = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1600;
    canvas.height = 900;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas");
    ctx.fillStyle = "rgb(40, 90, 160)";
    ctx.fillRect(0, 0, 1600, 900);
    const blob = await new Promise<Blob | null>((r) =>
      canvas.toBlob(r, "image/png"),
    );
    return Array.from(new Uint8Array(await (blob as Blob).arrayBuffer()));
  });
  await cover.locator("input[type=file]").setInputFiles({
    name: "bia.png",
    mimeType: "image/png",
    buffer: Buffer.from(png),
  });
  await expect(cover.getByRole("status")).toContainText("Đã lưu ảnh bìa.");
  const img = cover.getByRole("img", { name: "Ảnh bìa hiện tại" });
  await expect(img).toBeVisible();
  const src = (await img.getAttribute("src")) ?? "";
  const path = src.split("/object/public/media/")[1] ?? "";
  const upload = (await uploaded(page, decodeURIComponent(path))) as Upload;
  expect(upload.contentType).toBe("image/webp");

  // It survives a reload (saved at once, like the settings).
  await page.reload();
  await page.getByRole("tab", { name: "Cài đặt" }).click();
  await expect(
    page.getByRole("img", { name: "Ảnh bìa hiện tại" }),
  ).toHaveAttribute("src", new RegExp(`${upload.path}$`));

  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    const axe = await new AxeBuilder({ page }).analyze();
    expect(
      axe.violations.filter((v) =>
        ["serious", "critical"].includes(v.impact ?? ""),
      ),
    ).toEqual([]);
  }

  await page
    .getByRole("region", { name: "Ảnh bìa" })
    .getByRole("button", { name: "Bỏ ảnh bìa" })
    .click();
  await expect(page.getByRole("region", { name: "Ảnh bìa" })).toContainText(
    "Chưa có ảnh bìa.",
  );
});
