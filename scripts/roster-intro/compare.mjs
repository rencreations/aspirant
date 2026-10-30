// Frame comparison for the roster intro.
//
//   node scripts/roster-intro/compare.mjs [--times 0.7,1.0,...] [--base http://localhost:3100]
//        [--out DIR] [--ref C:\path\transitions.mov] [--rows 3] [--w 1920] [--h 1080]
//
// For each time it opens /character/?introT=<t> in Chrome (the page freezes the intro at t), takes
// a 1920x1080 screenshot, cuts the same moment out of the reference recording with ffmpeg and
// writes a side by side image (reference on the left, the site on the right). It also writes sheets
// of `--rows` pairs under one another, so a handful of times can be read in one picture.
// Playwright comes from apps/web. Needs Chrome and ffmpeg on the PATH.
import { execFileSync } from "node:child_process";
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

const DEFAULT_TIMES = [
  0.7, 1.0, 1.4, 1.55, 1.7, 1.9, 2.1, 2.3, 2.5, 2.7, 2.95, 3.1, 3.2, 3.3, 3.45, 3.6, 3.8, 4.1,
];
const times = (args.times ? args.times.split(",").map(Number) : DEFAULT_TIMES).filter((t) =>
  Number.isFinite(t),
);
const base = (args.base || "http://localhost:3100").replace(/\/$/, "");
const out = args.out || path.join(os.tmpdir(), "roster-intro-compare");
const ref = args.ref || "C:\\Users\\muham\\Videos\\transitions.mov";
const rows = Number(args.rows || 3);
const W = Number(args.w || 1920);
const H = Number(args.h || 1080);
fs.mkdirSync(out, { recursive: true });

const tag = (t) => t.toFixed(3).replace(".", "_");

function refFrame(t, file) {
  execFileSync(
    "ffmpeg",
    [
      "-v",
      "error",
      "-y",
      "-ss",
      String(t),
      "-i",
      ref,
      "-frames:v",
      "1",
      "-vf",
      `scale=${W}:${H}`,
      file,
    ],
    { stdio: "inherit" },
  );
}

function sideBySide(a, b, file) {
  // The reference is on the left, the site on the right.
  execFileSync(
    "ffmpeg",
    [
      "-v",
      "error",
      "-y",
      "-i",
      a,
      "-i",
      b,
      "-filter_complex",
      "[0]scale=960:-1[l];[1]scale=960:-1[r];[l][r]hstack",
      "-frames:v",
      "1",
      file,
    ],
    { stdio: "inherit" },
  );
}

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
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await ctx.addInitScript(() => {
  try {
    sessionStorage.setItem("aspirants:entered", "1");
  } catch {
    /* ignore */
  }
});
const page = await ctx.newPage();
page.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning")
    console.log("[page]", m.type(), m.text().slice(0, 300));
});
page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 300)));
await page.goto(`${base}/character/?introDebug&introT=0.01`, { waitUntil: "load" });
await page.waitForFunction(
  () => window.__rosterIntro && window.__rosterIntro.state !== "loading",
  null,
  { timeout: 60000 },
);

const pairs = [];
for (const t of times) {
  await page.evaluate((x) => window.__rosterIntro.seek(x), t);
  await page.waitForTimeout(60);
  const site = path.join(out, `site_${tag(t)}.png`);
  const ref1 = path.join(out, `ref_${tag(t)}.png`);
  await page.screenshot({ path: site });
  refFrame(t, ref1);
  const pair = path.join(out, `cmp_${tag(t)}.png`);
  sideBySide(ref1, site, pair);
  pairs.push(pair);
}
await browser.close();

// Sheets of a few pairs each.
for (let i = 0; i < pairs.length; i += rows) {
  const group = pairs.slice(i, i + rows);
  const file = path.join(out, `sheet_${String(i / rows).padStart(2, "0")}.png`);
  const inputs = group.flatMap((p) => ["-i", p]);
  execFileSync(
    "ffmpeg",
    [
      "-v",
      "error",
      "-y",
      ...inputs,
      "-filter_complex",
      `vstack=inputs=${group.length}`,
      "-frames:v",
      "1",
      file,
    ],
    { stdio: "inherit" },
  );
  console.log(file);
}
console.log(`pairs in ${out}`);
