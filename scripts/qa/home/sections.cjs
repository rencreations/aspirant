// Prints the sections of the home as the running page reports them: id, start and length in screens.
// The quickest way to learn the current order and the total length (about 59 screens at the time of writing).
//
// Usage: node scripts/qa/home/sections.cjs [base]
//   node scripts/qa/home/sections.cjs https://aspirant.cc/     (the live site)
const path = require("node:path");
const { createRequire } = require("node:module");

const req = createRequire(path.resolve(__dirname, "../../../apps/web/package.json"));
const { chromium } = req("@playwright/test");

const base = process.argv[2] || "http://localhost:3000/";

(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
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
  await page.goto(base, { waitUntil: "load" });
  await page.waitForFunction(() => window.__home && window.__home.sections, null, {
    timeout: 120000,
  });
  const sections = await page.evaluate(() => window.__home.sections());
  for (const s of sections) {
    console.log(
      `${s.id.padEnd(9)} start ${s.start.toFixed(2).padStart(6)}  screens ${s.screens.toFixed(2)}`,
    );
  }
  const last = sections[sections.length - 1];
  console.log("total", (last.start + last.screens).toFixed(2), "screens");
  await browser.close();
})();
