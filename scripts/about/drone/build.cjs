// The drone of the About page: the rigged FBX to one small GLB, and a still picture of it.
//
//   node scripts/about/drone/build.cjs [--fbx PATH] [--out DIR] [--renders DIR]
//                                      [--image webp|png] [--quality 0..1]
//
// Reads D:\ren\aspirant\3d\angela\drone.fbx (read only; --fbx or ABOUT_DRONE_FBX names another)
// and writes apps/web/public/models/about/drone.glb and apps/web/public/img/about/drone.webp
// (--out DIR writes both into DIR instead, for a trial). The work is done in real Chrome with the
// site's own three (Playwright and three come from apps/web), served by a small server this
// script starts on a free port and stops again. The file is then loaded back with GLTFLoader, as
// the page loads it, and checked: the build stops with an error if a bone, a material or the skin
// is not what the page relies on. Check pictures go to --renders (default: the temp folder).
// README.md in this folder has the rig, the face atlas and the choices.
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

const DEFAULT_FBX = "D:\\ren\\aspirant\\3d\\angela\\drone.fbx";
const MEDIA_TS = path.join(WEB, "src/features/about/media.ts");

/** The ten bones, child after parent, with the parent the page expects. */
const BONES = [
  ["drone_root", "drone_armature"],
  ["body", "drone_root"],
  ["wing_L", "body"],
  ["wing_R", "body"],
  ["fin_L", "body"],
  ["fin_R", "body"],
  ["antenna_L_01", "body"],
  ["antenna_L_02", "antenna_L_01"],
  ["antenna_R_01", "body"],
  ["antenna_R_02", "antenna_R_01"],
];
const MATERIALS = ["drone_body", "drone_face"];

/**
 * The pose of the still, in degrees: the pose the live drone rests in on the first screen. The
 * body is turned to the right of the screen and a little toward the visitor, the nose a touch
 * down so the top of the head shows, and the wings are a little open, as in a glide.
 */
const HERO_POSE = { yaw: 40, pitch: 6, roll: -4, spread: 35, raise: 12 };
const STILL_WIDTH = 1440;
const STILL_QUALITY = 0.9;

function option(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function fail(message) {
  throw new Error(`drone build: ${message}`);
}

const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".glb": "model/gltf-binary",
  ".fbx": "application/octet-stream",
};

/** Serves the build page, the site's three, the FBX and whatever the build holds in memory. */
function serve(fbx, memory) {
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
    if (url === "/source/drone.fbx") return send(fs.readFileSync(fbx), TYPES[".fbx"]);
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
function checkFile(json, image) {
  const used = json.extensionsUsed ?? [];
  if (!used.includes("KHR_materials_unlit")) fail("the materials are not unlit");
  if (image === "image/webp" && !used.includes("EXT_texture_webp")) fail("no WebP pictures");
  const names = (json.nodes ?? []).map((n) => n.name);
  for (const [bone] of BONES) if (!names.includes(bone)) fail(`the bone ${bone} is missing`);
  if ((json.skins ?? []).length !== 1) fail("expected one skin");
  if (json.skins[0].joints.length !== BONES.length) fail("the skin does not have ten joints");
  const materials = (json.materials ?? []).map((m) => m.name);
  for (const name of MATERIALS) if (!materials.includes(name)) fail(`no material ${name}`);
  for (const mesh of json.meshes ?? []) {
    for (const primitive of mesh.primitives) {
      if (primitive.targets) fail("a morph target is left in the file");
    }
  }
  for (const picture of json.images ?? []) {
    if (picture.mimeType !== image) fail(`a picture is ${picture.mimeType}, not ${image}`);
  }
  if ((json.animations ?? []).length) fail("the file has an animation");
}

/** What GLTFLoader gives back, against the FBX and against what the page looks for. */
function checkLoaded(glb, fbx) {
  for (const [name, parent] of BONES) {
    const bone = glb.bones.find((b) => b.name === name);
    if (!bone) fail(`after loading, the bone ${name} is missing`);
    if (bone.parent !== parent) fail(`${name} hangs on ${bone.parent}, not on ${parent}`);
    const source = fbx.bones.find((b) => b.name === name);
    for (const key of ["position", "quaternion", "scale"]) {
      const drift = Math.max(...bone[key].map((v, i) => Math.abs(v - source[key][i])));
      if (drift > 1e-4) fail(`${name}: the rest ${key} moved by ${drift}`);
    }
  }
  if (glb.bones.length !== BONES.length) fail(`${glb.bones.length} bones, expected ten`);
  for (const name of MATERIALS) {
    const mesh = glb.meshes.find((m) => m.material === name);
    if (!mesh) fail(`no mesh with the material ${name}`);
    if (!mesh.skinned) fail(`${name} is not skinned`);
    if (mesh.materialType !== "MeshBasicMaterial") fail(`${name} loads as ${mesh.materialType}`);
    if (mesh.morphTargets) fail(`${name} has morph targets`);
    if (!mesh.map) fail(`${name} has no picture`);
    if (mesh.joints.length !== BONES.length)
      fail(`${name} is bound to ${mesh.joints.length} bones`);
  }
  if (glb.meshes.length !== MATERIALS.length) fail(`${glb.meshes.length} meshes, expected two`);
  for (const key of ["min", "max"]) {
    const drift = Math.max(...glb.box[key].map((v, i) => Math.abs(v - fbx.box[key][i])));
    if (drift > 1e-3) fail(`the box moved by ${drift}`);
  }
  if (glb.animations) fail("the file loads with an animation");
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

async function main() {
  const fbx = path.resolve(option("fbx", process.env.ABOUT_DRONE_FBX ?? DEFAULT_FBX));
  if (!fs.existsSync(fbx)) fail(`missing ${fbx}`);
  const trial = option("out", null);
  const modelOut = trial
    ? path.join(path.resolve(trial), "drone.glb")
    : path.join(WEB, "public/models/about/drone.glb");
  const stillOut = trial
    ? path.join(path.resolve(trial), "drone.webp")
    : path.join(WEB, "public/img/about/drone.webp");
  const renders = path.resolve(option("renders", path.join(os.tmpdir(), "aspirant-about-drone")));
  const image = option("image", "webp") === "png" ? "image/png" : "image/webp";
  const quality = Number(option("quality", "1"));

  const memory = new Map();
  const server = await serve(fbx, memory);
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
      (options) => window.droneBuild.convert("/source/drone.fbx", options),
      { image, quality },
    );
    if (report.warnings.length) fail(`the exporter warned: ${report.warnings.join("; ")}`);
    const glb = Buffer.from(base64, "base64");
    const json = glbJson(glb);
    checkFile(json, image);

    // 2. Load it back as the page does, and compare with the FBX.
    memory.set("/build/drone.glb", glb);
    const loaded = await page.evaluate(() => window.droneBuild.loadGlb("/build/drone.glb"));
    const source = await page.evaluate(() => window.droneBuild.describeFbx("/source/drone.fbx"));
    checkLoaded(loaded, source);
    const errors = {};
    for (const name of MATERIALS) {
      errors[name] = await page.evaluate(
        (material) => window.droneBuild.pictureError("/source/drone.fbx", material),
        name,
      );
    }

    // 3. Check pictures: the views, one wing pose, the nine faces, the hero pose at display size.
    const glide = { spread: 50, raise: 20 };
    const up = { spread: 60, raise: 60, fins: 12 };
    const views = await page.evaluate(
      ([a, b, hero]) =>
        window.droneBuild.sheet([
          { label: "front", view: [0, 0, 1] },
          { label: "three-quarter", view: [0.72, 0.42, 1] },
          { label: "back", view: [0, 0, -1] },
          { label: "three-quarter back", view: [-0.72, 0.42, -1] },
          { label: "glide: spread 50, raise 20", view: [0.72, 0.42, 1], pose: a },
          { label: "up stroke: spread 60, raise 60\nfins 12", view: [0.4, 0.2, 1], pose: b },
          { label: "the same, from behind", view: [-0.72, 0.42, -1], pose: b },
          { label: "the still's pose", pose: hero },
        ]),
      [glide, up, HERO_POSE],
    );
    savePng(views, path.join(renders, "views.png"));
    const faces = await page.evaluate(() =>
      window.droneBuild.sheet(
        Object.keys(window.droneBuild.FACE_CELLS).map((face) => ({
          label: `${face}  ${window.droneBuild.FACE_CELLS[face].join(", ")}`,
          face,
          across: 0.62,
        })),
        { size: 320, cols: 3 },
      ),
    );
    savePng(faces, path.join(renders, "faces.png"));
    const hero = await page.evaluate(
      (pose) => window.droneBuild.picture({ width: 1500, height: 1300, across: 0.95, pose }),
      HERO_POSE,
    );
    savePng(hero, path.join(renders, "hero-2x.png"));

    // 4. The still.
    const still = await page.evaluate(
      ([width, pose, q]) => window.droneBuild.still({ width, pose, quality: q }),
      [STILL_WIDTH, HERO_POSE, STILL_QUALITY],
    );
    const stillBytes = Buffer.from(still.base64, "base64");
    const grounds = await page.evaluate(
      (data) => window.droneBuild.onGrounds(data, ["#f4f6f9", "#0b0f16"]),
      still.base64,
    );
    savePng(grounds, path.join(renders, "still-on-grounds.png"));

    writeWhole(modelOut, glb);
    writeWhole(stillOut, stillBytes);

    const { base64: _dropped, ...stillFacts } = still;
    const summary = {
      model: { file: modelOut, bytes: glb.length, image, quality, ...report },
      loaded: {
        parseMs: loaded.parseMs,
        box: loaded.box,
        meshes: loaded.meshes.map((m) => ({
          material: m.material,
          triangles: m.triangles,
          vertices: m.vertices,
          attributes: m.attributes,
          map: m.map,
        })),
        extensionsUsed: json.extensionsUsed,
        extensionsRequired: json.extensionsRequired,
        nodes: json.nodes.map((n) => n.name),
      },
      pictureError: errors,
      still: { file: stillOut, bytes: stillBytes.length, pose: HERO_POSE, ...stillFacts },
      renders,
    };
    fs.writeFileSync(path.join(renders, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
    console.log(JSON.stringify(summary, null, 2));

    if (!trial && fs.existsSync(MEDIA_TS)) {
      const said = /DRONE_MODEL_BYTES = ([\d_]+)/.exec(fs.readFileSync(MEDIA_TS, "utf8"));
      const bytes = said ? Number(said[1].replaceAll("_", "")) : null;
      if (bytes !== glb.length) {
        console.log(
          `\nDRONE_MODEL_BYTES in features/about/media.ts says ${bytes}. The file is ${glb.length}: write it there.`,
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
