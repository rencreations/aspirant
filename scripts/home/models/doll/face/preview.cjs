// Draws every expression of the doll on the real doll.glb in real Chrome, at 0, 30 and 60 degrees of
// yaw, large and at the size the page will show her (about 120 px tall), into contact sheets.
//
//   node scripts/home/models/doll/face/preview.cjs [--glb FILE] [--renders DIR]
//
// Run build-face.cjs first. Look at the pictures: seams, ghosts on the hair, the face at small size.
const fs = require("node:fs");
const http = require("node:http");
const { createRequire } = require("node:module");
const os = require("node:os");
const path = require("node:path");

const REPO = path.resolve(__dirname, "../../../../..");
const WEB = path.join(REPO, "apps/web");
const web = createRequire(path.join(WEB, "package.json"));
const { chromium } = web("@playwright/test");
const THREE_DIR = fs.realpathSync(path.join(WEB, "node_modules/three"));

const option = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const glb = path.resolve(option("glb", path.join(WEB, "public/models/home/doll.glb")));
const renders = path.resolve(option("renders", path.join(os.tmpdir(), "aspirant-home-doll-face")));
const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".glb": "model/gltf-binary",
  ".glsl": "text/plain",
};

function serve() {
  const roots = [
    ["/preview/", path.join(__dirname, "preview") + path.sep],
    ["/face/", __dirname + path.sep],
    ["/three/", THREE_DIR + path.sep],
  ];
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent((req.url ?? "/").split("?")[0]);
    if (url === "/doll.glb") {
      res.writeHead(200, { "content-type": TYPES[".glb"] });
      return res.end(fs.readFileSync(glb));
    }
    for (const [prefix, dir] of roots) {
      if (!url.startsWith(prefix)) continue;
      const file = path.normalize(path.join(dir, url.slice(prefix.length)));
      if (file.startsWith(dir) && fs.existsSync(file) && fs.statSync(file).isFile()) {
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
  const presets = JSON.parse(fs.readFileSync(path.join(__dirname, "presets.json"), "utf8"));
  const names = Object.keys(presets.presets);
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
    args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11"],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 800, height: 800 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      const t = m.text();
      if (m.type() === "error" && !t.includes("404")) errors.push(t.slice(0, 1500));
    });
    await page.goto(`${base}/preview/index.html`);
    await page.waitForFunction(() => window.__ready === true);
    const opened = await page.evaluate(
      (u) => window.dollFace.open(u[0], u[1], u[2]),
      [`${base}/doll.glb`, `${base}/face/face.glsl`, `${base}/face/presets.json`],
    );
    console.log("face vertices", opened.faceVertices);
    const shoot = async (file, cells, options) => {
      const png = await page.evaluate(([c, o]) => window.dollFace.sheet(c, o), [cells, options]);
      fs.mkdirSync(renders, { recursive: true });
      fs.writeFileSync(
        path.join(renders, file),
        Buffer.from(png.slice(png.indexOf(",") + 1), "base64"),
      );
    };
    // Large: each expression at 0, 30 and 60 degrees (and a sheet per yaw, so each picture is big enough to read).
    for (const yaw of [0, 30, 60]) {
      await shoot(
        `faces-yaw${yaw}.png`,
        names.map((n) => ({ preset: n, label: `${n} @${yaw}`, cam: yaw })),
        { size: 340, cols: 6 },
      );
    }
    // Blends: any two expressions interpolate their numbers, so a transition has no jump.
    const blends = [
      ["neutral", "smile"],
      ["angry", "crying"],
      ["shocked", "laughing"],
      ["neutral", "angry"],
      ["smile", "blink"],
      ["dizzy", "heartEyes"],
      ["sleepy", "scared"],
      ["smug", "pout"],
      ["neutral", "grin"],
      ["gloom", "smile"],
      ["dead", "sparkle"],
      ["cursing", "worried"],
    ];
    await shoot(
      "faces-blends.png",
      blends.map(([a, b]) => ({ mix: [a, b, 0.5], label: a + " > " + b + " at 0.5", cam: 10 })),
      { size: 340, cols: 6 },
    );
    // At the page's size: the whole doll, 120 px tall, in a row for each expression group.
    const small = names.map((n) => ({
      preset: n,
      label: n,
      cam: 8,
      target: [0, 0.85, 0],
      dist: 7.4,
      fov: 14,
      pitch: 2,
    }));
    await shoot("faces-small-120px.png", small, { size: 130, cols: 12, label: false });
    // The same at 2x (a retina display shows the doll about 240 px tall).
    const small2 = names.map((n) => ({
      preset: n,
      label: n,
      cam: 8,
      target: [0, 0.85, 0],
      dist: 7.4,
      fov: 14,
      pitch: 2,
    }));
    await shoot("faces-small-240px.png", small2, { size: 250, cols: 6, label: false });
    // The falling scene shows her face about 60 percent of a 1440 by 900 screen: five expressions,
    // at yaw 0 and 45, one picture each.
    const large = [
      ["neutral", 0],
      ["crying", 45],
      ["laughing", 0],
      ["dizzy", 45],
      ["shocked", 0],
      ["angry", 45],
    ];
    for (const [name, yaw] of large) {
      const cell = { preset: name, cam: yaw, target: [0.01, 0.9, 0.2], dist: 1.9, fov: 20 };
      const png = await page.evaluate(([c]) => window.dollFace.shot(c, 1440, 900), [cell]);
      fs.mkdirSync(renders, { recursive: true });
      fs.writeFileSync(
        path.join(renders, `large-${name}-yaw${yaw}.png`),
        Buffer.from(png.slice(png.indexOf(",") + 1), "base64"),
      );
    }
    if (errors.length) console.log("errors:\n" + errors.join("\n"));
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
