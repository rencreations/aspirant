/**
 * Bad connections. Loads the site in a browser with a poor or broken network and prints what a
 * visitor would meet: how long the loading screen holds, whether a page goes blank, whether the
 * offline notice shows, whether a stale tab reloads once and never loops. See
 * docs/design/performance.md ("Bad connections").
 *
 * Usage (build first, serve `apps/web/out`, then):
 *   node scripts/perf/net.mjs <base url> [scenarios]
 *   node scripts/perf/net.mjs http://127.0.0.1:3190 guard,nav,fail,stale
 *   node scripts/perf/net.mjs http://127.0.0.1:3190 slow,offline,enter     (a few minutes)
 *
 * Scenarios: slow (1.5 Mbit/s and 400 kbit/s), offline (the connection drops while loading),
 * fail (media, audio, data and pictures answer 404 or 500), stale (a file of the page is gone, as
 * after a deploy), nav (offline, a click on a page never opened), guard (the reload guard and the
 * rejection logger), enter (the "Enter now" button of the loading screen on a slow connection).
 */
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

// Playwright is a dependency of apps/web, so it is found from there.
const require = createRequire(new URL("../../apps/web/package.json", import.meta.url));
const playwright = await import(
  pathToFileURL(require.resolve(["@playwright", "test"].join("/"))).href
);
const { chromium } = playwright.default ?? playwright;

const base = process.argv[2] ?? "http://localhost:3190";
const only = process.argv[3] ?? "";
const browser = await chromium.launch({
  args: ["--use-gl=angle", "--enable-webgl", "--ignore-gpu-blocklist"],
});

function watch(page, tag) {
  const log = { tag, pageErrors: [], consoleErrors: [], failed: [], bad: [] };
  page.on("pageerror", (e) => log.pageErrors.push(String(e.message).slice(0, 120)));
  page.on("console", (m) => {
    if (m.type() === "error") log.consoleErrors.push(m.text().slice(0, 120));
  });
  page.on("requestfailed", (r) => log.failed.push(r.url().replace(base, "").slice(0, 80)));
  page.on("response", (r) => {
    if (r.status() >= 400) log.bad.push(`${r.status()} ${r.url().replace(base, "").slice(0, 70)}`);
  });
  return log;
}

const uniq = (a) => [...new Set(a)].slice(0, 6);
const sum = (l) =>
  `pageErrors=${JSON.stringify(uniq(l.pageErrors))} consoleErrors=${l.consoleErrors.length} failed=${l.failed.length} bad=${JSON.stringify(uniq(l.bad))}`;

async function gateState(page) {
  return page.evaluate(() => ({
    gate: document.documentElement.dataset.gate ?? "off",
    entered: sessionStorage.getItem("aspirants:entered"),
    mainText: (document.querySelector("main")?.textContent ?? "").length,
    bodyBlank: document.body.innerText.trim().length < 20,
  }));
}

async function waitGateOpen(page, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const s = await gateState(page).catch(() => null);
    if (s && s.gate === "off" && s.entered === "1") return Date.now() - t0;
    await new Promise((r) => setTimeout(r, 500));
  }
  return -1;
}

async function slow(label, kbps, latency, url, maxMs) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  const log = watch(page, label);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency,
    downloadThroughput: (kbps * 1024) / 8,
    uploadThroughput: (kbps * 1024) / 16,
  });
  const t0 = Date.now();
  await page.goto(base + url, { waitUntil: "commit", timeout: 60000 }).catch(() => {});
  const open = await waitGateOpen(page, maxMs);
  const s = await gateState(page).catch(() => ({}));
  console.log(
    `[${label}] ${url} gateOpenAfterMs=${open} (limit ${maxMs}) state=${JSON.stringify(s)} ${sum(log)}`,
  );
  await ctx.close();
}

async function offlineMid(url, atMs, maxMs) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  const log = watch(page, "offline-mid");
  await page.goto(base + url, { waitUntil: "commit", timeout: 60000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, atMs));
  await ctx.setOffline(true);
  const open = await waitGateOpen(page, maxMs);
  const s = await gateState(page).catch(() => ({}));
  const notice = await page
    .evaluate(() => document.querySelector("[role=status]")?.textContent ?? "")
    .catch(() => "");
  console.log(
    `[offline-mid ${url}] offlineAt=${atMs}ms gateOpenAfterMs=${open} (limit ${maxMs}) state=${JSON.stringify(s)} notice="${notice.slice(0, 60)}" ${sum(log)}`,
  );
  await ctx.setOffline(false);
  await ctx.close();
}

async function failing(label, url, matchers, maxMs) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  const log = watch(page, label);
  for (const [glob, status] of matchers) {
    await page.route(glob, (route) =>
      status === 0 ? route.abort("failed") : route.fulfill({ status, body: "x" }),
    );
  }
  await page.goto(base + url, { waitUntil: "commit", timeout: 60000 }).catch(() => {});
  const open = await waitGateOpen(page, maxMs);
  await new Promise((r) => setTimeout(r, 2500));
  const s = await gateState(page).catch(() => ({}));
  const err = await page
    .evaluate(() => document.querySelector("[role=alert]")?.textContent?.slice(0, 50) ?? "")
    .catch(() => "");
  console.log(
    `[${label}] ${url} gateOpenAfterMs=${open} state=${JSON.stringify(s)} alert="${err}" ${sum(log)}`,
  );
  await ctx.close();
}

async function staleChunks(url) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  await ctx.addInitScript(() => sessionStorage.setItem("aspirants:entered", "1"));
  const page = await ctx.newPage();
  const log = watch(page, "stale-chunks");
  let nav = 0;
  page.on("framenavigated", (f) => {
    if (f === page.mainFrame()) nav += 1;
  });
  let n = 0;
  await page.route("**/_next/static/chunks/**", (route) => {
    n += 1;
    // a lazy chunk (not the first scripts) vanishes, as after a new deploy
    if (n > 14 && n % 5 === 0) return route.fulfill({ status: 404, body: "gone" });
    return route.continue();
  });
  await page.goto(base + url, { waitUntil: "load", timeout: 60000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 7000));
  const guard = await page
    .evaluate(() => sessionStorage.getItem("aspirants:chunk-reload"))
    .catch(() => null);
  const s = await gateState(page).catch(() => ({}));
  console.log(
    `[stale-chunks] ${url} navigations=${nav} reloadGuard=${guard ? "set" : "none"} chunkRequests=${n} state=${JSON.stringify(s)} ${sum(log)}`,
  );
  await ctx.close();
}

async function offlineNav() {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  await ctx.addInitScript(() => sessionStorage.setItem("aspirants:entered", "1"));
  const page = await ctx.newPage();
  const log = watch(page, "offline-nav");
  await page.goto(base + "/", { waitUntil: "load", timeout: 60000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 3000));
  await ctx.setOffline(true);
  await new Promise((r) => setTimeout(r, 600));
  const offlineNotice = await page.evaluate(
    () => document.querySelector("[role=status]")?.textContent ?? "",
  );
  const before = await page.evaluate(() => location.pathname);
  const href = await page.evaluate(() => {
    const a = [...document.querySelectorAll("a[href]")].find((x) =>
      /\/(experience|story|collection)\/?$/.test(x.getAttribute("href") ?? ""),
    );
    return a?.getAttribute("href") ?? null;
  });
  if (href)
    await page.evaluate(
      (h) =>
        document
          .querySelector(`a[href="${h}"]`)
          ?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })),
      href,
    );
  await new Promise((r) => setTimeout(r, 1500));
  const after = await page.evaluate(() => ({
    path: location.pathname,
    text: document.body.innerText.trim().length,
    notice: document.querySelector("[role=status]")?.textContent ?? "",
  }));
  await ctx.setOffline(false);
  await new Promise((r) => setTimeout(r, 600));
  const back = await page.evaluate(
    () => document.querySelector("[role=status]")?.textContent ?? "",
  );
  await new Promise((r) => setTimeout(r, 3200));
  const gone = await page.evaluate(
    () => document.querySelector("[role=status]")?.textContent ?? "",
  );
  console.log(
    `[offline-nav] clickedLink=${href} path ${before} -> ${after.path} bodyText=${after.text} noticeOffline="${offlineNotice.slice(0, 40)}" afterClick="${after.notice.slice(0, 40)}" backOnline="${back.slice(0, 20)}" later="${gone}" ${sum(log)}`,
  );
  await ctx.close();
}

async function enterNow(url) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  const log = watch(page, "enter-now");
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 400,
    downloadThroughput: (400 * 1024) / 8,
    uploadThroughput: 25000,
  });
  const t0 = Date.now();
  await page.goto(base + url, { waitUntil: "commit", timeout: 60000 }).catch(() => {});
  const btn = page.getByRole("button", { name: /Enter now/ });
  let shownAt = -1;
  while (Date.now() - t0 < 110000) {
    if (await btn.count().catch(() => 0)) {
      shownAt = Date.now() - t0;
      break;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  let openAfter = -1;
  if (shownAt > 0) {
    const c0 = Date.now();
    await btn.click().catch(() => {});
    openAfter = await waitGateOpen(page, 20000);
    openAfter = openAfter < 0 ? -1 : openAfter;
    void c0;
  }
  const s = await gateState(page).catch(() => ({}));
  const btnAfter = await btn.count().catch(() => -1);
  console.log(
    `[enter-now] ${url} buttonShownAfterMs=${shownAt} (expect ~12000) gateOpenMsAfterClick=${openAfter} state=${JSON.stringify(s)} buttonAfter=${btnAfter} ${sum(log)}`,
  );
  await ctx.close();
}

async function guard() {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  await ctx.addInitScript(() => sessionStorage.setItem("aspirants:entered", "1"));
  const page = await ctx.newPage();
  let nav = 0;
  let warns = 0;
  page.on("framenavigated", (f) => {
    if (f === page.mainFrame()) nav += 1;
  });
  page.on("console", (m) => {
    if (m.type() === "warning" && /unhandled rejection/.test(m.text())) warns += 1;
  });
  await page.goto(base + "/", { waitUntil: "load", timeout: 60000 });
  await page.waitForTimeout(3000);
  const navBefore = nav;
  await page.evaluate(() => {
    void Promise.reject(
      Object.assign(new Error("Loading chunk 42 failed."), { name: "ChunkLoadError" }),
    );
  });
  await page.waitForTimeout(3500);
  const navAfterFirst = nav;
  const stamp = await page.evaluate(() => sessionStorage.getItem("aspirants:chunk-reload"));
  await page.evaluate(() => {
    void Promise.reject(
      Object.assign(new Error("Loading chunk 43 failed."), { name: "ChunkLoadError" }),
    );
  });
  await page.waitForTimeout(3000);
  const navAfterSecond = nav;
  for (let i = 0; i < 6; i++)
    await page.evaluate(() => {
      void Promise.reject(new Error("custom-x-rejection"));
    });
  await page.waitForTimeout(500);
  console.log(
    `[guard] navigations before=${navBefore} afterFirstChunkError=${navAfterFirst} (expect +1) afterSecond=${navAfterSecond} (expect same, no loop) stamp=${stamp ? "set" : "none"} sixSameRejections->warnings=${warns} (expect 1)`,
  );
  await ctx.setOffline(true);
  const n0 = nav;
  await page.evaluate(() => {
    sessionStorage.removeItem("aspirants:chunk-reload");
    void Promise.reject(
      Object.assign(new Error("Loading chunk 44 failed."), { name: "ChunkLoadError" }),
    );
  });
  await page.waitForTimeout(2000);
  const offlineNav = nav - n0;
  await ctx.setOffline(false);
  await page.waitForTimeout(3500);
  console.log(
    `[guard offline] reloadsWhileOffline=${offlineNav} (expect 0) reloadsAfterBackOnline=${nav - n0 - offlineNav} (expect 1)`,
  );
  await ctx.close();
}

const run = (name) => !only || only.split(",").includes(name);
if (run("guard")) await guard();
if (run("enter")) {
  await enterNow("/character/vexana/");
  await enterNow("/");
}
if (run("slow")) {
  await slow("1.5Mbit", 1500, 150, "/character/vexana/", 120000);
  await slow("slow3g", 400, 400, "/", 120000);
}
if (run("offline")) {
  await offlineMid("/character/vexana/", 3000, 90000);
  await offlineMid("/", 2000, 60000);
}
if (run("fail")) {
  await failing(
    "media-500",
    "/character/vexana/",
    [
      ["**/video/**", 500],
      ["**/audio/music/**", 500],
    ],
    60000,
  );
  await failing("audio-404", "/character/vexana/", [["**/audio/**", 404]], 60000);
  await failing("data-404", "/", [["**/data/**", 404]], 60000);
  await failing("img-abort", "/character/", [["**/img/**", 0]], 60000);
}
if (run("stale")) {
  await staleChunks("/character/vexana/");
  await staleChunks("/");
}
if (run("nav")) await offlineNav();
await browser.close();
