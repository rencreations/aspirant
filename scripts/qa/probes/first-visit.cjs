// The first visit on a slow connection, second by second: is the cover or the loading screen up
// (never the plain page), how many bytes have arrived, when does "Enter now" appear, when does
// the page open. Screenshots go to OUT (default: the temp folder).
//
//   MSYS_NO_PATHCONV=1 BASE=https://aspirant.cc R=/character/vexana/ SLOW=1 WAIT=90 node scripts/qa/probes/first-visit.cjs
//
// R is the route, SLOW the megabits a second (default 1), LAT the latency in ms (default 300).
const path = require("node:path");
const { BASE, OUT, PHONE, launch, throttle } = require("./lib.cjs");

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext(PHONE);
  const page = await ctx.newPage();
  const cdp = await throttle(
    ctx,
    page,
    Number(process.env.SLOW || 1),
    Number(process.env.LAT || 300),
  );
  let bytes = 0;
  cdp.on("Network.dataReceived", (e) => {
    bytes += e.dataLength;
  });
  const t0 = Date.now();
  await page.goto(BASE + (process.env.R || "/"), { waitUntil: "commit" });
  for (let i = 0; i < Number(process.env.WAIT || 90); i += 3) {
    await page.waitForTimeout(3000);
    const s = await page
      .evaluate(() => {
        const overlay = document.querySelector('[data-overlay="transition"]');
        return {
          gate: document.documentElement.dataset.gate || "",
          overlay: overlay?.getAttribute("data-active"),
          shellInert: document.getElementById("site-shell")?.inert,
          enterNow: [...document.querySelectorAll("button")].some((b) =>
            /enter now/i.test(b.innerText),
          ),
          animations: document.getAnimations().length,
        };
      })
      .catch((e) => ({ error: e.message.slice(0, 40) }));
    const sec = Math.round((Date.now() - t0) / 1000);
    await page
      .screenshot({ path: path.join(OUT, `first-visit-${sec}s.png`) })
      .catch(() => undefined);
    console.log(`${String(sec).padStart(3)}s ${(bytes / 1e6).toFixed(1)}MB`, JSON.stringify(s));
  }
  await browser.close();
})();
