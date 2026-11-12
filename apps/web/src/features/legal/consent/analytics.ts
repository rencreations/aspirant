import { GA_ID, GTM_ID } from "@/lib/legal";

/**
 * Google Analytics, through the Tag Manager container, and only after the visitor said yes.
 * Before that no request goes to Google at all. The container is about 550 KB, so it loads when
 * the browser is idle, after the page has opened, and it is not part of the loading bar (nothing
 * on the page waits for it).
 *
 * Consent Mode: every kind of storage starts denied, then analytics storage alone is granted.
 * The site has no ads, so the three advertising signals stay denied for ever.
 */

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

let loaded = false;

/** `gtag()` pushes its `arguments` object, which is the form the Google tag reads. */
function gtag(..._args: unknown[]): void {
  // eslint-disable-next-line prefer-rest-params
  (window.dataLayer ??= []).push(arguments);
}

/** Start counting. Safe to call again: it only grants analytics again after a withdrawal. */
export function startAnalytics(): void {
  (window as unknown as Record<string, unknown>)[`ga-disable-${GA_ID}`] = false;
  if (loaded) {
    gtag("consent", "update", { analytics_storage: "granted" });
    return;
  }
  loaded = true;
  window.dataLayer ??= [];
  gtag("consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied",
  });
  gtag("consent", "update", { analytics_storage: "granted" });
  window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`;
  document.head.appendChild(script);
}

/**
 * Stop counting and remove what Google Analytics stored in this browser. Called when the visitor
 * refuses or takes back a yes.
 */
export function stopAnalytics(): void {
  (window as unknown as Record<string, unknown>)[`ga-disable-${GA_ID}`] = true;
  if (loaded) gtag("consent", "update", { analytics_storage: "denied" });
  for (const line of expiryLines(document.cookie, window.location.hostname)) {
    document.cookie = line;
  }
}

/** The names of the cookies Google Analytics keeps (`_ga` and `_ga_<id>`) in a cookie string. */
export function analyticsCookieNames(cookie: string): string[] {
  return cookie
    .split(";")
    .map((part) => part.split("=")[0]?.trim() ?? "")
    .filter((name) => name === "_ga" || name.startsWith("_ga_"));
}

/**
 * The domains a cookie of this host may have been set on: the host itself and each parent that is
 * not a bare top level name (`aspirant.cc` for `www.aspirant.cc`). An address or `localhost` has none.
 */
export function cookieDomains(hostname: string): string[] {
  if (hostname === "localhost" || /^[\d.]+$/.test(hostname) || hostname.includes(":")) return [];
  const labels = hostname.split(".");
  const out: string[] = [];
  for (let i = 0; i <= labels.length - 2; i += 1) out.push(labels.slice(i).join("."));
  return out;
}

/** `document.cookie` lines that remove every Google Analytics cookie, on the host and on its parents. */
export function expiryLines(cookie: string, hostname: string): string[] {
  const past = "Thu, 01 Jan 1970 00:00:00 GMT";
  const lines: string[] = [];
  for (const name of analyticsCookieNames(cookie)) {
    lines.push(`${name}=; expires=${past}; path=/`);
    for (const domain of cookieDomains(hostname)) {
      lines.push(`${name}=; expires=${past}; path=/; domain=${domain}`);
    }
  }
  return lines;
}
