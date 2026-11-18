// The Selena section of the home page (workstream S4b): the drawer, the room (Selena and the
// dragon in `city_idle`, the doll hanging), the swing into the baked camera, the film
// (`city_intercation03`: the doll floats, is eaten, the dragon passes the lens) and the white.
//
//   node scripts/qa/probes/home-s4b.cjs <outFolder>
//   BASE=http://localhost:3100 SIZES=1440x900 node scripts/qa/probes/home-s4b.cjs out
//
// Frames are taken with the scene frozen (`__home.freeze`) after a `seek`, so a sheet is the same
// every run. Files: <outFolder>/s4b-<size>-u<screens>.png, `u` the screens since the section's start.
// Every check is printed as a line, and the console errors at the end.
const fs = require("node:fs");
const path = require("node:path");

const { BASE, OUT, PHONE, launch, context } = require("./lib.cjs");

const OUT_DIR = path.resolve(process.argv[2] || OUT);
fs.mkdirSync(OUT_DIR, { recursive: true });

const SIZES = (process.env.SIZES || "1440x900,1706x950,390x844")
  .split(",")
  .map((s) => s.split("x").map(Number));
/** Screens from the start of the section: the lead, the drawer, the rest, the fall, the film, the white. */
const STEPS = (
  process.env.STEPS || "-0.3,0.3,1.0,1.9,2.1,2.3,2.55,2.9,3.12,3.26,3.4,3.55,3.7,3.9,4.2"
)
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
  await sleep(1500);
  return { ctx, page, errors };
}

const startOf = (page) =>
  page.evaluate(() => window.__home.sections().find((s) => s.id === "selena").start);

async function seek(page, S, wait = 2200) {
  await page.evaluate((x) => {
    window.__home.freeze(false);
    window.__home.seek(x);
  }, S);
  await sleep(wait);
}

async function frozenShot(page, file) {
  await page.evaluate(() => window.__home.freeze(true));
  await sleep(350);
  await page.screenshot({ path: file });
}

async function hitAt(page, x, y) {
  await page.mouse.move(x, y);
  await sleep(250);
  return page.evaluate(() => window.__home.state().hit);
}

(async () => {
  const browser = await launch();
  for (const size of SIZES) {
    const [w, h] = size;
    const phone = w < h;
    console.log(`\n== ${w}x${h}`);
    const { ctx, page, errors } = await openHome(browser, size, phone ? PHONE : {});
    const start = await startOf(page);

    // Frame sheet.
    for (const u of STEPS) {
      await seek(page, start + u);
      await frozenShot(page, path.join(OUT_DIR, `s4b-${w}x${h}-u${u}.png`));
    }
    check(`${w}x${h} frame sheet`, true, `${STEPS.length} frames in ${OUT_DIR}`);

    // The drawer is open where a keyboard focus lands (the middle of the section), and the words show.
    await seek(page, 0, 1200);
    await page.evaluate(() => document.querySelector("[data-selena-action] a")?.focus());
    await sleep(2500);
    const focus = await page.evaluate((s) => {
      const el = document.querySelector("[data-selena-action]");
      return {
        u: window.__home.state().S - s,
        opacity: el ? Number(getComputedStyle(el).opacity) : -1,
      };
    }, start);
    check(
      `${w}x${h} focus on the button lands on an open drawer`,
      focus.opacity > 0.99,
      JSON.stringify(focus),
    );

    // The hit targets: on in the room, off in the film, on again when scrolled back.
    if (!phone) {
      await seek(page, start + 1.0, 2500);
      const head = await hitAt(page, 1205, 345);
      check("room: Selena's head answers the pointer", head === "selena:head", String(head));
      const doll = await hitAt(page, 520, 95);
      check("room: the hanging doll answers the pointer", doll === "doll", String(doll));
      await seek(page, start + 2.9, 2000);
      const film = await hitAt(page, 740, 300);
      check(
        "film: nothing answers the pointer (the baked camera is not the pixel picture)",
        film === null,
        String(film),
      );
      await seek(page, start + 1.0, 2500);
      const back = await hitAt(page, 1205, 345);
      check("back in the room: Selena answers again", back === "selena:head", String(back));
    }

    // The actors at the two ends: all there in the room, none at the end.
    await seek(page, start + 1.0, 2500);
    const room = await page.evaluate(() =>
      Object.fromEntries(window.__home.state().actors.map((a) => [a.name, a.visible])),
    );
    check(
      "room: Selena, the dragon and the doll are drawn",
      !!(room.selena && room.silverbolt && room.doll),
      JSON.stringify(room),
    );
    await seek(page, start + 3.8, 1800);
    const end = await page.evaluate(() =>
      Object.fromEntries(window.__home.state().actors.map((a) => [a.name, a.visible])),
    );
    check(
      "end: Selena, the dragon and the doll are gone",
      !end.selena && !end.silverbolt && !end.doll,
      JSON.stringify(end),
    );

    check(`${w}x${h} no console error`, errors.length === 0, errors.slice(0, 3).join(" | "));
    await ctx.close();
  }
  await browser.close();
  const failed = checks.filter((c) => !c.ok);
  console.log(`\n${checks.length - failed.length} of ${checks.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
})();
