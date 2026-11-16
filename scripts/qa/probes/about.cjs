// What does the About page look like? Photographs the first screen at rest, the opening held at a
// row of times, and the whole scroll, at desktop and phone sizes.
//
//   node scripts/qa/probes/about.cjs                          # all three parts at 1440x900 and 390x844
//   SIZES=1920x1080 PARTS=rest,scroll node scripts/qa/probes/about.cjs
//   STEP=0.25 node scripts/qa/probes/about.cjs                # a frame every quarter of a screen
//
// Files go to OUT (default the aspirant-probes folder in the temp folder), named about-<size>-*.png.
// The page's own hook `window.__aboutDrone` (state, freeze, seekIntro, skipIntro) holds the drone
// still for a picture; the state of the drone at every scroll frame is written to about-<size>.json.
const { BASE, OUT, launch, context } = require("./lib.cjs");
const fs = require("node:fs");
const path = require("node:path");

const SIZES = (process.env.SIZES || "1440x900,390x844")
  .split(",")
  .map((s) => s.split("x").map(Number));
const PARTS = (process.env.PARTS || "rest,intro,scroll").split(",");
const STEP = Number(process.env.STEP || 0.2);
const INTRO_TIMES = [0.15, 0.45, 0.75, 1.05, 1.35, 1.65, 1.95, 2.25, 2.55, 2.85, 3.15, 3.45, 3.9];

const pad = (n) => String(n).padStart(3, "0");

async function open(browser, w, h, intro) {
  const phone = w < 600;
  const ctx = await context(browser, {
    viewport: { width: w, height: h },
    deviceScaleFactor: 1,
    ...(phone ? { hasTouch: true, isMobile: true } : {}),
  });
  if (!intro) {
    await ctx.addInitScript(() => {
      try {
        sessionStorage.setItem("aspirants:intro", "off");
      } catch {
        /* ignore */
      }
    });
  }
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto(`${BASE}/about/`);
  await page.waitForLoadState("load");
  await page.waitForFunction(
    () => window.__aboutDrone && window.__aboutDrone.state().engine !== "pending",
    null,
    {
      timeout: 60_000,
    },
  );
  return { ctx, page, errors };
}

(async () => {
  const browser = await launch();
  for (const [w, h] of SIZES) {
    const tag = `${w}x${h}`;
    const shot = (page, name) =>
      page.screenshot({ path: path.join(OUT, `about-${tag}-${name}.png`) });

    if (PARTS.includes("rest")) {
      const { ctx, page, errors } = await open(browser, w, h, false);
      await page.waitForTimeout(2200);
      await shot(page, "rest");
      console.log(
        tag,
        "rest",
        JSON.stringify(await page.evaluate(() => window.__aboutDrone.state())),
      );
      if (errors.length) console.log(tag, "errors", errors);
      await ctx.close();
    }

    if (PARTS.includes("intro")) {
      const { ctx, page, errors } = await open(browser, w, h, true);
      for (const [i, t] of INTRO_TIMES.entries()) {
        await page.evaluate((s) => window.__aboutDrone.seekIntro(s), t);
        await page.waitForTimeout(260);
        await shot(page, `intro-${pad(i)}`);
      }
      if (errors.length) console.log(tag, "errors", errors);
      await ctx.close();
    }

    if (PARTS.includes("scroll")) {
      const { ctx, page, errors } = await open(browser, w, h, false);
      await page.waitForTimeout(1200);
      const total = await page.evaluate(() => document.documentElement.scrollHeight);
      const log = [];
      let i = 0;
      for (let y = 0; y <= total - h; y += Math.round(h * STEP)) {
        await page.evaluate((yy) => window.scrollTo(0, yy), y);
        await page.waitForTimeout(700);
        await shot(page, `scroll-${pad(i)}`);
        log.push({ i, y, ...(await page.evaluate(() => window.__aboutDrone.state())) });
        i += 1;
      }
      fs.writeFileSync(path.join(OUT, `about-${tag}.json`), JSON.stringify(log, null, 1));
      console.log(tag, "scroll frames", i, "page height", total);
      if (errors.length) console.log(tag, "errors", errors);
      await ctx.close();
    }
  }
  await browser.close();
  console.log("files in", OUT);
})();
