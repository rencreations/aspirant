/**
 * A Chromium trace of a press on Selena's page, with style invalidation tracking: how many style
 * recalculations there were, how big, and what caused them (the element and the reason). This is
 * how the cursor that restyled the whole page was found. See docs/design/performance.md.
 *
 * Usage (build first, serve `apps/web/out` on port 3190, then):
 *   node scripts/perf/trace.mjs [output trace file]
 */
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

// Playwright is a dependency of apps/web, so it is found from there.
const require = createRequire(new URL("../../apps/web/package.json", import.meta.url));
const { chromium } = await import(
  pathToFileURL(require.resolve(["@playwright", "test"].join("/"))).href
);
import fs from "fs";
import os from "os";
import path from "path";

const OUT = process.argv[2] ?? path.join(os.tmpdir(), "aspirant-trace.json");
const b = await chromium.launch({
  channel: "msedge",
  args: ["--autoplay-policy=no-user-gesture-required", "--ignore-gpu-blocklist"],
});
const c = await b.newContext({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
await c.addInitScript(() => {
  try {
    sessionStorage.setItem("aspirants:entered", "1");
  } catch {}
});
const p = await c.newPage();
const mode = () =>
  p.evaluate(() => document.querySelector("section[data-mode]")?.getAttribute("data-mode"));
await p.goto("http://127.0.0.1:3190/character/selena/", { waitUntil: "load", timeout: 240000 });
await p
  .getByRole("button", { name: "Skip" })
  .click({ timeout: 120000 })
  .catch(() => {});
for (let i = 0; i < 400 && (await mode()) !== "idle"; i++) await p.waitForTimeout(250);
await p.waitForTimeout(6000);
console.log(
  "DOM elements:",
  await p.evaluate(() => document.getElementsByTagName("*").length),
  "body children:",
  await p.evaluate(() =>
    [...document.body.children]
      .map(
        (e) =>
          e.tagName +
          "#" +
          e.id +
          "." +
          String(e.className).slice(0, 20) +
          ":" +
          e.getElementsByTagName("*").length,
      )
      .join(" | "),
  ),
);
await b.startTracing(p, {
  path: OUT,
  categories: [
    "devtools.timeline",
    "disabled-by-default-devtools.timeline",
    "disabled-by-default-devtools.timeline.invalidationTracking",
    "blink",
  ],
});
await p.getByRole("button", { name: "About", exact: true }).click();
await p.waitForTimeout(1500);
await b.stopTracing();
await b.close();
const t = JSON.parse(fs.readFileSync(OUT, "utf8"));
const ev = t.traceEvents ?? t;
const upd = ev.filter((e) => e.name === "UpdateLayoutTree" && e.ph === "X");
console.log(
  "UpdateLayoutTree events:",
  upd.length,
  "total ms",
  (upd.reduce((s, e) => s + e.dur, 0) / 1000).toFixed(0),
  "elementCount max",
  Math.max(...upd.map((e) => e.args?.elementCount ?? 0)),
);
const big = upd
  .sort((a, b) => b.dur - a.dur)
  .slice(0, 5)
  .map((e) => `${(e.dur / 1000).toFixed(1)}ms/${e.args?.elementCount}el`);
console.log("slowest:", big.join("  "));
const inval = ev.filter(
  (e) => e.name === "StyleRecalcInvalidationTracking" || e.name === "ScheduleStyleRecalculation",
);
const by = new Map();
for (const e of inval) {
  const a = e.args?.data ?? {};
  const k = `${e.name === "ScheduleStyleRecalculation" ? "sched" : "inval"}|${a.reason ?? ""}|${a.nodeName ?? ""}|${(a.selectorPart ?? a.extraData ?? a.invalidatedSelectorId ?? "").toString().slice(0, 50)}`;
  by.set(k, (by.get(k) ?? 0) + 1);
}
console.log("top invalidation reasons:");
for (const [k, n] of [...by].sort((a, b) => b[1] - a[1]).slice(0, 14))
  console.log(String(n).padStart(6), k);
