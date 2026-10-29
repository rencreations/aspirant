// Screenshots of the full-screen menu with each page hovered, at several screen sizes.
//
//   node scripts/qa/probes/menu-shots.cjs
//   VPS='[["phone",390,844,1],["wide",2560,1080]]' HOVER=0,3 R=/story/ node scripts/qa/probes/menu-shots.cjs
//
// VPS is a JSON list of [name, width, height, touch]. HOVER is the list of menu items (0 to 4).
// Files are written to OUT as menu-<name>-<item>.png.
const path = require("node:path");
const { BASE, OUT, launch, context } = require("./lib.cjs");

const viewports = JSON.parse(process.env.VPS || '[["d1440",1440,900],["d1920",1920,1080]]');
const hovers = (process.env.HOVER || "0,1,2,3,4").split(",").map(Number);

(async () => {
  const browser = await launch();
  for (const [name, width, height, touch] of viewports) {
    const ctx = await context(browser, {
      viewport: { width, height },
      hasTouch: Boolean(touch),
      isMobile: Boolean(touch),
    });
    const page = await ctx.newPage();
    await page.goto(BASE + (process.env.R || "/"), { waitUntil: "load" });
    await page.waitForTimeout(2500);
    await page.getByRole("button", { name: /open menu/i }).click();
    await page.waitForTimeout(1800);
    for (const i of hovers) {
      const link = page.locator('nav[aria-label="Menu"] li').nth(i).locator("a");
      if (!touch) await link.hover({ force: true });
      await page.waitForTimeout(1000);
      const file = path.join(OUT, `menu-${name}-${i}.png`);
      await page.screenshot({ path: file });
      console.log(file);
    }
    await ctx.close();
  }
  await browser.close();
})();
