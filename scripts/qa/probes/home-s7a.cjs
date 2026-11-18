// What does the bend section of the home look like, beat by beat? Seeks to every 0.45 screen of the
// section (the nine screens, with the lead and the tail either side) and photographs it, at 1440x900,
// 1706x950 and 390x844, in real Chrome. Then it walks the section with a real wheel through the drone's
// meeting, hovers and presses a poster of the fan wall (the credit plate), and puts the keyboard on
// each control of the section to see that the page moves to where it shows.
//
//   node scripts/qa/probes/home-s7a.cjs <outFolder>
//   BASE=http://localhost:3100 SIZES=1440x900 STEPS=2.7,4.5,6.6 PARTS=frames node scripts/qa/probes/home-s7a.cjs out
//
// PARTS is a comma list of frames, pop, hover and keys (all by default). STEPS are screens into the
// section (the start is 47.1). Files: <outFolder>/s7a-<part>-<size>-<value>.png. The library's R2
// bucket allows CORS only from some origins: for another dev port, serve the mirror (`npx serve
// D:\ren\aspirant-r2 -l 3301 --cors`) and start the dev server with NEXT_PUBLIC_LIBRARY_ORIGIN.
const fs = require("node:fs");
const path = require("node:path");

const { BASE, OUT, launch, context } = require("./lib.cjs");

const OUT_DIR = path.resolve(process.argv[2] || OUT);
fs.mkdirSync(OUT_DIR, { recursive: true });

// The bend's start is the registry's: read from the page once it is open (START overrides it).
let START = Number(process.env.START || Number.NaN);
const SIZES = (process.env.SIZES || "1440x900,1706x950,390x844")
  .split(",")
  .map((s) => s.split("x").map(Number));
const STEPS = (
  process.env.STEPS || Array.from({ length: 24 }, (_, i) => (-0.45 + 0.45 * i).toFixed(2)).join(",")
)
  .split(",")
  .map(Number);
const PARTS = new Set((process.env.PARTS || "frames,pop,hover,keys").split(","));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tag = (v) => String(v).replace(".", "_");

/** The rest of the console, minus the noise of the dev server. */
const NOISE =
  /preloaded|X4122|Fast Refresh|Program Info|Fast|It is also|You might|Consider|Refresh requires/;

async function open(browser, w, h, touch) {
  const ctx = await context(browser, {
    viewport: { width: w, height: h },
    hasTouch: touch,
    isMobile: touch,
  });
  const page = await ctx.newPage();
  const logs = [];
  page.on("console", (m) => {
    if (m.type() === "error") logs.push(m.text());
  });
  page.on("pageerror", (e) => logs.push(`pageerror: ${e.message}`));
  await page.goto(`${BASE}/`, { waitUntil: "load", timeout: 180_000 });
  await page.waitForFunction(() => window.__home && window.__home.state().open, null, {
    timeout: 180_000,
  });
  if (!Number.isFinite(START)) {
    START = await page.evaluate(() => window.__home.sections().find((s) => s.id === "bend").start);
  }
  return { ctx, page, logs };
}

const seek = (page, screens) => page.evaluate((s) => window.__home.seek(s), START + screens);
const where = (page) => page.evaluate(() => window.__home.state().S);

async function frames(browser, w, h) {
  const { ctx, page, logs } = await open(browser, w, h, false);
  await seek(page, STEPS[0] - 1.2);
  await sleep(2500);
  for (const v of STEPS) {
    await seek(page, v);
    await sleep(1500);
    const file = path.join(OUT_DIR, `s7a-frames-${w}x${h}-${tag(v)}.png`);
    await page.screenshot({ path: file });
    const st = await page.evaluate(() => {
      const x = window.__home.state();
      const b = x.sections.find((s) => s.id === "bend");
      return { S: +x.S.toFixed(2), local: b && +b.local.toFixed(3), mount: b && b.mount };
    });
    console.log(`${w}x${h} ${String(v).padStart(5)} ${JSON.stringify(st)}`);
  }
  await ctx.close();
  return logs;
}

/** A real wheel from 7.4 to 9.0 screens: the drone comes out of its paper and meets Tetra. */
async function pop(browser, w, h) {
  const { ctx, page, logs } = await open(browser, w, h, false);
  await seek(page, 6.2);
  await sleep(2500);
  await seek(page, 7.4);
  await sleep(2500);
  await page.mouse.move(w * 0.7, h * 0.3);
  for (const mark of [7.8, 7.9, 8.0, 8.1, 8.2, 8.3, 8.45, 8.6, 8.75, 8.9, 9.0]) {
    for (let i = 0; i < 400; i += 1) {
      if ((await where(page)) >= START + mark - 0.01) break;
      await page.mouse.wheel(0, 40);
      await sleep(55);
    }
    await sleep(250);
    await page.screenshot({ path: path.join(OUT_DIR, `s7a-pop-${w}x${h}-${tag(mark)}.png`) });
    console.log(`${w}x${h} pop ${mark} at ${(await where(page)).toFixed(2)}`);
  }
  await ctx.close();
  return logs;
}

/** Hover a poster of the wall (the credit plate beside it), press it (it stays), press elsewhere (it goes). */
async function hover(browser, w, h) {
  const touch = w < 600;
  const { ctx, page, logs } = await open(browser, w, h, touch);
  await seek(page, 2.0);
  await sleep(1500);
  await seek(page, 3.0);
  await sleep(2500);
  const plateOn = () =>
    page.evaluate(() => !!document.querySelector('[data-bend-plate][data-on="1"]'));
  let found = null;
  for (let y = 0.15; y < 0.9 && !found; y += 0.07) {
    for (let x = 0.08; x < 0.95 && !found; x += 0.06) {
      if (touch) {
        await page.touchscreen.tap(w * x, h * y);
        await sleep(200);
        if (await plateOn()) found = { x: w * x, y: h * y };
      } else {
        await page.mouse.move(w * x, h * y);
        await sleep(60);
        if ((await page.evaluate(() => window.__home.state().hit)) === "bend-art") {
          found = { x: w * x, y: h * y };
        }
      }
    }
  }
  console.log(`${w}x${h} a poster at ${JSON.stringify(found)}`);
  if (found) {
    await sleep(800);
    await page.screenshot({ path: path.join(OUT_DIR, `s7a-hover-${w}x${h}.png`) });
    console.log(`${w}x${h} plate while hovered or tapped: ${await plateOn()}`);
    if (!touch) {
      await page.mouse.down();
      await page.mouse.up();
      await page.mouse.move(w * 0.5, h * 0.95);
      await sleep(900);
      console.log(`${w}x${h} plate after a press and leaving the poster: ${await plateOn()}`);
    }
  }
  await ctx.close();
  return logs;
}

/** The keyboard: Tab from the control before the section, and a scripted focus of each group. */
async function keys(browser, w, h) {
  const { ctx, page, logs } = await open(browser, w, h, false);
  await sleep(500);
  const ready = await page.evaluate(() => {
    const list = [...document.querySelectorAll("a[href], button, input, [tabindex]")].filter(
      (e) => !e.closest("[inert]") && e.tabIndex >= 0,
    );
    const first = list.findIndex((e) => e.closest('[data-bend="fan"]'));
    if (first < 1) return false;
    list[first - 1].focus();
    return true;
  });
  console.log(`${w}x${h} focus placed before the section: ${ready}`);
  for (let i = 0; i < 5; i += 1) {
    await page.keyboard.press("Tab");
    // The first press may find the section still being built: the page follows when it has.
    await sleep(i === 0 ? 7000 : 1800);
    const info = await page.evaluate((start) => {
      const e = document.activeElement;
      const g = e && e.closest("[data-bend]");
      return {
        text: e && (e.textContent || "").trim().slice(0, 28),
        group: g && g.dataset.bend,
        groupOpacity: g ? getComputedStyle(g).opacity : null,
        screensIn: +(window.__home.state().S - start).toFixed(2),
      };
    }, START);
    console.log(`${w}x${h} Tab ${i + 1} ${JSON.stringify(info)}`);
    if (i === 0) await page.screenshot({ path: path.join(OUT_DIR, `s7a-keys-${w}x${h}.png`) });
  }
  await ctx.close();
  return logs;
}

(async () => {
  const browser = await launch();
  const errors = [];
  for (const [w, h] of SIZES) {
    if (PARTS.has("frames")) errors.push(...(await frames(browser, w, h)));
    if (PARTS.has("pop") && w >= 600) errors.push(...(await pop(browser, w, h)));
    if (PARTS.has("hover")) errors.push(...(await hover(browser, w, h)));
    if (PARTS.has("keys") && w >= 600) errors.push(...(await keys(browser, w, h)));
  }
  await browser.close();
  const real = errors.filter((e) => !NOISE.test(e));
  console.log(
    real.length ? `console errors:\n${real.slice(0, 12).join("\n")}` : "no console errors",
  );
})();
