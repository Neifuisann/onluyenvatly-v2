/**
 * In-app browsers (Zalo, Messenger, Facebook…). Links shared in class chats
 * open in the app's webview, where sign-in cookies get lost, fullscreen and
 * downloads are blocked and a test in progress dies with the chat. The root
 * layout asks the student to reopen the page in a real browser.
 *
 * Detection is by user agent only, on the client (no `headers()`, so pages
 * stay static). Order matters: Messenger and Instagram also carry FB tokens.
 */

export type InAppApp =
  | "zalo"
  | "messenger"
  | "threads"
  | "instagram"
  | "facebook"
  | "tiktok"
  | "line"
  | "other";

export type MobileOs = "ios" | "android" | "other";

export type InAppBrowser = { app: InAppApp; os: MobileOs };

const APPS: ReadonlyArray<readonly [RegExp, InAppApp]> = [
  [/Zalo/i, "zalo"],
  [
    /FBAN\/Messenger|MessengerForiOS|MessengerLite|FB_IAB\/MESSENGER|Orca-Android/i,
    "messenger",
  ],
  [/Barcelona/, "threads"],
  [/Instagram/i, "instagram"],
  [/FBAN|FBAV|FB_IAB|FB4A|FBIOS/, "facebook"],
  [/musical_ly|Bytedance|TikTok/i, "tiktok"],
  [/\bLine\//, "line"],
  // Any other Android WebView ("; wv)"). iOS WKWebViews have no such marker,
  // and a home-screen web app looks the same, so iOS needs a known app token.
  [/;\s?wv\)/, "other"],
];

export function detectInAppBrowser(
  userAgent: string | null | undefined,
): InAppBrowser | null {
  if (!userAgent) return null;
  const app = APPS.find(([re]) => re.test(userAgent))?.[1];
  if (!app) return null;
  const os: MobileOs = /iPhone|iPad|iPod/.test(userAgent)
    ? "ios"
    : /Android/.test(userAgent)
      ? "android"
      : "other";
  return { app, os };
}

/**
 * A link that leaves the webview for the system browser, or null when the
 * platform has none (the student then copies the link or uses the app menu).
 * - Android: an intent with no package opens the default browser; the
 *   fallback reloads the same page if the app refuses intents.
 * - iOS 17+: `x-safari-https://…` opens Safari.
 */
export function externalBrowserUrl(href: string, os: MobileOs): string | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (os === "ios") return `x-safari-${url.href}`;
  if (os === "android") {
    // The intent's own `#Intent;…` replaces the fragment.
    const target = `${url.host}${url.pathname}${url.search}`;
    const scheme = url.protocol.slice(0, -1);
    const fallback = encodeURIComponent(url.href);
    return `intent://${target}#Intent;scheme=${scheme};action=android.intent.action.VIEW;S.browser_fallback_url=${fallback};end`;
  }
  return null;
}
