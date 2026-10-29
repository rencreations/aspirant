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

/** A context with the loading gate skipped (as a returning visitor in the same tab). */
async function context(browser, options = {}) {
  const ctx = await browser.newContext(options);
  await ctx.addInitScript(() => {
    try {
      sessionStorage.setItem("aspirants:entered", "1");
    } catch {
      /* ignore */
    }
  });
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

const PHONE = {
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 2,
};

module.exports = { BASE, OUT, PHONE, launch, context, throttle };
