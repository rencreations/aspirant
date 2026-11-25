// The voices section's way in is a trigger (a clock play): it fires when the scroll reaches the first
// threshold after the white of Selena's way out, holds the page while it runs, and plays back (shorter)
// when the scroll goes back above it. This scrolls to it with a real wheel, a hard flick, page-down keys,
// the other way, against the play and by a seek, and prints for each: how long the play ran, whether the
// page moved while it was held, the biggest step of the section's value in a frame, and where it ended.
//
// Usage: node scripts/qa/home/voices-trigger.cjs [http://localhost:3000/]
const path = require("node:path");
const { createRequire } = require("node:module");
const req = createRequire(path.resolve(__dirname, "../../../apps/web/package.json"));
const { chromium } = req("@playwright/test");
(async () => {
  const base = process.argv[2] || "http://localhost:3000/";
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
  const sec = await page.evaluate(() => window.__home.sections().find((s) => s.id === "voices"));
  const start = sec.start;
  console.log("voices start", start.toFixed(2), "screens", sec.screens);
  const reset = async (S) => {
    await page.evaluate((s) => window.__home.seek(s), S);
    await page.waitForTimeout(4500);
    await page.mouse.move(720, 450);
  };
  const sampler = () =>
    page.evaluate(() => {
      window.__vs = [];
      window.__vgen = (window.__vgen || 0) + 1;
      const gen = window.__vgen;
      const t0 = performance.now();
      const tick = () => {
        if (gen !== window.__vgen) return;
        const h = window.__home,
          st = h.state();
        const p = h.plays().find((x) => x.id === "voices");
        window.__vs.push({
          t: performance.now() - t0,
          S: st.S,
          raw: st.raw,
          v: p ? p.v : null,
          active: p ? p.active : null,
          dir: p ? p.direction : null,
          fired: p ? p.fired : null,
          held: document.documentElement.classList.contains("lenis-stopped"),
        });
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  const summary = async (label) => {
    const fr = await page.evaluate(() => window.__vs);
    let playing = fr.filter((f) => f.active);
    let t0 = playing[0] ? playing[0].t : null,
      t1 = playing.length ? playing[playing.length - 1].t : null;
    let heldMove = 0;
    for (let i = 1; i < fr.length; i++)
      if (fr[i].active && fr[i - 1].active)
        heldMove = Math.max(heldMove, Math.abs(fr[i].raw - fr[i - 1].raw));
    let vJump = 0;
    for (let i = 1; i < fr.length; i++) {
      const dt = fr[i].t - fr[i - 1].t;
      if (dt < 100) vJump = Math.max(vJump, Math.abs(fr[i].v - fr[i - 1].v));
    }
    const last = fr[fr.length - 1];
    console.log(
      `${label}: play ran ${playing.length ? ((t1 - t0) / 1000).toFixed(2) + " s" : "never"} (dir ${playing[0] ? playing[0].dir : "-"}), raw moved while held ${heldMove.toFixed(3)} screens, biggest v step per frame ${vJump.toFixed(3)}, ends S=${last.S.toFixed(2)} v=${last.v.toFixed(3)} fired=${last.fired}`,
    );
  };
  const wheelTo = async (to, px, gap) => {
    const dir = to > (await page.evaluate(() => window.__home.state().raw)) ? 1 : -1;
    for (let g = 0; g < 4000; g++) {
      const s = await page.evaluate(() => window.__home.state().raw);
      if ((dir > 0 && s >= to) || (dir < 0 && s <= to)) break;
      await page.mouse.wheel(0, dir * px);
      await page.waitForTimeout(gap);
    }
  };
  const flick = async (n, px, gap) => {
    for (let i = 0; i < n; i++) {
      await page.mouse.wheel(0, px);
      await page.waitForTimeout(gap);
    }
  };
  // 1 slow down
  await reset(start - 0.8);
  await sampler();
  await wheelTo(start + 0.6, 30, 24);
  await page.waitForTimeout(2800);
  await summary("slow wheel down");
  // 2 hard flick down from the Selena exit
  await reset(start - 1.2);
  await sampler();
  await flick(14, 260, 12);
  await page.waitForTimeout(5000);
  await summary("hard flick down (14 x 260 px)");
  // 3 page down keys
  await reset(start - 0.6);
  await sampler();
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press("PageDown");
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(3000);
  await summary("page down keys");
  // 4 scroll up from the rest
  await reset(start + 1.0);
  await sampler();
  await wheelTo(start - 0.4, 40, 24);
  await page.waitForTimeout(2800);
  await summary("slow wheel up from the rest");
  // 5 hard flick up
  await reset(start + 1.0);
  await sampler();
  await flick(14, -260, 12);
  await page.waitForTimeout(5000);
  await summary("hard flick up (14 x 260 px)");
  // 6 scroll down, then wheel the other way while the play runs
  await reset(start - 0.5);
  await sampler();
  await wheelTo(start + 0.07, 30, 24);
  for (let i = 0; i < 40; i++) {
    await page.mouse.wheel(0, -60);
    await page.waitForTimeout(25);
  }
  await page.waitForTimeout(3500);
  await summary("wheel against the play");
  // 7 jump past the trigger
  await reset(start + 0.4);
  await sampler();
  await page.waitForTimeout(800);
  await summary("seek past the trigger (rest at once)");
  // 8 slow down then up in the middle of the rest, then down again
  await reset(start - 0.5);
  await sampler();
  await wheelTo(start + 0.6, 30, 24);
  await page.waitForTimeout(2600);
  await wheelTo(start - 0.3, 30, 24);
  await page.waitForTimeout(2600);
  await wheelTo(start + 0.6, 30, 24);
  await page.waitForTimeout(2600);
  await summary("down, up, down");
  await browser.close();
})();
