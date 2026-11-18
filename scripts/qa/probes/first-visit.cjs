// The first visit on a slow connection, second by second: is the cover or the loading screen up
// (never the plain page), how many bytes have arrived, what the note under the bar says (the real progress),
// when does the page open. It never opens with a part of the page: there is no "Enter now". Screenshots go to OUT (default: the temp folder).
//
// On the home page (R=/) the first visit is the drone loader: the cover, the loading screen with the
// real bar, then the tap gate ("Touch anywhere to continue"). This probe does NOT switch the intro off,
// it presses the gate when it appears (once) and goes on measuring until the page is open. The line
// of each second says the home phase (`home`), the percent the bar shows (`pct`) and, once pressed,
// the second of the press. Set NOTAP=1 to leave the gate standing (to look at it).
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
  let tappedAt = null;
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
        const boot = document.querySelector("[data-home-boot]");
        return {
          gate: document.documentElement.dataset.gate || "",
          overlay: overlay?.getAttribute("data-active"),
          home: boot?.getAttribute("data-phase") || "",
          pct:
            document
              .querySelector('[data-home-boot] [role="progressbar"]')
              ?.getAttribute("aria-valuenow") ?? "",
          shellInert: document.getElementById("site-shell")?.inert,
          enterNow: [...document.querySelectorAll("button")].some((b) =>
            /enter now/i.test(b.innerText),
          ),
          note:
            [...document.querySelectorAll("p")]
              .find((p) => /Still loading|Offline\./.test(p.textContent || ""))
              ?.textContent?.slice(0, 90) || "",
          animations: document.getAnimations().length,
        };
      })
      .catch((e) => ({ error: e.message.slice(0, 40) }));
    const sec = Math.round((Date.now() - t0) / 1000);
    await page
      .screenshot({ path: path.join(OUT, `first-visit-${sec}s.png`) })
      .catch(() => undefined);
    console.log(`${String(sec).padStart(3)}s ${(bytes / 1e6).toFixed(1)}MB`, JSON.stringify(s));
    // The home's tap gate: press it once, as a visitor does, and keep measuring until it opens.
    if (s.home === "tap" && tappedAt === null && !process.env.NOTAP) {
      await page
        .getByRole("button", { name: /touch anywhere to continue/i })
        .click({ timeout: 5000 })
        .catch(() => undefined);
      tappedAt = sec;
      console.log(`    pressed the tap gate at ${sec}s`);
    }
  }
  await browser.close();
})();
