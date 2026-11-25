// The About page's opening holds the scroll (25 Nov 2026): a visitor who scrolls while the drone
// crosses the title must not move the page, and the opening must play to its end. Then Tetra's
// entrance holds the page for one second only. Both run with the opening on, so this probe does not
// set `aspirants:intro`.
//
// Usage: BASE=http://localhost:3000 node scripts/qa/probes/about-hold.cjs
const { BASE, launch, context } = require("./lib.cjs");

(async () => {
  const browser = await launch();
  const ctx = await context(browser, { viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/about/`, { waitUntil: "domcontentloaded" });
  // The opening starts when the loading screen has gone.
  await page.waitForFunction(
    () => window.__aboutDrone && window.__aboutDrone.state().phase === "title",
    null,
    { timeout: 180000, polling: 20 },
  );
  await page.mouse.move(720, 450);
  const t0 = Date.now();
  const rows = [];
  let wheels = 0;
  while (Date.now() - t0 < 5200) {
    await page.mouse.wheel(0, 240);
    wheels++;
    const s = await page.evaluate(() => ({
      y: window.scrollY,
      phase: window.__aboutDrone.state().phase,
    }));
    rows.push({ t: Date.now() - t0, ...s });
    await page.waitForTimeout(60);
  }
  let last = "";
  for (const r of rows) {
    const line = `phase ${r.phase} y ${Math.round(r.y)}`;
    if (line !== last) console.log(`t=${(r.t / 1000).toFixed(2)} ${line}`);
    last = line;
  }
  const moved = rows.filter((r) => r.phase !== "done" && r.y > 2);
  const done = rows.find((r) => r.phase === "done");
  console.log(
    `${wheels} wheels during the opening; the page moved before the end: ${moved.length ? "YES" : "no"}; done at ${done ? (done.t / 1000).toFixed(2) + " s" : "never"}`,
  );
  // Then on down to Tetra (phase two): the page may stall at her stage for about a second, no more.
  const trace = [];
  const t1 = Date.now();
  while (Date.now() - t1 < 40000) {
    await page.mouse.wheel(0, Number(process.env.PX || 160));
    trace.push({
      t: Date.now() - t1,
      ...(await page.evaluate(() => {
        const st = window.__aboutTetra ? window.__aboutTetra.state() : null;
        return { y: window.scrollY, hold: st ? st.hold : "-", rest: st ? Math.round(st.rest) : 0 };
      })),
    });
    const tetra = await page.evaluate(() => {
      const el = document.querySelector('[data-phase="2"]');
      return el ? el.getBoundingClientRect().bottom < 0 : false;
    });
    if (tetra) break;
    await page.waitForTimeout(40);
  }
  let stallFrom = -1;
  const stalls = [];
  for (let i = 1; i < trace.length; i++) {
    const still = Math.abs(trace[i].y - trace[i - 1].y) < 1;
    if (still && stallFrom < 0) stallFrom = trace[i - 1].t;
    if (!still && stallFrom >= 0) {
      if (trace[i - 1].t - stallFrom > 150)
        stalls.push(`${((trace[i - 1].t - stallFrom) / 1000).toFixed(2)} s at y ${trace[i].y}`);
      stallFrom = -1;
    }
  }
  console.log(
    `stalls on the way down past phase two: ${stalls.length ? stalls.join(", ") : "none"}`,
  );
  let lastHold = "";
  for (const r of trace) {
    if (r.hold !== lastHold)
      console.log(`  t=${(r.t / 1000).toFixed(2)} y=${r.y} hold=${r.hold} rest=${r.rest}`);
    lastHold = r.hold;
  }
  await browser.close();
})();
