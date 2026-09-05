export type AndroidInstallBrowser =
  | "chrome"
  | "samsung"
  | "edge"
  | "firefox"
  | "other"
  | "desktop";

export function detectAndroidInstallBrowser(
  userAgent: string,
): AndroidInstallBrowser {
  if (!/android/i.test(userAgent)) return "desktop";
  if (/samsungbrowser/i.test(userAgent)) return "samsung";
  if (/edga|edg\//i.test(userAgent)) return "edge";
  if (/firefox|fxios/i.test(userAgent)) return "firefox";
  if (/chrome/i.test(userAgent) && !/opr|opera|brave/i.test(userAgent)) {
    return "chrome";
  }
  return "other";
}

export function isChromeWebApkSafe(browser: AndroidInstallBrowser) {
  return browser === "chrome" || browser === "desktop";
}

export function chromeIntentUrl(pageUrl: string) {
  const parsed = new URL(pageUrl);
  const fallback = encodeURIComponent(pageUrl);
  return `intent://${parsed.host}${parsed.pathname}${parsed.search}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${fallback};end`;
}
