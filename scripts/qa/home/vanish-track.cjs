// Finds the frames in which Tetra is drawn and then, in the next frame, is not, while she is still on
// the screen: she vanished instead of leaving. Scrolls with a real wheel, down to a turning point and
// back up (and down again), for a row of turning points, and prints every vanish with the scroll
// position, the direction and where she was.
//
// Usage: node scripts/qa/home/vanish-track.cjs [--base http://localhost:3100/] [--from 35.75]
//   [--turns 36.95,37.35,40.95,41.35,41.75,42.35,43.35] [--back 35.75] [--px 24]
//
// Tetra's `visible` is read once a frame after the kernel's own update (a callback registered later
// in the same frame), and her head's mark on the screen says where she was.
const path = require("node:path");
const { createRequire } = require("node:module");

const req = createRequire(path.resolve(__dirname, "../../../apps/web/package.json"));
const { chromium } = req("@playwright/test");

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i < 0 ? fallback : args[i + 1];
};
const base = flag("--base", "http://localhost:3000/");
const from = Number(flag("--from", 35.75));
const back = Number(flag("--back", 35.75));
const px = Number(flag("--px", 24));
const turns = flag("--turns", "36.95,37.35,40.95,41.35,41.75,42.35,43.35").split(",").map(Number);

(async () => {
  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
    args: ["--ignore-gpu-blocklist"],
  });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => {
    try {
      sessionStorage.setItem("aspirants:entered", "1");
      localStorage.setItem(
        "aspirants:consent",
        JSON.stringify({ choice: "rejected", at: Date.now() }),
      );
      sessionStorage.setItem("aspirants:intro", "off");
    } catch {
      /* storage can be blocked */
    }
  });
  const page = await ctx.newPage();
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__home && window.__home.state().open, null, {
    timeout: 120000,
  });
  await page.evaluate((s) => window.__home.seek(s), from);
  await page.waitForTimeout(4000);

  await page.evaluate(() => {
    window.__vanish = { frames: [], dir: 0 };
    const watch = () => {
      const h = window.__home;
      const a = h && h.peek("tetra");
      if (a && a.state) {
        const st = a.state();
        window.__vanish.frames.push({
          t: performance.now(),
          S: h.state().S,
          visible: a.visible,
          head: [st.marks.head.x, st.marks.head.y],
          dir: window.__vanish.dir,
        });
      }
      requestAnimationFrame(watch);
    };
    requestAnimationFrame(watch);
  });

  await page.mouse.move(720, 450);
  const S = () => page.evaluate(() => window.__home.state().S);
  const go = async (to, dir) => {
    await page.evaluate((d) => {
      window.__vanish.dir = d;
    }, dir);
    let guard = 0;
    for (;;) {
      const s = await S();
      if ((dir > 0 && s >= to) || (dir < 0 && s <= to) || guard++ > 6000) break;
      await page.mouse.wheel(0, dir * px);
      await page.waitForTimeout(16);
    }
  };

  for (const turn of turns) {
    await go(turn, 1);
    await go(back, -1);
    await page.waitForTimeout(600);
    await go(turn, 1);
    await page.waitForTimeout(300);
    await go(back, -1);
    await page.waitForTimeout(600);
  }

  const frames = await page.evaluate(() => window.__vanish.frames);
  console.log("frames", frames.length);
  const events = [];
  for (let i = 1; i < frames.length; i += 1) {
    const a = frames[i - 1];
    const b = frames[i];
    // Drawn, then not drawn, while her head was on the screen (with a margin for her ears and arms).
    if (a.visible && !b.visible && Math.abs(a.head[0]) < 700 && Math.abs(a.head[1]) < 440) {
      events.push({ S: b.S, dir: b.dir, head: a.head.map((v) => Math.round(v)) });
    }
  }
  console.log("vanishes:", events.length);
  for (const e of events.slice(0, 40)) {
    console.log(
      `  at S=${e.S.toFixed(3)} going ${e.dir > 0 ? "down" : "up"}, head was at (${e.head[0]}, ${e.head[1]})`,
    );
  }
  // A jump: she is drawn in two frames in a row and her head moved further than she can run
  // (a teleport, or a streak across the screen), while she is on the screen in one of them.
  const jumps = [];
  for (let i = 1; i < frames.length; i += 1) {
    const a = frames[i - 1];
    const b = frames[i];
    if (!a.visible || !b.visible || b.t - a.t > 40) continue;
    const onScreen = (f) => Math.abs(f.head[0]) < 760 && Math.abs(f.head[1]) < 480;
    if (!onScreen(a) && !onScreen(b)) continue;
    const d = Math.hypot(b.head[0] - a.head[0], b.head[1] - a.head[1]);
    if (d > 60) jumps.push({ d, S: b.S, dir: b.dir, a: a.head, b: b.head });
  }
  jumps.sort((p, q) => q.d - p.d);
  console.log("jumps over 60 px in a frame:", jumps.length);
  for (const j of jumps.slice(0, 12)) {
    console.log(
      `  ${j.d.toFixed(0)} px at S=${j.S.toFixed(3)} going ${j.dir > 0 ? "down" : "up"}: (${j.a.map(Math.round)}) to (${j.b.map(Math.round)})`,
    );
  }
  await browser.close();
})();
