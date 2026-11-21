// Which requests are still pending after N seconds, with the e2e CORS route in place?
// node pending.cjs <url> [seconds=25] [withRoute=1]
const path = require("node:path");
const { createRequire } = require("node:module");
const req = createRequire(path.resolve(__dirname, "../../apps/web/package.json"));
const { chromium } = req("@playwright/test");
const [url, secs = "25", withRoute = "1"] = process.argv.slice(2);
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  if (withRoute === "1") {
    await ctx.route("https://s3.aspirant.cc/**", async (route) => {
      try {
        const response = await route.fetch();
        await route.fulfill({
          response,
          headers: { ...response.headers(), "access-control-allow-origin": "*" },
        });
      } catch {
        await route.abort("failed");
      }
    });
  }
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    try {
      sessionStorage.setItem("aspirants:entered", "1");
      sessionStorage.setItem("aspirants:intro", "off");
    } catch {}
  });
  const pending = new Map();
  page.on("request", (r) => pending.set(r, Date.now()));
  page.on("requestfinished", (r) => pending.delete(r));
  page.on("requestfailed", (r) => pending.delete(r));
  let loaded = false;
  let t0 = Date.now();
  page.on("load", () => {
    loaded = true;
    console.log("load fired at", ((Date.now() - t0) / 1000).toFixed(1), "s");
  });
  t0 = Date.now();
  await page.goto(url, { waitUntil: "commit", timeout: 60000 });
  await page.waitForTimeout(+secs * 1000);
  console.log(`load event after ${secs}s: ${loaded} | pending requests: ${pending.size}`);
  const byHost = {};
  for (const [r] of pending) {
    const u = new URL(r.url());
    const key =
      u.host + u.pathname.split("/").slice(0, 4).join("/") + " [" + r.resourceType() + "]";
    byHost[key] = (byHost[key] || 0) + 1;
  }
  console.log(JSON.stringify(byHost, null, 1).slice(0, 1500));
  await browser.close();
})().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});
