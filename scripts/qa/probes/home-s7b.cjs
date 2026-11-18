// The archive and the footer of the home page: frame sheets at the joints, the interactions (mouse,
// keyboard, touch), and the way out to About. Run with plain node against a running dev server:
//
//   BASE=http://localhost:3100 OUT=./out node scripts/qa/probes/home-s7b.cjs
//
// PARTS (comma list, default all): sheet, interact, handoff. SIZES: "1440x900,1706x950,390x844".
// STOPS: the scroll positions of the sheet (screens). The scene is frozen for each picture (the
// probe seeks, lets the drone settle for 1.6 s, then freezes), so a frame is the pure function of S.
// Prints one line per picture and the console errors. The handoff part removes `aspirants:intro`
// after the home is open, so About's opening plays, and records About's phase for every frame.
const path = require("node:path");
const fs = require("node:fs");
const lib = require("./lib.cjs");

const OUT = process.env.OUT || lib.OUT;
const PARTS = (process.env.PARTS || "sheet,interact,handoff").split(",");
const SIZES = (process.env.SIZES || "1440x900,1706x950,390x844")
  .split(",")
  .map((s) => s.split("x").map(Number));
// Screens from the start of the archive (the registry's start, read from the page).
const STOPS = (process.env.STOPS || "0,0.35,0.5,1.1,1.9,2.3,2.7,3.1,3.5,4.0")
  .split(",")
  .map(Number);
fs.mkdirSync(OUT, { recursive: true });

async function openHome(browser, options) {
  const ctx = await lib.context(browser, options);
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text().slice(0, 240));
  });
  page.on("pageerror", (e) => errors.push(`pageerror ${e.message}`));
  await page.goto(`${lib.BASE}/`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!window.__home && window.__home.state().open, null, {
    timeout: 180000,
  });
  await page.waitForTimeout(2000);
  return { ctx, page, errors };
}

const lits = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("[data-archive-room]")]
      .map((li) => (+getComputedStyle(li).getPropertyValue("--lit")).toFixed(2))
      .join(" "),
  );

async function sheet(browser) {
  for (const [w, h] of SIZES) {
    const { ctx, page, errors } = await openHome(browser, {
      viewport: { width: w, height: h },
      deviceScaleFactor: 1,
    });
    const archiveStart = await page.evaluate(
      () => window.__home.sections().find((s) => s.id === "archive").start,
    );
    for (const offset of STOPS) {
      const S = +(archiveStart + offset).toFixed(3);
      await page.evaluate((S) => {
        window.__home.freeze(false);
        window.__home.seek(S);
      }, S);
      await page.waitForTimeout(1600);
      await page.evaluate(() => window.__home.freeze(true));
      await page.waitForTimeout(250);
      const file = path.join(OUT, `s7b-${String(S).replace(".", "_")}-${w}x${h}.png`);
      await page.screenshot({ path: file });
      const st = await page.evaluate(() => {
        const s = window.__home.state();
        return {
          running: s.sections.filter((x) => x.running).map((x) => x.id),
          actors: s.actors.filter((a) => a.visible).map((a) => a.name),
        };
      });
      console.log(`sheet ${w}x${h} S=${S}`, JSON.stringify(st), file);
    }
    console.log(`sheet ${w}x${h} errors:`, errors.join(" | ") || "none");
    await ctx.close();
  }
}

async function interact(browser) {
  {
    const { ctx, page, errors } = await openHome(browser, {
      viewport: { width: 1440, height: 900 },
    });
    await page.evaluate(() => window.__home.seek(57.0));
    await page.waitForTimeout(1500);
    console.log("rest lit    ", await lits(page));
    const box = await page.locator('[data-archive-room="4"] a').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 8 });
    await page.waitForTimeout(1300);
    console.log(
      "hover lit   ",
      await lits(page),
      "(the light is on cover 4, the drone is over it)",
    );
    await page.screenshot({ path: path.join(OUT, "s7b-hover.png") });
    await page.mouse.move(700, 120, { steps: 8 });
    await page.waitForTimeout(1600);
    console.log("let go lit  ", await lits(page), "(back on the tour's own cover)");
    await page.keyboard.press("Shift");
    const before = await page.evaluate(() => window.__home.state().S);
    await page.locator('[data-archive-room="8"] a').focus();
    await page.waitForTimeout(2500);
    const after = await page.evaluate(() => window.__home.state().S);
    console.log(
      `focus cover 8: S ${before.toFixed(2)} -> ${after.toFixed(2)}, lit`,
      await lits(page),
    );
    console.log("mouse and keyboard errors:", errors.join(" | ") || "none");
    await ctx.close();
  }
  {
    const { ctx, page, errors } = await openHome(browser, {
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
      deviceScaleFactor: 2,
    });
    await page.evaluate(() => window.__home.seek(57.0));
    await page.waitForTimeout(1500);
    const b = await page.locator('[data-archive-room="3"] a').boundingBox();
    await page.touchscreen.tap(Math.min(380, b.x + 40), b.y + 60);
    await page.waitForTimeout(2000);
    console.log(
      "touch: first tap on a cover that is not lit stays on /:",
      new URL(page.url()).pathname,
      "lit",
      await lits(page),
    );
    await page.screenshot({ path: path.join(OUT, "s7b-touch.png") });
    console.log("touch errors:", errors.join(" | ") || "none");
    await ctx.close();
  }
}

async function handoff(browser) {
  for (const mode of ["wheel", "button", "key"]) {
    const { ctx, page, errors } = await openHome(browser, {
      viewport: { width: 1440, height: 900 },
    });
    await page.evaluate(() => sessionStorage.removeItem("aspirants:intro"));
    await page.evaluate((S) => window.__home.seek(S), mode === "key" ? 40 : 59.9);
    await page.waitForTimeout(1500);
    const t0 = Date.now();
    if (mode === "wheel")
      for (let i = 0; i < 6; i++) {
        await page.mouse.wheel(0, 60);
        await page.waitForTimeout(60);
      }
    if (mode === "button") await page.getByRole("button", { name: "Continue to About" }).click();
    if (mode === "key") await page.locator("body").press("n");
    const seen = [];
    for (let i = 0; i < 70; i++) {
      const url = new URL(page.url()).pathname;
      let phase = null;
      try {
        phase = await page.evaluate(() =>
          window.__aboutDrone ? window.__aboutDrone.state().phase : null,
        );
      } catch {}
      if (i % 4 === 0)
        await page.screenshot({
          path: path.join(OUT, `s7b-handoff-${mode}-${String(i).padStart(2, "0")}.png`),
        });
      const last = seen[seen.length - 1];
      if (!last || last.url !== url || last.phase !== phase)
        seen.push({ t: Date.now() - t0, url, phase });
      await page.waitForTimeout(100);
    }
    console.log(`handoff ${mode}:`, seen.map((s) => `${s.t}ms ${s.url} ${s.phase}`).join("  >  "));
    console.log(
      `handoff ${mode} errors:`,
      errors.join(" | ") || "none",
      "(About's phases should read wait, title, landing, landed, done)",
    );
    await ctx.close();
  }
}

(async () => {
  const browser = await lib.launch();
  if (PARTS.includes("sheet")) await sheet(browser);
  if (PARTS.includes("interact")) await interact(browser);
  if (PARTS.includes("handoff")) await handoff(browser);
  await browser.close();
})();
