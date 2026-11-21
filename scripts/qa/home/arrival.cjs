// A fresh visit to the home: the loader, the tap gate and the intro, shot on a clock.
//
// Usage: node scripts/qa/home/arrival.cjs [base] [width] [height] [outdir]
//
// Prints how long the tap gate took to appear. The press is a click in the lower middle of the screen.
// Only the consent box is answered: the opening is NOT skipped, so this is the real document load.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createRequire } = require("node:module");

const req = createRequire(path.resolve(__dirname, "../../../apps/web/package.json"));
const { chromium } = req("@playwright/test");

const [
  ,
  ,
  base = "http://localhost:3000/",
  w = "1440",
  h = "900",
  out = path.join(os.tmpdir(), "aspirant-home-arrival"),
] = process.argv;

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
    args: ["--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"],
  });
  const ctx = await browser.newContext({
    viewport: { width: +w, height: +h },
    deviceScaleFactor: 1,
    hasTouch: +w < 700,
  });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem("aspirants:consent", "rejected");
    } catch {
      /* storage can be blocked */
    }
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  page.on("console", (m) => {
    if (m.type() === "error" && !/404|CORS|ERR_FAILED/.test(m.text()))
      errors.push(m.text().slice(0, 200));
  });
  const t0 = Date.now();
  await page.goto(base, { waitUntil: "commit" });
  let i = 0;
  const shot = async (tag) => {
    await page.screenshot({
      path: path.join(out, `${String(i++).padStart(2, "0")}_${tag}_${w}.png`),
    });
  };
  await page.waitForTimeout(700);
  await shot("load_a");
  await page.waitForTimeout(1200);
  await shot("load_b");
  await page.waitForFunction(() => /Touch anywhere/i.test(document.body.innerText), null, {
    timeout: 120000,
  });
  console.log("tap gate after", ((Date.now() - t0) / 1000).toFixed(1), "s");
  await shot("tap");
  await page.mouse.click(+w / 2, +h * 0.6);
  for (let k = 0; k < 10; k++) {
    await page.waitForTimeout(1500);
    await shot("intro" + k);
  }
  const st = await page.evaluate(() => window.__home && window.__home.state());
  console.log("open", st && st.open, "S", st && st.S, "errors", JSON.stringify(errors.slice(0, 5)));
  await browser.close();
})();
