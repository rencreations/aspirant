// Guinevere's two drones of the About page: the two source FBX files to one small GLB.
//
//   node scripts/about/companions/build.cjs [--source DIR] [--out DIR] [--renders DIR] [--quality 0..1]
//
// Reads D:\ren\aspirant\3d\guinevere (read only; --source or ABOUT_COMPANION_SOURCE names another
// folder with drone1.fbx and drone2.fbx) and writes apps/web/public/models/about/companion.glb
// (--out DIR writes it into DIR instead, for a trial). The two sources hold one model in two
// attitudes (the build checks that), so one file serves both drones. The work is done in real
// Chrome with the site's own three (Playwright, three and TypeScript come from apps/web), served
// by a small server this script starts on a free port and stops again. The file is then loaded
// back with GLTFLoader, as the page loads it, and checked. Check pictures go to --renders
// (default: the temp folder); the faces in them are drawn by the page's own shader
// (apps/web/src/features/about/companions/face.ts). README.md in this folder has the rig.
const fs = require("node:fs");
const http = require("node:http");
const { createRequire } = require("node:module");
const os = require("node:os");
const path = require("node:path");

const REPO = path.resolve(__dirname, "../../..");
const WEB = path.join(REPO, "apps/web");
const web = createRequire(path.join(WEB, "package.json"));
const { chromium } = web("@playwright/test");
const ts = web("typescript");
// The folder of three behind the workspace link (its package.json is not an export).
const THREE_DIR = fs.realpathSync(path.join(WEB, "node_modules/three"));

const DEFAULT_SOURCE = "D:\\ren\\aspirant\\3d\\guinevere";
const FEATURE = path.join(WEB, "src/features/about/companions");
const MODEL_TS = path.join(FEATURE, "model.ts");
const FACE_TS = path.join(FEATURE, "face.ts");

const SOURCES = {
  "/source/drone1.fbx": "drone1.fbx",
  "/source/drone2.fbx": "drone2.fbx",
};

/** What the page looks for by name: the six parts and where each hangs. */
const PARTS = {
  body: "companion",
  face: "body",
  ear_L: "body",
  ear_R: "body",
  glove_L: "companion",
  glove_R: "companion",
};
/** The file must stay a small one: the page loads it whole when the section comes near. */
const MAX_BYTES = 400_000;

function option(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function fail(message) {
  throw new Error(`companion build: ${message}`);
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
  if (!used.includes("EXT_texture_webp")) fail("no WebP picture");
  if ((json.images ?? []).length !== 1) fail(`${(json.images ?? []).length} pictures, expected 1`);
  if (json.images[0].mimeType !== "image/webp") fail(`the picture is ${json.images[0].mimeType}`);
  if ((json.skins ?? []).length !== 0) fail("the file has a skin: the parts must be rigid nodes");
  if ((json.animations ?? []).length !== 0) fail("the file has animations");
  if (bytes > MAX_BYTES) fail(`the file is ${bytes} bytes, over ${MAX_BYTES}`);
}

/** What the source must be, and what the two sources must share. */
function checkSource(report) {
  if (report.blendedCorners !== 0) fail(`${report.blendedCorners} corners hang on two bones`);
  const other = report.otherFile;
  for (const [bone, row] of Object.entries(other)) {
    if (bone === "pictureDifference") continue;
    if (Array.isArray(row.corners)) fail(`${bone}: the two sources differ in size`);
    if (row.shapeError > 6e-4 || row.uvError > 1e-4) {
      fail(`${bone}: the two sources differ in shape (${row.shapeError} m, uv ${row.uvError})`);
    }
  }
  if (other.pictureDifference !== 0) fail("the two sources have different pictures");
  if (report.frame.mirrorSpread > 5e-4) fail("the body's two halves are not mirrors");
  for (const [name, part] of Object.entries(report.parts)) {
    // Closed shells wound outward have a volume above zero; the screen is an open patch.
    if (name !== "face" && !(part.volume > 0)) fail(`${name} is wound inside out`);
  }
}

/** What GLTFLoader gives back, against what the page looks for. */
function checkLoaded(glb) {
  const node = (name) => glb.nodes.find((n) => n.name === name) ?? fail(`no node ${name}`);
  for (const [name, parent] of Object.entries(PARTS)) {
    const n = node(name);
    if (n.type !== "Mesh" || !n.mesh) fail(`${name} is a ${n.type}`);
    if (n.parent !== parent) fail(`${name} hangs on ${n.parent}, expected ${parent}`);
    if (n.mesh.skinned || n.mesh.morphTargets) fail(`${name} is skinned or has targets`);
    if (n.mesh.materialType !== "MeshBasicMaterial")
      fail(`${name} loads as ${n.mesh.materialType}`);
    if (!n.mesh.map) fail(`${name} has no picture`);
    if (n.mesh.material !== (name === "face" ? "companion_face" : "companion_body")) {
      fail(`${name} has the material ${n.mesh.material}`);
    }
    for (const attribute of ["normal", "position", "uv"]) {
      if (!n.mesh.attributes.includes(attribute)) fail(`${name} has no ${attribute}`);
    }
    if (n.scale.some((v) => Math.abs(v - 1) > 1e-6)) fail(`${name} carries a scale`);
  }
  // The body stands at the origin, unturned, and the two sides are mirrors.
  const body = node("body");
  if (body.position.some((v) => v !== 0) || body.quaternion[3] !== 1) fail("the body is moved");
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
  mirrored("ear_L", "ear_R", "ears' hinges");
  mirrored("glove_L", "glove_R", "gloves");
  for (const name of ["glove_L", "glove_R"]) {
    if (node(name).quaternion[3] !== 1) fail(`${name} rests turned`);
  }
  const extras = glb.extras ?? fail("no extras on the root");
  if (!(extras.radius > 0.05 && extras.radius < 0.12))
    fail(`the ball's radius is ${extras.radius}`);
  if (!(extras.screen?.halfWidth > 0.03)) fail("the screen is not described");
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

const FRONT = [0, 0, 1];
const QUARTER = [0.7, 0.25, 1];

async function main() {
  const source = path.resolve(
    option("source", process.env.ABOUT_COMPANION_SOURCE ?? DEFAULT_SOURCE),
  );
  for (const file of Object.values(SOURCES)) {
    if (!fs.existsSync(path.join(source, file))) fail(`missing ${path.join(source, file)}`);
  }
  const trial = option("out", null);
  const modelOut = trial
    ? path.join(path.resolve(trial), "companion.glb")
    : path.join(WEB, "public/models/about/companion.glb");
  const renders = path.resolve(
    option("renders", path.join(os.tmpdir(), "aspirant-about-companions")),
  );
  const quality = Number(option("quality", "1"));

  const memory = new Map();
  memory.set("/build/face.js", faceModule());
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
    page.on("console", (message) => {
      if (message.type() === "error") console.error("[console]", message.text());
    });
    await page.goto(`${base}/page/index.html`);
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 30_000 });

    const shoot = async (name, cells, options) => {
      const png = await page.evaluate(
        ([c, o]) => window.companionBuild.sheet(c, o),
        [cells, options],
      );
      savePng(png, path.join(renders, name));
    };

    // 1. The sources as they are, for the record.
    for (const name of ["drone1", "drone2"]) {
      await page.evaluate((n) => window.companionBuild.loadFbx(`/source/${n}.fbx`), name);
      await shoot(
        `source-${name}.png`,
        [
          { label: `${name}.fbx, front`, view: FRONT },
          { label: "three-quarter", view: QUARTER },
          { label: "side", view: [1, 0, 0] },
          { label: "back", view: [0, 0, -1] },
        ],
        { size: 360, cols: 4, across: 0.42 },
      );
    }

    // 2. Convert.
    const { report, base64, cleaned } = await page.evaluate(
      (options) =>
        window.companionBuild.convert(
          { model: "/source/drone1.fbx", other: "/source/drone2.fbx" },
          options,
        ),
      { quality },
    );
    if (report.warnings.length) fail(`the exporter warned: ${report.warnings.join("; ")}`);
    checkSource(report);
    const glb = Buffer.from(base64, "base64");
    const json = glbJson(glb);
    checkFile(json, glb.length);
    savePng(cleaned, path.join(renders, "picture-cleaned.png"));

    // 3. Load the built file back as the page does.
    memory.set("/build/companion.glb", glb);
    const loaded = await page.evaluate(() => window.companionBuild.loadGlb("/build/companion.glb"));
    checkLoaded(loaded);

    // 4. Check pictures.
    await shoot(
      "views.png",
      [
        { label: "front", view: FRONT },
        { label: "three-quarter", view: QUARTER },
        { label: "side (+X)", view: [1, 0, 0] },
        { label: "back", view: [0, 0, -1] },
        { label: "the other three-quarter", view: [-0.7, 0.25, 1] },
        { label: "top", view: [0, 1, 0.001] },
        { label: "bottom", view: [0, -1, 0.001] },
        { label: "front, no outline", view: FRONT, outline: false },
      ],
      { size: 420, cols: 4 },
    );
    const ear = (splay, fold, twist) => ({ splay, fold, twist });
    const both = (e) => ({ ear_L: e, ear_R: e });
    await shoot(
      "parts-ears.png",
      [
        { label: "rest", view: FRONT },
        { label: "splay 30", view: FRONT, pose: both(ear(30, 0, 0)) },
        { label: "splay 70 (flat, like a cross cat)", view: FRONT, pose: both(ear(70, 0, 0)) },
        { label: "splay -15 (pricked)", view: FRONT, pose: both(ear(-15, 0, 0)) },
        { label: "fold 35 (forward)", view: QUARTER, pose: both(ear(0, 35, 0)) },
        { label: "fold -35 (back)", view: QUARTER, pose: both(ear(0, -35, 0)) },
        { label: "twist 40", view: FRONT, pose: both(ear(0, 0, 40)) },
        { label: "twist -40", view: FRONT, pose: both(ear(0, 0, -40)) },
        { label: "left only: splay 50", view: FRONT, pose: { ear_L: ear(50, 0, 0) } },
        { label: "right only: fold 40", view: QUARTER, pose: { ear_R: ear(0, 40, 0) } },
        { label: "fold 35, side", view: [1, 0, 0], pose: both(ear(0, 35, 0)) },
        { label: "fold -35, side", view: [1, 0, 0], pose: both(ear(0, -35, 0)) },
      ],
      { size: 360, cols: 4 },
    );
    const glove = (at, turn, scale) => ({ at, turn, scale });
    await shoot(
      "parts-gloves.png",
      [
        { label: "rest", view: FRONT },
        { label: "rest, three-quarter", view: QUARTER },
        { label: "rest, side", view: [1, 0, 0] },
        { label: "rest, top", view: [0, 1, 0.001] },
        { label: "left: turn z 90", view: FRONT, pose: { glove_L: glove(null, [0, 0, 90]) } },
        {
          label: "left: turn x 90 (the star up)",
          view: FRONT,
          pose: { glove_L: glove(null, [-90, 0, 0]) },
        },
        {
          label: "left: turn y 90 (a punch to the side)",
          view: FRONT,
          pose: { glove_L: glove([2.6, 0, 0.2], [0, 90, 0]) },
        },
        { label: "left: turn y -90", view: FRONT, pose: { glove_L: glove(null, [0, -90, 0]) } },
        {
          label: "a guard: both up by the face",
          view: FRONT,
          pose: {
            glove_L: glove([1.25, 0.35, 0.9], [0, -20, -15]),
            glove_R: glove([-1.25, 0.35, 0.9], [0, 20, 15]),
          },
        },
        {
          label: "a jab: the left out to you",
          view: QUARTER,
          pose: {
            glove_L: glove([0.9, 0.1, 2.6], [0, 0, 0]),
            glove_R: glove([-1.3, 0.2, 0.8], [0, 20, 15]),
          },
        },
        {
          label: "a wave: the right high",
          view: FRONT,
          pose: { glove_R: glove([-2.0, 1.3, 0.3], [0, 0, 25]) },
        },
        {
          label: "hiding: both over the screen",
          view: FRONT,
          pose: {
            glove_L: glove([0.55, 0.05, 1.25], [0, 0, 20]),
            glove_R: glove([-0.55, 0.05, 1.25], [0, 0, -20]),
          },
        },
      ],
      { size: 360, cols: 4, across: 0.5 },
    );
    await shoot(
      "parts-body.png",
      [
        { label: "yaw 40", view: FRONT, pose: { yaw: 40 } },
        { label: "yaw -40", view: FRONT, pose: { yaw: -40 } },
        { label: "pitch 25 (a bow)", view: FRONT, pose: { pitch: 25 } },
        { label: "pitch -25", view: FRONT, pose: { pitch: -25 } },
        { label: "roll 25", view: FRONT, pose: { roll: 25 } },
        { label: "the ball alone: roll 90", view: FRONT, pose: { body: [0, 0, 90] } },
        { label: "the ball alone: yaw 180", view: FRONT, pose: { body: [0, 180, 0] } },
        { label: "the ball alone: pitch 60", view: QUARTER, pose: { body: [60, 0, 0] } },
      ],
      { size: 360, cols: 4, across: 0.5 },
    );
    const FACE = { across: 0.2, outline: true };
    await shoot(
      "faces.png",
      loaded.faces.flatMap((name) => [
        { label: name, view: FRONT, face: name, ...FACE },
        { label: `${name}, turned 30`, view: FRONT, pose: { yaw: 30 }, face: name, ...FACE },
      ]),
      { size: 300, cols: 6 },
    );
    const steps = [0, 0.25, 0.5, 0.75, 1];
    await shoot(
      "faces-live.png",
      [
        ...["bold", "soft", "happy", "love", "dizzy"].flatMap((name) =>
          steps.map((b) => ({
            label: `${name}, blink ${b}`,
            view: FRONT,
            face: name,
            live: { blinkL: b, blinkR: b },
            ...FACE,
          })),
        ),
        { label: "soft, a wink", view: FRONT, face: "soft", live: { blinkR: 1 }, ...FACE },
        { label: "soft, look right", view: FRONT, face: "soft", live: { lookX: 0.14 }, ...FACE },
        {
          label: "soft, look left and up",
          view: FRONT,
          face: "soft",
          live: { lookX: -0.14, lookY: 0.08 },
          ...FACE,
        },
        { label: "bold, look down", view: FRONT, face: "bold", live: { lookY: -0.08 }, ...FACE },
        { label: "dizzy, spirals turned", view: FRONT, face: "dizzy", live: { spin: 2 }, ...FACE },
        ...steps.map((t) => ({
          label: `bold to happy, ${t}`,
          view: FRONT,
          face: { from: "bold", to: "happy", t },
          ...FACE,
        })),
        ...steps.map((t) => ({
          label: `soft to wide, ${t}`,
          view: FRONT,
          face: { from: "soft", to: "wide", t },
          ...FACE,
        })),
        ...steps.map((t) => ({
          label: `soft to love, ${t}`,
          view: FRONT,
          face: { from: "soft", to: "love", t },
          ...FACE,
        })),
        ...steps.map((t) => ({
          label: `lit ${t}`,
          view: FRONT,
          face: "bold",
          live: { on: t },
          ...FACE,
        })),
      ],
      { size: 240, cols: 5 },
    );
    // The faces at the size the page shows them: the ball about 110 pixels across.
    await shoot(
      "faces-small.png",
      loaded.faces.map((name) => ({ label: name, view: FRONT, face: name })),
      { size: 300, cols: 7, across: 0.42 },
    );

    writeWhole(modelOut, glb);

    const summary = {
      model: { file: modelOut, bytes: glb.length, ...report },
      loaded: {
        parseMs: loaded.parseMs,
        box: loaded.box,
        nodes: loaded.nodes,
        extras: loaded.extras,
        extensionsUsed: json.extensionsUsed,
      },
      renders,
    };
    fs.mkdirSync(renders, { recursive: true });
    fs.writeFileSync(path.join(renders, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
    console.log(
      JSON.stringify(
        {
          bytes: glb.length,
          frame: report.frame,
          parts: report.parts,
          otherFile: report.otherFile,
          picture: report.picture,
          extras: loaded.extras,
          parseMs: loaded.parseMs,
          renders,
        },
        null,
        2,
      ),
    );

    if (!trial && fs.existsSync(MODEL_TS)) {
      const text = fs.readFileSync(MODEL_TS, "utf8");
      const said = /COMPANION_MODEL_BYTES = ([\d_]+)/.exec(text);
      const bytes = said ? Number(said[1].replaceAll("_", "")) : null;
      if (bytes !== glb.length) {
        console.log(
          `\nCOMPANION_MODEL_BYTES in features/about/companions/model.ts says ${bytes}. The file is ${glb.length}: write it there.`,
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
