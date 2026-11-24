// The funny and chase sections of the home, looked at.
//
//   node scripts/qa/probes/home-s6.cjs <outFolder>
//   BASE=http://localhost:3100 SIZES=1440x900,390x844 node scripts/qa/probes/home-s6.cjs out
//   PARTS=keys,duo node scripts/qa/probes/home-s6.cjs out   (sheets, wheel, keys, duo, comic, speed, touch)
//
// Per size: both sections at -5, 0, 25, 50, 75, 100 and 105 percent (pictures
// <out>/s6-<size>-<section>-<percent>.png and the visible actors), then, at the first size only,
// both sections walked with a real wheel (down and back up, the pose Tetra wears), real Tab
// presses through the controls of both sections, a hover and a press on both drones in the middle,
// the comic scene (the two links, a hover and a press on Tetra's book, which goes to all the comics),
// and the frame gaps. A second pass with touch (hasTouch) taps the button, a card and the book.
//
// The dev server reloads the page whenever any file of the tree changes (other work in progress):
// each part notices a reload and starts again, up to six times. Judge speed on the production build.
const fs = require("node:fs");
const path = require("node:path");

const { BASE, OUT, launch, context } = require("./lib.cjs");

const OUT_DIR = path.resolve(process.argv[2] || OUT);
fs.mkdirSync(OUT_DIR, { recursive: true });
const SIZES = (process.env.SIZES || "1440x900,1706x950,390x844")
  .split(",")
  .map((s) => s.split("x").map(Number));
const STEPS = (process.env.STEPS || "-5,0,25,50,75,100,105").split(",").map(Number);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const quiet = (t) => !/X4122|preload|Fast Refresh|HMR|WebGLProgram/.test(t);
const ROOT = BASE + "/";

/** Where a section's `local` is, in screens. */
const where = (page, id, local) =>
  page.evaluate(
    ({ id, local }) => {
      const s = window.__home.sections().find((x) => x.id === id);
      return s.start + local * s.screens;
    },
    { id, local },
  );

async function seek(page, id, local, wait = 1500) {
  const S = await where(page, id, local);
  await page.evaluate((S) => window.__home.seek(S), S);
  await sleep(wait);
}

const active = (page) => page.evaluate(() => window.__home.state().active);
const hit = (page) => page.evaluate(() => window.__home.state().hit);
const visible = (page) =>
  page.evaluate(() =>
    window.__home
      .state()
      .actors.filter((a) => a.visible)
      .map((a) => a.name),
  );

/** The pose Tetra wears, from the shared actor (the lab hands out the same one and is let go at once). */
const pose = (page) =>
  page
    .evaluate(() => {
      const a = window.__home.peek("tetra");
      return a && a.state ? a.state().pose : null;
    })
    .catch(() => null);

const describeFocus = (page) =>
  page.evaluate(() => {
    const a = document.activeElement;
    const root = a && a.closest("[data-home-text]");
    const content = root && root.querySelector("[data-home-content]");
    const r = a.getBoundingClientRect();
    return {
      text: (a.textContent || "").trim().slice(0, 22),
      section: root && root.getAttribute("data-home-text"),
      contentOpacity: content ? getComputedStyle(content).opacity : null,
      rect: [r.x, r.y, r.width, r.height].map(Math.round),
      outline: getComputedStyle(a).outlineStyle,
    };
  });

function gaps(page, n = 180) {
  return page.evaluate(
    (n) =>
      new Promise((res) => {
        const g = [];
        let last = performance.now();
        const t = (now) => {
          g.push(now - last);
          last = now;
          if (g.length < n) requestAnimationFrame(t);
          else {
            g.sort((a, b) => a - b);
            res({ med: g[n >> 1], p95: g[Math.floor(n * 0.95)], max: g[n - 1] });
          }
        };
        requestAnimationFrame(t);
      }),
    n,
  );
}

/** Runs `fn` on a fresh page; starts again when the dev server reloaded the page meanwhile. */
async function part(name, [w, h], extra, fn, navigates = false) {
  for (let i = 0; i < 6; i++) {
    const browser = await launch();
    const ctx = await context(browser, { viewport: { width: w, height: h }, ...extra });
    const page = await ctx.newPage();
    const errors = [];
    let reloaded = false;
    page.on("framenavigated", (f) => {
      if (f === page.mainFrame()) reloaded = true;
    });
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error" && quiet(m.text())) errors.push(m.text());
    });
    try {
      await page.goto(ROOT, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => !!window.__home && window.__home.state().open, null, {
        timeout: 240000,
      });
      reloaded = false;
      // The cast arrives in the background (deferred): give it time.
      await sleep(9000);
      await fn(page, [w, h]);
      if (reloaded && !navigates) throw new Error("the page was reloaded");
      console.log(
        name,
        errors.length ? `errors: ${errors.slice(0, 5).join(" | ")}` : "no console errors",
      );
      await browser.close();
      return;
    } catch (e) {
      console.log(name, `attempt ${i + 1} failed: ${String(e).slice(0, 110)}`);
      await browser.close().catch(() => undefined);
    }
  }
}

async function sheets([w, h]) {
  const tag = `${w}x${h}`;
  await part(`${tag} sheets`, [w, h], {}, async (page) => {
    for (const id of ["funny", "chase"]) {
      for (const p of STEPS) {
        await seek(page, id, p / 100, 1700);
        const name = `${id}-${String(p).replace("-", "m").padStart(3, "0")}`;
        await page.screenshot({ path: path.join(OUT_DIR, `s6-${tag}-${name}.png`) });
        console.log(
          tag,
          id,
          p,
          JSON.stringify({ active: await active(page), actors: await visible(page) }),
        );
      }
    }
    const jumps = [
      ["chase", 0.9],
      ["funny", 0.3],
      ["chase", 0.17],
      ["funny", 0.55],
      ["chase", 0.5],
    ];
    for (const [id, p] of jumps) {
      await seek(page, id, p, 1700);
      console.log(tag, `jump to ${id} ${p}`, JSON.stringify(await visible(page)));
    }
  });
}

async function wheel([w, h]) {
  await part(`${w}x${h} wheel`, [w, h], {}, async (page) => {
    const log = [];
    await seek(page, "funny", 0.03, 2500);
    await page.mouse.move(w / 2, h / 2);
    const local = async () => {
      const st = await page.evaluate(() => window.__home.state());
      const list = await page.evaluate(() => window.__home.sections());
      const s = list.find((x) => x.id === "funny");
      return +((st.S - s.start) / s.screens).toFixed(2);
    };
    for (let i = 0; i < 40; i++) {
      await page.mouse.wheel(0, 0.1 * h);
      await sleep(130);
      if (i % 4 === 3) log.push(["down", await local(), await pose(page)]);
    }
    await sleep(800);
    for (let i = 0; i < 40; i++) {
      await page.mouse.wheel(0, -0.1 * h);
      await sleep(130);
      if (i % 4 === 3) log.push(["up", await local(), await pose(page)]);
    }
    console.log(w, h, "pose by wheel (dance, shock, run, then back)", JSON.stringify(log));
    await seek(page, "chase", 0.9, 2500);
    await seek(page, "funny", 0.1, 2500);
    console.log(w, h, "pose after chase 0.9 then funny 0.1 (dance)", await pose(page));
  });
}

async function keys([w, h]) {
  await part(`${w}x${h} keys`, [w, h], {}, async (page) => {
    // A focus on the first control of the funny section (the page moves there and its words show),
    // then real Tab presses through the controls of both sections, and a Shift+Tab back.
    await seek(page, "voices", 0.5, 800);
    await page.evaluate(() => document.querySelector('[data-home-text="funny"] a').focus());
    await sleep(1200);
    console.log(
      w,
      h,
      "focus funny button",
      await active(page),
      JSON.stringify(await describeFocus(page)),
    );
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press("Tab");
      await sleep(1200);
      const f = await describeFocus(page);
      console.log(w, h, `Tab ${i + 1}`, await active(page), JSON.stringify(f));
      await page.screenshot({ path: path.join(OUT_DIR, `s6-${w}x${h}-tab-${i + 1}.png`) });
    }
    await page.keyboard.press("Shift+Tab");
    await sleep(1200);
    console.log(w, h, "Shift+Tab", await active(page), JSON.stringify(await describeFocus(page)));
  });
}

async function duo([w, h]) {
  await part(`${w}x${h} duo`, [w, h], {}, async (page) => {
    await seek(page, "funny", 0.7, 2500);
    for (const [who, x] of [
      ["a", w / 2 - 0.15 * w],
      ["b", w / 2 + 0.15 * w],
    ]) {
      await page.mouse.move(x, h / 2 - 0.16 * h);
      await sleep(500);
      const over = await hit(page);
      await page.mouse.down();
      await page.mouse.up();
      await sleep(450);
      await page.screenshot({ path: path.join(OUT_DIR, `s6-${w}x${h}-duo-${who}-press.png`) });
      console.log(w, h, `duo ${who} hover target`, JSON.stringify(over));
    }
  });
}

async function bookQuads(page) {
  return page.evaluate(async () => {
    const t = await window.__home.lab("tetra");
    const q = t.book.quads();
    window.__home.unpin("tetra");
    return q && { left: q.left, right: q.right };
  });
}

async function comic([w, h]) {
  await part(
    `${w}x${h} comic`,
    [w, h],
    {},
    async (page) => {
      await seek(page, "chase", 0.84, 3000);
      const links = await page.evaluate(() =>
        Array.from(document.querySelectorAll('[data-home-text="chase"] a')).map((a) => [
          a.getAttribute("href"),
          a.textContent.trim(),
        ]),
      );
      console.log(w, h, "comic links", JSON.stringify(links));
      const quads = await bookQuads(page);
      await sleep(600);
      if (!quads) return console.log(w, h, "the book is not on the screen");
      const mid = (c) => [
        w / 2 + c.reduce((a, p) => a + p.x, 0) / c.length,
        h / 2 - c.reduce((a, p) => a + p.y, 0) / c.length,
      ];
      const [x, y] = mid(quads.left);
      await page.mouse.move(x, y);
      await sleep(400);
      console.log(w, h, "hover the left board of the book", JSON.stringify(await hit(page)));
      await page.mouse.down();
      await page.mouse.up();
      for (let i = 0; i < 80 && page.url() === ROOT; i++) await sleep(500);
      console.log(w, h, "press the book goes to", page.url());
    },
    true,
  );
}

async function touch([w, h]) {
  const extra = { hasTouch: true, isMobile: true, deviceScaleFactor: 2 };
  await part(
    `${w}x${h} touch (story button)`,
    [w, h],
    extra,
    async (page) => {
      await seek(page, "funny", 0.8, 2500);
      const b = await page.evaluate(() => {
        const r = document.querySelector('[data-home-text="funny"] a').getBoundingClientRect();
        return [r.x + r.width / 2, r.y + r.height / 2];
      });
      await page.touchscreen.tap(b[0], b[1]);
      for (let i = 0; i < 80 && page.url() === ROOT; i++) await sleep(500);
      console.log(w, h, "tap Read The Story goes to", page.url());
    },
    true,
  );
  await part(
    `${w}x${h} touch (the book)`,
    [w, h],
    extra,
    async (page) => {
      await seek(page, "chase", 0.84, 3000);
      const q = (await bookQuads(page)).right;
      await sleep(500);
      const x = w / 2 + q.reduce((a, p) => a + p.x, 0) / q.length;
      const y = h / 2 - q.reduce((a, p) => a + p.y, 0) / q.length;
      await page.touchscreen.tap(x, y);
      for (let i = 0; i < 80 && page.url() === ROOT; i++) await sleep(500);
      console.log(w, h, "tap the book goes to", page.url());
    },
    true,
  );
  await part(
    `${w}x${h} touch (comic card)`,
    [w, h],
    extra,
    async (page) => {
      await seek(page, "chase", 0.84, 3000);
      const c = await page.evaluate(() => {
        const r = document.querySelector('[data-chase-link="left"]').getBoundingClientRect();
        return [r.x + r.width / 2, r.y + r.height / 2];
      });
      await page.touchscreen.tap(c[0], c[1]);
      for (let i = 0; i < 80 && page.url() === ROOT; i++) await sleep(500);
      console.log(w, h, "tap the left comic card goes to", page.url());
    },
    true,
  );
}

async function speed([w, h]) {
  await part(`${w}x${h} speed`, [w, h], {}, async (page) => {
    await seek(page, "funny", 0.28, 1800);
    console.log(w, h, "frame gaps with the dragon", JSON.stringify(await gaps(page)));
    await seek(page, "chase", 0.84, 1800);
    console.log(w, h, "frame gaps in the comic", JSON.stringify(await gaps(page)));
  });
}

const PARTS = (process.env.PARTS || "sheets,wheel,keys,duo,comic,speed,touch").split(",");

(async () => {
  if (PARTS.includes("sheets")) for (const size of SIZES) await sheets(size);
  const [w, h] = SIZES[0];
  if (PARTS.includes("wheel")) await wheel([w, h]);
  if (PARTS.includes("keys")) await keys([w, h]);
  if (PARTS.includes("duo")) await duo([w, h]);
  if (PARTS.includes("comic")) await comic([w, h]);
  if (PARTS.includes("speed")) await speed([w, h]);
  const phone = SIZES.find(([x]) => x < 600);
  if (phone && PARTS.includes("touch")) await touch(phone);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
