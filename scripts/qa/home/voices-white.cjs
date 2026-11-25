// The voices' way in when the visitor stops in the white: scroll down through Selena's way out with a
// real wheel, stop at a given place in the white, and print, frame by frame, the section's value, the
// play's state and the page, for a few seconds. The way in must start by itself and play (its value
// rises over about two seconds), not land on its rest in one frame.
//
// Usage: node scripts/qa/home/voices-white.cjs <base> [stopAt=30.98] [px=60] [gap=40]
const path = require("node:path");
const { createRequire } = require("node:module");
const req = createRequire(path.resolve(__dirname, "../../../apps/web/package.json"));
const { chromium } = req("@playwright/test");

(async () => {
  const [base, stopArg = "30.98", pxArg = "60", gapArg = "40"] = process.argv.slice(2);
  const stopAt = Number(stopArg);
  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
    args: ["--ignore-gpu-blocklist"],
  });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => {
    sessionStorage.setItem("aspirants:entered", "1");
    localStorage.setItem(
      "aspirants:consent",
      JSON.stringify({ choice: "rejected", at: Date.now() }),
    );
    sessionStorage.setItem("aspirants:intro", "off");
  });
  const page = await ctx.newPage();
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__home && window.__home.state().open, null, {
    timeout: 180000,
  });
  await page.evaluate(() => window.__home.seek(30.2));
  await page.waitForTimeout(5000);
  await page.mouse.move(720, 450);
  await page.evaluate(() => {
    window.__vw = [];
    const t0 = performance.now();
    const tick = () => {
      const h = window.__home;
      const st = h.state();
      const p = h.plays().find((x) => x.id === "voices");
      window.__vw.push({
        t: performance.now() - t0,
        S: st.S,
        real: window.scrollY / st.unit,
        v: p ? p.v : null,
        active: p ? p.active : null,
        fired: p ? p.fired : null,
        held: document.documentElement.classList.contains("lenis-stopped"),
      });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  for (let i = 0; i < 400; i++) {
    const s = await page.evaluate(() => window.scrollY / window.__home.state().unit);
    if (s >= stopAt) break;
    await page.mouse.wheel(0, Number(pxArg));
    await page.waitForTimeout(Number(gapArg));
  }
  const stopT = await page.evaluate(() => performance.now());
  await page.waitForTimeout(5000);
  const fr = await page.evaluate(() => window.__vw);
  let last = "";
  let prevV = null;
  let biggest = 0;
  for (const f of fr) {
    if (prevV !== null && f.v !== null) biggest = Math.max(biggest, Math.abs(f.v - prevV));
    prevV = f.v;
    const line = `S=${f.S.toFixed(2)} real=${f.real.toFixed(2)} v=${f.v === null ? "-" : f.v.toFixed(2)} active=${f.active} held=${f.held}`;
    if (line !== last) console.log(`t=${(f.t / 1000).toFixed(2)} ${line}`);
    last = line;
  }
  console.log("biggest step of v in a frame", biggest.toFixed(3), "stop wall", stopT.toFixed(0));
  await browser.close();
})();
