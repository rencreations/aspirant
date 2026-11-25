// Scrolls with a real wheel through a stretch of the home and prints what changes suddenly: an actor
// that was drawn and is not, the words of the funny section going from 1 to 0 in a frame, the scene
// jumping. With RANGES it also prints the top speed of the scene inside each range (a section's
// `topSpeed`, kernel/speed.ts) and how long the visitor was in it.
//
// Usage: [BLIND=70] [RANGES="40.8-41.9,42.07-44.31"] [TRACE="41.3-42.7" TRACE_GAP=40]
//   node scripts/qa/home/speed-track.cjs <base> <fromS> <toS> <px per wheel> <gap ms> [down|up]
// BLIND=N sends N wheel events without reading the page in between (nothing idles). A frame's speed
// can read high when the headless browser stalls and then draws two frames close together: look at the
// time spent in a range, not at one frame.
// Scrolls with a real wheel through a stretch at a given speed and prints, per frame where something
// big changes: the scene's S, the duo's and Tetra's visibility, and the funny words' opacity.
const path = require("node:path");
const { createRequire } = require("node:module");
const req = createRequire(path.resolve(__dirname, "../../../apps/web/package.json"));
const { chromium } = req("@playwright/test");
(async () => {
  const [base, fromS, toS, px, gap, dirArg] = [
    process.argv[2],
    Number(process.argv[3]),
    Number(process.argv[4]),
    Number(process.argv[5]),
    Number(process.argv[6] || 16),
    process.argv[7] || "down",
  ];
  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
    args: ["--ignore-gpu-blocklist"],
  });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => {
    sessionStorage.setItem("aspirants:entered", "1");
    localStorage.setItem(
      "aspirants:consent",
      JSON.stringify({ choice: "rejected", at: Date.now() }),
    );
    sessionStorage.setItem("aspirants:intro", "off");
  });
  const page = await ctx.newPage();
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__home && window.__home.state().open, null, {
    timeout: 120000,
  });
  await page.evaluate((s) => window.__home.seek(s), dirArg === "down" ? fromS : toS);
  await page.waitForTimeout(5000);
  await page.mouse.move(720, 450);
  await page.evaluate(() => {
    window.__fr = [];
    const words = document.querySelector('[data-home-section="funny"] [data-home-content]');
    const chaseWords = document.querySelector('[data-home-section="chase"] [data-home-content]');
    const t0 = performance.now();
    const tick = () => {
      const h = window.__home;
      const st = h.state();
      const duo = h.peek("duo"),
        tetra = h.peek("tetra"),
        doll = h.peek("doll"),
        sb = h.peek("silverbolt");
      let duoPlaced = null;
      try {
        duoPlaced = duo && duo.state ? duo.state().placed : null;
      } catch {}
      window.__fr.push({
        t: performance.now() - t0,
        S: st.S,
        raw: st.raw,
        duo: duo ? duo.visible : null,
        tetra: tetra ? tetra.visible : null,
        doll: doll ? doll.visible : null,
        sb: sb ? sb.visible : null,
        duoY: duoPlaced ? duoPlaced.map((p) => Math.round(p.y)) : null,
        w: words ? Number(getComputedStyle(words).opacity) : null,
        sn: (() => {
          try {
            const q = h.snap();
            return (q.moving ? "M" : "-") + (q.blocked || "");
          } catch {
            return "?";
          }
        })(),
        pl: (() => {
          try {
            const c = h.plays().find((x) => x.id === "chase");
            return c ? c.zones.map((z) => z.p.toFixed(2)).join("/") : "";
          } catch {
            return "";
          }
        })(),
      });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const S = () => page.evaluate(() => window.__home.state().raw);
  const sign = dirArg === "down" ? 1 : -1;
  const target = dirArg === "down" ? toS : fromS;
  const blind = Number(process.env.BLIND || 0);
  if (blind) {
    for (let g = 0; g < blind; g++) {
      await page.mouse.wheel(0, sign * px);
      await page.waitForTimeout(gap);
    }
  }
  for (let g = 0; !blind && g < 3000; g++) {
    const s = await S();
    if ((sign > 0 && s >= target) || (sign < 0 && s <= target)) break;
    await page.mouse.wheel(0, sign * px);
    await page.waitForTimeout(gap);
  }
  await page.waitForTimeout(2500);
  const fr = await page.evaluate(() => window.__fr);
  console.log("frames", fr.length);
  // Sudden: a visible flag goes true->false while on screen, or the words' opacity drops over 0.3 in a frame, or S jumps over 0.3.
  let prev = null;
  const rows = [];
  for (const f of fr) {
    if (prev) {
      const ev = [];
      for (const k of ["duo", "tetra", "doll", "sb"]) if (prev[k] && !f[k]) ev.push(k + " hidden");
      if (prev.w !== null && f.w !== null && Math.abs(f.w - prev.w) > 0.3)
        ev.push(`words ${prev.w.toFixed(2)}->${f.w.toFixed(2)}`);
      if (Math.abs(f.S - prev.S) > 0.3) ev.push(`S jump ${(f.S - prev.S).toFixed(2)}`);
      if (ev.length)
        rows.push(
          `t=${f.t.toFixed(0)}ms S=${f.S.toFixed(2)} raw=${f.raw.toFixed(2)} duoY=${JSON.stringify(f.duoY)} ${ev.join(", ")}`,
        );
    }
    prev = f;
  }
  console.log(rows.length ? rows.slice(0, 30).join("\n") : "no sudden changes");
  let worst = 0;
  for (let i = 1; i < fr.length; i++) {
    const dt = (fr[i].t - fr[i - 1].t) / 1000;
    if (dt > 0 && dt < 0.1) worst = Math.max(worst, Math.abs(fr[i].S - fr[i - 1].S) / dt);
  }
  console.log(
    "top scene speed over the run:",
    worst.toFixed(2),
    "screens/s; ends S",
    fr[fr.length - 1].S.toFixed(2),
  );
  if (process.env.TRACE) {
    const [a, b] = process.env.TRACE.split("-").map(Number);
    let lastT = -1e9;
    for (const f of fr) {
      if (
        f.raw >= a &&
        f.raw <= b &&
        f.t - lastT >= (process.env.TRACE_GAP ? Number(process.env.TRACE_GAP) : 40)
      ) {
        lastT = f.t;
        console.log(
          `  t=${f.t.toFixed(0)} raw=${f.raw.toFixed(3)} S=${f.S.toFixed(3)} snap=${f.sn} zones=${f.pl}`,
        );
      }
    }
  }
  const ranges = (process.env.RANGES || "")
    .split(",")
    .filter(Boolean)
    .map((r) => r.split("-").map(Number));
  for (const [lo, hi] of ranges) {
    let topS = 0,
      topRaw = 0,
      n = 0,
      t0 = null,
      t1 = null;
    for (let i = 1; i < fr.length; i++) {
      const dt = (fr[i].t - fr[i - 1].t) / 1000;
      if (!(dt > 0) || dt > 0.1) continue;
      if (fr[i].raw >= lo && fr[i].raw <= hi && fr[i - 1].raw >= lo && fr[i - 1].raw <= hi) {
        topRaw = Math.max(topRaw, Math.abs(fr[i].raw - fr[i - 1].raw) / dt);
        topS = Math.max(topS, Math.abs(fr[i].S - fr[i - 1].S) / dt);
        n++;
        if (t0 === null) t0 = fr[i].t;
        t1 = fr[i].t;
      }
    }
    let at = -1,
      best = 0;
    for (let i = 1; i < fr.length; i++) {
      const dt = (fr[i].t - fr[i - 1].t) / 1000;
      if (!(dt > 0) || dt > 0.1) continue;
      if (fr[i].raw >= lo && fr[i].raw <= hi && fr[i - 1].raw >= lo && fr[i - 1].raw <= hi) {
        const v = Math.abs(fr[i].raw - fr[i - 1].raw) / dt;
        if (v > best) {
          best = v;
          at = i;
        }
      }
    }
    if (at > 0)
      console.log(
        "around the top:",
        fr
          .slice(Math.max(0, at - 3), at + 3)
          .map((f) => `t=${f.t.toFixed(0)} S=${f.S.toFixed(3)} raw=${f.raw.toFixed(3)}`)
          .join(" | "),
      );
    console.log(
      `range ${lo}-${hi}: ${n} frames, top scene raw speed ${topRaw.toFixed(2)}, top shown speed ${topS.toFixed(2)} screens/s, time inside ${t0 === null ? 0 : ((t1 - t0) / 1000).toFixed(2)} s`,
    );
  }
  await browser.close();
})();
