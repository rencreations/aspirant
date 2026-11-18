// The gramophone of the home page: the FBX and its four maps to one small GLB.
//
//   node scripts/home/models/gramophone/build.cjs [--source DIR] [--out DIR] [--renders DIR]
//
// Reads D:\ren\aspirant\3d\gramophone (read only: source/ponograph.fbx and the four
// textures/lobby_MUSIC_*.png) and writes apps/web/public/models/home/gramophone.glb and
// gramophone-rig.json (--out DIR writes them into DIR instead, for a trial). The work is done in
// real Chrome with the site's own three (Playwright and three come from apps/web), served by a
// small server this script starts on a free port and stops again. The file is then loaded back
// with a plain GLTFLoader, as the page loads it, the pivots are tested on that copy, and the
// check pictures are drawn. README.md in this folder has the frame, the pivots and the lighting.
const fs = require("node:fs");
const http = require("node:http");
const { createRequire } = require("node:module");
const os = require("node:os");
const path = require("node:path");

const REPO = path.resolve(__dirname, "../../../..");
const WEB = path.join(REPO, "apps/web");
const web = createRequire(path.join(WEB, "package.json"));
const root = createRequire(path.join(REPO, "package.json"));
const { chromium } = web("@playwright/test");
const sharp = root("sharp");
const THREE_DIR = fs.realpathSync(path.join(WEB, "node_modules/three"));

const DEFAULT_SOURCE = "D:\\ren\\aspirant\\3d\\gramophone";
/** The page loads the file whole when the section comes near: keep it small. */
const MAX_BYTES = 1_300_000;
/** Textures: the base map at 2048 (the engraving of the horn reads at that size), the others at 1024. */
const BASE_SIZE = 2048;
const SMALL_SIZE = 1024;
/** The maps are DirectX (green down, an Unreal export): the raised brass ornament lit from the upper left decided it, see the README. */
const FLIP_NORMAL_G = true;

function option(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
function fail(message) {
  throw new Error(`gramophone build: ${message}`);
}

const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".glb": "model/gltf-binary",
  ".png": "image/png",
  ".fbx": "application/octet-stream",
};

function serve(source, memory) {
  const roots = [
    ["/page/", path.join(__dirname, "page") + path.sep],
    ["/three/", THREE_DIR + path.sep],
  ];
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent((req.url ?? "/").split("?")[0]);
    const send = (body, type) => {
      res.writeHead(200, { "content-type": type, "cache-control": "no-store" });
      res.end(body);
    };
    if (memory.has(url)) return send(memory.get(url), TYPES[path.extname(url)]);
    if (url === "/source/ponograph.fbx") {
      return send(fs.readFileSync(path.join(source, "source/ponograph.fbx")), TYPES[".fbx"]);
    }
    for (const [prefix, dir] of roots) {
      if (!url.startsWith(prefix)) continue;
      const file = path.normalize(path.join(dir, url.slice(prefix.length)));
      if (!file.startsWith(dir) || !fs.existsSync(file)) break;
      return send(fs.readFileSync(file), TYPES[path.extname(file)] ?? "application/octet-stream");
    }
    res.writeHead(404);
    res.end("not found");
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

/** The maps for the page: base at 2048, normal and the packed ORM at 1024, as lossless PNG. */
async function makeMaps(source) {
  const dir = path.join(source, "textures");
  const file = (name) => path.join(dir, `lobby_MUSIC_${name}.png`);
  const base = await sharp(file("BaseColor"))
    .removeAlpha()
    .resize(BASE_SIZE, BASE_SIZE, { kernel: "lanczos3" })
    .png()
    .toBuffer();

  const normalRaw = await sharp(file("Normal"))
    .removeAlpha()
    .resize(SMALL_SIZE, SMALL_SIZE, { kernel: "lanczos3" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (FLIP_NORMAL_G) {
    for (let i = 1; i < normalRaw.data.length; i += 3) normalRaw.data[i] = 255 - normalRaw.data[i];
  }
  const normal = await sharp(normalRaw.data, { raw: normalRaw.info }).png().toBuffer();

  const grey = async (name) =>
    sharp(file(name))
      .removeAlpha()
      .toColourspace("b-w")
      .resize(SMALL_SIZE, SMALL_SIZE, { kernel: "lanczos3" })
      .raw()
      .toBuffer();
  const rough = await grey("Roughness");
  const metal = await grey("Metallic");
  const orm = Buffer.alloc(SMALL_SIZE * SMALL_SIZE * 3);
  for (let i = 0; i < SMALL_SIZE * SMALL_SIZE; i++) {
    orm[i * 3] = 255; // occlusion: none is baked
    orm[i * 3 + 1] = rough[i];
    orm[i * 3 + 2] = metal[i];
  }
  const ormPng = await sharp(orm, { raw: { width: SMALL_SIZE, height: SMALL_SIZE, channels: 3 } })
    .png()
    .toBuffer();
  return { base, normal, orm: ormPng };
}

function glbJson(buffer) {
  if (buffer.readUInt32LE(0) !== 0x46546c67) fail("the output is not a GLB");
  const length = buffer.readUInt32LE(12);
  return JSON.parse(buffer.subarray(20, 20 + length).toString("utf8"));
}

function checkFile(json, bytes) {
  const used = json.extensionsUsed ?? [];
  if (!used.includes("EXT_texture_webp")) fail("no WebP pictures");
  if (used.includes("KHR_materials_unlit")) fail("the material is unlit: it must be lit PBR");
  if ((json.images ?? []).length !== 3) fail(`${(json.images ?? []).length} pictures, expected 3`);
  if ((json.materials ?? []).length !== 1) fail("expected one material");
  const m = json.materials[0];
  if (!m.normalTexture || !m.pbrMetallicRoughness?.baseColorTexture) fail("a map is missing");
  if (!m.pbrMetallicRoughness.metallicRoughnessTexture) fail("no packed roughness and metal map");
  if (bytes > MAX_BYTES) fail(`the file is ${bytes} bytes, over ${MAX_BYTES}`);
}

function savePng(address, file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from(address.slice(address.indexOf(",") + 1), "base64"));
}
function writeWhole(file, buffer) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const part = `${file}.part`;
  fs.writeFileSync(part, buffer);
  fs.renameSync(part, file);
}

const NAMES = [
  "gramophone",
  "cabinet",
  "horn",
  "crank",
  "platter",
  "soundbox",
  "anchor_needle_tip",
  "anchor_record_seat",
  "anchor_crank_handle",
  "anchor_bell_mouth",
  "anchor_elbow",
];

function checkLoaded(loaded) {
  for (const name of NAMES) {
    if (!loaded.nodes.some((n) => n.name === name)) fail(`the node ${name} is missing`);
  }
  if (loaded.meshes.some((m) => m.name === "disk")) fail("the default record is still in the file");
  for (const m of loaded.meshes) {
    if (m.material !== "MeshStandardMaterial") fail(`${m.name} loads as ${m.material}`);
    for (const k of ["map", "normalMap", "metalnessMap", "roughnessMap"]) {
      if (!m.maps.includes(k)) fail(`${m.name} has no ${k}`);
    }
  }
  const size = loaded.box.max.map((v, i) => v - loaded.box.min[i]);
  const want = [0.441, 0.532, 0.4]; // the depth is the crank handle (-0.223) to the bell (+0.166)
  size.forEach((v, i) => {
    if (Math.abs(v - want[i]) > 0.01)
      fail(`the box is ${size.map((s) => s.toFixed(3))}, expected ${want}`);
  });
  if (Math.abs(loaded.box.min[1]) > 0.002) fail("the floor is not at y 0");
}

async function main() {
  const source = path.resolve(
    option("source", process.env.HOME_GRAMOPHONE_SOURCE ?? DEFAULT_SOURCE),
  );
  for (const f of [
    "source/ponograph.fbx",
    "textures/lobby_MUSIC_BaseColor.png",
    "textures/lobby_MUSIC_Normal.png",
    "textures/lobby_MUSIC_Metallic.png",
    "textures/lobby_MUSIC_Roughness.png",
  ]) {
    if (!fs.existsSync(path.join(source, f))) fail(`missing ${path.join(source, f)}`);
  }
  const trial = option("out", null);
  const outDir = trial ? path.resolve(trial) : path.join(WEB, "public/models/home");
  const renders = path.resolve(
    option("renders", path.join(os.tmpdir(), "aspirant-home-gramophone")),
  );

  const maps = await makeMaps(source);
  const memory = new Map([
    ["/build/base.png", maps.base],
    ["/build/normal.png", maps.normal],
    ["/build/orm.png", maps.orm],
  ]);
  const server = await serve(source, memory);
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
    args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11"],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 800, height: 800 } });
    page.on("pageerror", (error) => console.error("[page]", error.message));
    page.on("console", (m) => {
      if (m.type() === "error" && !m.text().includes("404"))
        console.error("[console]", m.text().slice(0, 300));
    });
    await page.goto(`${base}/page/index.html`);
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 30_000 });

    const { report, base64 } = await page.evaluate(() =>
      window.gramophoneBuild.convert({
        fbx: "/source/ponograph.fbx",
        base: "/build/base.png",
        normal: "/build/normal.png",
        orm: "/build/orm.png",
      }),
    );
    if (report.warnings.length) fail(`the exporter warned: ${report.warnings.join("; ")}`);
    const glb = Buffer.from(base64, "base64");
    const json = glbJson(glb);
    checkFile(json, glb.length);

    memory.set("/build/gramophone.glb", glb);
    const loaded = await page.evaluate(() =>
      window.gramophoneBuild.loadGlb("/build/gramophone.glb"),
    );
    checkLoaded(loaded);
    const tests = await page.evaluate(() => window.gramophoneBuild.pivotTests());
    if (!tests.crankConstant) fail(`the crank does not turn about its pivot: ${tests.crankRadii}`);
    if (!(tests.platterMoves < 0.001)) fail(`the platter wanders: ${tests.platterMoves}`);
    for (const radius of tests.handleRadii) {
      if (Math.abs(radius - 0.06) > 0.0015)
        fail(`the handle's anchor is ${radius} m from the crank's axis, not 0.06`);
    }
    for (const [angle, error] of Object.entries(tests.needleAnchorError)) {
      if (error > 0.002)
        fail(`the needle's anchor is ${error} m off the tip at a lift of ${angle}`);
    }
    if (
      Math.abs(tests.recordSeatAfterTurn[0]) > 1e-4 ||
      Math.abs(tests.recordSeatAfterTurn[2]) > 1e-4
    ) {
      fail("the record's seat moves when the platter turns");
    }

    const shoot = async (name, cells, options) => {
      const png = await page.evaluate(
        ([c, o]) => window.gramophoneBuild.sheet(c, o),
        [cells, options],
      );
      savePng(png, path.join(renders, name));
    };
    const single = async (name, view, w = 1440, h = 900) => {
      const png = await page.evaluate(
        ([v, a, b]) => window.gramophoneBuild.shot(v, a, b),
        [view, w, h],
      );
      savePng(png, path.join(renders, name));
    };

    // The presentation: the owner's screenshot, horn to the left of the screen.
    const hero = { yaw: 220, cam: 0, pitch: 16, dist: 1.5, target: [0, 0.26, 0] };
    await single("hero-1440x900.png", hero);
    await shoot(
      "views.png",
      [0, 45, 90, 135, 180, 225, 270, 315].map((yaw) => ({
        label: `yaw ${yaw}`,
        yaw,
        pitch: 18,
        dist: 1.7,
      })),
      { size: 420, cols: 4 },
    );
    await shoot(
      "crank.png",
      [0, 90, 180, 270].map((a) => ({
        label: `crank ${a}`,
        crank: a,
        yaw: 0,
        cam: 200,
        pitch: 12,
        dist: 0.6,
        fov: 24,
        target: [-0.06, 0.12, -0.16],
      })),
      { size: 420, cols: 4 },
    );
    await shoot(
      "platter.png",
      [0, 90].map((a) => ({
        label: `platter ${a}`,
        platter: a,
        yaw: 0,
        cam: 0,
        pitch: 55,
        dist: 1.0,
        target: [0, 0.15, 0],
      })),
      { size: 480, cols: 2 },
    );
    const armView = { yaw: 0, pitch: 6, dist: 0.45, fov: 24, target: [-0.08, 0.17, -0.04] };
    await shoot(
      "tonearm.png",
      [
        { label: "front: needle down (0)", lift: 0 },
        { label: "front: lift 30", lift: 30 },
        { label: "front: lift 60", lift: 60 },
        { label: "front: lift -30", lift: -30 },
        { label: "front: lift -60", lift: -60 },
        { label: "side (+X): needle down (0)", lift: 0, cam: 90 },
        { label: "side: lift 30", lift: 30, cam: 90 },
        { label: "side: lift 60", lift: 60, cam: 90 },
        { label: "side: lift -30", lift: -30, cam: 90 },
        { label: "side: lift -60", lift: -60, cam: 90 },
      ].map((c) => ({ cam: 0, ...armView, ...c })),
      { size: 400, cols: 5 },
    );
    // The normal map, both ways, on the raised brass ornament of the +X face, lit by one lamp from
    // the upper left with no environment: a raised ornament is bright on its upper left edges.
    const ornament = {
      yaw: 0,
      cam: 90,
      pitch: 0,
      dist: 0.42,
      fov: 24,
      target: [0.18, 0.07, 0.0],
      env: 0,
      key: 4,
      rim: 0,
      keyPos: [1.2, 1.4, 0.9],
    };
    await shoot(
      "normal-check.png",
      [
        { label: "G as stored", flipG: false },
        { label: "G flipped", flipG: true },
      ].map((c) => ({ ...ornament, ...c })),
      { size: 640, cols: 2 },
    );
    // And the engraved bell, seen from the mouth, lit from above.
    const bell = {
      yaw: 0,
      cam: 70,
      pitch: 10,
      dist: 0.7,
      fov: 26,
      target: [0.1, 0.34, 0],
      env: 0.2,
      key: 3.5,
      rim: 0,
      keyPos: [0.3, 2, 0.4],
    };
    await shoot(
      "normal-check-bell.png",
      [
        { label: "G as stored", flipG: false },
        { label: "G flipped", flipG: true },
      ].map((c) => ({ ...bell, ...c })),
      { size: 640, cols: 2 },
    );
    await page.evaluate(() => window.gramophoneBuild.shot({ flipG: false }, 64, 64));
    // Tone mapping and light, side by side.
    await shoot(
      "recipes.png",
      [
        { label: "ACES, env 1, key 2.6", tone: "ACESFilmicToneMapping" },
        { label: "none, env 1, key 2.6", tone: "NoToneMapping" },
        { label: "AgX, env 1, key 2.6", tone: "AgXToneMapping" },
        { label: "ACES, env 0.6, key 3.4", tone: "ACESFilmicToneMapping", env: 0.6, key: 3.4 },
        { label: "ACES, env 1.5, key 1.5", tone: "ACESFilmicToneMapping", env: 1.5, key: 1.5 },
        { label: "none, env 0.8, key 2.0", tone: "NoToneMapping", env: 0.8, key: 2.0 },
      ].map((c) => ({ ...hero, ...c })),
      { size: 480, cols: 3 },
    );
    await page.evaluate(() => window.gramophoneBuild.setTone("ACESFilmicToneMapping"));

    writeWhole(path.join(outDir, "gramophone.glb"), glb);

    const extents = (min, max) => max.map((v, i) => Math.round((v - min[i]) * 1000) / 1000);
    const rig = {
      file: "gramophone.glb",
      bytes: glb.length,
      frame:
        "metres, Y up, floor at y 0, the cabinet centred on the Y axis; the horn points +X, tilted 19.4 degrees up; the crank is on -Z; the tonearm's post is on -X",
      box: {
        min: loaded.box.min,
        max: loaded.box.max,
        size: extents(loaded.box.min, loaded.box.max),
      },
      yawOfSource: { radians: report.yawRadians, degrees: report.yawDegrees },
      presentation: {
        yawDegrees: 220,
        yawRadians: 3.84,
        note: "rotate the root `gramophone` about Y by this to face the horn to the left of the screen, as in the owner's screenshot (the horn is +X: at 180 it is exactly screen left)",
      },
      nodes: Object.fromEntries(
        loaded.nodes
          .filter((n) => NAMES.includes(n.name))
          .map((n) => [n.name, { position: n.position, children: n.children }]),
      ),
      parts: report.parts,
      crank: {
        node: "crank",
        axis: [0, 0, 1],
        pivot: [-0.092, 0.104, -0.141],
        throwRadius: 0.06,
        handleAtRest: [-0.032, 0.104, -0.199],
        note: "rotation.z turns it; the arm lies along +X at rest; the whole turn is free",
      },
      platter: {
        node: "platter",
        axis: [0, 1, 0],
        pivot: [0, 0.148, 0],
        radius: tests.platter.radius,
        plateTopY: tests.platter.rimTopY,
        spindleTopY: tests.platter.innerTopY,
        recordSeatY: 0.1475,
        recordRadius: 0.14,
        note: "the default record is not in the file. Put the page's own record (4 to 5 mm thick, radius 0.14) on `anchor_record_seat` and make it a child of the `platter` node so it spins with it; the needle tip (y 0.152) then rests on its top. The spindle (a small brass stub) is part of the platter mesh and ends 4.6 mm above the top of a 4 mm record, so the label needs a hole of radius 0.006.",
      },
      soundbox: {
        node: "soundbox",
        pivot: [-0.081, 0.193, -0.045],
        liftAxis: [0.38, 0, 0.93],
        needleTipAtRest: tests.needleTip["0"],
        needleRadiusFromPlatterCentre: 0.097,
        needleTrace: tests.needleTip,
        liftDegrees: {
          down: 0,
          up: 50,
          note: "rotate the node about liftAxis (quaternion.setFromAxisAngle). A positive angle lifts the needle (9 mm at 35 degrees, 14 mm at 45, 17 mm at 50, 23 mm at 60) and draws it 3 cm in toward the platter's middle; a negative angle swings it out over the rim. The drum tilts like a soundbox rocked on its hinge and nothing intersects the horn. 0 is the needle down on a record.",
        },
      },
      anchors: Object.fromEntries(
        loaded.nodes
          .filter((n) => n.name.startsWith("anchor_"))
          .map((n) => [
            n.name,
            {
              parent: n.parent,
              localPosition: n.position,
              worldAtRest: n.world,
              note:
                n.parent === "gramophone"
                  ? "static"
                  : "rides on " + n.parent + ": its world position follows the part",
            },
          ]),
      ),
      bellMouth: report.bellMouth,
      textures: {
        map: { size: report.textures.base, colorSpace: "srgb" },
        normalMap: {
          size: report.textures.normal,
          convention: FLIP_NORMAL_G
            ? "flipped to OpenGL in the build"
            : "OpenGL (+Y up), as stored",
        },
        orm: {
          size: report.textures.orm,
          note: "R 255 (no baked occlusion), G roughness, B metalness; the one texture is metalnessMap and roughnessMap",
        },
      },
      lighting: loaded.recipe ?? null,
      tests,
    };
    rig.lighting = await page.evaluate(() => window.gramophoneBuild.RECIPE);
    writeWhole(
      path.join(outDir, "gramophone-rig.json"),
      Buffer.from(`${JSON.stringify(rig, null, 2)}\n`),
    );

    const summary = {
      bytes: glb.length,
      report,
      loaded: { parseMs: loaded.parseMs, meshes: loaded.meshes },
      tests,
      renders,
    };
    fs.mkdirSync(renders, { recursive: true });
    fs.writeFileSync(path.join(renders, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
