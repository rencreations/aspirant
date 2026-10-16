// Minimal static server for the export in `out/`, mounted under an optional base path, with
// GitHub Pages behaviour: "/dir/" serves "dir/index.html", unknown paths get 404.html (404).
// Usage: node e2e/static-server.mjs --port 3100 --base /aspirant
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const root = resolve(import.meta.dirname, "..", arg("dir", "out"));
const port = Number(arg("port", "3100"));
const base = arg("base", "").replace(/\/+$/, "");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".mp4": "video/mp4",
  ".m4a": "audio/mp4",
  ".vtt": "text/vtt",
  ".glb": "model/gltf-binary",
};

function send(res, file, status = 200) {
  res.writeHead(status, {
    "content-type": TYPES[extname(file)] ?? "application/octet-stream",
    "cache-control": "no-cache",
  });
  createReadStream(file).pipe(res);
}

createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  let path = decodeURIComponent(url.pathname);
  if (base) {
    if (path === base) {
      res.writeHead(301, { location: `${base}/` }).end();
      return;
    }
    if (!path.startsWith(`${base}/`)) {
      send(res, join(root, "404.html"), 404);
      return;
    }
    path = path.slice(base.length);
  }
  const target = normalize(join(root, path));
  if (!target.startsWith(root)) {
    res.writeHead(403).end();
    return;
  }
  if (existsSync(target) && statSync(target).isDirectory()) {
    if (!path.endsWith("/")) {
      res.writeHead(301, { location: `${base}${path}/${url.search}` }).end();
      return;
    }
    const index = join(target, "index.html");
    if (existsSync(index)) return send(res, index);
  } else if (existsSync(target)) {
    return send(res, target);
  } else if (existsSync(`${target}.html`)) {
    return send(res, `${target}.html`);
  } else {
    // Next on Windows writes segment prefetch files as "__next.a/b.txt" instead of
    // "__next.a.b.txt" (path separator bug, Linux builds are fine). Map them here.
    const m = /^(.*[\\/])__next\.([^\\/]+)\.txt$/.exec(target);
    const parts = m?.[2]?.split(".") ?? [];
    if (m && parts.length > 1) {
      const alt = join(
        m[1] ?? "",
        `__next.${parts[0]}`,
        ...parts.slice(1, -1),
        `${parts.at(-1)}.txt`,
      );
      if (existsSync(alt)) return send(res, alt);
    }
  }
  send(res, join(root, "404.html"), 404);
}).listen(port, "127.0.0.1", () => {
  process.stdout.write(`Serving ${root} at http://127.0.0.1:${port}${base}/\n`);
});
