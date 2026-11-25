// Real Chrome with the site's own three, on a small local server. The page (page/index.html)
// loads the sources and the finished files, cuts the views (page/recipes.js) and draws the sheets
// (page/render.js). Files on disk are read through /disk/<path>; nothing is written by the page.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(HERE, "../../../..");
const WEB = path.join(REPO, "apps/web");
const web = createRequire(path.join(WEB, "package.json"));
const { chromium } = web("@playwright/test");
const THREE_DIR = fs.realpathSync(path.join(WEB, "node_modules/three"));
const PAGE_DIR = path.join(HERE, "page");

const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".glb": "model/gltf-binary",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".obj": "text/plain",
  ".mtl": "text/plain",
};

/** Only these folders can be read by the page (sources, work files, the mirror, the repo). */
const READABLE = [
  "D:\\ren\\aspirant\\3d\\",
  "D:\\ren\\aspirant-work\\",
  "D:\\ren\\aspirant-r2\\",
  REPO + path.sep,
].map((p) => p.toLowerCase());

function serve() {
  const server = http.createServer((req, res) => {
    const url = (req.url ?? "/").split("?")[0];
    const send = (file) => {
      res.writeHead(200, {
        "content-type": TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream",
        "cache-control": "no-store",
      });
      fs.createReadStream(file).pipe(res);
    };
    const inside = (dir, rel) => {
      const file = path.normalize(path.join(dir, decodeURIComponent(rel)));
      return file.startsWith(dir + path.sep) && fs.existsSync(file) ? file : null;
    };
    let file = null;
    if (url === "/") file = path.join(PAGE_DIR, "index.html");
    else if (url.startsWith("/page/")) file = inside(PAGE_DIR, url.slice(6));
    else if (url.startsWith("/three/")) file = inside(THREE_DIR, url.slice(7));
    else if (url.startsWith("/disk/")) {
      const p = path.normalize(decodeURIComponent(url.slice(6)));
      if (READABLE.some((r) => p.toLowerCase().startsWith(r)) && fs.existsSync(p)) file = p;
    }
    if (file && fs.statSync(file).isFile()) return send(file);
    if (process.env.SHOW404) console.log("404", decodeURIComponent(url));
    res.writeHead(404);
    res.end("not found");
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

/** Opens the page. Returns { page, close }. */
export async function openPage({ width = 1900, height = 900 } = {}) {
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
    args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11"],
  });
  const page = await browser.newPage({ viewport: { width, height } });
  page.on("pageerror", (error) => console.error("[page]", error.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !/404/.test(m.text())) console.error("[console]", m.text());
    if (m.type() === "warning" && process.env.PAGELOG) console.warn("[page]", m.text());
    if (m.type() === "log") console.log("[page]", m.text());
  });
  await page.goto(`${base}/`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 30_000 });
  return {
    page,
    async close() {
      await browser.close();
      server.close();
    },
  };
}
