// What do the bolt and the fall sections of the home look like, from the first frame of the dragon
// to the doll at the end of the fall? Takes a frame sheet of both at the three sizes, plus a few
// frames of a real wheel scroll through the throw of the doll, and prints the console errors.
//
//   node scripts/qa/probes/home-s3.cjs [outFolder]
//
// BASE, SIZES, STEPS_BOLT and STEPS_FALL set the rest. ABS_S (a list of scroll positions in
// screens, for example 17.88,17.9,17.92 for the joint J6 with the hand section) adds frames at those
// places.
//
// Needs the dev server (`npx next dev -p 3100` from apps/web, BASE=http://localhost:3100) or a
// production build served on 3000. The page opens with the intro off, as `lib.cjs` does.
const path = require("node:path");
const fs = require("node:fs");
const { BASE, OUT: DEFAULT_OUT, launch, context } = require("./lib.cjs");

const OUT = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_OUT;
fs.mkdirSync(OUT, { recursive: true });

/** Where the sections start on the scroll, in screens, from the page's own registry. */
const SIZES = (process.env.SIZES || "1440x900,1706x950,390x844")
  .split(",")
  .map((s) => s.split("x").map(Number));
/** Local positions of the frames: 0 to 1 over the bolt section (4 screens), then the fall (2.6). */
const BOLT = (process.env.STEPS_BOLT || "0.05,0.15,0.25,0.4,0.55,0.7,0.85,0.97,1")
  .split(",")
  .map(Number);
const FALL = (process.env.STEPS_FALL || "0.05,0.15,0.3,0.5,0.7,0.85,1").split(",").map(Number);
const ABS = (process.env.ABS_S || "").split(",").filter(Boolean).map(Number);

async function settle(page, S) {
  await page.evaluate(() => window.__home.freeze(false));
  await page.evaluate((s) => window.__home.seek(s), S);
  // The dragon and the doll are built when the section is near: wait for them.
  await page
    .waitForFunction(
      () => {
        const names = window.__home.state().actors.map((a) => a.name);
        return ["silverbolt", "doll", "marks", "bolt-lines"].every((n) => names.includes(n));
      },
      null,
      { timeout: 120000 },
    )
    .catch(() => undefined);
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.__home.freeze(true));
  await page.waitForTimeout(120);
}

(async () => {
  const browser = await launch();
  const errors = [];
  for (const [w, h] of SIZES) {
    const ctx = await context(browser, { viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(`${w}x${h} pageerror: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(`${w}x${h} console: ${m.text().slice(0, 200)}`);
    });
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => !!window.__home && window.__home.state().open, null, {
      timeout: 240000,
    });
    const sections = await page.evaluate(() => window.__home.sections());
    const bolt = sections.find((s) => s.id === "bolt");
    const fall = sections.find((s) => s.id === "fall");
    const jobs = [
      ...BOLT.map((l) => ["bolt", bolt.start + l * bolt.screens, l]),
      ...FALL.map((l) => ["fall", fall.start + l * fall.screens, l]),
      ...ABS.map((s) => ["at", s, s]),
    ];
    for (const [id, S, local] of jobs) {
      await settle(page, S);
      const label = id === "at" ? S.toFixed(2) : String(Math.round(local * 100)).padStart(3, "0");
      const file = path.join(OUT, `home-${id}-${w}x${h}-${label}.png`);
      await page.screenshot({ path: file });
      const state = await page.evaluate(() =>
        window.__home
          .state()
          .actors.filter((a) => a.visible)
          .map((a) => a.name),
      );
      console.log(`${id} ${w}x${h} local ${local} S ${S.toFixed(2)} shown: ${state.join(", ")}`);
    }
    await ctx.close();
  }
  const real = errors.filter(
    (e) => !/X4122|preloaded using link preload|Failed to load resource|Fast Refresh/.test(e),
  );
  console.log(real.length ? `errors:\n${real.join("\n")}` : "no console errors");
  await browser.close();
})();
