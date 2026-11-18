// The rows and the strip of the home page (workstream S2): frame sheets at the beats and the joints,
// then the strip's interactions (the hover swap, the film's hover, the window and its player by mouse
// and by touch, a preview's press, the keyboard).
//
//   node scripts/qa/probes/home-s2.cjs <outFolder>
//   BASE=http://localhost:3100 SIZES=1440x900 node scripts/qa/probes/home-s2.cjs out
//
// The frames are taken with a `seek` and the scene running (the films have to play to show a picture),
// so two runs differ in which frame of the loop a clip is at. Files: <outFolder>/s2-<part>-<size>-<s>.png
// (`s` is screens from the start of the section). It prints every check as a line and every console
// error at the end.
const fs = require("node:fs");
const path = require("node:path");

const { BASE, OUT, launch, context } = require("./lib.cjs");

const OUT_DIR = path.resolve(process.argv[2] || OUT);
fs.mkdirSync(OUT_DIR, { recursive: true });

const SIZES = (process.env.SIZES || "1440x900,1706x950,390x844")
  .split(",")
  .map((s) => s.split("x").map(Number));
/** Screens from the start of each section: the lead, the beats, the joints (rows 2.4, strip 0). */
const ROWS = (process.env.ROWS || "-0.2,0,0.7,1.1,1.4,1.7,2.1,2.4").split(",").map(Number);
const STRIP = (process.env.STRIP || "0,0.3,0.7,1.1,1.4,1.8,2.1,2.4,2.9,3.4,3.7")
  .split(",")
  .map(Number);
// Where the sections start is the registry's: read from the page (`__home.sections()`) once it is open.
let ROWS_START = 0;
let STRIP_START = 0;

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
  await page.addStyleTag({ content: "nextjs-portal{display:none !important}" });
  const starts = await page.evaluate(() =>
    Object.fromEntries(window.__home.sections().map((s) => [s.id, s.start])),
  );
  ROWS_START = starts.rows;
  STRIP_START = starts.strip;
  await sleep(2600);
  return { ctx, page, errors };
}

const seek = async (page, S, wait = 1500) => {
  await page.evaluate((x) => window.__home.seek(x), S);
  await sleep(wait);
};
const centreOf = (page, sel) =>
  page.evaluate((s) => {
    const r = document.querySelector(s).getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, sel);
const words = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("[data-strip-swap]")].map((e) => e.textContent),
  );
const players = (page) =>
  page.evaluate(() => [...document.querySelectorAll("video")].map((v) => v.currentSrc).length);

(async () => {
  const browser = await launch();
  const errors = [];

  for (const size of SIZES) {
    const tag = `${size[0]}x${size[1]}`;
    const { ctx, page, errors: e } = await openHome(browser, size);
    errors.push(...e);
    for (const s of ROWS) {
      await seek(page, ROWS_START + s);
      await page.screenshot({
        path: path.join(OUT_DIR, `s2-rows-${tag}-${String(s).replace(".", "_")}.png`),
      });
    }
    for (const s of STRIP) {
      await seek(page, STRIP_START + s);
      await page.screenshot({
        path: path.join(OUT_DIR, `s2-strip-${tag}-${String(s).replace(".", "_")}.png`),
      });
      const st = await page.evaluate(() => {
        const h = window.__home.state();
        return { S: +h.S.toFixed(3), actors: h.actors.filter((a) => a.visible).map((a) => a.name) };
      });
      console.log(`${tag} strip +${s} ${JSON.stringify(st)}`);
    }
    await ctx.close();
  }

  // The interactions, at the desktop size.
  {
    const { ctx, page, errors: e } = await openHome(browser, SIZES[0]);
    errors.push(...e);
    await seek(page, STRIP_START + 0.32, 2500);
    check("the pair of words rests", (await words(page)).join("|") === "Aspirant 5.0|Trailer");
    const cta = await centreOf(page, "[data-strip-cta]");
    await page.mouse.move(cta.x, cta.y, { steps: 6 });
    await sleep(900);
    check("a hover of See All swaps the pair", (await words(page)).join("|") === "Our|Collections");
    check(
      "the tag above does not change",
      await page.evaluate(() =>
        /Video/i.test(document.querySelector('[data-strip-g="video"]').textContent),
      ),
    );
    await page.mouse.move(700, 800, { steps: 6 });
    await sleep(900);
    check("leaving gives the pair back", (await words(page)).join("|") === "Aspirant 5.0|Trailer");
    await page.mouse.move(720, 450, { steps: 8 });
    await sleep(700);
    check(
      "the strip is under the pointer",
      (await page.evaluate(() => window.__home.state().hit)) === "film",
    );
    await page.mouse.down();
    await page.mouse.up();
    await sleep(700);
    check("no player opens from the small frame", (await players(page)) === 0);

    await seek(page, STRIP_START + 1.35, 2500);
    await page.mouse.move(400, 300, { steps: 6 });
    await sleep(600);
    await page.mouse.down();
    await page.mouse.up();
    await sleep(1600);
    check("a press on the grown frame opens the player", (await players(page)) > 0);
    const y0 = await page.evaluate(() => window.scrollY);
    await page.mouse.wheel(0, 800);
    await sleep(700);
    check("the page is held under the player", (await page.evaluate(() => window.scrollY)) === y0);
    await page.keyboard.press("Escape");
    await sleep(1600);
    check("Escape closes it", (await players(page)) === 0);
    await page.mouse.wheel(0, 300);
    await sleep(800);
    check("the page is free again", (await page.evaluate(() => window.scrollY)) !== y0);

    await seek(page, STRIP_START + 2.4, 3000);
    await page.evaluate(async () => {
      window.__film = await window.__home.lab("film");
    });
    await sleep(500);
    const pr = await page.evaluate(() => {
      const r = window.__film.previewRect(3, {});
      return r ? { x: r.x + r.w / 2, y: r.y + r.h / 2 } : null;
    });
    if (pr) {
      await page.mouse.move(pr.x, pr.y, { steps: 8 });
      await sleep(700);
      check(
        "a preview is under the pointer",
        (await page.evaluate(() => window.__film.hoveredPreview)) === 3,
      );
      await page.mouse.down();
      await page.mouse.up();
      let url = page.url();
      for (let i = 0; i < 20 && !/video\/films/.test(url); i++) {
        await sleep(1000);
        url = page.url();
      }
      check("a press on a preview goes to its film", /collection\/video\/films/.test(url), url);
    } else {
      check("a preview is on the screen in the hold", false);
    }
    await ctx.close();
  }

  // The keyboard: the page goes to a control that is not on screen.
  {
    const { ctx, page, errors: e } = await openHome(browser, SIZES[0]);
    errors.push(...e);
    await seek(page, 6.0, 1500);
    const seen = [];
    for (let i = 0; i < 14; i++) {
      await page.keyboard.press("Tab");
      await sleep(500);
      seen.push(
        await page.evaluate(() => {
          const a = document.activeElement;
          return {
            text: (a?.getAttribute("aria-label") || a?.textContent || "").trim().slice(0, 30),
            S: +window.__home.state().raw.toFixed(1),
          };
        }),
      );
    }
    const see = seen.find((x) => /^See All$/.test(x.text));
    check(
      "the keyboard reaches See All with the small frame on screen",
      !!see && Math.abs(see.S - 8.5) < 0.2,
      JSON.stringify(see),
    );
    const play = seen.find((x) => /Play the trailer/.test(x.text));
    check(
      "the keyboard reaches the play button with the window on screen",
      !!play && Math.abs(play.S - 9.55) < 0.2,
      JSON.stringify(play),
    );
    const film = seen.find((x) => /Day of Enders/.test(x.text));
    check(
      "the keyboard reaches a film link with the orbit on screen",
      !!film && Math.abs(film.S - 10.6) < 0.2,
      JSON.stringify(film),
    );
    await ctx.close();
  }

  // Touch: a tap on the grown frame opens the player; a press on See All shows the other words.
  {
    const {
      ctx,
      page,
      errors: e,
    } = await openHome(browser, [390, 844], { hasTouch: true, isMobile: true });
    errors.push(...e);
    await seek(page, STRIP_START + 1.4, 2500);
    const r = await page.evaluate(() => {
      const b = document.querySelector("[data-strip-window]").getBoundingClientRect();
      return { x: b.x + b.width / 2, y: b.y + b.height / 2 - 70 };
    });
    await page.touchscreen.tap(r.x, r.y);
    await sleep(1800);
    check("a tap on the grown frame opens the player", (await players(page)) > 0);
    await page.keyboard.press("Escape");
    await sleep(1500);
    await ctx.close();
  }

  console.log(errors.length ? `\nconsole errors:\n${errors.join("\n")}` : "\nno console errors");
  fs.writeFileSync(path.join(OUT_DIR, "s2-checks.json"), JSON.stringify(checks, null, 2));
  await browser.close();
  process.exit(checks.every((c) => c.ok) ? 0 : 1);
})();
