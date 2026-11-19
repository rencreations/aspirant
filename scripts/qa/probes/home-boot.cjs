// The home page's opening, looked at: the loader at its quarters, the tap gate, the intro frame by
// frame and the joint with the hero (J0). It does NOT switch the intro off (`lib.cjs` `context()`
// would): it uses a plain context with only the consent answer, so the page runs its own opening.
//
//   node scripts/qa/probes/home-boot.cjs <outFolder>
//
// Environment: BASE (default http://localhost:3000), SIZES ("1440x900,1706x950,390x844"), TIMES (the
// seconds of the intro to photograph, default every 0.2 s from 0.1 to 1.8), STAGES=0 to skip the loader
// quarters, INTRO=0 to skip the intro frames.
//
// What it does for each size:
//   1. Loader: the waited media (pictures, data, video, audio) are held back by the browser and let
//      go in four groups, so the bar can be photographed at its quarters. The drone files are let go
//      first (it must appear early). Shots: stage-<size>-<n>.png. The bar, the label and the groups are
//      the real ones: nothing here moves them.
//   2. Gate: the page waits for "tap" and photographs "Touch anywhere to continue".
//   3. Intro: it presses the empty space, freezes the scene (`__home.freeze`) and asks the opening's
//      scene for each time (`__homeBoot.seekIntro(t)`: the actors are run from just before it, so the
//      springs are where they would be). Shots: intro-<size>-<t>.png.
//   4. J0: at the last instant of the intro it reads the drone and the logo and compares them with
//      the numbers of the joint (the drone at +0.30 W, -0.22 H, 0.17 H tall, the logo's art box at the
//      hero rect) and writes `home-boot-<size>.json`.
const fs = require("node:fs");
const path = require("node:path");
const { BASE, OUT, launch } = require("./lib.cjs");

const out = process.argv[2] ? path.resolve(process.argv[2]) : OUT;
fs.mkdirSync(out, { recursive: true });
const SIZES = (process.env.SIZES || "1440x900,1706x950,390x844")
  .split(",")
  .map((s) => s.split("x").map(Number));
const TIMES = (process.env.TIMES || "0.1,0.3,0.5,0.7,0.9,1.1,1.3,1.5,1.7,1.8")
  .split(",")
  .map(Number);

const phase = (page) =>
  page
    .evaluate(() => document.querySelector("[data-home-boot]")?.getAttribute("data-phase") ?? null)
    .catch(() => null);

/** The hero rect and the drone's place of the joint, as the code computes them (fx/logo/math.ts, drone-route.ts). */
function joint(w, h) {
  const art = w < 700 ? 0.86 * w : Math.min(0.7 * w, 0.42 * h * (2708.213 / 674.833));
  return {
    logo: { cx: 0, cy: h / 2 - 0.47 * h, width: art },
    drone: { x: 0.3 * w, y: -0.22 * h, height: 0.17 * h },
  };
}

(async () => {
  const browser = await launch();
  const report = [];
  for (const [w, h] of SIZES) {
    const tag = `${w}x${h}`;
    const phone = w < 700;
    const ctx = await browser.newContext({
      viewport: { width: w, height: h },
      deviceScaleFactor: phone ? 2 : 1,
      hasTouch: phone,
      isMobile: phone,
    });
    await ctx.addInitScript(() => {
      try {
        localStorage.setItem(
          "aspirants:consent",
          JSON.stringify({ choice: "rejected", at: Date.now() }),
        );
      } catch {
        /* ignore */
      }
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text().slice(0, 300));
    });

    const held = [];
    let hold = process.env.STAGES !== "0";
    await page.route(/\/(models|img|video|data|audio)\/|\.(m4a|mp4|webm|glb)(\?|$)/, (route) =>
      hold ? held.push(route) : route.continue(),
    );
    await page.goto(BASE + "/", { waitUntil: "commit" });
    const t0 = Date.now();
    while ((await phase(page)) !== "boot" && Date.now() - t0 < 180000)
      await page.waitForTimeout(100);

    const snap = async (name) => {
      const info = await page
        .evaluate(() => ({
          pct: document.querySelector("[role=progressbar]")?.getAttribute("aria-valuenow"),
          boot: window.__homeBoot?.state()?.droneShown ?? null,
        }))
        .catch(() => ({}));
      await page.screenshot({ path: path.join(out, `stage-${tag}-${name}.png`) });
      console.log(tag, "stage", name, JSON.stringify(info));
    };
    if (hold) {
      // The list is ordered: the drone's files first, the rest only when they have arrived, so the
      // later requests exist only after the drone's are let go. Release what is held in batches.
      await page.waitForTimeout(1500);
      await snap("0-held");
      const isDrone = (r) => /drone|faces|marks/.test(r.request().url());
      const letGo = (list) => {
        for (const r of list) {
          held.splice(held.indexOf(r), 1);
          r.continue().catch(() => undefined);
        }
      };
      letGo(held.filter(isDrone));
      await page.waitForTimeout(2500);
      await snap("1-drone");
      let i = 2;
      for (const share of [3, 2, 1]) {
        letGo(held.slice(0, Math.ceil(held.length / share)));
        await page.waitForTimeout(2500);
        await snap(`${i++}-group`);
      }
      hold = false;
      letGo([...held]);
    }
    while ((await phase(page)) !== "tap" && Date.now() - t0 < 180000)
      await page.waitForTimeout(150);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(out, `gate-${tag}.png`) });

    const entry = { size: tag, errors };
    if (process.env.INTRO !== "0") {
      if (phone) await page.touchscreen.tap(Math.round(w * 0.15), Math.round(h * 0.85));
      else await page.mouse.click(Math.round(w * 0.15), Math.round(h * 0.85));
      while ((await phase(page)) !== "intro") await page.waitForTimeout(30);
      await page.evaluate(() => window.__home.freeze(true));
      await page.waitForTimeout(100);
      for (const t of TIMES) {
        await page.evaluate((s) => window.__homeBoot.seekIntro(s), t);
        await page.waitForTimeout(250);
        await page.screenshot({
          path: path.join(out, `intro-${tag}-${String(t).padStart(5, "0")}.png`),
        });
      }
      // J0: the last instant of the intro against the joint.
      await page.evaluate(() => window.__homeBoot.seekIntro(1.849));
      await page.waitForTimeout(250);
      entry.end = await page.evaluate(() => {
        const s = window.__homeBoot.state();
        return { drone: s.drone, logo: s.logo };
      });
      entry.joint = joint(w, h);
      const d = entry.end.drone;
      const j = entry.joint.drone;
      entry.droneOffPx = Math.hypot(d.x - j.x, d.y - j.y);
      entry.droneHeightOffPx = Math.abs(d.height - j.height);
      entry.logoOffPx = Math.hypot(
        entry.end.logo.cx - entry.joint.logo.cx,
        entry.end.logo.cy - entry.joint.logo.cy,
      );
      console.log(
        tag,
        "J0 drone off by",
        entry.droneOffPx.toFixed(1),
        "px (the drone floats a few px), logo off by",
        entry.logoOffPx.toFixed(2),
        "px",
      );
      await page.evaluate(() => window.__home.skipIntro());
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(out, `open-${tag}.png`) });
    }
    report.push(entry);
    await ctx.close();
  }
  fs.writeFileSync(path.join(out, "home-boot.json"), JSON.stringify(report, null, 2));
  await browser.close();
})();
