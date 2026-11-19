// The hero and the aspirants of the home page (workstream S1): frame sheets at the beats and at the
// joints, then the wall's interactions (hover, the VIEW cursor, the preview window by mouse, touch and
// keyboard, the scroll held while it is open).
//
//   node scripts/qa/probes/home-s1.cjs <outFolder>
//   BASE=http://localhost:3100 SIZES=1440x900 STEPS=0,1,4.5 node scripts/qa/probes/home-s1.cjs out
//
// Frames are taken with the scene frozen (`__home.freeze`) and a `seek`, so the wall's glide does not
// move between two frames and a frame sheet is the same every run. Files: <outFolder>/s1-<size>-<S>.png
// and s1-checks.json. It prints every check as a line and every console error at the end.
const fs = require("node:fs");
const path = require("node:path");

const { BASE, OUT, launch, context } = require("./lib.cjs");

const OUT_DIR = path.resolve(process.argv[2] || OUT);
fs.mkdirSync(OUT_DIR, { recursive: true });

const SIZES = (process.env.SIZES || "1440x900,1706x950,390x844")
  .split(",")
  .map((s) => s.split("x").map(Number));
/** Screens: the freeze, the logo's morph, the ring, the land, the joints (3.95, 4.2, 5.3), the close. */
const STEPS = (process.env.STEPS || "0,0.4,0.7,1,1.3,1.8,2.6,3.4,3.95,4.2,4.5,5,5.15,5.3,5.4")
  .split(",")
  .map(Number);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const checks = [];
const check = (name, ok, detail) => {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail === undefined ? "" : ` (${detail})`}`);
};

async function openHome(browser, [w, h], extra = {}) {
  const ctx = await context(browser, { viewport: { width: w, height: h }, ...extra });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    const t = m.text();
    if (m.type() === "error" && !/preloaded|X4122/.test(t)) errors.push(t);
  });
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!window.__home && window.__home.state().open, null, {
    timeout: 240000,
  });
  // The cards fly out of the ring for the first 1.7 s: let it finish before frames are taken.
  await sleep(2600);
  return { ctx, page, errors };
}

(async () => {
  const browser = await launch();
  const errors = [];

  for (const size of SIZES) {
    const tag = `${size[0]}x${size[1]}`;
    const { ctx, page, errors: e } = await openHome(browser, size);
    errors.push(...e);
    await page.evaluate(() => window.__home.freeze(true));
    for (const s of STEPS) {
      await page.evaluate((x) => window.__home.seek(x), s);
      await sleep(450);
      const file = path.join(OUT_DIR, `s1-${tag}-${String(s).replace(".", "_")}.png`);
      await page.screenshot({ path: file });
      const st = await page.evaluate(() => {
        const h = window.__home.state();
        return {
          S: +h.S.toFixed(3),
          actors: h.actors.filter((a) => a.visible).map((a) => a.name),
        };
      });
      console.log(`${tag} S=${s} ${JSON.stringify(st)}`);
    }
    await ctx.close();
  }

  // The interactions, at the desktop size.
  {
    const { ctx, page, errors: e } = await openHome(browser, SIZES[0]);
    errors.push(...e);
    await page.evaluate(() => window.__home.seek(1.0));
    await sleep(1500);
    await page.mouse.move(450, 450, { steps: 8 });
    await sleep(700);
    check(
      "hover finds a card of the wall",
      (await page.evaluate(() => window.__home.state().hit)) === "field",
    );
    await page.mouse.down();
    await page.mouse.up();
    await sleep(1000);
    const title = () =>
      page.evaluate(() => document.querySelector('[role="dialog"] h2')?.textContent ?? null);
    check("a press opens the preview", (await title()) !== null, await title());
    const y0 = await page.evaluate(() => window.scrollY);
    await page.mouse.wheel(0, 900);
    await sleep(700);
    check("the page is held while it is open", (await page.evaluate(() => window.scrollY)) === y0);
    const first = await title();
    await page.keyboard.press("ArrowRight");
    await sleep(500);
    check("the arrow key shows the next picture", (await title()) !== first, await title());
    await page.keyboard.press("Escape");
    await sleep(900);
    check("Escape closes it", (await title()) === null);
    await page.mouse.wheel(0, 300);
    await sleep(700);
    check("the page is free again", (await page.evaluate(() => window.scrollY)) !== y0);
    await ctx.close();
  }

  // Touch: a tap on a card opens it; keyboard: the one hidden button opens it.
  {
    const {
      ctx,
      page,
      errors: e,
    } = await openHome(browser, [390, 844], { hasTouch: true, isMobile: true });
    errors.push(...e);
    await page.evaluate(() => window.__home.seek(1.0));
    await sleep(1500);
    await page.touchscreen.tap(120, 200);
    await sleep(1000);
    check(
      "a tap opens the preview",
      (await page.evaluate(() => !!document.querySelector('[role="dialog"]'))) === true,
    );
    await ctx.close();
  }
  {
    const { ctx, page, errors: e } = await openHome(browser, SIZES[0]);
    errors.push(...e);
    let reached = false;
    for (let i = 0; i < 40 && !reached; i++) {
      await page.keyboard.press("Tab");
      reached = await page.evaluate(() =>
        /about aspirant/i.test(document.activeElement?.textContent ?? ""),
      );
    }
    await sleep(1200);
    const S = await page.evaluate(() => window.__home.state().S);
    check(
      "Tab reaches the About button and the page shows it",
      reached && Math.abs(S - 5) < 0.2,
      S.toFixed(2),
    );
    await ctx.close();
  }

  // A jump far down: the bar has its own logo and the logo actor is not drawn.
  {
    const { ctx, page, errors: e } = await openHome(browser, SIZES[0]);
    errors.push(...e);
    await page.evaluate(() => window.__home.seek(9));
    await sleep(1200);
    const logo = await page.evaluate(() => window.__home.actor("logo"));
    check("after a jump the logo actor is not shown", !logo || logo.visible === false);
    await ctx.close();
  }

  console.log(
    errors.length ? `console errors:\n${errors.slice(0, 20).join("\n")}` : "no console errors",
  );
  fs.writeFileSync(
    path.join(OUT_DIR, "s1-checks.json"),
    JSON.stringify({ checks, errors }, null, 2),
  );
  await browser.close();
  process.exit(checks.some((c) => !c.ok) ? 1 : 0);
})();
