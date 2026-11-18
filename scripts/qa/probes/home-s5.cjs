// The voices and music sections of the home, looked at and checked, in real Chrome.
//
//   node scripts/qa/probes/home-s5.cjs <outFolder>
//   PARTS=lock node ...   runs only some parts (voices, joints, music, lock)
//   BASE=http://localhost:3100 SIZES=1440x900,390x844 node scripts/qa/probes/home-s5.cjs out
//
// What it does at each size:
//   voices   the section at 0, 25, 50, 75 and 100 percent; plays a line, switches to another line
//            while it plays (the row and the dance must follow), a second press stops it, another
//            Aspirant by click and by the arrow keys, the Arabic line is right to left.
//   joints   the pair as each section commands it at J9, J10 and J11 (read from the sections' own
//            hooks): the two sides of each joint must agree.
//   music    the leave, the empty screen, the arrival, a record picked with the mouse (or a tap on
//            a phone), the song, "Another record", the crank key before any pick, the exit (the
//            song must stop) and a jump back in (nothing may sound by itself).
//   lock     the real hold with a real wheel (the intro key is cleared after the page opens): it
//            takes hold at the lock point, survives a steady wheel, shows Continue, and a fresh
//            gesture after a pause lets go. Then the same with the gramophone held back: the page
//            must never hold on a scene that is not there.
//
// Pictures go to <outFolder>/s5-<size>-<name>.png. Failed checks are printed as FAIL and the exit
// code is 1. The sections' hooks are `window.__homeVoices` and `window.__homeMusic` (`state()`,
// `select(i)` / `choose(i)`, `another()`, `keep()`).
const fs = require("node:fs");
const path = require("node:path");

const { BASE, OUT, launch, context } = require("./lib.cjs");

const OUT_DIR = path.resolve(process.argv[2] || OUT);
fs.mkdirSync(OUT_DIR, { recursive: true });
const SIZES = (process.env.SIZES || "1440x900,1706x950,390x844")
  .split(",")
  .map((s) => s.split("x").map(Number));
const PARTS = (process.env.PARTS || "voices,joints,music,lock").split(",");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;

function check(tag, name, ok, detail = "") {
  if (!ok) failed += 1;
  console.log(`${tag} ${ok ? "ok  " : "FAIL"} ${name}${detail ? `  ${detail}` : ""}`);
}

async function seek(page, id, local, wait = 1200) {
  await page.evaluate(
    ({ id, local }) => {
      const s = window.__home.sections().find((x) => x.id === id);
      window.__home.seek(s.start + local * s.screens);
    },
    { id, local },
  );
  await sleep(wait);
}

const music = (page) => page.evaluate(() => window.__homeMusic && window.__homeMusic.state());
const voices = (page) => page.evaluate(() => window.__homeVoices && window.__homeVoices.state());
const rows = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('[data-voices-panel][data-active="1"] [data-voices-line]')]
      .map((r) => r.dataset.state)
      .join(","),
  );

async function waitFor(fn, ms = 60000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await fn()) return true;
    await sleep(250);
  }
  return false;
}

async function openHome(browser, [w, h], touch) {
  const ctx = await context(browser, {
    viewport: { width: w, height: h },
    ...(touch ? { hasTouch: true, isMobile: true } : {}),
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForFunction(() => !!window.__home && window.__home.state().open, null, {
    timeout: 240000,
  });
  return { ctx, page, errors };
}

async function voicesPart(page, tag, shot) {
  for (const f of [0, 0.25, 0.5, 0.75, 1]) {
    await seek(page, "voices", f, 1500);
    await shot(`voices-${String(Math.round(f * 100)).padStart(3, "0")}`);
  }
  await seek(page, "voices", 0.5, 2000);
  const play = (n) =>
    page.locator('[data-voices-panel][data-active="1"] [data-voices-play]').nth(n);
  await play(1).click();
  await sleep(1500);
  check(tag, "a line plays and its row says so", (await rows(page)).split(",")[1] === "playing");
  check(tag, "the pair dances while it plays", (await voices(page)).dance > 0.5);
  await shot("voices-playing");
  await play(3).click();
  await sleep(1500);
  const s = await voices(page);
  check(
    tag,
    "switching lines mid-play moves the state",
    (await rows(page)).split(",")[3] === "playing" && s.speaking,
  );
  await play(3).click();
  await sleep(500);
  check(tag, "a second press stops the line", !(await rows(page)).includes("playing"));
  await page.locator('[data-voices-tab="ruby"]').click();
  await sleep(800);
  check(tag, "a tab changes the Aspirant", (await voices(page)).index === 1);
  await page.locator('[data-voices-tab="ruby"]').focus();
  await page.keyboard.press("ArrowRight");
  await sleep(500);
  check(tag, "the arrow keys move the chooser", (await voices(page)).index === 2);
  const arabic = await page.evaluate(() => {
    const p = document.querySelector(
      '[data-voices-panel][data-active="1"] [data-voices-line]:nth-child(4) p',
    );
    return p ? `${p.getAttribute("lang")}/${p.getAttribute("dir")}` : "";
  });
  check(tag, "the Arabic line is right to left", arabic === "ar/rtl", arabic);
}

async function jointsPart(page, tag) {
  await page.evaluate(() => window.__home.freeze(true));
  const read = () =>
    page.evaluate(() => ({
      v: window.__homeVoices.state().placed,
      m: window.__homeMusic.state().placed,
    }));
  const eps = 0.0005;
  const near = (a, b) =>
    a.every((p, i) => Math.abs(p.x - b[i].x) < 1.5 && Math.abs(p.y - b[i].y) < 1.5);
  await seek(page, "voices", 0, 1800);
  const j9 = (await read()).v;
  const wide = await page.evaluate(() => innerWidth / 2);
  check(tag, "J9 the pair is off screen at the two edges", j9[0].x < -wide && j9[1].x > wide);
  await seek(page, "voices", 1 - eps, 1800);
  const end = (await read()).v;
  await seek(page, "music", eps, 1800);
  const start = (await read()).m;
  check(tag, "J10 voices end = music start", near(end, start), JSON.stringify([end, start]));
  await seek(page, "music", 1 - eps, 1800);
  const j11 = (await read()).m;
  check(
    tag,
    "J11 the pair hovers high at the left",
    j11[0].x < 0 && j11[0].y > 0 && j11[1].x < 0,
    JSON.stringify(j11),
  );
  await page.evaluate(() => window.__home.freeze(false));
}

async function musicPart(page, tag, shot, touch, [w, h]) {
  for (const f of [0, 0.08, 0.18]) {
    await seek(page, "music", f, 1200);
    await shot(`music-${String(Math.round(f * 100)).padStart(3, "0")}`);
  }
  await seek(page, "music", 0.45, 1000);
  check(tag, "the props arrive", await waitFor(async () => (await music(page)).propsReady));
  await sleep(6500);
  await shot("music-stands");
  // Find a sleeve with the real pointer. A point counts only when the pointer finds the same sleeve
  // twice, each time coming in from far away (a sweep across the crate flips sleeves under it, and a
  // point found that way may miss when approached fresh: the hit shape is thin at the sleeve tops).
  const approach = async (x, y) => {
    await page.mouse.move(2, 2);
    await sleep(30);
    await page.mouse.move(x, y);
    await sleep(90);
    const hit = await page.evaluate(() => window.__home.state().hit);
    return hit && String(hit.id || hit).startsWith("record-") ? String(hit.id || hit) : null;
  };
  let found = null;
  for (let y = h * 0.72; y < h * 0.88 && !found; y += 20) {
    for (let x = w * 0.1; x < w * 0.46 && !found; x += 20) {
      const first = await approach(x, y);
      if (first && first === (await approach(x, y))) found = { x, y };
    }
  }
  check(tag, "the pointer finds a sleeve", !!found);
  if (found) {
    // A finger never lands 16 ms after a mouse move: pause as a person would (a tap straight after a
    // mouse move on a touch page was seen to miss, an input mix no visitor produces).
    if (touch) {
      await sleep(700);
      await page.touchscreen.tap(found.x, found.y);
    } else await page.mouse.click(found.x, found.y);
  } else await page.evaluate(() => window.__homeMusic.choose(2));
  let saw = false;
  for (let i = 0; i < 24 && !saw; i++) {
    await sleep(600);
    const s = await music(page);
    if (s.step === "playing") saw = true;
    if (i === 3) await shot("music-fetch");
    if (i === 8) await shot("music-place");
  }
  const s = await music(page);
  check(
    tag,
    "the song plays on the platter",
    saw && s.musicOn && s.needleDown && s.platter > 0.3,
    JSON.stringify({ step: s.step, platter: s.platter }),
  );
  await shot("music-playing");
  await page.getByRole("button", { name: "Another record" }).click();
  await sleep(4500);
  const again = await music(page);
  check(
    tag,
    "Another record puts the disc back and silences the song",
    again.step === "idle" && !again.musicOn,
  );
  // The crank key turns the crank with no pick.
  await page.getByRole("button", { name: "Turn the crank" }).focus();
  await page.keyboard.press("Enter");
  await sleep(1500);
  check(tag, "the crank key turns the platter before a pick", (await music(page)).platter > 0.1);
  // Pick by key, then leave mid-song.
  await page.locator("[data-music-key]").nth(1).focus();
  await page.keyboard.press("Enter");
  await waitFor(async () => (await music(page)).musicOn, 20000);
  for (const f of [0.88, 0.94, 1]) {
    await seek(page, "music", f, 1400);
    await shot(`music-${String(Math.round(f * 100)).padStart(3, "0")}`);
  }
  const end = await music(page);
  check(
    tag,
    "leaving mid-song stops the song and clears the drones' work",
    !end.musicOn && end.solo.every((x) => x === "free"),
    JSON.stringify({ step: end.step, solo: end.solo }),
  );
  await seek(page, "music", 0.5, 7000);
  const back = await music(page);
  check(tag, "a jump back in starts nothing by itself", back.step === "idle" && !back.musicOn);
}

async function lockPart(browser, size, tag) {
  const [w, h] = size;
  const { page, errors } = await openHome(browser, size, false);
  const shot = (name) => page.screenshot({ path: path.join(OUT_DIR, `s5-${tag}-${name}.png`) });
  await page.evaluate(() => sessionStorage.removeItem("aspirants:intro"));
  await seek(page, "music", 0.12, 800);
  check(
    tag,
    "the props are ready before the hold",
    await waitFor(async () => (await music(page)).propsReady),
  );
  await page.mouse.move(w / 2, h / 2);
  for (let i = 0; i < 24; i++) {
    await page.mouse.wheel(0, 100);
    await sleep(60);
  }
  const at = await page.evaluate(() => window.__home.state().raw);
  check(tag, "the page is held at the lock point", (await music(page)).held);
  for (let i = 0; i < 70; i++) {
    await page.mouse.wheel(0, 100);
    await sleep(80);
  }
  const still = await page.evaluate(() => window.__home.state().raw);
  check(
    tag,
    "a steady wheel does not carry it through",
    Math.abs(still - at) < 0.02,
    `${at.toFixed(3)} to ${still.toFixed(3)}`,
  );
  const cont = await page.evaluate(() => {
    const b = document.querySelector("[data-music-continue]");
    const c = getComputedStyle(b);
    return c.visibility === "visible" && Number(c.opacity) > 0.9;
  });
  check(tag, "Continue shows once the scene stands", cont);
  await shot("music-held");
  // A gesture begun within a second of the scene standing is too early (the grace of intent.ts).
  await sleep(1900);
  await page.mouse.wheel(0, 120);
  await sleep(120);
  await page.mouse.wheel(0, 120);
  await sleep(400);
  check(tag, "a fresh gesture lets the page go", !(await music(page)).held);
  await page.close();

  // The gramophone and the covers held back: the page must not hold.
  const slow = await openHome(browser, size, false);
  await slow.ctx.route(/gramophone|music\.json|\/library\/v1\/music/, async (route) => {
    await sleep(30000);
    try {
      await route.continue();
    } catch {
      /* the page went away */
    }
  });
  await slow.page.evaluate(() =>
    caches.keys().then((k) => Promise.all(k.map((n) => caches.delete(n)))),
  );
  await slow.page.reload({ waitUntil: "domcontentloaded", timeout: 180000 });
  await slow.page.evaluate(() => sessionStorage.removeItem("aspirants:intro"));
  await slow.page.waitForFunction(() => !!window.__home && window.__home.state().open, null, {
    timeout: 240000,
  });
  // The seek is repeated until it has taken: the point is to cross the lock, not to scroll from the top.
  for (let i = 0; i < 5; i++) {
    await seek(slow.page, "music", 0.12, 1500);
    if ((await slow.page.evaluate(() => window.__home.state().raw)) > 36) break;
  }
  await slow.page.mouse.move(w / 2, h / 2);
  const from = await slow.page.evaluate(() => window.__home.state().raw);
  for (let i = 0; i < 30; i++) {
    await slow.page.mouse.wheel(0, 100);
    await sleep(70);
  }
  const to = await slow.page.evaluate(() => window.__home.state().raw);
  const m = await music(slow.page);
  check(
    tag,
    "with the props late the page is never held",
    from > 36 && to > 36.9 && !m.held && !m.propsReady,
    `${from.toFixed(2)} to ${to.toFixed(2)}`,
  );
  errors.push(...slow.errors.filter((e) => !/aborted|net::/.test(e)));
  return errors;
}

async function run(size) {
  const [w, h] = size;
  const tag = `${w}x${h}`;
  const touch = w < 600;
  const shot = (page) => (name) =>
    page.screenshot({ path: path.join(OUT_DIR, `s5-${tag}-${name}.png`) });
  const browser = await launch();
  const { page, errors } = await openHome(browser, size, touch);
  if (PARTS.includes("voices")) await voicesPart(page, tag, shot(page));
  if (PARTS.includes("joints")) await jointsPart(page, tag);
  if (PARTS.includes("music")) await musicPart(page, tag, shot(page), touch, size);
  await page.close();
  const more = PARTS.includes("lock") ? await lockPart(browser, size, tag) : [];
  const all = [...errors, ...more].filter((e) => !/X4122|preload/.test(e));
  check(tag, "no console errors", all.length === 0, all.slice(0, 3).join(" | "));
  await browser.close();
}

(async () => {
  for (const size of SIZES) await run(size);
  console.log(failed ? `${failed} check(s) FAILED` : "all checks passed");
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
