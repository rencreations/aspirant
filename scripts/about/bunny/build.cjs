// Mr. Bunny, Chang'e's drone, for the About page: the source FBX to one small rigged GLB.
//
//   node scripts/about/bunny/build.cjs [--source FILE] [--out DIR] [--renders DIR] [--no-renders]
//
// Reads D:\ren\aspirant\3d\change\change.fbx (read only; --source or ABOUT_BUNNY_FBX names another
// file) and writes apps/web/public/models/about/bunny.glb (--out DIR writes it into DIR instead,
// for a trial). The drone is taken apart, rigged and given its targets in real Chrome with the
// site's own three (page/convert.js); Node writes the file with glTF Transform (write.cjs); the
// file is loaded back with GLTFLoader, as the page loads it, and checked; then the check pictures
// are drawn into --renders (default: aspirant-about-bunny in the temp folder). The faces in them
// are drawn by the page's own module, apps/web/src/features/about/bunny/face.ts.
// README.md in this folder has the rig, the targets and the faces.
const fs = require("node:fs");
const http = require("node:http");
const { createRequire } = require("node:module");
const os = require("node:os");
const path = require("node:path");

const { writeGlb } = require("./write.cjs");

const REPO = path.resolve(__dirname, "../../..");
const WEB = path.join(REPO, "apps/web");
const web = createRequire(path.join(WEB, "package.json"));
const { chromium } = web("@playwright/test");
const ts = web("typescript");
const sharp = createRequire(path.join(REPO, "package.json"))("sharp");
// The folder of three behind the workspace link (its package.json is not an export).
const THREE_DIR = fs.realpathSync(path.join(WEB, "node_modules/three"));

const DEFAULT_SOURCE = "D:\\ren\\aspirant\\3d\\change\\change.fbx";
const FEATURE = path.join(WEB, "src/features/about/bunny");
const MODEL_TS = path.join(FEATURE, "model.ts");
const FACE_TS = path.join(FEATURE, "face.ts");

/** The bones the page looks for by name, and what each hangs on. */
const BONES = {
  body: "bunny",
  ear_L_1: "body",
  ear_L_2: "ear_L_1",
  ear_L_3: "ear_L_2",
  ear_R_1: "body",
  ear_R_2: "ear_R_1",
  ear_R_3: "ear_R_2",
  foot_L: "body",
  foot_R: "body",
};
const TARGETS = [
  "squash",
  "stretch",
  "puff",
  "lean_L",
  "lean_R",
  "brow_down",
  "brow_up",
  "pods_out",
  "lens_out",
  "ear_L_droop",
  "ear_R_droop",
  "ear_L_fold",
  "ear_R_fold",
  "ear_L_perk",
  "ear_R_perk",
  "ear_L_curl",
  "ear_R_curl",
];
/** The whole drone in the source, in metres: across the ears, the height, the depth. */
const SIZE = { x: 0.5197, y: 0.5146, z: 0.4125 };
/** The file must stay small: the page loads it whole. */
const MAX_BYTES = 400_000;

function option(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const flag = (name) => process.argv.includes(`--${name}`);

function fail(message) {
  throw new Error(`bunny build: ${message}`);
}

const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".glb": "model/gltf-binary",
  ".fbx": "application/octet-stream",
};

/** The page's own face module, as plain JavaScript the build page can import. */
function faceModule() {
  const source = fs.readFileSync(FACE_TS, "utf8");
  return ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
}

/** Serves the build page, the site's three, the source and whatever the build holds in memory. */
function serve(sourceFile, memory) {
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
    if (url === "/source/change.fbx") return send(fs.readFileSync(sourceFile), TYPES[".fbx"]);
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
  for (const name of ["KHR_materials_unlit", "EXT_texture_webp", "KHR_mesh_quantization"]) {
    if (!used.includes(name)) fail(`the file does not use ${name}`);
  }
  if ((json.images ?? []).length !== 1) fail(`${(json.images ?? []).length} pictures, expected 1`);
  if (json.images[0].mimeType !== "image/webp") fail(`the picture is ${json.images[0].mimeType}`);
  if ((json.skins ?? []).length !== 1) fail(`${(json.skins ?? []).length} skins, expected 1`);
  if ((json.animations ?? []).length !== 0) fail("the file has animations");
  if ((json.meshes ?? []).length !== 1) fail(`${json.meshes.length} meshes, expected 1`);
  const mesh = json.meshes[0];
  if (JSON.stringify(mesh.extras?.targetNames) !== JSON.stringify(TARGETS)) {
    fail(`the targets are ${JSON.stringify(mesh.extras?.targetNames)}`);
  }
  for (const p of mesh.primitives) {
    if ((p.targets ?? []).length !== TARGETS.length) fail("a primitive lacks targets");
    for (const t of p.targets) {
      if (Object.keys(t).join() !== "POSITION") fail("a target holds more than places");
      const a = json.accessors[t.POSITION];
      if (a.sparse && a.sparse.count < 1) fail("a sparse target with no values");
      if (!a.min || !a.max) fail("a target without its bounds");
    }
  }
  for (const node of json.nodes) {
    if (node.scale) fail(`${node.name} carries a scale`);
  }
  if (bytes > MAX_BYTES) fail(`the file is ${bytes} bytes, over ${MAX_BYTES}`);
}

/** What GLTFLoader gives back, against what the page looks for and what the page computed. */
function checkLoaded(glb, primitives) {
  const node = (name) => glb.nodes.find((n) => n.name === name) ?? fail(`no node ${name}`);
  for (const [name, parent] of Object.entries(BONES)) {
    const n = node(name);
    if (n.type !== "Bone") fail(`${name} is a ${n.type}`);
    if (n.parent !== parent) fail(`${name} hangs on ${n.parent}, expected ${parent}`);
    if (n.scale.some((v) => Math.abs(v - 1) > 1e-6)) fail(`${name} carries a scale`);
  }
  const body = node("body");
  if (body.position.some((v) => v !== 0) || body.quaternion[3] !== 1) fail("the body is moved");
  const meshes = glb.nodes.filter((n) => n.mesh);
  if (meshes.length !== 2) fail(`${meshes.length} meshes, expected 2`);
  for (const material of ["bunny_body", "bunny_face"]) {
    const m = meshes.find((n) => n.mesh.material === material) ?? fail(`no mesh ${material}`);
    if (!m.mesh.skinned) fail(`${material} is not skinned`);
    if (m.mesh.materialType !== "MeshBasicMaterial")
      fail(`${material} loads as ${m.mesh.materialType}`);
    if (!m.mesh.map) fail(`${material} has no picture`);
    if (m.mesh.map.flipY !== false) fail("the picture loads flipped");
    if (m.mesh.side !== 0) fail(`${material} is not one sided`);
    if (JSON.stringify(m.mesh.targets) !== JSON.stringify(TARGETS)) {
      fail(`${material} has the targets ${m.mesh.targets.join(", ")}`);
    }
    if (JSON.stringify(m.mesh.bones) !== JSON.stringify(Object.keys(BONES))) {
      fail(`${material} has the bones ${m.mesh.bones.join(", ")}`);
    }
    for (const attribute of ["normal", "position", "uv", "skinIndex", "skinWeight"]) {
      if (!m.mesh.attributes[attribute]) fail(`${material} has no ${attribute}`);
    }
    // Every target reaches as far in the loaded file as it did when it was computed.
    const computed = primitives[material === "bunny_body" ? "body" : "face"].targets;
    TARGETS.forEach((name, t) => {
      let want = 0;
      const d = computed[t];
      for (let i = 0; i < d.length; i += 3)
        want = Math.max(want, Math.hypot(d[i], d[i + 1], d[i + 2]));
      if (Math.abs(m.mesh.reach[t] - want) > 1e-4) {
        fail(
          `${material}: ${name} reaches ${m.mesh.reach[t]} m in the file, ${want} m as computed`,
        );
      }
    });
  }
  const mirrored = (a, b, what) => {
    const pa = node(a).position;
    const pb = node(b).position;
    if (
      Math.abs(pa[0] + pb[0]) > 1e-5 ||
      Math.abs(pa[1] - pb[1]) > 1e-5 ||
      Math.abs(pa[2] - pb[2]) > 1e-5
    ) {
      fail(`the ${what} are not mirrors`);
    }
  };
  mirrored("ear_L_1", "ear_R_1", "ears' hinges");
  mirrored("foot_L", "foot_R", "feet's pivots");
  if (node("ear_L_1").position[0] <= 0) fail("the left ear is not on +X");
  const size = [0, 1, 2].map((k) => glb.box.max[k] - glb.box.min[k]);
  const want = [SIZE.x, SIZE.y, SIZE.z];
  for (let k = 0; k < 3; k++) {
    if (Math.abs(size[k] - want[k]) > 0.002)
      fail(`the drone is ${size.join(" by ")} m, expected ${want.join(" by ")}`);
  }
  const extras = glb.extras ?? fail("no extras on the root");
  if (!(extras.screen?.halfWidth > 20)) fail("the screen is not described");
  for (const target of extras.bodyTargets ?? []) {
    for (const bone of ["ear_L_1", "ear_R_1", "foot_L", "foot_R"]) {
      const h = extras.hinges?.[target]?.[bone];
      if (!h || h.shift.length !== 3 || h.turn.length !== 4) fail(`no hinge for ${target} ${bone}`);
    }
  }
}

/** Corners at the same rest place move together under every target, in both primitives. */
function checkSeams(primitives) {
  const byPlace = new Map();
  let shared = 0;
  let worst = 0;
  for (const p of Object.values(primitives)) {
    const count = p.position.length / 3;
    for (let i = 0; i < count; i++) {
      // A rest place, quantised as the file stores it.
      const key = [0, 1, 2].map((k) => Math.round(p.position[i * 3 + k] * 32767)).join();
      const moves = p.targets.map((t) => [0, 1, 2].map((k) => Math.round(t[i * 3 + k] * 32767)));
      const seen = byPlace.get(key);
      if (!seen) {
        byPlace.set(key, moves);
        continue;
      }
      shared++;
      moves.forEach((m, t) => {
        for (let k = 0; k < 3; k++) worst = Math.max(worst, Math.abs(m[k] - seen[t][k]));
      });
    }
  }
  if (worst > 0) fail(`two corners at one place part under a target (by ${worst} steps)`);
  return { sharedCorners: shared };
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

/** The picture as lossless WebP, decoded again and compared texel for texel. */
async function encodePicture(pngAddress) {
  const png = Buffer.from(pngAddress.slice(pngAddress.indexOf(",") + 1), "base64");
  const webp = await sharp(png).removeAlpha().webp({ lossless: true, effort: 6 }).toBuffer();
  const a = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const b = await sharp(webp).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (a.info.width !== b.info.width || a.info.height !== b.info.height)
    fail("the WebP changed size");
  let differ = 0;
  for (let i = 0; i < a.data.length; i++) if (a.data[i] !== b.data[i]) differ++;
  if (differ) fail(`the WebP differs from the picture in ${differ} values`);
  return { webp, png, width: a.info.width, height: a.info.height };
}

module.exports = { BONES, TARGETS, fail, savePng };

const FRONT = [0, 0, 1];
const QUARTER = [0.75, 0.3, 1];
const SIDE = [1, 0, 0];

async function main() {
  const sourceFile = path.resolve(option("source", process.env.ABOUT_BUNNY_FBX ?? DEFAULT_SOURCE));
  if (!fs.existsSync(sourceFile)) fail(`missing ${sourceFile}`);
  const trial = option("out", null);
  const modelOut = trial
    ? path.join(path.resolve(trial), "bunny.glb")
    : path.join(WEB, "public/models/about/bunny.glb");
  const renders = path.resolve(
    option("renders", path.join(os.tmpdir(), "aspirant-about-bunny", "renders")),
  );

  const memory = new Map();
  memory.set("/build/face.js", faceModule());
  const server = await serve(sourceFile, memory);
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
    page.on("console", (message) => {
      if (message.type() === "error" || message.type() === "warning") {
        console.error(`[${message.type()}]`, message.text());
      }
    });
    await page.goto(`${base}/page/index.html`);
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 30_000 });

    // 1. Convert, in the page.
    const made = await page.evaluate(() => window.bunnyBuild.convert("/source/change.fbx"));
    const { report } = made;
    const seams = checkSeams(made.primitives);

    // 2. The picture and the file.
    const picture = await encodePicture(made.picture);
    savePng(made.picture, path.join(renders, "picture.png"));
    const written = await writeGlb(made, picture.webp);
    const glb = written.glb;
    const json = glbJson(glb);
    checkFile(json, glb.length);

    // 3. Load the built file back as the page does.
    memory.set("/build/bunny.glb", glb);
    const loaded = await page.evaluate(() => window.bunnyBuild.loadGlb("/build/bunny.glb"));
    checkLoaded(loaded, made.primitives);

    const summary = {
      model: {
        file: modelOut,
        bytes: glb.length,
        picture: { webp: picture.webp.length, width: picture.width, height: picture.height },
      },
      report,
      seams,
      targets: written.targets,
      loaded: {
        parseMs: loaded.parseMs,
        box: loaded.box,
        nodes: loaded.nodes,
        extensionsUsed: json.extensionsUsed,
        extensionsRequired: json.extensionsRequired,
      },
      renders,
    };

    if (!flag("no-renders")) {
      const { drawAll } = require("./pictures.cjs");
      summary.checks = await drawAll(page, { renders, report, loaded, made, base });
    }

    writeWhole(modelOut, glb);
    fs.mkdirSync(renders, { recursive: true });
    fs.writeFileSync(path.join(renders, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
    console.log(
      JSON.stringify(
        {
          bytes: glb.length,
          picture: summary.model.picture,
          vertices: report.vertices,
          triangles: report.triangles,
          size: [0, 1, 2].map((k) => +(loaded.box.max[k] - loaded.box.min[k]).toFixed(4)),
          checks: summary.checks,
          renders,
        },
        null,
        2,
      ),
    );

    if (!trial && fs.existsSync(MODEL_TS)) {
      const text = fs.readFileSync(MODEL_TS, "utf8");
      const said = /BUNNY_MODEL_BYTES = ([\d_]+)/.exec(text);
      const bytes = said ? Number(said[1].replaceAll("_", "")) : null;
      if (bytes !== glb.length) {
        console.log(
          `\nBUNNY_MODEL_BYTES in features/about/bunny/model.ts says ${bytes}. The file is ${glb.length}: write it there.`,
        );
      }
    }
  } finally {
    await browser.close();
    server.close();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack ?? error.message ?? error);
    process.exit(1);
  });
}
