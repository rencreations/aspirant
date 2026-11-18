// A local server and real Chrome (with the GPU), for the checks that load the finished files with
// the site's own three. The page is verify/page/stage.html; it exposes `window.stage`.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { MODELS, THREE_DIR, chromium } from "./env.mjs";

const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".glb": "model/gltf-binary",
  ".png": "image/png",
  ".webp": "image/webp",
};

function serve(files) {
  const pageDir = path.join(MODELS, "verify", "page") + path.sep;
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent((req.url ?? "/").split("?")[0]);
    const send = (file) => {
      res.writeHead(200, {
        "content-type": TYPES[path.extname(file)] ?? "application/octet-stream",
        "cache-control": "no-store",
      });
      fs.createReadStream(file).pipe(res);
    };
    if (url.startsWith("/file/") && files[url.slice(6)]) return send(files[url.slice(6)]);
    for (const [prefix, dir] of [
      ["/page/", pageDir],
      ["/three/", THREE_DIR + path.sep],
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

/**
 * Opens the stage page. `files` maps a short name to a path on disk; the page loads them as
 * `/file/<name>`. Returns { page, base, close }.
 */
export async function openStage(files = {}) {
  const server = await serve(files);
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
    args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11"],
  });
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
  page.on("pageerror", (error) => console.error("[page]", error.message));
  page.on("console", (message) => {
    if (message.type() === "error") console.error("[console]", message.text());
  });
  await page.goto(`${base}/page/stage.html`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 30_000 });
  return {
    page,
    base,
    async close() {
      await browser.close();
      server.close();
    },
  };
}

/** A data address to bytes. */
export function pngBytes(address) {
  return Buffer.from(address.slice(address.indexOf(",") + 1), "base64");
}
