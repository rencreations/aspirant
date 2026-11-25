// Records a stretch of the About page under a real input and cuts it into contact sheets, to look at
// the drone and its friends (Mr. Bunny in phase three, Guinevere's two drones in phase four, the doll
// in phase five) at speed. The opening is switched off, so the page is open at once.
//
// Usage: BASE=http://localhost:3000 node scripts/qa/probes/about-flick.cjs <fromPhase> <toPhase> <mode> [w h]
// mode: "flick" (400 px every 16 ms), "brisk" (120 px every 40 ms), "flip" (down to the end, back up
// halfway, down again), "touch" (fast swipes at phone size). Sheets: 4 by 4 frames, 8 a second.
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const { BASE, OUT, launch } = require("./lib.cjs");

(async () => {
  const [fromArg = "3", toArg = "5", mode = "flick", wArg, hArg] = process.argv.slice(2);
  const touch = mode === "touch";
  const w = Number(wArg || (touch ? 390 : 1440));
  const h = Number(hArg || (touch ? 844 : 900));
  const dir = path.join(OUT, `about-flick-${mode}-${w}`);
  fs.mkdirSync(dir, { recursive: true });
  const browser = await launch();
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    ...(touch ? { hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : {}),
    recordVideo: { dir, size: { width: w, height: h } },
  });
  await ctx.addInitScript(() => {
    sessionStorage.setItem("aspirants:entered", "1");
    sessionStorage.setItem("aspirants:intro", "off");
    localStorage.setItem(
      "aspirants:consent",
      JSON.stringify({ choice: "rejected", at: Date.now() }),
    );
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/about/`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => window.__aboutDrone && window.__aboutDrone.state().phase === "done",
    null,
    {
      timeout: 180000,
    },
  );
  const top = (n) =>
    page.evaluate((n) => {
      const el = document.querySelector(`[data-phase="${n}"]`);
      return el ? el.getBoundingClientRect().top + window.scrollY : 0;
    }, n);
  const bottom = (n) =>
    page.evaluate((n) => {
      const el = document.querySelector(`[data-phase="${n}"]`);
      return el ? el.getBoundingClientRect().bottom + window.scrollY : 0;
    }, n);
  // "label" as the first phase: from the ledger to the very end of the page (TheMLabel's close).
  const label = fromArg === "label";
  const from = label
    ? await page.evaluate(
        () =>
          document.querySelector('[data-about-section="ledger"]').getBoundingClientRect().top +
          window.scrollY,
      )
    : (await top(Number(fromArg))) - h;
  const to = label
    ? await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)
    : (await bottom(Number(toArg))) + h * 0.5;
  await page.evaluate((y) => window.scrollTo(0, y), from);
  await page.waitForTimeout(4000);
  await page.mouse.move(w / 2, h / 2);
  const wheelTo = async (target, px, gap) => {
    for (let i = 0; i < 3000; i++) {
      const y = await page.evaluate(() => window.scrollY);
      const sign = target > y ? 1 : -1;
      if (Math.abs(target - y) < px) break;
      await page.mouse.wheel(0, sign * px);
      await page.waitForTimeout(gap);
    }
  };
  const t0 = Date.now();
  if (mode === "flick") await wheelTo(to, 400, 16);
  else if (mode === "brisk") await wheelTo(to, 120, 40);
  else if (mode === "flip") {
    await wheelTo(from + (to - from) * 0.6, 400, 16);
    await wheelTo(from + (to - from) * 0.3, 400, 16);
    await wheelTo(to, 400, 16);
  } else if (touch) {
    const cdp = await ctx.newCDPSession(page);
    for (let i = 0; i < 200; i++) {
      const y = await page.evaluate(() => window.scrollY);
      if (y >= to) break;
      const x = Math.round(w / 2);
      const y0 = Math.round(h * 0.85);
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x, y: y0 }],
      });
      for (let k = 1; k <= 6; k++) {
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x, y: y0 - (h * 0.7 * k) / 6 }],
        });
        await page.waitForTimeout(14);
      }
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await page.waitForTimeout(300);
    }
  }
  await page.waitForTimeout(2500);
  const skip = 4 + (Date.now() - t0 > 0 ? 0 : 0);
  const video = page.video();
  await ctx.close();
  await browser.close();
  const file = await video.path();
  execFileSync("ffmpeg", [
    "-loglevel",
    "error",
    "-y",
    "-ss",
    String(skip + 2),
    "-i",
    file,
    "-vf",
    `fps=${process.env.FPS || 8},scale=${Math.round(w / 3)}:-1,tile=4x4`,
    path.join(dir, "sheet-%02d.png"),
  ]);
  console.log("sheets in", dir, "took", ((Date.now() - t0) / 1000).toFixed(1), "s");
})();
