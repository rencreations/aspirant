// Walks the home at a row of positions and lists every request that failed or answered 400 or more.
// A 404 on a `__next.*.txt` file is a framework prefetch and harmless. A failed media file is not.
//
// Usage: node scripts/qa/home/failed-requests.cjs [base]
const path = require("node:path");
const { createRequire } = require("node:module");

const req = createRequire(path.resolve(__dirname, "../../../apps/web/package.json"));
const { chromium } = req("@playwright/test");

const base = process.argv[2] || "http://localhost:3000/";

(async () => {
  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
    args: ["--ignore-gpu-blocklist"],
  });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem("aspirants:consent", "rejected");
      sessionStorage.setItem("aspirants:intro", "off");
    } catch {
      /* storage can be blocked */
    }
  });
  const page = await ctx.newPage();
  const bad = new Map();
  page.on("response", (r) => {
    if (r.status() >= 400) bad.set(r.url(), r.status());
  });
  page.on("requestfailed", (r) =>
    bad.set(r.url(), "FAILED " + (r.failure() && r.failure().errorText)),
  );
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__home && window.__home.state().open, null, {
    timeout: 120000,
  });
  for (const S of [3, 8, 14, 20, 28, 31, 34, 38, 42, 46]) {
    await page.evaluate((s) => window.__home.seek(s), S);
    await page.waitForTimeout(2500);
  }
  console.log([...bad.entries()].map((e) => e[1] + " " + e[0]).join("\n") || "none");
  await browser.close();
})();
