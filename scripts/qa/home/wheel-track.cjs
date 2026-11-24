// Scrolls the home with a real mouse wheel between two positions (in screens) and records Tetra's
// body every frame, to find the places where it jumps instead of blending. `seek` is a jump (the
// actor snaps to what is asked), so only a real wheel shows a pop.
//
// Usage: node scripts/qa/home/wheel-track.cjs <fromS> <toS> [--back] [--px 36] [--gap 16] [--video dir]
//   node scripts/qa/home/wheel-track.cjs 36.4 47 --back --px 40
//
// Prints, for every channel, the biggest step between two frames and the scroll position where it
// happened, the worst first. `--video dir` also records the run (convert it with ffmpeg).
const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");

const req = createRequire(path.resolve(__dirname, "../../../apps/web/package.json"));
const { chromium } = req("@playwright/test");

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i < 0 ? fallback : args[i + 1];
};
const from = Number(args[0]);
const to = Number(args[1]);
const back = args.includes("--back");
const px = Number(flag("--px", 36));
const gap = Number(flag("--gap", 16));
const videoDir = flag("--video", null);
const base = flag("--base", "http://localhost:3000/");

(async () => {
  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
    args: ["--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"],
  });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    ...(videoDir ? { recordVideo: { dir: videoDir, size: { width: 1440, height: 900 } } } : {}),
  });
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
    const keys = ["x", "y", "z", "yaw", "pitch", "roll", "squash"];
    const turns = [
      "hips",
      "spine",
      "spine2",
      "neck",
      "head",
      "shoulderL",
      "shoulderR",
      "armL",
      "armR",
      "foreL",
      "foreR",
      "wristL",
      "wristR",
      "legL",
      "legR",
      "kneeL",
      "kneeR",
    ];
    window.__trk = [];
    const t0 = performance.now();
    const flat = (c) => {
      const out = {};
      for (const k of keys) out[k] = c[k];
      for (const t of turns) {
        out[t + ".x"] = c[t].x;
        out[t + ".y"] = c[t].y;
        out[t + ".z"] = c[t].z;
      }
      for (const r of ["reachL", "reachR"]) {
        for (const a of ["x", "y", "z", "w"]) out[r + "." + a] = c[r][a];
      }
      return out;
    };
    // The scene's own position, cheaply, once a frame.
    window.__trkS = 0;
    const watchS = () => {
      window.__trkS = window.__home.state().S;
      if (window.__trkOn !== false) requestAnimationFrame(watchS);
    };
    window.__trkOn = true;
    requestAnimationFrame(watchS);
    // The actor calls this with the channels it composed, once every frame it is drawn.
    const hook = () => {
      const a = window.__home && window.__home.peek("tetra");
      if (!a || !a.tweak) return false;
      a.tweak((c) => {
        const st = a.state();
        window.__trk.push({
          t: performance.now() - t0,
          S: window.__trkS,
          pose: st.pose,
          weights: st.weights,
          c: flat(c),
          head: [st.marks.head.x, st.marks.head.y],
        });
      });
      return true;
    };
    const wait = () => {
      if (!hook()) setTimeout(wait, 100);
    };
    wait();
  });

  const unit = await page.evaluate(() => window.__home.state().unit);
  console.log("unit px per screen:", unit);
  await page.mouse.move(720, 450);
  const run = async (a, b) => {
    const dir = b > a ? 1 : -1;
    let guard = 0;
    for (;;) {
      const S = await page.evaluate(() => window.__home.state().S);
      if ((dir > 0 && S >= b) || (dir < 0 && S <= b) || guard++ > 4000) break;
      await page.mouse.wheel(0, dir * px);
      await page.waitForTimeout(gap);
    }
    await page.waitForTimeout(1500);
  };
  await run(from, to);
  if (back) await run(to, from);

  const data = await page.evaluate(() => {
    window.__trkOn = false;
    return window.__trk;
  });
  console.log("frames", data.length);
  // A pop is a step that the frames around it do not explain: the second difference of a channel
  // (a smooth swing has a small one, a jump has the size of the jump). A hand target counts only as
  // much as the share the arm is solved toward it (`w`).
  const spikes = {};
  for (let i = 2; i < data.length; i += 1) {
    const a = data[i - 2];
    const b = data[i - 1];
    const c = data[i];
    // Frames that are not neighbours (she was hidden between) are a jump on purpose, not a pop;
    // and a pop off the screen is not seen.
    if (c.t - a.t > 80) continue;
    if (Math.abs(c.head[0]) > 760 || Math.abs(c.head[1]) > 520) continue;
    for (const k of Object.keys(c.c)) {
      let v0 = a.c[k];
      let v1 = b.c[k];
      let v2 = c.c[k];
      const reach = k.match(/^(reach[LR])\.[xyz]$/);
      if (reach) {
        const w = (o) => o.c[reach[1] + ".w"];
        v0 *= w(a);
        v1 *= w(b);
        v2 *= w(c);
      }
      if (k.endsWith(".w")) continue;
      const jump = Math.abs(v2 - 2 * v1 + v0);
      if (!spikes[k] || jump > spikes[k].jump) {
        spikes[k] = { jump, S: c.S, i, pose: c.pose, step: v2 - v1 };
      }
    }
  }
  const rows = Object.entries(spikes)
    .map(([k, v]) => ({ k, ...v }))
    .sort((p, q) => q.jump - p.jump)
    .slice(0, 16);
  for (const r of rows) {
    console.log(
      `${r.k.padEnd(12)} jump ${r.jump.toFixed(3)} (step ${r.step.toFixed(3)}) at S=${r.S.toFixed(2)} frame ${r.i} pose ${r.pose}`,
    );
  }
  const out = path.join(process.env.TMP || ".", "wheel-track.json");
  fs.writeFileSync(out, JSON.stringify(data));
  console.log("saved", out);
  await ctx.close();
  await browser.close();
})();
