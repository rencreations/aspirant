// The home page walked end to end with a real wheel, down and then up, in real Chrome. It checks
// what round two promises (docs/design/home/kernel-plays.md, kernel-snap.md): scenes fire at a
// threshold, hold the scroll until they end and play back going up, the page is never held with no
// scene running, and it never stands still under a wheel with no hold. It logs every play (where it
// fired, how long it held) and every frame longer than 50 ms (and where).
//
//   node scripts/qa/probes/home-plays.cjs <outFolder>
//   BASE=http://localhost:3100 SIZES=1440x900,390x844 DIR=down|up|both SHOTS=1 node scripts/qa/probes/home-plays.cjs out
//
// Environment: BASE (default http://localhost:3000), SIZES ("1440x900,1706x950,390x844"), DIR
// ("both"), SHOTS=1 (a picture 0.7 s after each play ends: the rest the visitor stands in), STEP
// (wheel notch in px, 100), EVERY (ms between notches, 30). Files: <outFolder>/plays-<size>.json and,
// with SHOTS, plays-<size>-<d|u>-<nn>-r<screens>.png. Exit code 1 when a check fails.
//
// The page opens with the opening switched off (`lib.cjs` `context()`), at the top. The dev server is
// two to three times slower than the production build: judge frame times on the build.
const fs = require("node:fs");
const path = require("node:path");

const { BASE, OUT, launch, context, PHONE } = require("./lib.cjs");

const OUT_DIR = path.resolve(process.argv[2] || OUT);
fs.mkdirSync(OUT_DIR, { recursive: true });
const SIZES = (process.env.SIZES || "1440x900,1706x950,390x844")
  .split(",")
  .map((s) => s.split("x").map(Number));
const DIR = process.env.DIR || "both";
const SHOTS = process.env.SHOTS === "1";
const STEP = Number(process.env.STEP || 100);
const EVERY = Number(process.env.EVERY || 30);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** A walk that has not reached its end after this long is a failure (a trap). */
const LIMIT_MS = 10 * 60 * 1000;
/** The longest a scene may hold the page, in seconds. The kernel's own limit is the play plus 1.5 s. */
const MAX_HOLD_S = 5;

/** Frame logger: every frame's time, the scroll, the play that runs and whether the site's lock is on. */
const LOGGER = () => {
  if (window.__plog) return;
  window.__plog = { frames: [], gaps: [] };
  let last = performance.now();
  const tick = () => {
    const now = performance.now();
    const dt = now - last;
    last = now;
    const h = window.__home;
    if (h) {
      const st = h.state();
      const pl = h.plays().find((q) => q.active);
      window.__plog.frames.push([
        Math.round(now),
        Math.round(dt),
        +st.raw.toFixed(3),
        pl ? `${pl.id}#${pl.fired}` : "-",
        document.documentElement.classList.contains("lenis-stopped") ? 1 : 0,
      ]);
      if (dt > 50)
        window.__plog.gaps.push([
          Math.round(now),
          Math.round(dt),
          +st.raw.toFixed(2),
          pl ? pl.id : "-",
        ]);
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

async function walk(page, dir, tag, total, W, H, failures) {
  const sign = dir === "down" ? 1 : -1;
  const t0 = Date.now();
  const events = [];
  let prev = false;
  let shots = 0;
  let still = 0;
  let lastRaw = -1;
  while (Date.now() - t0 < LIMIT_MS) {
    const st = await page.evaluate(() => {
      const s = window.__home.state();
      return {
        raw: s.raw,
        playing: s.playing,
        locked: document.documentElement.classList.contains("lenis-stopped"),
        snapping: window.__home.snap().moving,
      };
    });
    if (dir === "down" ? st.raw >= total - 0.02 : st.raw <= 0.02) break;
    const play = !!st.playing;
    if (!prev && play)
      events.push({ t: Date.now() - t0, e: `start:${st.playing}`, raw: +st.raw.toFixed(3) });
    if (prev && !play) {
      events.push({ t: Date.now() - t0, e: "end", raw: +st.raw.toFixed(3) });
      if (SHOTS) {
        await sleep(700);
        await page.screenshot({
          path: path.join(
            OUT_DIR,
            `plays-${W}x${H}-${tag}-${String(shots++).padStart(2, "0")}-r${st.raw.toFixed(2)}.png`,
          ),
        });
      }
    }
    prev = play;
    // The site's lock with no scene running is a trap (the aspirants' preview and the list's viewer
    // hold on purpose, and are not opened by a wheel).
    if (st.locked && !play && !st.snapping) {
      still += 1;
      if (still === 40)
        failures.push(`${tag}: the page is locked with no scene running at ${st.raw.toFixed(2)}`);
    } else if (!st.locked && Math.abs(st.raw - lastRaw) < 0.0005) {
      still += 1;
      if (still === 200)
        failures.push(`${tag}: the wheel moves nothing and nothing holds, at ${st.raw.toFixed(2)}`);
    } else still = 0;
    lastRaw = st.raw;
    for (let i = 0; i < 3; i++) {
      await page.mouse.wheel(0, sign * STEP);
      await sleep(EVERY);
    }
  }
  if (Date.now() - t0 >= LIMIT_MS)
    failures.push(`${tag}: the walk did not reach the end in ${LIMIT_MS / 1000} s`);
  return events;
}

/** Pair the start and end events into plays: id, where, seconds held. */
function summarise(events) {
  const plays = [];
  let start = null;
  for (const e of events) {
    if (e.e.startsWith("start:")) start = e;
    else if (e.e === "end" && start) {
      plays.push({
        id: start.e.slice(6),
        at: start.raw,
        to: e.raw,
        seconds: +((e.t - start.t) / 1000).toFixed(2),
      });
      start = null;
    }
  }
  return plays;
}

async function run(browser, W, H) {
  const phone = W < 600;
  const ctx = await context(
    browser,
    phone ? { ...PHONE } : { viewport: { width: W, height: H }, deviceScaleFactor: 1 },
  );
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${String(e)}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 200)}`);
  });
  await page.goto(`${BASE}/`);
  await page.waitForFunction(() => window.__home && window.__home.state().open, null, {
    timeout: 120_000,
  });
  await sleep(1500);
  await page.evaluate(LOGGER);
  await page.mouse.move(Math.round(W / 2), Math.round(H / 2));
  const total = (await page.evaluate(() => window.__home.state())).total;
  const failures = [];
  const result = { size: `${W}x${H}`, total };
  if (DIR !== "up") {
    result.down = summarise(await walk(page, "down", "d", total, W, H, failures));
  }
  if (DIR !== "down") {
    if (DIR === "up") {
      await page.evaluate((t) => window.__home.seek(t - 0.5), total);
      await sleep(2500);
    }
    result.up = summarise(await walk(page, "up", "u", total, W, H, failures));
  }
  const log = await page.evaluate(() => window.__plog);
  result.gaps = log.gaps;
  result.errors = errors;
  for (const k of ["down", "up"]) {
    if (!result[k]) continue;
    const held = result[k].reduce((a, p) => a + p.seconds, 0);
    const longest = result[k].reduce((a, p) => Math.max(a, p.seconds), 0);
    console.log(
      `${W}x${H} ${k}: ${result[k].length} plays, ${held.toFixed(1)} s held, longest ${longest.toFixed(2)} s, ` +
        result[k].map((p) => `${p.id}@${p.at.toFixed(2)}:${p.seconds}`).join(" "),
    );
    for (const p of result[k]) {
      if (p.seconds > MAX_HOLD_S)
        failures.push(`${W}x${H} ${k}: ${p.id} held the page ${p.seconds} s at ${p.at}`);
    }
  }
  const worst = log.gaps.reduce((a, g) => Math.max(a, g[1]), 0);
  console.log(`${W}x${H}: ${log.gaps.length} frames over 50 ms, worst ${worst} ms`);
  for (const g of log.gaps) console.log("  gap", g.join(" "));
  result.failures = failures;
  fs.writeFileSync(path.join(OUT_DIR, `plays-${W}x${H}.json`), JSON.stringify(result, null, 1));
  if (errors.length) console.log(`${W}x${H} ERRORS`, errors.slice(0, 5));
  for (const f of failures) console.log("FAIL", f);
  await ctx.close();
  return failures.length + errors.length;
}

(async () => {
  const browser = await launch();
  let bad = 0;
  for (const [w, h] of SIZES) bad += await run(browser, w, h);
  await browser.close();
  console.log(bad ? `${bad} problem(s)` : "no problems");
  process.exit(bad ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
