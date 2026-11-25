// Walks a stretch of the home with a real input and prints, section by section, what changed too fast:
// the scene's top speed, every frame in which it stepped more than STEP screens, every actor that was
// drawn and then was not, and every block of words whose opacity moved more than 0.35 in one frame.
// It also prints how far the page ran ahead of the scene.
//
// Usage: node scripts/qa/home/flick-walk.cjs <base> <fromS> <toS> <mode> [w h]
// mode: "flick" (a hard wheel: 400 px every 16 ms), "brisk" (120 px every 40 ms), "slow" (60 px
// every 80 ms), "touch" (hard touch flings by the browser's own gesture, phone size), "flip" (a hard
// flick down, then up halfway, then down again). EVENTS=1 lists every event, not only a count.
// VIDEO=<dir> records the run; SHEET=<fps> then cuts it into contact sheets of 4 by 4 frames (ffmpeg).
const path = require("node:path");
const { createRequire } = require("node:module");
const req = createRequire(path.resolve(__dirname, "../../../apps/web/package.json"));
const { chromium } = req("@playwright/test");

const STEP = Number(process.env.STEP || 0.12);

(async () => {
  const [base, fromArg, toArg, mode = "flick", wArg, hArg] = process.argv.slice(2);
  const fromS = Number(fromArg);
  const toS = Number(toArg);
  const touch = mode === "touch";
  const w = Number(wArg || (touch ? 390 : 1440));
  const h = Number(hArg || (touch ? 844 : 900));
  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
    args: ["--ignore-gpu-blocklist"],
  });
  const videoDir = process.env.VIDEO || null;
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    ...(touch ? { hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : {}),
    ...(videoDir ? { recordVideo: { dir: videoDir, size: { width: w, height: h } } } : {}),
  });
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
    timeout: 180000,
  });
  const sections = await page.evaluate(() => window.__home.sections());
  const down = toS > fromS;
  await page.evaluate((s) => window.__home.seek(s), fromS);
  await page.waitForTimeout(6000);
  await page.mouse.move(w / 2, h / 2);
  await page.evaluate(() => {
    window.__fr = [];
    const words = [...document.querySelectorAll("[data-home-section]")].map((el) => ({
      id: el.getAttribute("data-home-section"),
      el: el.querySelector("[data-home-content]"),
      slot: el,
    }));
    const t0 = performance.now();
    const tick = () => {
      const st = window.__home.state();
      const op = {};
      for (const w of words) {
        if (!w.el) continue;
        const a = Number(getComputedStyle(w.slot).opacity);
        const b = Number(getComputedStyle(w.el).opacity);
        // Words that are off the screen count as gone, whatever their opacity.
        const r = w.el.getBoundingClientRect();
        const seen =
          r.bottom > innerHeight * 0.05 &&
          r.top < innerHeight * 0.95 &&
          r.right > 0 &&
          r.left < innerWidth &&
          r.height > 0;
        op[w.id] = seen ? Math.round(a * b * 100) / 100 : 0;
      }
      window.__fr.push({
        t: performance.now() - t0,
        S: st.S,
        raw: st.raw,
        real: window.scrollY / st.unit,
        held: document.documentElement.classList.contains("lenis-stopped"),
        actors: st.actors.filter((a) => a.visible).map((a) => a.name),
        op,
      });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const real = () => page.evaluate(() => window.scrollY / window.__home.state().unit);
  const S = () => page.evaluate(() => window.__home.state().S);
  const wheelTo = async (target, px, gap) => {
    const sign = target > (await real()) ? 1 : -1;
    for (let i = 0; i < 4000; i++) {
      const s = await S();
      if ((sign > 0 && s >= target) || (sign < 0 && s <= target)) break;
      await page.mouse.wheel(0, sign * px);
      await page.waitForTimeout(gap);
    }
  };
  if (mode === "flick") await wheelTo(toS, 400, 16);
  else if (mode === "brisk") await wheelTo(toS, 120, 40);
  else if (mode === "slow") await wheelTo(toS, 60, 80);
  else if (mode === "flip") {
    const mid = fromS + (toS - fromS) * 0.6;
    await wheelTo(mid, 400, 16);
    await wheelTo(fromS + (toS - fromS) * 0.3, 400, 16);
    await wheelTo(toS, 400, 16);
  } else if (touch) {
    const cdp = await ctx.newCDPSession(page);
    for (let i = 0; i < 200; i++) {
      const s = await S();
      if ((down && s >= toS) || (!down && s <= toS)) break;
      // A fast swipe: the finger travels 70 percent of the screen in about 80 ms and lets go, so the
      // browser flings the page on by itself.
      const x = Math.round(w / 2);
      const y0 = Math.round(h * (down ? 0.85 : 0.15));
      const dy = (down ? -1 : 1) * Math.round(h * 0.7);
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x, y: y0 }],
      });
      for (let k = 1; k <= 6; k++) {
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x, y: y0 + (dy * k) / 6 }],
        });
        await page.waitForTimeout(14);
      }
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await page.waitForTimeout(120);
    }
  }
  await page.waitForTimeout(3000);
  const fr = await page.evaluate(() => window.__fr);
  const sectionAt = (s) => {
    let id = sections[0].id;
    for (const x of sections) if (s >= x.start) id = x.id;
    return id;
  };
  const per = new Map();
  const bucket = (id) => {
    if (!per.has(id)) per.set(id, { top: 0, steps: 0, vanish: [], words: [], frames: 0 });
    return per.get(id);
  };
  let lead = 0;
  const events = [];
  for (let i = 1; i < fr.length; i++) {
    const a = fr[i - 1];
    const b = fr[i];
    const dt = (b.t - a.t) / 1000;
    const id = sectionAt(b.S);
    const p = bucket(id);
    p.frames++;
    lead = Math.max(lead, Math.abs(b.real - b.S));
    // The speed over the last 50 ms or more (a headless browser's frame times jitter).
    let j = i - 1;
    while (j > 0 && b.t - fr[j].t < 50) j--;
    const span = (b.t - fr[j].t) / 1000;
    if (span > 0 && span < 0.2) p.top = Math.max(p.top, Math.abs(b.S - fr[j].S) / span);
    if (
      process.env.FAST &&
      span > 0 &&
      span < 0.2 &&
      Math.abs(b.S - fr[j].S) / span > Number(process.env.FAST)
    )
      events.push(
        `S=${b.S.toFixed(3)} speed ${((b.S - fr[j].S) / span).toFixed(1)} dt ${(dt * 1000).toFixed(1)}ms raw ${a.raw.toFixed(3)}->${b.raw.toFixed(3)} real ${b.real.toFixed(3)} held ${b.held}`,
      );
    if (Math.abs(b.S - a.S) > STEP) {
      p.steps++;
      events.push(
        `S=${b.S.toFixed(2)} step ${(b.S - a.S).toFixed(2)} in ${(dt * 1000).toFixed(0)}ms`,
      );
    }
    for (const name of a.actors)
      if (!b.actors.includes(name)) {
        p.vanish.push(`${name}@${b.S.toFixed(2)}`);
        events.push(`S=${b.S.toFixed(2)} ${name} hidden`);
      }
    for (const k of Object.keys(b.op)) {
      if (a.op[k] === undefined) continue;
      if (Math.abs(b.op[k] - a.op[k]) > 0.35) {
        p.words.push(`${k} ${a.op[k]}->${b.op[k]}@${b.S.toFixed(2)}`);
        events.push(`S=${b.S.toFixed(2)} words of ${k} ${a.op[k]} -> ${b.op[k]}`);
      }
    }
  }
  const last = fr[fr.length - 1];
  const t = (fr[fr.length - 1].t / 1000).toFixed(1);
  console.log(
    `${mode} ${w}x${h} ${fromS} -> ${toS}: ${fr.length} frames in ${t} s, ends S=${last.S.toFixed(2)} real=${last.real.toFixed(2)}, most the page led the scene ${lead.toFixed(2)} screens`,
  );
  for (const [id, p] of per) {
    console.log(
      `  ${id.padEnd(9)} frames ${String(p.frames).padStart(4)} top ${p.top.toFixed(2)} s/s, steps>${STEP} ${p.steps}, hidden ${p.vanish.length}${p.vanish.length ? " " + p.vanish.slice(0, 6).join(" ") : ""}, words ${p.words.length}${p.words.length ? " " + p.words.slice(0, 4).join(" ") : ""}`,
    );
  }
  if (process.env.EVENTS) console.log(events.join("\n"));
  await browser.close();
})();
