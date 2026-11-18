// The hand and the list of the home page (workstream S4a): frame sheets at the beats and at the
// joints, then the interactions (the hand and the doll under the pointer, the strip by the keyboard
// with real Tab presses, the open view by mouse, keyboard and touch, the page held while it is open).
//
//   node scripts/qa/probes/home-s4a.cjs <outFolder>
//   BASE=http://localhost:3100 SIZES=1440x900 node scripts/qa/probes/home-s4a.cjs out
//
// Frames are taken with the scene frozen (`__home.freeze`) after a `seek`, so a frame sheet is the
// same every run. Files: <outFolder>/s4a-<size>-<section>-<offset>.png. Every check is printed as a
// line, and the console errors at the end.
const fs = require("node:fs");
const path = require("node:path");

const { BASE, OUT, launch, context } = require("./lib.cjs");

const OUT_DIR = path.resolve(process.argv[2] || OUT);
fs.mkdirSync(OUT_DIR, { recursive: true });

const SIZES = (process.env.SIZES || "1440x900,1706x950,390x844")
  .split(",")
  .map((s) => s.split("x").map(Number));
/**
 * Screens from the start of each section: the lead, the plays, the joints (round two: the scenes are
 * triggered, so a position is a rest. The hand rests from 0.5 to its join at 1.0, the list rests on
 * frame `k` at 0.7 + 0.4 k and on the grown frame at 4.8).
 */
const HAND_STEPS = (process.env.HAND || "-0.45,0,0.1,0.6,0.9,1.2,1.4").split(",").map(Number);
const LIST_STEPS = (process.env.LIST || "-0.4,0,0.3,0.7,1.1,2.3,4.3,4.8,5").split(",").map(Number);

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

const sections = (page) => page.evaluate(() => window.__home.sections());
async function seek(page, S, wait = 1100) {
  await page.evaluate((x) => {
    window.__home.freeze(false);
    window.__home.seek(x);
  }, S);
  await sleep(wait);
}

(async () => {
  const browser = await launch();
  const errors = [];

  // The frame sheets.
  for (const size of SIZES) {
    const tag = `${size[0]}x${size[1]}`;
    const { ctx, page, errors: e } = await openHome(browser, size);
    errors.push(...e);
    const secs = await sections(page);
    for (const [id, steps] of [
      ["hand", HAND_STEPS],
      ["list", LIST_STEPS],
    ]) {
      const sec = secs.find((s) => s.id === id);
      for (const off of steps) {
        await seek(page, sec.start + off);
        await page.evaluate(() => window.__home.freeze(true));
        await sleep(200);
        const file = path.join(OUT_DIR, `s4a-${tag}-${id}-${String(off).replace(".", "_")}.png`);
        await page.screenshot({ path: file });
        const st = await page.evaluate(() => {
          const h = window.__home.state();
          return {
            S: +h.S.toFixed(3),
            actors: h.actors.filter((a) => a.visible).map((a) => a.name),
          };
        });
        console.log(`${tag} ${id} ${off} ${JSON.stringify(st)}`);
      }
    }
    await ctx.close();
  }

  // Desktop interactions.
  {
    const { ctx, page, errors: e } = await openHome(browser, SIZES[0]);
    errors.push(...e);
    const secs = await sections(page);
    const hand = secs.find((s) => s.id === "hand");
    const list = secs.find((s) => s.id === "list");

    // 1. The hand and the doll answer the pointer, with no label on the hand.
    await seek(page, hand.start + 0.6, 2200);
    await page.mouse.move(560, 560);
    await page.mouse.move(790, 470, { steps: 10 });
    await sleep(500);
    check(
      "the pointer over a fingertip hits the hand",
      (await page.evaluate(() => window.__home.state().hit)) === "hand",
    );
    await page.mouse.move(724, 675, { steps: 8 });
    await sleep(400);
    check(
      "the pointer over the doll hits the doll",
      (await page.evaluate(() => window.__home.state().hit)) === "doll",
    );
    await page.mouse.move(60, 450, { steps: 6 });

    // 2. The loops play only for the frame in the window.
    await seek(page, list.start + 1.5, 3500);
    const vids = await page.evaluate(() =>
      [...document.querySelectorAll("video")].map((v) => ({
        playing: !v.paused,
        t: v.currentTime,
      })),
    );
    check(
      "exactly one loop plays, for the frame in the window",
      vids.filter((v) => v.playing).length === 1,
      JSON.stringify(vids.map((v) => +v.playing)),
    );

    // 3. The viewer by mouse.
    await page.mouse.move(720, 500, { steps: 6 });
    await sleep(400);
    const btn = await page.evaluate(() => {
      const b = document.querySelector('[data-list-open][aria-disabled="false"]');
      const r = b && b.getBoundingClientRect();
      return b && { i: b.dataset.listOpen, w: r.width, h: r.height, label: b.dataset.cursor };
    });
    check(
      "one open button is live over a 4:5 window",
      !!btn && Math.abs(btn.w / btn.h - 0.8) < 0.01,
      JSON.stringify(btn),
    );
    check("the cursor says it opens", !!btn && /view/i.test(btn.label || ""), btn && btn.label);
    await page.mouse.click(720, 500);
    await sleep(1400);
    await page.screenshot({ path: path.join(OUT_DIR, "s4a-viewer-open.png") });
    check(
      "a click opens the whole picture in a dialog",
      await page.evaluate(() => !!document.querySelector('[role="dialog"]')),
    );
    const y0 = await page.evaluate(() => window.scrollY);
    await page.mouse.wheel(0, 700);
    await sleep(600);
    check(
      "the page does not scroll while it is open",
      (await page.evaluate(() => window.scrollY)) === y0,
    );
    await page.keyboard.press("Escape");
    await sleep(1300);
    check(
      "Escape closes it and gives the focus back to the button",
      await page.evaluate(
        () =>
          !document.querySelector('[role="dialog"]') &&
          document.activeElement &&
          document.activeElement.hasAttribute("data-list-open"),
      ),
    );
    await page.mouse.click(720, 500);
    await sleep(1300);
    await page.mouse.click(20, 450);
    await sleep(1300);
    check(
      "a press on the margin closes it",
      await page.evaluate(() => !document.querySelector('[role="dialog"]')),
    );

    // 4. The keyboard: real Tab presses from the first name, to a frame's button.
    await seek(page, list.start + 0.7, 1500);
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await page.evaluate(() => document.querySelector('[data-list-name="0"] a').focus());
    await sleep(600);
    await page.keyboard.press("Tab");
    await sleep(300);
    const second = await page.evaluate(
      () => document.activeElement && document.activeElement.dataset.listOpen,
    );
    check("the Tab after a name is that frame's button", second === "0", String(second));
    await page.keyboard.press("Tab");
    await sleep(2200);
    const third = await page.evaluate(() => {
      const a = document.activeElement;
      return a && a.closest("[data-list-name]") && a.closest("[data-list-name]").dataset.listName;
    });
    check(
      "the next Tab is the next name, and the strip goes to its frame",
      third === "1",
      String(third),
    );
    await sleep(1500);
    await page.keyboard.press("Tab");
    await sleep(2200);
    await page.keyboard.press("Enter");
    await sleep(1400);
    check(
      "Enter on the button of the frame in the window opens it",
      await page.evaluate(() => !!document.querySelector('[role="dialog"]')),
    );
    await page.keyboard.press("Escape");
    await sleep(1200);

    // 5. The frame grows into the screen; the end state of the section.
    await seek(page, list.start + 4.8, 2500);
    const st = await page.evaluate(() => window.__home.state());
    check(
      "Selena and the doll are drawn at the end of the list",
      ["selena", "doll"].every((n) => st.actors.some((a) => a.name === n && a.visible)),
    );
    await ctx.close();
  }

  // Touch: a tap opens the view and a tap on the margin closes it.
  {
    const {
      ctx,
      page,
      errors: e,
    } = await openHome(browser, [390, 844], {
      hasTouch: true,
      isMobile: true,
      deviceScaleFactor: 2,
    });
    errors.push(...e);
    const list = (await sections(page)).find((s) => s.id === "list");
    await seek(page, list.start + 1.5, 3500);
    await page.touchscreen.tap(195, 480);
    await sleep(1500);
    await page.screenshot({ path: path.join(OUT_DIR, "s4a-touch-viewer.png") });
    check(
      "touch: a tap opens the picture",
      await page.evaluate(() => !!document.querySelector('[role="dialog"]')),
    );
    await page.touchscreen.tap(195, 820);
    await sleep(1300);
    check(
      "touch: a tap on the margin closes it",
      await page.evaluate(() => !document.querySelector('[role="dialog"]')),
    );
    await ctx.close();
  }

  await browser.close();
  console.log(`\n${checks.filter((c) => c.ok).length} of ${checks.length} checks passed`);
  const real = errors.filter((m) => !/Failed to load resource/.test(m));
  console.log(
    real.length
      ? `console errors:\n${[...new Set(real)].slice(0, 8).join("\n")}`
      : "no console errors",
  );
  fs.writeFileSync(path.join(OUT_DIR, "s4a-checks.json"), JSON.stringify(checks, null, 2));
  process.exit(checks.every((c) => c.ok) && real.length === 0 ? 0 : 1);
})();
