// Screenshot a page of the running site in real Chrome (the loading gate is skipped).
// node shot.cjs <url> <outfile.png> [width=1440] [height=900] [waitMs=5000] [scrollY=0] [fullpage=0]
const path = require("node:path");
const { createRequire } = require("node:module");
const req = createRequire(path.resolve(__dirname, "../../apps/web/package.json"));
const { chromium } = req("@playwright/test");
const [url, out, w = "1440", h = "900", wait = "5000", scrollY = "0", full = "0"] =
  process.argv.slice(2);
(async () => {
  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
    args: [
      "--use-gl=angle",
      "--enable-unsafe-swiftshader",
      "--autoplay-policy=no-user-gesture-required",
    ],
  });
  const ctx = await browser.newContext({
    viewport: { width: +w, height: +h },
    deviceScaleFactor: 1,
    hasTouch: +w < 600,
    isMobile: +w < 600,
  });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    try {
      sessionStorage.setItem("aspirants:entered", "1");
      sessionStorage.setItem("aspirants:intro", "off");
    } catch {}
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push("console: " + m.text().slice(0, 240));
  });
  page.on("requestfailed", (r) => errors.push("requestfailed: " + r.url().slice(0, 140)));
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(+wait);
  if (+scrollY) {
    await page.evaluate((y) => window.scrollTo(0, y), +scrollY);
    await page.waitForTimeout(1200);
  }
  await page.screenshot({ path: out, fullPage: full === "1" });
  console.log("title:", await page.title(), "| errors:", JSON.stringify(errors.slice(0, 6)));
  await browser.close();
})().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});
