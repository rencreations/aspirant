// The 3D Models room's data (`apps/web/public/data/library/models.json`) and the files the pipelines
// do not make: the companions' models (the About page's own files, copied byte for byte), the
// sticker of Selena's Entrance, and the posters of every view. See README.md.
//
//   node scripts/library/models/build.mjs                  every step
//   node scripts/library/models/build.mjs posters manifest some steps
//
// Steps: companions, sticker, posters, manifest. The model files of the other views are made by the
// pipelines in the folders beside this one (selena-entrance, selena-in-game, parts).
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../../..");
const WEB = path.join(REPO, "apps/web");
const MIRROR = process.env.ASPIRANT_R2_MIRROR ?? "D:\\ren\\aspirant-r2";
/** Every file of the room is under this key (`models/v1/...`); a changed file needs `v2`. */
const PREFIX = "models/v1";
const OUT_DIR = path.join(MIRROR, "library", "v1", ...PREFIX.split("/"));
const DATA = path.join(WEB, "public/data/library/models.json");
const ENTRIES = path.join(HERE, "entries.json");
/** The owner's sticker for Selena's Entrance idle (read only). */
const STICKER_SOURCE = process.env.MODELS_STICKER ?? "C:\\Users\\muham\\Downloads\\vs.png";
/** The About page's files that are views of this room, as they are. */
const COMPANIONS = {
  "guinevere-drone": path.join(WEB, "public/models/about/companion.glb"),
  "mr-bunny": path.join(WEB, "public/models/about/bunny.glb"),
  tetra: path.join(WEB, "public/models/about/tetra.glb"),
};
const POSTER = { w: 800, h: 1000 };
const THUMB = { w: 240, h: 300 };

const web = createRequire(path.join(WEB, "package.json"));
const THREE_DIR = fs.realpathSync(path.join(WEB, "node_modules/three"));

function fail(message) {
  throw new Error(`models: ${message}`);
}

const keyOf = (...parts) => [PREFIX, ...parts].join("/");
const fileOf = (key) => path.join(MIRROR, "library", "v1", ...key.split("/"));

/** Write only when the bytes differ, so a run that changes nothing changes no file. */
function writeIfNew(file, bytes) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (fs.existsSync(file) && Buffer.compare(fs.readFileSync(file), bytes) === 0) return false;
  fs.writeFileSync(file, bytes);
  return true;
}

function readEntries() {
  return JSON.parse(fs.readFileSync(ENTRIES, "utf8")).entries;
}

function allViews() {
  return readEntries().flatMap((e) => e.views);
}

function companions() {
  for (const [id, source] of Object.entries(COMPANIONS)) {
    if (!fs.existsSync(source)) fail(`missing ${source}`);
    const wrote = writeIfNew(fileOf(keyOf(`${id}.glb`)), fs.readFileSync(source));
    console.log(`companions: ${id}.glb ${wrote ? "written" : "unchanged"}`);
  }
}

async function sticker() {
  if (!fs.existsSync(STICKER_SOURCE)) fail(`missing the sticker ${STICKER_SOURCE}`);
  const bytes = await sharp(STICKER_SOURCE)
    .resize({ width: 512, height: 512, fit: "inside" })
    .webp({ quality: 90, alphaQuality: 100 })
    .toBuffer();
  const wrote = writeIfNew(fileOf(keyOf("sticker.webp")), bytes);
  console.log(`sticker: ${bytes.length} bytes ${wrote ? "written" : "unchanged"}`);
}

/** A small server for the poster page: the page, the site's three and the model files. */
function serve() {
  const pageDir = path.join(HERE, "posters") + path.sep;
  const types = { ".html": "text/html", ".js": "text/javascript", ".glb": "model/gltf-binary" };
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent((req.url ?? "/").split("?")[0]);
    const send = (file) => {
      res.writeHead(200, {
        "content-type": types[path.extname(file)] ?? "application/octet-stream",
        "cache-control": "no-store",
      });
      fs.createReadStream(file).pipe(res);
    };
    for (const [prefix, dir] of [
      ["/page/", pageDir],
      ["/three/", THREE_DIR + path.sep],
      ["/models/", OUT_DIR + path.sep],
    ]) {
      if (!url.startsWith(prefix)) continue;
      const file = path.normalize(path.join(dir, url.slice(prefix.length)));
      if (file.startsWith(dir) && fs.existsSync(file)) return send(file);
    }
    res.writeHead(404);
    res.end("not found");
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

/** The posters: every view rendered by the site's three, on a clear ground. */
async function posters(only) {
  const { chromium } = web("@playwright/test");
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
    args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11"],
  });
  try {
    const page = await browser.newPage({ viewport: { width: POSTER.w, height: POSTER.h } });
    page.on("pageerror", (e) => console.error("[page]", e.message));
    await page.goto(`${base}/page/index.html`);
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 30_000 });
    for (const view of allViews()) {
      if (only.length && !only.includes(view.id)) continue;
      const glb = path.join(OUT_DIR, `${view.id}.glb`);
      if (!fs.existsSync(glb)) {
        console.warn(`posters: ${view.id}.glb is not there yet, skipped`);
        continue;
      }
      const address = await page.evaluate((v) => window.poster(v), {
        file: `/models/${view.id}.glb`,
        mode: view.mode,
        clip: view.defaultClip ?? "",
        home: view.home ?? null,
        w: POSTER.w,
        h: POSTER.h,
      });
      const png = Buffer.from(address.slice(address.indexOf(",") + 1), "base64");
      const p = await sharp(png).webp({ quality: 88, alphaQuality: 95 }).toBuffer();
      const t = await sharp(png)
        .resize(THUMB.w, THUMB.h)
        .webp({ quality: 86, alphaQuality: 90 })
        .toBuffer();
      writeIfNew(fileOf(keyOf("posters", `${view.id}-p.webp`)), p);
      writeIfNew(fileOf(keyOf("posters", `${view.id}-t.webp`)), t);
      console.log(`posters: ${view.id} (${p.length} and ${t.length} bytes)`);
    }
  } finally {
    await browser.close();
    server.close();
  }
}

/** The data file the room reads. A view whose file is missing stops the step: nothing half made ships. */
async function manifest() {
  const items = [];
  for (const e of readEntries()) {
    const views = [];
    for (const v of e.views) {
      const file = keyOf(`${v.id}.glb`);
      const disk = fileOf(file);
      const pKey = keyOf("posters", `${v.id}-p.webp`);
      const tKey = keyOf("posters", `${v.id}-t.webp`);
      const missing = !fs.existsSync(disk)
        ? `the view ${v.id} has no file (${disk})`
        : !fs.existsSync(fileOf(pKey)) || !fs.existsSync(fileOf(tKey))
          ? `the view ${v.id} has no poster`
          : "";
      if (missing) {
        // `--partial` is for working on the room while the pipelines run: never for a release.
        if (!PARTIAL) fail(missing);
        console.warn(`manifest: PARTIAL, ${missing}, left out`);
        continue;
      }
      const meta = await sharp(fileOf(pKey)).metadata();
      const view = {
        id: v.id,
        label: v.label,
        mode: v.mode,
        behaviour: v.behaviour,
        file,
        bytes: fs.statSync(disk).size,
        poster: { t: tKey, p: pKey, w: meta.width, h: meta.height },
      };
      const asRefs = (rows) =>
        rows.map(([id, label, group, groupLabel]) => ({
          id,
          label,
          ...(group ? { group, groupLabel } : {}),
        }));
      if (v.clips) view.clips = asRefs(v.clips);
      if (v.forms)
        view.forms = v.forms.map((f) => ({ id: f.id, label: f.label, clips: asRefs(f.clips) }));
      if (v.defaultClip) view.defaultClip = v.defaultClip;
      if (v.home) view.home = v.home;
      views.push(view);
    }
    const first = views[0];
    if (!first) continue;
    const stats = await sharp(fileOf(first.poster.p)).stats();
    const [r, g, b] = stats.channels.map((c) => Math.round(c.mean));
    items.push({
      id: e.id,
      kind: "model",
      title: e.title,
      ...(e.aspirant ? { aspirant: e.aspirant } : {}),
      collection: "models",
      chars: e.chars,
      pair: e.pair ?? null,
      canon: "official",
      tags: ["3d", "model", e.slug, ...(e.aspirant ? [e.aspirant.toLowerCase()] : [])],
      views,
      img: {
        t: first.poster.t,
        p: first.poster.p,
        f: first.poster.p,
        w: first.poster.w,
        h: first.poster.h,
        c: `#${[r, g, b].map((n) => (n ?? 200).toString(16).padStart(2, "0")).join("")}`,
      },
    });
  }
  const json = `${JSON.stringify({ v: 1, slug: "models", items })}\n`;
  writeIfNew(DATA, Buffer.from(json));
  const total = items.flatMap((i) => i.views).reduce((n, v) => n + v.bytes, 0);
  console.log(
    `manifest: ${items.length} entries, ${items.flatMap((i) => i.views).length} views, ${(total / 1e6).toFixed(1)} MB of models`,
  );
  // The search and the counts follow the data file.
  const py = process.env.PYTHON ?? "C:\\Users\\muham\\anaconda3\\python.exe";
  const r = spawnSync(py, [path.join(REPO, "scripts/library/build_index.py")], {
    stdio: "inherit",
    cwd: REPO,
  });
  if (r.status !== 0) fail("build_index.py failed");
}

const PARTIAL = process.argv.includes("--partial");
const steps = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const only = (process.argv.find((a) => a.startsWith("--only=")) ?? "")
  .slice(7)
  .split(",")
  .filter(Boolean);
const run = steps.length ? steps : ["companions", "sticker", "posters", "manifest"];
for (const step of run) {
  if (step === "companions") companions();
  else if (step === "sticker") await sticker();
  else if (step === "posters") await posters(only);
  else if (step === "manifest") await manifest();
  else fail(`unknown step ${step}`);
}
