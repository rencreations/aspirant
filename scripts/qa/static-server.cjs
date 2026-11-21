// A small static server for the built site that survives a burst of file opens. The `serve` package dies with
// EMFILE on Windows when the home preloads hundreds of files at once, and then every test sees a refused
// connection. This one retries an open that hits the limit, answers byte ranges (video) and listens on both
// IPv4 and IPv6 (`localhost` can be either).
//
// Usage: node scripts/qa/static-server.cjs [dir=apps/web/out] [port=3000]
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(process.argv[2] || path.join(__dirname, "../../apps/web/out"));
const port = Number(process.argv[3] || 3000);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  ".wav": "audio/wav",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".glb": "model/gltf-binary",
  ".wasm": "application/wasm",
  ".vtt": "text/vtt; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};

function resolveFile(urlPath) {
  let p;
  try {
    p = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  const full = path.join(root, p);
  if (!full.startsWith(root)) return null;
  const tries = [];
  if (p.endsWith("/")) tries.push(path.join(full, "index.html"));
  else tries.push(full, full + ".html", path.join(full, "index.html"));
  for (const t of tries) {
    try {
      const st = fs.statSync(t);
      if (st.isFile()) return { file: t, size: st.size };
    } catch {
      /* next */
    }
  }
  return null;
}

function open(file, opts, res, tries = 0) {
  const stream = fs.createReadStream(file, opts);
  stream.on("error", (e) => {
    if ((e.code === "EMFILE" || e.code === "ENFILE") && tries < 200) {
      setTimeout(() => open(file, opts, res, tries + 1), 25 + tries * 5);
    } else if (!res.headersSent) {
      res.statusCode = 500;
      res.end();
    } else {
      res.destroy();
    }
  });
  stream.pipe(res);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", "http://x");
  let hit = resolveFile(url.pathname);
  let status = 200;
  if (!hit) {
    hit = resolveFile("/404.html");
    status = 404;
    if (!hit) {
      res.statusCode = 404;
      res.end("not found");
      return;
    }
  }
  const type = TYPES[path.extname(hit.file).toLowerCase()] || "application/octet-stream";
  res.setHeader("Content-Type", type);
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Cache-Control", "no-cache");
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || "");
  if (range && status === 200) {
    let start = range[1] === "" ? Math.max(0, hit.size - Number(range[2])) : Number(range[1]);
    let end =
      range[1] === "" || range[2] === "" ? hit.size - 1 : Math.min(Number(range[2]), hit.size - 1);
    if (start > end || start >= hit.size) {
      res.statusCode = 416;
      res.setHeader("Content-Range", `bytes */${hit.size}`);
      res.end();
      return;
    }
    res.statusCode = 206;
    res.setHeader("Content-Range", `bytes ${start}-${end}/${hit.size}`);
    res.setHeader("Content-Length", String(end - start + 1));
    if (req.method === "HEAD") return void res.end();
    open(hit.file, { start, end }, res);
    return;
  }
  res.statusCode = status;
  res.setHeader("Content-Length", String(hit.size));
  if (req.method === "HEAD") return void res.end();
  open(hit.file, {}, res);
});
server.listen(port, "::", () => console.log(`static ${root} on ${port}`));
