// Draws every face of both atlases on the real drone (the shipped model), beside the nine of the
// shipped atlas, into contact sheets. Run after faces.cjs, then look at the pictures.
//
//   node scripts/home/drone/check.cjs [--faces DIR] [--renders DIR]
const fs = require("node:fs");
const http = require("node:http");
const { createRequire } = require("node:module");
const os = require("node:os");
const path = require("node:path");

const REPO = path.resolve(__dirname, "../../..");
const WEB = path.join(REPO, "apps/web");
const web = createRequire(path.join(WEB, "package.json"));
const { chromium } = web("@playwright/test");
const THREE_DIR = fs.realpathSync(path.join(WEB, "node_modules/three"));

const option = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const facesDir = path.resolve(option("faces", path.join(WEB, "public/img/home")));
const renders = path.resolve(
  option("renders", path.join(os.tmpdir(), "aspirant-home-drone-faces")),
);
const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".glb": "model/gltf-binary",
  ".webp": "image/webp",
};

/** The shipped atlas: cells from the plain one (features/about/drone/drone-scene.ts, CELL). */
const ORIGINAL = {
  normal: [0, 0],
  angry: [-1, 0],
  squint: [1, 0],
  happy: [-1, -1],
  dead: [0, -1],
  scan: [1, -1],
  ecg: [-1, -2],
  sleepy: [0, -2],
  alert: [1, -2],
};

function serve() {
  const roots = [
    ["/page/", path.join(__dirname, "page") + path.sep],
    ["/three/", THREE_DIR + path.sep],
    ["/faces/", facesDir + path.sep],
    ["/model/", path.join(WEB, "public/models/about") + path.sep],
  ];
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent((req.url ?? "/").split("?")[0]);
    for (const [prefix, dir] of roots) {
      if (!url.startsWith(prefix)) continue;
      const file = path.normalize(path.join(dir, url.slice(prefix.length)));
      if (file.startsWith(dir) && fs.existsSync(file)) {
        res.writeHead(200, {
          "content-type": TYPES[path.extname(file)] ?? "application/octet-stream",
          "cache-control": "no-store",
        });
        return res.end(fs.readFileSync(file));
      }
    }
    res.writeHead(404);
    res.end();
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

async function main() {
  const json = JSON.parse(fs.readFileSync(path.join(facesDir, "drone-faces.json"), "utf8"));
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
    args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11"],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 800, height: 800 } });
    page.on("pageerror", (e) => console.error("[page]", e.message));
    page.on(
      "console",
      (m) =>
        m.type() === "error" &&
        !m.text().includes("404") &&
        console.error("[console]", m.text().slice(0, 300)),
    );
    await page.goto(`${base}/page/index.html`);
    await page.waitForFunction(() => window.__ready === true);
    const glb = `${base}/model/drone.glb`;
    const found = await page.evaluate((u) => window.droneFaces.found(u), glb);
    console.log("screen box", JSON.stringify(found));
    const shoot = async (name, cells, options) => {
      const png = await page.evaluate(
        ([u, c, o]) => window.droneFaces.sheet(u, c, o),
        [glb, cells, options],
      );
      fs.mkdirSync(renders, { recursive: true });
      fs.writeFileSync(
        path.join(renders, name),
        Buffer.from(png.slice(png.indexOf(",") + 1), "base64"),
      );
    };
    const original = Object.entries(ORIGINAL).map(([label, uCell]) => ({
      label: `shipped: ${label}`,
      atlas: "original",
      uCell,
    }));
    const mine = Object.entries(json.faces).map(([label, f]) => ({
      label,
      atlas: `${base}/faces/${f.file}`,
      uCell: f.uCell,
    }));
    await shoot("original-cells.png", original, { size: 320, cols: 5 });
    await shoot("home-faces.png", mine, { size: 320, cols: 6 });
    // The same at the size they have on the page: the drone is about 300 px wide on a laptop.
    await shoot("home-faces-small.png", [...original, ...mine], { size: 110, cols: 9 });
    // Blink and look must keep the glyphs inside their cell.
    const stress = mine.flatMap((c) => [
      { ...c, label: `${c.label} blink .6`, blink: 0.6 },
      { ...c, label: `${c.label} look`, look: [0.1, 0.06] },
    ]);
    await shoot("home-faces-blink-look.png", stress, { size: 240, cols: 6 });
    console.log("pictures in", renders);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
