// Shared helpers for the probe scripts in this folder. Run them with plain `node` against a
// running site (BASE, default http://localhost:3000). Playwright comes from apps/web.
const { createRequire } = require("node:module");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs");

const web = createRequire(path.join(__dirname, "../../../apps/web/package.json"));
const { chromium } = web("@playwright/test");

const BASE = (process.env.BASE || "http://localhost:3000").replace(/\/$/, "");
const OUT = process.env.OUT || path.join(os.tmpdir(), "aspirant-probes");
fs.mkdirSync(OUT, { recursive: true });

/** A real installed Chrome (GPU, H.264). Playwright's bundled Chromium has no H.264. */
async function launch() {
  return chromium.launch({ channel: "chrome", headless: true });
}

/**
 * A context with the loading gate skipped (as a returning visitor in the same tab) and the home
 * page's own opening switched off: `aspirants:intro` = "off" is written when the document is the
 * home page, so `/` opens at once with no drone loader, no tap gate and no intro. It is written
 * only there on purpose. The other openings (About's flight, Tetra's entrance, TheMLabel's close,
 * the roster's) are what other probes look at, and `about.cjs` decides for itself whether the About
 * opening runs; a global "off" would have turned its `intro` part into a picture of the finished
 * page. A probe that wants them off on every page sets the key itself. Probes that want to look at
 * the home's own opening use `launch()` and a plain `browser.newContext()` (see first-visit.cjs and
 * `tapHome` below).
 */
async function context(browser, options = {}) {
  const ctx = await browser.newContext(options);
  const base = new URL(BASE).pathname.replace(/\/+$/, "");
  await ctx.addInitScript(
    ({ base }) => {
      try {
        sessionStorage.setItem("aspirants:entered", "1");
        const path = location.pathname.replace(/\/+$/, "");
        if (path === base || path === `${base}/index.html`) {
          sessionStorage.setItem("aspirants:intro", "off");
        }
        localStorage.setItem(
          "aspirants:consent",
          JSON.stringify({ choice: "rejected", at: Date.now() }),
        );
      } catch {
        /* ignore */
      }
    },
    { base },
  );
  return ctx;
}

/** Limit the network of a page (CDP). `mbit` is megabits a second, `latency` is in ms. */
async function throttle(ctx, page, mbit, latency = 300) {
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency,
    downloadThroughput: (mbit * 1024 * 1024) / 8,
    uploadThroughput: 100000,
  });
  return cdp;
}

/**
 * Presses the home page's tap gate ("Touch anywhere to continue") once it appears, and waits for the
 * page to open. Returns the seconds the gate waited for the files and the seconds the opening took
 * after the press, or null when the page has no home loading screen (another route, or intro off).
 * `timeout` is in milliseconds. It never gives up before then: a slow connection waits.
 */
async function tapHome(page, timeout = 120000) {
  const t0 = Date.now();
  const gate = page.getByRole("button", { name: /touch anywhere to continue/i });
  const appeared = await gate
    .waitFor({ state: "visible", timeout })
    .then(() => true)
    .catch(() => false);
  if (!appeared) return null;
  const gateAfter = (Date.now() - t0) / 1000;
  const t1 = Date.now();
  await gate.click();
  await page
    .waitForFunction(() => !document.querySelector("[data-home-boot]"), null, { timeout })
    .catch(() => undefined);
  return { gateAfter, openAfter: (Date.now() - t1) / 1000 };
}

const PHONE = {
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 2,
};

module.exports = { BASE, OUT, PHONE, launch, context, throttle, tapHome };
