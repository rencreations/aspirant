// Checks that the roster page is never seen before the intro: black from the first paint.
//
//   node scripts/roster-intro/first-paint.mjs [--base http://localhost:3100] [--cpu 4] [--out DIR]
//
// It records the screen with the browser's own screencast (every frame the browser paints, with its
// time) for two cases, each with and without a slowed processor: a hard load of /character/ and a
// page change from / to /character/ through the menu. A frame "shows the page" when its left half is
// the roster's red field (the intro's own frames are neutral grey or black until it cuts to the
// roster's red wedge). The script lists the first frames, saves them, and fails (exit code 1) when a
// frame of the page comes before the intro's hard cut at 0.7 s. Chrome and Playwright (apps/web).
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const web = createRequire(path.join(here, "../../apps/web/package.json"));
const { chromium } = web("@playwright/test");

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith("--"))
      acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith("--") ? all[i + 1] : "1"]);
    return acc;
  }, []),
);
const base = (args.base || "http://localhost:3100").replace(/\/$/, "");
const out = args.out || path.join(os.tmpdir(), "roster-intro-first-paint");
const cpuRates = args.cpu ? [1, Number(args.cpu)] : [1, 4];
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: [
    "--use-angle=default",
    "--ignore-gpu-blocklist",
    "--enable-unsafe-swiftshader",
    "--autoplay-policy=no-user-gesture-required",
  ],
});

/** Mean colour of the left half and of the whole frame, worked out in a page (no image library). */
const probe = await (await browser.newContext()).newPage();
async function stats(b64) {
  return probe.evaluate(async (data) => {
    const blob = await (await fetch(`data:image/jpeg;base64,${data}`)).blob();
    const bmp = await createImageBitmap(blob);
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 36;
    const g = c.getContext("2d");
    g.drawImage(bmp, 0, 0, 64, 36);
    const px = g.getImageData(0, 0, 64, 36).data;
    const mean = (x0, x1) => {
      let r = 0,
        gg = 0,
        b = 0,
        n = 0;
      for (let y = 4; y < 36; y++)
        for (let x = x0; x < x1; x++) {
          const i = (y * 64 + x) * 4;
          r += px[i];
          gg += px[i + 1];
          b += px[i + 2];
          n++;
        }
      return [r / n, gg / n, b / n];
    };
    return { left: mean(0, 24), all: mean(0, 64) };
  }, b64);
}

const kind = (s) => {
  const [r, g, b] = s.left;
  const lum = 0.3 * r + 0.59 * g + 0.11 * b;
  if (lum < 8) return "black";
  if (r - b > 45 && r > 100) return "PAGE";
  if (lum > 235) return "white";
  return "other";
};

async function record(label, cpu, entered, run) {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  if (entered) {
    await ctx.addInitScript(() => {
      try {
        sessionStorage.setItem("aspirants:entered", "1");
      } catch {
        /* ignore */
      }
    });
  }
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu });
  const frames = [];
  cdp.on("Page.screencastFrame", (f) => {
    frames.push({ t: f.metadata.timestamp * 1000, data: f.data });
    void cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => undefined);
  });
  await run(page, async () => {
    await cdp.send("Page.startScreencast", { format: "jpeg", quality: 55, everyNthFrame: 1 });
    return performance.now() + performance.timeOrigin;
  });
  // Keep recording until the intro is playing (it may be late on a slow processor or a first visit),
  // then a little longer so its hard cut at 0.7 s is in the recording.
  const started = Date.now();
  let playing = false;
  while (Date.now() - started < 120_000) {
    const state = await page
      .evaluate(() => window.__rosterIntro?.state ?? "none")
      .catch(() => "none");
    if (state === "playing" || state === "ended") {
      playing = true;
      break;
    }
    await page.waitForTimeout(250);
  }
  if (playing) await page.waitForTimeout(1500);
  await cdp.send("Page.stopScreencast");
  await ctx.close();
  return { frames, playing };
}

let failed = false;
const report = async (label, cpu, { frames, playing }, t0) => {
  const rows = [];
  let seenIntro = false;
  let bad = 0;
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    const s = await stats(f.data);
    const k = kind(s);
    // The intro's hard cut shows a neutral grey page: the first grey frame after black frames.
    const [r, g, b] = s.left;
    const grey = Math.abs(r - g) < 12 && Math.abs(g - b) < 14 && r > 120 && r < 215;
    if (k === "other" && grey && rows.some((x) => x.kind === "black")) seenIntro = true;
    if (k === "PAGE" && !seenIntro) bad++;
    rows.push({ ms: Math.round(f.t - t0), kind: k, rgb: s.left.map(Math.round).join(",") });
    if (i < 8)
      fs.writeFileSync(
        path.join(out, `${label}_cpu${cpu}_${String(i).padStart(2, "0")}.jpg`),
        Buffer.from(f.data, "base64"),
      );
  }
  // Runs of the same kind of frame: where each starts, in ms after the start, and how many frames.
  const runs = [];
  for (const r of rows) {
    const last = runs[runs.length - 1];
    if (last && last.kind === r.kind) last.n++;
    else runs.push({ kind: r.kind, ms: r.ms, n: 1, rgb: r.rgb });
  }
  const head = runs
    .slice(0, 16)
    .map((r) => `${r.ms}ms ${r.kind}x${r.n}(${r.rgb})`)
    .join("  ");
  const verdict = bad
    ? `FAIL ${bad} frame(s) show the page before the intro`
    : seenIntro
      ? "ok (the intro's cut at 0.7 s was seen, no page frame before it)"
      : `INCONCLUSIVE (${playing ? "the cut at 0.7 s was not seen" : "the intro never started in the recording"})`;
  console.log(`${label} cpu x${cpu}: ${frames.length} frames. ${verdict}`);
  console.log(`   ${head}`);
  if (bad) failed = true;
};

for (const cpu of cpuRates) {
  // A hard load of a returning visitor: the first thing that is painted is the page's markup.
  let t0 = 0;
  await report(
    "hard",
    cpu,
    await record("hard", cpu, true, async (page, start) => {
      t0 = await start();
      await page.goto(`${base}/character/`, { waitUntil: "commit" });
    }),
    t0,
  );

  // The first visit of a browser session: the loader's curtain, then the page opens onto black.
  await report(
    "first-visit",
    cpu,
    await record("first-visit", cpu, false, async (page, start) => {
      t0 = await start();
      await page.goto(`${base}/character/`, { waitUntil: "commit" });
    }),
    t0,
  );

  // A page change from the home page, with the logo transition.
  await report(
    "nav",
    cpu,
    await record("nav", cpu, true, async (page, start) => {
      await page.goto(`${base}/`, { waitUntil: "load" });
      await page.getByRole("button", { name: /open menu/i }).click();
      await page.waitForTimeout(600);
      t0 = await start();
      await page.locator('a[href$="/character/"]:visible').first().click();
    }),
    t0,
  );
}

await browser.close();
console.log(`frames in ${out}`);
process.exit(failed ? 1 : 0);
