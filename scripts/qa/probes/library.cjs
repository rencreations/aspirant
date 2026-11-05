// Visits the shelf and the ten rooms of the collection at three sizes in real Chrome and reports
// console errors, failed requests, broken pictures and sideways overflow. Writes screenshots.
//
//   BASE=http://localhost:3000 OUT=D:/ren/aspirant-work/probe-library node scripts/qa/probes/library.cjs [room ...]
//
// Run it against the production build (`pnpm build`, then `pnpm start`). With no room names it
// visits all eleven pages.
const { createRequire } = require("module");
const path = require("path");
const fs = require("fs");

const req = createRequire(path.join(__dirname, "..", "..", "..", "apps", "web", "package.json"));
const { chromium } = req("@playwright/test");

const BASE = (process.env.BASE || "http://localhost:3000").replace(/\/+$/, "");
const OUT = process.env.OUT || path.join(require("os").tmpdir(), "aspirant-probes", "library");
const ROOMS = [
  "arts",
  "films",
  "music",
  "voicelines",
  "fanart",
  "comic",
  "lore",
  "design",
  "animation",
  "others",
];
const SIZES = [
  { name: "1440", width: 1440, height: 900 },
  { name: "1920", width: 1920, height: 1080 },
  { name: "390", width: 390, height: 844, mobile: true },
];

const wanted = process.argv.slice(2);
const pages = [
  { id: "shelf", url: `${BASE}/collection/` },
  ...ROOMS.map((r) => ({ id: r, url: `${BASE}/collection/${r}/` })),
].filter((p) => wanted.length === 0 || wanted.includes(p.id));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
    args: [
      "--use-gl=angle",
      "--enable-unsafe-swiftshader",
      "--autoplay-policy=no-user-gesture-required",
    ],
  });
  let problems = 0;
  for (const p of pages) {
    for (const s of SIZES) {
      const ctx = await browser.newContext({
        viewport: { width: s.width, height: s.height },
        hasTouch: !!s.mobile,
        isMobile: !!s.mobile,
      });
      const page = await ctx.newPage();
      await page.addInitScript(() => {
        try {
          sessionStorage.setItem("aspirants:entered", "1");
          sessionStorage.setItem("aspirants:intro", "off");
        } catch {}
      });
      const errors = [];
      page.on("pageerror", (e) => errors.push("pageerror: " + e.message.slice(0, 160)));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push("console: " + m.text().slice(0, 160));
      });
      page.on("requestfailed", (r) => errors.push("failed: " + r.url().slice(0, 120)));
      page.on("response", (r) => {
        if (r.status() >= 400) errors.push(`http ${r.status()}: ${r.url().slice(0, 120)}`);
      });
      let line = `${p.id.padEnd(11)} ${s.name.padEnd(5)}`;
      try {
        await page.goto(p.url, { waitUntil: "domcontentloaded", timeout: 90000 });
        await page.waitForTimeout(7000);
        const info = await page.evaluate(() => {
          const imgs = [...document.images];
          const broken = imgs
            .filter((i) => i.complete && i.naturalWidth === 0 && i.currentSrc)
            .map((i) => i.currentSrc.slice(0, 100));
          return {
            overflow: document.documentElement.scrollWidth - window.innerWidth,
            broken,
            h1: document.querySelector("h1")?.textContent?.trim().slice(0, 40) ?? null,
            height: document.documentElement.scrollHeight,
          };
        });
        await page.screenshot({ path: path.join(OUT, `${p.id}-${s.name}.png`) });
        const bad = errors.length + info.broken.length + (info.overflow > 2 ? 1 : 0);
        problems += bad;
        line += ` h1=${JSON.stringify(info.h1)} height=${info.height} overflow=${info.overflow} broken=${info.broken.length} errors=${errors.length}`;
        for (const b of info.broken.slice(0, 3)) line += `\n      broken image: ${b}`;
        for (const e of errors.slice(0, 4)) line += `\n      ${e}`;
      } catch (e) {
        problems += 1;
        line += " FAILED " + e.message.slice(0, 120);
      }
      console.log(line);
      await ctx.close();
    }
  }
  await browser.close();
  console.log(
    problems === 0
      ? "\nAll clean. Screenshots in " + OUT
      : `\n${problems} problem(s). Screenshots in ${OUT}`,
  );
  process.exit(problems === 0 ? 0 : 1);
})();
