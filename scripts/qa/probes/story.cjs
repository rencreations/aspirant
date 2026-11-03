// What does the story page look like? Photographs the landing and a chapter page at desktop and
// phone sizes: the title card, then the text with its pictures at several scroll positions.
//
//   node scripts/qa/probes/story.cjs                      # landing and chapter 6
//   CH=chapter-12 node scripts/qa/probes/story.cjs        # another chapter (slug)
//   SIZES=1440x900,390x844 STEPS=6 node scripts/qa/probes/story.cjs
//
// Files go to OUT (default the aspirant-probes folder in the temp folder), named story-<size>-*.png.
const { BASE, OUT, launch, context } = require("./lib.cjs");
const path = require("node:path");

const SLUG = process.env.CH || "chapter-06";
const SIZES = (process.env.SIZES || "1440x900,390x844")
  .split(",")
  .map((s) => s.split("x").map(Number));
const STEPS = Number(process.env.STEPS || 5);
const PAGES = (process.env.PAGES || "landing,chapter").split(",");

async function settle(page, ms = 1500) {
  await page.waitForLoadState("load");
  await page.waitForTimeout(ms);
}

(async () => {
  const browser = await launch();
  for (const [w, h] of SIZES) {
    const phone = w < 600;
    const ctx = await context(browser, {
      viewport: { width: w, height: h },
      deviceScaleFactor: 1,
      ...(phone ? { hasTouch: true, isMobile: true } : {}),
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    const tag = `${w}x${h}`;
    if (PAGES.includes("landing")) {
      await page.goto(`${BASE}/story/`);
      await settle(page, 2500);
      await page.screenshot({ path: path.join(OUT, `story-${tag}-landing-0.png`) });
      const total = await page.evaluate(() => document.documentElement.scrollHeight);
      for (const [i, y] of [h * 1.4, h * 2.6, h * 3.8].entries()) {
        if (y > total) break;
        await page.evaluate((yy) => window.scrollTo(0, yy), y);
        await page.waitForTimeout(900);
        await page.screenshot({ path: path.join(OUT, `story-${tag}-landing-${i + 1}.png`) });
      }
    }
    if (PAGES.includes("chapter")) {
      await page.goto(`${BASE}/story/${SLUG}/`);
      await settle(page, 2500);
      await page.screenshot({ path: path.join(OUT, `story-${tag}-${SLUG}-card.png`) });
      const total = await page.evaluate(() => document.documentElement.scrollHeight);
      const span = total - h;
      for (let i = 1; i <= STEPS; i += 1) {
        const y = Math.round((span * i) / (STEPS + 0.5));
        await page.evaluate((yy) => window.scrollTo(0, yy), y);
        await page.waitForTimeout(1200);
        await page.screenshot({ path: path.join(OUT, `story-${tag}-${SLUG}-${i}.png`) });
      }
      console.log(`${tag} ${SLUG}: page height ${total}px`);
    }
    console.log(`${tag} errors: ${errors.length}`);
    for (const e of errors.slice(0, 8)) console.log("  ", e.slice(0, 200));
    await ctx.close();
  }
  await browser.close();
  console.log("files in", OUT);
})();
