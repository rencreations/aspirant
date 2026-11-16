// Tetra of the About page: the rigged FBX, its rig file and three Mixamo clips to one small GLB.
//
//   node scripts/about/tetra/build.cjs [--source DIR] [--out DIR] [--renders DIR] [--quality 0..1]
//
// Reads D:\ren\aspirant\3d (read only; --source or ABOUT_TETRA_SOURCE names another folder with
// the same tree: angela/tetra.fbx, angela/tetra.rig.json, viewer/animations/*.fbx) and writes
// apps/web/public/models/about/tetra.glb (--out DIR writes it into DIR instead, for a trial). The
// work is done in real Chrome with the site's own three (Playwright and three come from
// apps/web), served by a small server this script starts on a free port and stops again. The file
// is then loaded back with GLTFLoader, as the page loads it, and checked: the build stops with an
// error if a bone, a target, a clip or a material is not what the page relies on. Check pictures
// go to --renders (default: the temp folder). README.md in this folder has the rig, the blink and
// the choices.
const fs = require("node:fs");
const http = require("node:http");
const { createRequire } = require("node:module");
const os = require("node:os");
const path = require("node:path");

const REPO = path.resolve(__dirname, "../../..");
const WEB = path.join(REPO, "apps/web");
const web = createRequire(path.join(WEB, "package.json"));
const { chromium } = web("@playwright/test");
// The folder of three behind the workspace link (its package.json is not an export).
const THREE_DIR = fs.realpathSync(path.join(WEB, "node_modules/three"));

const DEFAULT_SOURCE = "D:\\ren\\aspirant\\3d";
const MODEL_TS = path.join(WEB, "src/features/about/tetra/model.ts");

/** The files of the source folder the build reads, by the address the page asks for. */
const SOURCES = {
  "/source/tetra.fbx": "angela/tetra.fbx",
  "/source/tetra.rig.json": "angela/tetra.rig.json",
  "/source/walk.fbx": "viewer/animations/Walking.fbx",
  "/source/hiphop.fbx": "viewer/animations/Hip Hop Dancing.fbx",
  "/source/rumba.fbx": "viewer/animations/Rumba Dancing.fbx",
};

/** What the page looks for by name. */
const BONES = [
  "mixamorigHips",
  "mixamorigSpine",
  "mixamorigSpine1",
  "mixamorigSpine2",
  "mixamorigNeck",
  "mixamorigHead",
  "mixamorigLeftShoulder",
  "mixamorigLeftArm",
  "mixamorigLeftForeArm",
  "mixamorigLeftHand",
  "mixamorigRightShoulder",
  "mixamorigRightArm",
  "mixamorigRightForeArm",
  "mixamorigRightHand",
  "mixamorigLeftUpLeg",
  "mixamorigLeftLeg",
  "mixamorigRightUpLeg",
  "mixamorigRightLeg",
  "ear_L",
  "ear_R",
];
const EYE_TARGETS = ["blink_L", "blink_R", "squeeze", "wide", "look_x", "look_y"];
const MOUTH_TARGETS = [
  "mouth_a",
  "mouth_i",
  "mouth_u",
  "mouth_e",
  "mouth_o",
  "smile_mouth",
  "grin",
  "frown_mouth",
];
const CLIPS = ["walk", "hiphop", "rumba"];
/** The file must stay a small one: the page loads it whole when the section comes near. */
const MAX_BYTES = 1_200_000;

function option(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function fail(message) {
  throw new Error(`tetra build: ${message}`);
}

const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".glb": "model/gltf-binary",
  ".fbx": "application/octet-stream",
};

/** Serves the build page, the site's three, the sources and whatever the build holds in memory. */
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
    if (SOURCES[url]) {
      return send(fs.readFileSync(path.join(source, SOURCES[url])), TYPES[path.extname(url)]);
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
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

/** The JSON part of a GLB. */
function glbJson(buffer) {
  if (buffer.readUInt32LE(0) !== 0x46546c67) fail("the output is not a GLB");
  const length = buffer.readUInt32LE(12);
  return JSON.parse(buffer.subarray(20, 20 + length).toString("utf8"));
}

/** What the file itself must say, before anything loads it. */
function checkFile(json, bytes) {
  const used = json.extensionsUsed ?? [];
  if (!used.includes("KHR_materials_unlit")) fail("the materials are not unlit");
  if (!used.includes("EXT_texture_webp")) fail("no WebP pictures");
  for (const picture of json.images ?? []) {
    if (picture.mimeType !== "image/webp") fail(`a picture is ${picture.mimeType}`);
  }
  if ((json.images ?? []).length !== 3) fail(`${(json.images ?? []).length} pictures, expected 3`);
  if ((json.animations ?? []).length !== CLIPS.length) fail("the clips are not all in the file");
  if (bytes > MAX_BYTES) fail(`the file is ${bytes} bytes, over ${MAX_BYTES}`);
}

/** What GLTFLoader gives back, against what the page looks for. */
function checkLoaded(glb) {
  for (const name of BONES) {
    if (!glb.bones.some((b) => b.name === name)) fail(`the bone ${name} is missing`);
  }
  // A mesh of two materials comes back as two meshes: they are found by the material's name.
  const mesh = (material) =>
    glb.meshes.find((m) => m.materials.some((x) => x.name === material)) ??
    fail(`no mesh with the material ${material}`);
  const body = mesh("tetra_body");
  const hair = mesh("tetra_hair");
  const eyes = mesh("tetra_eyes");
  const mouth = mesh("tetra_mouth");
  for (const m of [body, hair, eyes, mouth]) {
    if (!m.skinned) fail(`${m.node} is not skinned`);
    for (const material of m.materials) {
      if (material.type !== "MeshBasicMaterial") fail(`${material.name} loads as ${material.type}`);
      if (!material.map) fail(`${material.name} has no picture`);
    }
  }
  if (body.targets.length || hair.targets.length) fail("the body has morph targets");
  for (const name of EYE_TARGETS) {
    if (!eyes.targets.includes(name)) fail(`the eyes have no target ${name}`);
  }
  for (const name of MOUTH_TARGETS) {
    if (!mouth.targets.includes(name)) fail(`the mouth has no target ${name}`);
  }
  if (!mouth.materials[0].transparent) fail("the mouth's material is not see-through");
  for (const name of CLIPS) {
    if (!glb.animations.some((clip) => clip.name === name)) fail(`no clip ${name}`);
  }
  if (!(glb.extras?.springs?.length > 0)) fail("the springs are not in the file");
  if (!(glb.extras?.clips?.walk?.speed > 0)) fail("the walk has no speed");
  const height = glb.box.max[1] - glb.box.min[1];
  if (Math.abs(height - 0.649) > 0.01) fail(`the doll is ${height} m tall`);
}

function savePng(address, file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from(address.slice(address.indexOf(",") + 1), "base64"));
}

/** Written beside the target first, then moved over it: the dev server never sees half a file. */
function writeWhole(file, buffer) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const part = `${file}.part`;
  fs.writeFileSync(part, buffer);
  fs.renameSync(part, file);
}

const FACE = { target: [-0.01, 0.42, 0.05], across: 0.26 };
const FRONT = [0, 0, 1];
const QUARTER = [0.6, 0.1, 1];
const STEPS = [0, 0.25, 0.5, 0.75, 1];

async function main() {
  const source = path.resolve(option("source", process.env.ABOUT_TETRA_SOURCE ?? DEFAULT_SOURCE));
  for (const file of Object.values(SOURCES)) {
    if (!fs.existsSync(path.join(source, file))) fail(`missing ${path.join(source, file)}`);
  }
  const trial = option("out", null);
  const modelOut = trial
    ? path.join(path.resolve(trial), "tetra.glb")
    : path.join(WEB, "public/models/about/tetra.glb");
  const renders = path.resolve(option("renders", path.join(os.tmpdir(), "aspirant-about-tetra")));
  const quality = Number(option("quality", "0.95"));

  const memory = new Map();
  const server = await serve(source, memory);
  const base = `http://127.0.0.1:${server.address().port}`;
  // Real Chrome with the GPU: the pictures are drawn by the same WebGL the visitor has.
  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
    args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11"],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 800, height: 800 } });
    page.on("pageerror", (error) => console.error("[page]", error.message));
    await page.goto(`${base}/page/index.html`);
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 30_000 });

    // 1. Convert.
    const { report, base64 } = await page.evaluate(
      (options) =>
        window.tetraBuild.convert(
          {
            fbx: "/source/tetra.fbx",
            rig: "/source/tetra.rig.json",
            clips: {
              walk: "/source/walk.fbx",
              hiphop: "/source/hiphop.fbx",
              rumba: "/source/rumba.fbx",
            },
          },
          options,
        ),
      { quality },
    );
    if (report.warnings.length) fail(`the exporter warned: ${report.warnings.join("; ")}`);
    const glb = Buffer.from(base64, "base64");
    const json = glbJson(glb);
    checkFile(json, glb.length);

    // 2. The blink of the source, for the record, before the built file takes the stage.
    await page.evaluate(() => window.tetraBuild.loadFbx("/source/tetra.fbx"));
    const before = await page.evaluate(
      ([face, front, quarter, steps]) =>
        window.tetraBuild.sheet(
          [front, quarter].flatMap((view) =>
            steps.map((b) => ({
              label: `source blink ${b}`,
              morph: { blink: b },
              view,
              ...face,
            })),
          ),
        ),
      [FACE, FRONT, QUARTER, STEPS],
    );
    savePng(before, path.join(renders, "blink-before.png"));

    // 3. Load the built file back as the page does.
    memory.set("/build/tetra.glb", glb);
    const loaded = await page.evaluate(() => window.tetraBuild.loadGlb("/build/tetra.glb"));
    checkLoaded(loaded);

    // 4. Check pictures.
    const shoot = async (name, cells, options) => {
      const png = await page.evaluate(([c, o]) => window.tetraBuild.sheet(c, o), [cells, options]);
      savePng(png, path.join(renders, name));
    };
    await shoot(
      "views.png",
      [
        { label: "front", view: FRONT },
        { label: "three-quarter", view: [0.7, 0.25, 1] },
        { label: "side", view: [1, 0, 0] },
        { label: "back", view: [0, 0, -1] },
        { label: "the other three-quarter", view: [-0.7, 0.25, 1] },
      ],
      { size: 420, cols: 5 },
    );
    await shoot(
      "blink-after.png",
      [
        ...[FRONT, QUARTER, [-0.6, 0.1, 1]].flatMap((view) =>
          STEPS.map((b) => ({
            label: `blink ${b}`,
            morph: { blink_L: b, blink_R: b },
            view,
            ...FACE,
          })),
        ),
        { label: "at the page's size", view: FRONT, morph: {} },
        { label: "shut, at the page's size", view: FRONT, morph: { blink_L: 1, blink_R: 1 } },
        { label: "a wink", view: FRONT, morph: { blink_L: 1, smile_mouth: 1 }, ...FACE },
        { label: "half shut", view: FRONT, morph: { blink_L: 0.4, blink_R: 0.4 }, ...FACE },
        { label: "squeeze", view: FRONT, morph: { squeeze: 1 }, ...FACE },
      ],
      { size: 360, cols: 5 },
    );
    const faces = [
      ["rest", {}],
      ["wide", { wide: 1 }],
      ["look_x 1", { look_x: 1 }],
      ["look_x -1", { look_x: -1 }],
      ["look_y 1", { look_y: 1 }],
      ["look_y -1", { look_y: -1 }],
      ["squeeze + mouth_a", { squeeze: 1, mouth_a: 1 }],
      ["happy: shut + grin", { blink_L: 1, blink_R: 1, grin: 1 }],
      ["smile 0.6", { smile_mouth: 0.6 }],
      ["surprised: wide + o", { wide: 1, mouth_o: 0.9 }],
      ...MOUTH_TARGETS.map((name) => [name, { [name]: 1 }]),
    ];
    await shoot(
      "faces.png",
      faces.flatMap(([label, morph]) => [
        { label, morph, view: FRONT, ...FACE },
        { label: `${label}, from the side`, morph, view: QUARTER, ...FACE },
      ]),
      { size: 300, cols: 6 },
    );
    for (const name of CLIPS) {
      const seconds = loaded.animations.find((clip) => clip.name === name).seconds;
      const cells = [];
      for (const view of [
        [0.55, 0.12, 1],
        [-1, 0.1, 0.25],
      ]) {
        for (let k = 0; k < 8; k++) {
          const t = (seconds * k) / 8;
          cells.push({ label: `${name} ${t.toFixed(2)} s`, clip: name, t, view, across: 0.78 });
        }
      }
      await shoot(`clip-${name}.png`, cells, { size: 420, cols: 4 });
    }
    const tips = {};
    for (const name of CLIPS) {
      const rows = await page.evaluate((n) => window.tetraBuild.legTips(n), name);
      const all = rows.flat();
      tips[name] = { lowest: Math.min(...all), highest: Math.max(...all) };
    }

    writeWhole(modelOut, glb);

    const summary = {
      model: { file: modelOut, bytes: glb.length, ...report },
      loaded: {
        parseMs: loaded.parseMs,
        box: loaded.box,
        bones: loaded.bones.map((b) => b.name),
        meshes: loaded.meshes,
        animations: loaded.animations,
        extensionsUsed: json.extensionsUsed,
        springs: loaded.extras.springs.map((row) => row.bone),
        colliders: loaded.extras.colliders.map((row) => row.bone),
      },
      legTips: tips,
      renders,
    };
    fs.mkdirSync(renders, { recursive: true });
    fs.writeFileSync(path.join(renders, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
    console.log(JSON.stringify(summary, null, 2));

    if (!trial && fs.existsSync(MODEL_TS)) {
      const said = /TETRA_MODEL_BYTES = ([\d_]+)/.exec(fs.readFileSync(MODEL_TS, "utf8"));
      const bytes = said ? Number(said[1].replaceAll("_", "")) : null;
      if (bytes !== glb.length) {
        console.log(
          `\nTETRA_MODEL_BYTES in features/about/tetra/model.ts says ${bytes}. The file is ${glb.length}: write it there.`,
        );
      }
    }
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
