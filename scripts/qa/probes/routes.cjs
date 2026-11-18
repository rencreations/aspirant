// What does each route look like a few seconds after it opens? Prints the state of <html>
// (data-gate), how many animations run, canvases, playing videos and the
// scroll position, with the console errors.
//
//   node scripts/qa/probes/routes.cjs
//   BASE=https://aspirant.cc PROFILE=phone SLOW=1 WAIT=60 ROUTES=/,/character/vexana/ node scripts/qa/probes/routes.cjs
//
// SLOW is megabits a second. On Git Bash put MSYS_NO_PATHCONV=1 in front, or "/" becomes a path.
//
// A fresh context has no saved answer, so the home page ("/") would stop at its tap gate for ever.
// Every context here switches the intros off (`aspirants:intro` = "off"), so the home opens at once
// like every other route. INTRO=1 keeps the home's own opening instead: the probe presses the tap gate
// and prints `home` (the phase) and the seconds the opening took (`tap`).
const { BASE, PHONE, launch, throttle, tapHome } = require("./lib.cjs");

const routes = (
  process.env.ROUTES ||
  "/,/about/,/story/,/story/part-01/,/character/,/character/vexana/,/character/guinevere/,/character/selena/,/character/obsidia/,/character/ruby/,/character/lesley/,/character/fanny/,/collection/"
).split(",");
const wait = Number(process.env.WAIT || 12);

(async () => {
  const browser = await launch();
  for (const route of routes) {
    const ctx = await browser.newContext(
      process.env.PROFILE === "phone" ? PHONE : { viewport: { width: 1440, height: 900 } },
    );
    if (!process.env.INTRO) {
      await ctx.addInitScript(() => {
        try {
          sessionStorage.setItem("aspirants:intro", "off");
        } catch {
          /* ignore */
        }
      });
    }
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message.slice(0, 80)));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text().slice(0, 80));
    });
    if (process.env.SLOW) await throttle(ctx, page, Number(process.env.SLOW));
    await page.goto(BASE + route, { waitUntil: "commit" });
    const tapped = process.env.INTRO && route === "/" ? await tapHome(page, wait * 1000) : null;
    let last = null;
    for (let i = 0; i < wait; i += 1) {
      await page.waitForTimeout(1000);
      last =
        (await page
          .evaluate(() => ({
            gate: document.documentElement.dataset.gate || "",
            animations: document.getAnimations().length,
            canvases: document.querySelectorAll("canvas").length,
            videosPlaying: [...document.querySelectorAll("video")].filter((v) => !v.paused).length,
            scrollY: Math.round(scrollY),
          }))
          .catch(() => null)) ?? last;
    }
    console.log(
      route.padEnd(24),
      JSON.stringify(last),
      tapped ? `tap ${JSON.stringify(tapped)}` : "",
      "errors",
      errors.length,
      errors[0] || "",
    );
    await ctx.close();
  }
  await browser.close();
})();
