import { describe, expect, it } from "vitest";
import { detectInAppBrowser, externalBrowserUrl } from "./in-app-browser";

const UA = {
  zaloAndroid:
    "Mozilla/5.0 (Linux; Android 13; SM-A536E Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.6099.230 Mobile Safari/537.36 Zalo android/12100667 ZaloTheme/light ZaloLanguage/vi",
  zaloIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Zalo iOS/474 ZaloTheme/light ZaloLanguage/vi",
  messengerIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/MessengerForiOS;FBAV/440.0.0.33.109;FBBV/1;FBDV/iPhone14,5;FBMD/iPhone;FBSN/iOS;FBSV/17.1;FBSS/3;FBCR/;FBID/phone;FBLC/vi_VN;FBOP/5]",
  messengerAndroid:
    "Mozilla/5.0 (Linux; Android 14; Pixel 7 Build/UQ1A.240205.004; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/121.0.6167.178 Mobile Safari/537.36 [FB_IAB/Orca-Android;FBAV/447.0.0.21.110;]",
  facebookAndroid:
    "Mozilla/5.0 (Linux; Android 12; M2101K6G Build/SKQ1.210908.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.6099.193 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/447.0.0.40.108;]",
  instagramIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 317.0.3.25.104 (iPhone14,7; iOS 17_3; vi_VN; vi; scale=3.00; 1170x2532; 562456331)",
  tiktokAndroid:
    "Mozilla/5.0 (Linux; Android 13; 2201117TG Build/TKQ1.221114.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.6099.144 Mobile Safari/537.36 trill_330003 BytedanceWebview/d8a21c6",
  plainWebView:
    "Mozilla/5.0 (Linux; Android 11; RMX2189 Build/RP1A.200720.011; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/118.0.0.0 Mobile Safari/537.36",
  chromeAndroid:
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36",
  safariIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1",
  chromeIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1",
  desktop:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
};

describe("detectInAppBrowser", () => {
  it("names the app and the OS of in-app browsers", () => {
    expect(detectInAppBrowser(UA.zaloAndroid)).toEqual({
      app: "zalo",
      os: "android",
    });
    expect(detectInAppBrowser(UA.zaloIos)).toEqual({ app: "zalo", os: "ios" });
    expect(detectInAppBrowser(UA.messengerIos)?.app).toBe("messenger");
    expect(detectInAppBrowser(UA.messengerAndroid)?.app).toBe("messenger");
    expect(detectInAppBrowser(UA.facebookAndroid)?.app).toBe("facebook");
    expect(detectInAppBrowser(UA.instagramIos)).toEqual({
      app: "instagram",
      os: "ios",
    });
    expect(detectInAppBrowser(UA.tiktokAndroid)?.app).toBe("tiktok");
    expect(detectInAppBrowser(UA.plainWebView)).toEqual({
      app: "other",
      os: "android",
    });
  });

  it("leaves real browsers alone", () => {
    for (const ua of [
      UA.chromeAndroid,
      UA.safariIos,
      UA.chromeIos,
      UA.desktop,
      "",
      null,
      undefined,
    ]) {
      expect(detectInAppBrowser(ua)).toBeNull();
    }
  });
});

describe("externalBrowserUrl", () => {
  const href = "https://onluyenvatly.vn/lop/abc?tab=bai#q3";

  it("opens Safari on iOS", () => {
    expect(externalBrowserUrl(href, "ios")).toBe(`x-safari-${href}`);
  });

  it("builds an Android intent without the fragment, falling back to the page", () => {
    expect(externalBrowserUrl(href, "android")).toBe(
      `intent://onluyenvatly.vn/lop/abc?tab=bai#Intent;scheme=https;action=android.intent.action.VIEW;S.browser_fallback_url=${encodeURIComponent(href)};end`,
    );
  });

  it("has no link for other systems or odd URLs", () => {
    expect(externalBrowserUrl(href, "other")).toBeNull();
    expect(externalBrowserUrl("javascript:alert(1)", "ios")).toBeNull();
    expect(externalBrowserUrl("not a url", "android")).toBeNull();
  });
});
