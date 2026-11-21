// A frame sheet of the home page on a running site: seek to a list of positions (in screens), wait for the
// actors, take a screenshot at each. Prints the section that is active and the actors that are visible.
//
// Usage: node scripts/qa/home/sheet.cjs [base] [width] [height] [outdir] [S,S,S...]
//   node scripts/qa/home/sheet.cjs http://localhost:3000/ 1440 900 ./shots 0,6,13,19,27,34,42,50
//
// Needs real Chrome and a site that serves the home (a production build is best: see docs/VERIFY.md).
// The loading gate is skipped (`aspirants:intro = off`) and the consent box is answered.
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
  out = path.join(os.tmpdir(), "aspirant-home-sheet"),
  list = "0,3,6,9,13,19,27,34,42,50",
] = process.argv;
const stops = list.split(",").map(Number);

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
  });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem("aspirants:consent", "rejected");
      sessionStorage.setItem("aspirants:intro", "off");
      localStorage.setItem("aspirants:intro", "off");
    } catch {
      /* storage can be blocked */
    }
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text().slice(0, 200));
  });
  page.on("pageerror", (e) => errors.push("pageerror " + String(e).slice(0, 200)));
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__home && window.__home.state().open, null, {
    timeout: 120000,
  });
  for (const S of stops) {
    await page.evaluate((s) => window.__home.seek(s), S);
    // The pair, Selena and the guests take a few seconds to build after a jump.
    await page.waitForTimeout(3500);
    const st = await page.evaluate(() => window.__home.state());
    const file = path.join(out, `s${String(S).replace(".", "_")}_${w}.png`);
    await page.screenshot({ path: file });
    const seen = st.actors
      .filter((a) => a.visible)
      .map((a) => a.name)
      .join(",");
    console.log(S, "active", st.active, "actors", seen);
  }
  console.log("errors", JSON.stringify(errors.slice(0, 8)));
  await browser.close();
})();
