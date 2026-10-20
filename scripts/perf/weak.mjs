/**
 * The weak browser. Plays Selena's page the way a visitor does (boot, welcome, idle, then a press,
 * the page and the exit for About, Skills and Gallery) in a browser made slow on purpose, and
 * prints the frame rate and the slowest frames of each step. See docs/design/performance.md.
 *
 * Usage (build first, serve `apps/web/out`, then):
 *   FULL=1 node scripts/perf/weak.mjs <base url> <gpu|soft> <cpu slowdown> <width> <height> <dpr> [route]
 *   FULL=1 node scripts/perf/weak.mjs http://127.0.0.1:3190 gpu 4 1366 768 1
 *   FULL=1 node scripts/perf/weak.mjs http://127.0.0.1:3190 soft 4 1366 768 1 "character/selena/?quality=lite"
 *
 * `soft` turns the GPU and the video acceleration off (every frame is decoded and composed by the
 * processor). Without FULL=1 the loading screen is skipped. Needs Microsoft Edge (H.264).
 */
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

// Playwright is a dependency of apps/web, so it is found from there.
const require = createRequire(new URL("../../apps/web/package.json", import.meta.url));
const playwright = await import(
  pathToFileURL(require.resolve(["@playwright", "test"].join("/"))).href
);
const { chromium } = playwright.default ?? playwright;
const [
  ,
  ,
  base = "http://127.0.0.1:3190",
  mode = "soft",
  throttle = "4",
  w = "1366",
  h = "768",
  dpr = "1",
  route = "character/selena/",
] = process.argv;
const args = ["--autoplay-policy=no-user-gesture-required", "--ignore-gpu-blocklist"];
if (mode === "soft")
  args.push("--disable-gpu", "--disable-gpu-compositing", "--disable-accelerated-video-decode");
const b = await chromium.launch({ channel: "msedge", args });
const c = await b.newContext({
  viewport: { width: Number(w), height: Number(h) },
  deviceScaleFactor: Number(dpr),
});
await c.addInitScript(() => {
  window.__frames = [];
  window.__loaf = [];
  window.__media = [];
  for (const name of ["load", "play", "pause"]) {
    const orig = HTMLMediaElement.prototype[name];
    HTMLMediaElement.prototype[name] = function (...a) {
      const t = performance.now();
      const r = orig.apply(this, a);
      const d = performance.now() - t;
      if (d > 20)
        window.__media.push(
          `${name} ${Math.round(d)}ms ${(this.currentSrc || this.src || "").split("/").slice(-2).join("/").slice(0, 28)}`,
        );
      return r;
    };
  }
  const setter = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "src");
  Object.defineProperty(HTMLMediaElement.prototype, "src", {
    ...setter,
    set(v) {
      const t = performance.now();
      setter.set.call(this, v);
      const d = performance.now() - t;
      if (d > 20) window.__media.push(`src= ${Math.round(d)}ms`);
    },
  });
  const ct = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "currentTime");
  Object.defineProperty(HTMLMediaElement.prototype, "currentTime", {
    ...ct,
    set(v) {
      const t = performance.now();
      ct.set.call(this, v);
      const d = performance.now() - t;
      if (d > 20) window.__media.push(`currentTime= ${Math.round(d)}ms`);
    },
  });
  let last = performance.now();
  const loop = (t) => {
    window.__frames.push(t - last);
    last = t;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries())
        window.__loaf.push({
          d: Math.round(e.duration),
          blk: Math.round(e.blockingDuration),
          render: Math.round(e.startTime + e.duration - e.renderStart),
          sl: Math.round(e.startTime + e.duration - e.styleAndLayoutStart),
          s: e.scripts
            .map((x) => `${x.invoker}|${x.sourceFunctionName}|${Math.round(x.duration)}`)
            .slice(0, 3),
        });
    }).observe({ type: "long-animation-frame", buffered: true });
  } catch {}
});
const p = await c.newPage();
const cdp = await c.newCDPSession(p);
if (Number(throttle) > 1)
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: Number(throttle) });
const mode_ = () =>
  p.evaluate(() => document.querySelector("section[data-mode]")?.getAttribute("data-mode"));
const t0 = Date.now();
await p.goto(base + "/" + route, { waitUntil: "load", timeout: 240000 });
// boot: measure frames while the loading screen runs
const boot = await (async () => {
  for (
    let i = 0;
    i < 1200 &&
    !(await p
      .getByRole("button", { name: "Skip" })
      .isVisible()
      .catch(() => false)) &&
    (await mode_()) !== "idle";
    i++
  )
    await p.waitForTimeout(250);
  return (Date.now() - t0) / 1000;
})();
const stat = async (label) => {
  const r = await p.evaluate(() => {
    const f = window.__frames.slice().sort((a, b) => a - b);
    const n = f.length;
    const tot = window.__frames.reduce((a, x) => a + x, 0) / 1000;
    const q = (x) => f[Math.floor(n * x)] ?? 0;
    const out = {
      fps: n / tot,
      p50: q(0.5),
      p95: q(0.95),
      p99: q(0.99),
      max: f[n - 1] ?? 0,
      over50: f.filter((x) => x > 50).length,
      loaf: window.__loaf.slice(),
    };
    window.__frames.length = 0;
    window.__loaf.length = 0;
    return out;
  });
  console.log(
    label.padEnd(22),
    `fps ${r.fps.toFixed(1).padStart(5)} p50 ${r.p50.toFixed(0)} p95 ${r.p95.toFixed(0)} p99 ${r.p99.toFixed(0)} max ${r.max.toFixed(0)} >50ms:${r.over50}`,
    r.loaf.filter((x) => x.d > 100).length
      ? `LoAF>100: ${r.loaf
          .filter((x) => x.d > 100)
          .map((x) => x.d)
          .join(",")}`
      : "",
  );
  for (const x of r.loaf.filter((y) => y.d > (label.startsWith("boot") ? 150 : 400)))
    console.log("      big frame", x.d, "render", x.render, "style+layout", x.sl, x.s.join(" ; "));
};
console.log(
  `mode ${mode} throttle ${throttle}x viewport ${w}x${h}@${dpr}; boot screen/skip visible after ${boot.toFixed(1)}s`,
);
await stat("boot (incl. loading)");
await p
  .getByRole("button", { name: "Skip" })
  .click({ timeout: 120000 })
  .catch(() => {});
for (let i = 0; i < 400 && (await mode_()) !== "idle"; i++) await p.waitForTimeout(250);
await p.waitForTimeout(1500);
await stat("welcome->idle");
await p.waitForTimeout(6000);
await stat("idle 6s");
for (const name of ["About", "Skills", "Gallery"]) {
  await p.getByRole("button", { name, exact: true }).click();
  await p.waitForTimeout(900);
  await stat(`${name} press 0.9s`);
  for (let i = 0; i < 300 && (await mode_()) !== "page"; i++) await p.waitForTimeout(200);
  await p.waitForTimeout(4000);
  await stat(`${name} page 4s`);
  await p.getByRole("button", { name: "Back", exact: true }).click();
  for (let i = 0; i < 400 && (await mode_()) !== "idle"; i++) await p.waitForTimeout(200);
  await p.waitForTimeout(1500);
  await stat(`${name} back`);
}
console.log(
  "slow media calls (>20ms, throttled):",
  JSON.stringify(await p.evaluate(() => window.__media)),
);
const vids = await p.evaluate(() =>
  [...document.querySelectorAll("section video")]
    .filter((v) => v.getAttribute("src"))
    .map((v) => `${v.src.slice(0, 5)}${v.videoWidth}`),
);
console.log("videos attached at end:", vids.join(" "));
await b.close();
