// What does the home page look like all the way down? Scrolls the page with a real wheel and
// photographs every section at 0, 25, 50, 75 and 100 percent of its length, at 1440x900, 1706x950
// and 390x844, in real Chrome. Next to each picture it writes the kernel's own account of the frame
// (`window.__home.state()`): the scene's position, every section's local value and mount state, the
// actors that are shown.
//
//   node scripts/qa/probes/home.cjs <outFolder>
//   BASE=http://localhost:3100 SIZES=1440x900 STEPS=0,0.5 ONLY=hero,strip node scripts/qa/probes/home.cjs out
//
// Files: <outFolder>/home-<size>-<nn>-<section>-<percent>.png and home-<size>.json. The last
// section's 100 percent is taken a little before the end of the page, because the very end opens
// About. A line is printed for every frame, and every console error of the page is listed at the end.
const fs = require("node:fs");
const path = require("node:path");

const { BASE, OUT, launch, context } = require("./lib.cjs");

const OUT_DIR = path.resolve(process.argv[2] || OUT);
fs.mkdirSync(OUT_DIR, { recursive: true });

const SIZES = (process.env.SIZES || "1440x900,1706x950,390x844")
  .split(",")
  .map((s) => s.split("x").map(Number));
const STEPS = (process.env.STEPS || "0,0.25,0.5,0.75,1").split(",").map(Number);
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(",")) : null;
/** How close (in screens) the smoothed position must be to the real one before a picture is taken. */
const SETTLE = 0.004;
/** The end of the page opens About: stay this far (screens) from it. */
const END_MARGIN = 0.1;

const pad = (n) => String(n).padStart(2, "0");
const pct = (f) => String(Math.round(f * 100)).padStart(3, "0");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Move the page to `target` screens with the wheel, in a few big steps, waiting for each to land. */
async function wheelTo(page, target) {
  for (let i = 0; i < 60; i++) {
    const s = await page.evaluate(() => ({ y: window.scrollY, unit: window.__home.state().unit }));
    const remaining = target * s.unit - s.y;
    if (Math.abs(remaining) < 3) return;
    await page.mouse.wheel(0, Math.max(-2400, Math.min(2400, remaining)));
    // Lenis eases the page to the new target: wait until it has stopped moving.
    let last = s.y;
    for (let k = 0; k < 40; k++) {
      await sleep(70);
      const y = await page.evaluate(() => window.scrollY);
      if (Math.abs(y - last) < 0.5 && k > 2) break;
      last = y;
    }
  }
}

/** Wait until the scene has caught up with the scroll and the sections near it have mounted. */
async function settle(page) {
  await page.waitForFunction(
    (eps) => {
      const st = window.__home.state();
      if (Math.abs(st.S - st.raw) > eps) return false;
      return !st.sections.some((s) => s.mount === "mounting");
    },
    SETTLE,
    { timeout: 30_000 },
  );
  // A few more frames, so a fade that was started has drawn.
  await sleep(250);
}

async function run(browser, w, h) {
  const phone = w < 600;
  const tag = `${w}x${h}`;
  const ctx = await context(browser, {
    viewport: { width: w, height: h },
    deviceScaleFactor: 1,
    ...(phone ? { hasTouch: true, isMobile: true } : {}),
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${String(e)}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
  });
  await page.goto(`${BASE}/`);
  await page.waitForFunction(() => window.__home && window.__home.state().open, null, {
    timeout: 120_000,
  });
  await page.mouse.move(Math.round(w / 2), Math.round(h / 2));

  const first = await page.evaluate(() => window.__home.state());
  console.log(
    tag,
    "ready",
    JSON.stringify({ total: first.total, unit: first.unit, size: first.size }),
  );
  const report = [];

  let n = 0;
  for (const section of first.sections) {
    n++;
    if (ONLY && !ONLY.has(section.id)) continue;
    const isLast = section.id === first.sections[first.sections.length - 1].id;
    for (const f of STEPS) {
      let target = section.start + f * section.screens;
      if (isLast) target = Math.min(target, first.total - END_MARGIN);
      await wheelTo(page, target);
      await settle(page);
      const st = await page.evaluate(() => window.__home.state());
      const file = `home-${tag}-${pad(n)}-${section.id}-${pct(f)}.png`;
      await page.screenshot({ path: path.join(OUT_DIR, file) });
      report.push({ file, section: section.id, f, target, state: st });
      const here = st.sections.find((s) => s.id === section.id);
      console.log(
        file,
        `S=${st.S.toFixed(3)} raw=${st.raw.toFixed(3)} local=${here ? here.local.toFixed(3) : "?"}`,
        `shown=[${st.actors.filter((a) => a.visible).map((a) => a.name)}]`,
      );
    }
  }
  fs.writeFileSync(path.join(OUT_DIR, `home-${tag}.json`), JSON.stringify(report, null, 1));
  if (errors.length) console.log(tag, "ERRORS", errors);
  await ctx.close();
  return errors;
}

(async () => {
  const browser = await launch();
  let bad = 0;
  for (const [w, h] of SIZES) bad += (await run(browser, w, h)).length;
  await browser.close();
  console.log(bad ? `${bad} console error(s)` : "no console errors");
  process.exit(bad ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
