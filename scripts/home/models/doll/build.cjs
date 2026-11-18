// The Obsidia doll of the home page: the rig FBX, the Mixamo walk and the four maps to one GLB.
//
//   node scripts/home/models/doll/build.cjs [--source DIR] [--out DIR] [--renders DIR] [--work DIR]
//   node scripts/home/models/doll/build.cjs --dump DIR      only write DIR/rig_dump.json
//   node scripts/home/models/doll/build.cjs --reselect      choose the face triangles again
//
// Reads the Meshy folder (read only: the rig FBX with the true bind pose, the walking FBX for its
// clip, the base, normal, roughness and metallic pictures) and writes apps/web/public/models/home/
// doll.glb and doll-rig.json (--out DIR writes them into DIR instead, for a trial). The work is done
// in real Chrome with the site's own three (Playwright and three come from apps/web) and the
// anaconda Python (Pillow, numpy and scipy bake the maps: bake.py). The file is then loaded back with
// a plain GLTFLoader, as the site loads it, and checked. README.md in this folder has the rig, the
// face, the numbers and what is not verified.
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const { createRequire } = require("node:module");
const os = require("node:os");
const path = require("node:path");

const REPO = path.resolve(__dirname, "../../../..");
const WEB = path.join(REPO, "apps/web");
const web = createRequire(path.join(WEB, "package.json"));
const { chromium } = web("@playwright/test");
const THREE_DIR = fs.realpathSync(path.join(WEB, "node_modules/three"));

const PYTHON = process.env.HOME_PYTHON ?? "C:\\Users\\muham\\anaconda3\\python.exe";
const DEFAULT_SOURCE =
  "D:\\ren\\aspirant\\3d\\obsidia\\Meshy_AI_chibi_boxer_doll_rigged_20261117_animated_mixamo_Walking";
const PREFIX = "Meshy_AI_chibi_boxer_doll_rigged_20261117_";
const FACE_JSON = path.join(__dirname, "curation/face-tris.json");
/** The page loads the file whole when the first scene with the doll comes near. */
const MAX_BYTES = 1_300_000;

function option(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")
    ? process.argv[i + 1]
    : fallback;
}
const flag = (name) => process.argv.includes(`--${name}`);
function fail(message) {
  throw new Error(`doll build: ${message}`);
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
  const sources = {
    "/source/rig.fbx": `${PREFIX}character_meshyrig.fbx`,
    "/source/walk.fbx": `${PREFIX}animated_mixamo_Walking.fbx`,
  };
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent((req.url ?? "/").split("?")[0]);
    const send = (body, type) => {
      res.writeHead(200, { "content-type": type, "cache-control": "no-store" });
      res.end(body);
    };
    if (memory.has(url)) return send(memory.get(url), TYPES[path.extname(url)]);
    if (sources[url]) return send(fs.readFileSync(path.join(source, sources[url])), TYPES[".fbx"]);
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

function python(script, args) {
  const result = spawnSync(PYTHON, ["-I", path.join(__dirname, script), ...args], {
    encoding: "utf8",
    maxBuffer: 1 << 26,
  });
  if (result.status !== 0) fail(`${script} failed:\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

function glbJson(buffer) {
  if (buffer.readUInt32LE(0) !== 0x46546c67) fail("the output is not a GLB");
  const length = buffer.readUInt32LE(12);
  return JSON.parse(buffer.subarray(20, 20 + length).toString("utf8"));
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

const BONES = [
  "Hips",
  "Spine02",
  "Spine01",
  "Spine",
  "neck",
  "Head",
  "LeftShoulder",
  "LeftArm",
  "LeftForeArm",
  "LeftHand",
  "RightShoulder",
  "RightArm",
  "RightForeArm",
  "RightHand",
  "LeftUpLeg",
  "LeftLeg",
  "LeftFoot",
  "LeftToeBase",
  "RightUpLeg",
  "RightLeg",
  "RightFoot",
  "RightToeBase",
];
const NODES = ["doll", "doll_body", "socket_hand_L", "socket_hand_R", "socket_head_top"];

function checkFile(json, bytes) {
  const used = json.extensionsUsed ?? [];
  if (!used.includes("EXT_texture_webp")) fail("no WebP pictures");
  if (used.includes("KHR_materials_unlit")) fail("the material is unlit: it must be lit PBR");
  if (used.includes("KHR_mesh_quantization"))
    fail("the file needs mesh quantisation: keep it plain");
  if ((json.images ?? []).length !== 3) fail(`${(json.images ?? []).length} pictures, expected 3`);
  if ((json.skins ?? []).length !== 1) fail("expected one skin");
  if (json.skins[0].joints.length !== BONES.length) fail(`${json.skins[0].joints.length} joints`);
  if ((json.animations ?? []).length !== 1) fail("expected the clip walk");
  const prim = json.meshes[0].primitives[0];
  for (const a of ["POSITION", "NORMAL", "TEXCOORD_0", "JOINTS_0", "WEIGHTS_0", "_FACE"]) {
    if (prim.attributes[a] === undefined) fail(`the attribute ${a} is missing`);
  }
  const joints = json.accessors[prim.attributes.JOINTS_0];
  const weights = json.accessors[prim.attributes.WEIGHTS_0];
  if (joints.componentType !== 5121) fail("JOINTS_0 is not unsigned byte");
  if (weights.componentType !== 5121 || !weights.normalized)
    fail("WEIGHTS_0 is not normalised bytes");
  if (bytes > MAX_BYTES) fail(`the file is ${bytes} bytes, over ${MAX_BYTES}`);
}

function checkLoaded(loaded) {
  for (const name of BONES) {
    if (!loaded.bones.some((b) => b.name === name)) fail(`the bone ${name} is missing`);
  }
  for (const name of ["head_end", "headfront", "Armature"]) {
    if (loaded.nodes.some((n) => n.name === name)) fail(`${name} is still in the file`);
  }
  for (const name of NODES) {
    if (!loaded.nodes.some((n) => n.name === name)) fail(`the node ${name} is missing`);
  }
  if (loaded.material.type !== "MeshStandardMaterial")
    fail(`the material is ${loaded.material.type}`);
  for (const k of ["map", "normalMap", "metalnessMap", "roughnessMap"]) {
    if (!loaded.material.maps.includes(k)) fail(`the material has no ${k}`);
  }
  if (!loaded.material.sameOrm) fail("roughness and metalness are not one picture");
  if (!loaded.animations.some((a) => a.name === "walk")) fail("no walk clip");
  if (!loaded.attributes._face) fail("the loader lost the _face attribute");
  const height = loaded.box.max[1] - loaded.box.min[1];
  if (Math.abs(loaded.box.min[1]) > 0.003) fail(`the feet are at ${loaded.box.min[1]}, not on y 0`);
  if (Math.abs(height - 1.7) > 0.02) fail(`the doll is ${height} m tall`);
}

async function main() {
  const source = path.resolve(option("source", process.env.HOME_DOLL_SOURCE ?? DEFAULT_SOURCE));
  for (const f of [
    "character_meshyrig.fbx",
    "animated_mixamo_Walking.fbx",
    "animated_mixamo_Walking.png",
    "animated_mixamo_Walking_normal.png",
    "animated_mixamo_Walking_roughness.png",
    "animated_mixamo_Walking_metallic.png",
  ]) {
    if (!fs.existsSync(path.join(source, PREFIX + f)))
      fail(`missing ${path.join(source, PREFIX + f)}`);
  }
  const trial = option("out", null);
  const outDir = trial ? path.resolve(trial) : path.join(WEB, "public/models/home");
  const renders = path.resolve(option("renders", path.join(os.tmpdir(), "aspirant-home-doll")));
  const work = path.resolve(option("work", path.join(renders, "work")));
  fs.mkdirSync(work, { recursive: true });

  const memory = new Map();
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

    // The source mesh as a soup of triangles, for the Python helpers.
    const dumpDir = option("dump", null);
    await page.evaluate((u) => window.dollBuild.openSource(u), `${base}/source/rig.fbx`);
    const dump = await page.evaluate(() => window.dollBuild.dumpRig());
    const dumpFile = path.join(dumpDir ? path.resolve(dumpDir) : work, "rig_dump.json");
    fs.mkdirSync(path.dirname(dumpFile), { recursive: true });
    fs.writeFileSync(dumpFile, JSON.stringify(dump));
    console.log(`dumped ${dump.position.length / 9} triangles to ${dumpFile}`);
    if (dumpDir) return;

    if (flag("reselect") || !fs.existsSync(FACE_JSON)) {
      console.log(python("face-select.py", [dumpFile, FACE_JSON]));
    }
    // The colours the FBX carries itself (brighter and warmer than the separate base file: that
    // one is a plain albedo, this one is what the artist's viewer showed).
    const embedded = path.join(work, "base-embedded.png");
    const png = await page.evaluate(() => window.dollBuild.exportEmbedded());
    fs.writeFileSync(embedded, Buffer.from(png.slice(png.indexOf(",") + 1), "base64"));
    const maps = path.join(work, "maps");
    console.log(python("bake.py", [dumpFile, FACE_JSON, maps, embedded]));
    memory.set("/build/base.png", fs.readFileSync(path.join(maps, "base.png")));
    memory.set("/build/normal.png", fs.readFileSync(path.join(maps, "normal.png")));
    memory.set("/build/orm.png", fs.readFileSync(path.join(maps, "orm.png")));
    memory.set("/build/face.json", fs.readFileSync(FACE_JSON));

    const urls = {
      rig: `${base}/source/rig.fbx`,
      walk: `${base}/source/walk.fbx`,
      face: `${base}/build/face.json`,
      base: `${base}/build/base.png`,
      normal: `${base}/build/normal.png`,
      orm: `${base}/build/orm.png`,
    };
    const { report, base64 } = await page.evaluate((u) => window.dollBuild.convert(u), urls);
    if (report.warnings.length) fail(`the exporter warned: ${report.warnings.join("; ")}`);
    const glb = Buffer.from(base64, "base64");
    const json = glbJson(glb);
    checkFile(json, glb.length);
    for (const row of report.overlay) {
      if (row.maxMetres > 0.012)
        fail(`the rebuilt doll is ${row.maxMetres} m off the source at ${row.t} s`);
    }

    memory.set("/build/doll.glb", glb);
    const loaded = await page.evaluate(() => window.dollBuild.stage.loadGlb("/build/doll.glb"));
    checkLoaded(loaded);

    const shoot = async (name, cells, options) => {
      const png = await page.evaluate(
        ([c, o]) => window.dollBuild.stage.sheet(c, o),
        [cells, options],
      );
      savePng(png, path.join(renders, name));
    };
    const single = async (name, view, w = 800, h = 800) => {
      const png = await page.evaluate(
        ([v, a, b]) => window.dollBuild.stage.shot(v, a, b),
        [view, w, h],
      );
      savePng(png, path.join(renders, name));
    };

    await shoot(
      "views.png",
      [0, 45, 90, 180, -45, -90].map((cam) => ({
        label: `yaw ${cam}`,
        cam,
        target: [0, 0.82, 0],
        dist: 5.2,
      })),
      { size: 420, cols: 6 },
    );
    await single(
      "hero-1440x900.png",
      { cam: 20, pitch: 8, target: [0, 0.85, 0], dist: 4.6 },
      1440,
      900,
    );
    const speed = report.clips.walk.speedMetresPerSecond;
    const dur = report.clips.walk.seconds;
    await shoot(
      "walk.png",
      Array.from({ length: 8 }, (_, k) => ({
        label: `walk ${((dur * k) / 8).toFixed(2)} s`,
        clip: "walk",
        t: (dur * k) / 8,
        cam: 90,
        pitch: 2,
        target: [0, 0.7, 0],
        dist: 5,
      })),
      { size: 330, cols: 8 },
    );

    // Poses: the ones the page needs, drawn from the front and from the side.
    const poseFile = JSON.parse(fs.readFileSync(path.join(__dirname, "poses.json"), "utf8"));
    const poseCells = Object.entries(poseFile.poses).flatMap(([name, p]) =>
      [
        { cam: 25, pitch: 6 },
        { cam: 90, pitch: 4 },
      ].map((v, i) => ({
        label: `${name} ${i ? "side" : "front"}`,
        pose: p.turns,
        hips: p.hips ?? null,
        scales: p.scales ?? {},
        target: [0, name === "fall" ? 0.9 : 0.85, 0],
        dist: name === "fall" ? 4.4 : 3.7,
        fov: 24,
        ...v,
      })),
    );
    await shoot("poses.png", poseCells, { size: 300, cols: 6 });
    // The arm stretch, with and without the counter-scaled hand, and the wrong way (both bones).
    await shoot(
      "stretch.png",
      [
        { label: "no stretch", pose: { LeftArm: [-165, 0, 10] }, scales: {} },
        {
          label: "LeftArm 1.6",
          pose: { LeftArm: [-165, 0, 10] },
          scales: { LeftArm: [1, 1.6, 1] },
        },
        {
          label: "LeftArm 1.6, hand 1/1.6",
          pose: { LeftArm: [-165, 0, 10] },
          scales: { LeftArm: [1, 1.6, 1], LeftHand: [1, 0.625, 1] },
        },
        {
          label: "WRONG: arm and forearm 1.6",
          pose: { LeftArm: [-165, 0, 10] },
          scales: { LeftArm: [1, 1.6, 1], LeftForeArm: [1, 1.6, 1] },
        },
      ].map((c) => ({ cam: 25, pitch: 4, target: [0, 1.0, 0], dist: 7.5, fov: 24, ...c })),
      { size: 360, cols: 4 },
    );

    writeWhole(path.join(outDir, "doll.glb"), glb);

    // The facts the actors need, in one file.
    const paramsFile = JSON.parse(
      fs.readFileSync(path.join(__dirname, "face/params.json"), "utf8"),
    );
    const faceSel = JSON.parse(fs.readFileSync(FACE_JSON, "utf8"));
    const frame = paramsFile.frame;
    const [eyeA, eyeB] = [frame.eyeLeftRed, frame.eyeRightBlue];
    const roll = Math.atan2(eyeB[1] - eyeA[1], eyeB[0] - eyeA[0]);
    const mid = [(eyeA[0] + eyeB[0]) / 2, (eyeA[1] + eyeB[1]) / 2];
    const rotate = (x, y) => [
      x * Math.cos(roll) + y * Math.sin(roll),
      -x * Math.sin(roll) + y * Math.cos(roll),
    ];
    const mouthUnits = rotate((frame.mouth[0] - mid[0]) / 0.1, (frame.mouth[1] - mid[1]) / 0.1);
    const round = (v, p = 5) => Math.round(v * 10 ** p) / 10 ** p;
    const rig = {
      file: "doll.glb",
      bytes: glb.length,
      frame:
        "metres, Y up, the feet on y 0, the figure's centre line on the Y axis, the front +Z; no node has a rotation or a scale; Hips is the root bone",
      heightMetres: round(loaded.box.max[1] - loaded.box.min[1], 4),
      scaleForHeight:
        "multiply by h / 1.7 (0.1765 for a doll 0.30 m tall); the facts below are in the file's own 1.7 m units",
      recentre: {
        fromCentimetres: [3.6, 0, 19.9],
        note: "the FBX is in centimetres; the build moved x by -3.6 cm (the body's line is 3.6 cm off the hair's middle) and z by -19.9 cm (to the feet), then scaled by 0.01",
      },
      box: loaded.box,
      triangles: report.triangles,
      vertices: report.vertices,
      faceVertices: loaded.attributes._face ? loaded.faceVertices : null,
      textures: {
        base: loaded.material.mapSize,
        normal: loaded.material.normalSize,
        orm: loaded.material.ormSize,
        note: "base is the colour picture the FBX itself carries (warmer and brighter than the separate base file) with the painted face replaced by skin; normal is flat on the face; orm: R 255, G roughness, B metalness, one picture for both maps; the uvs are glTF's (v down) and the pictures are upright (flipY false)",
      },
      loader:
        "plain GLTFLoader from three/addons, no Meshopt, no Draco, no KTX2. The WebP pictures are read through EXT_texture_webp, which GLTFLoader handles by itself. The mesh is one SkinnedMesh `doll_body` with one MeshStandardMaterial `doll`; find it by name.",
      attributes: loaded.attributes,
      faceAttribute: {
        file: "_FACE",
        loaded: "_face",
        note: "1 on the face triangles, 0 elsewhere, constant per triangle (vertices are split on the border). A page that draws the face reads it in the vertex shader (face/face.glsl)",
      },
      bones: Object.fromEntries(
        Object.entries(report.bonesWorld).map(([name, b]) => [
          name,
          {
            parent: b.parent,
            bindWorld: b.world,
            localPosition: b.localPos,
            localQuaternion: b.localQuat,
          },
        ]),
      ),
      mixamoNames: {
        Spine02: "Spine",
        Spine01: "Spine1",
        Spine: "Spine2",
        neck: "Neck",
        note: "the other bones keep the Mixamo names; the spine numbering of the Meshy rig is reversed",
      },
      removedBones: [
        "head_end (folded into Head: its weights carried 5,475 vertices)",
        "headfront (folded into Head)",
      ],
      sockets: {
        socket_hand_L: {
          parent: "LeftHand",
          localPosition: [0, 0.06, 0],
          note: "the mitten's middle; local Y along the bone",
        },
        socket_hand_R: { parent: "RightHand", localPosition: [0, 0.06, 0] },
        socket_head_top: {
          parent: "Head",
          localPosition: [0, 0.596, 0],
          note: "where the Meshy rig's head_end was, the top of the hair's crown",
        },
      },
      boneLengthsMetres: {
        upperArm: 0.162,
        forearm: 0.134,
        hand: 0.134,
        thigh: 0.175,
        shin: 0.145,
        foot: 0.052,
      },
      face: {
        note: "all positions in the file's final metres, in the bind pose (the vertex positions before the skin), measured on an orthographic front view (plus or minus 1 cm). The head is tilted a little: the blue eye is 2.8 cm higher than the red one.",
        eyeRed: {
          screenSide: "left",
          dollSide: "right",
          centre: frame.eyeLeftRed,
          irisRadius: frame.irisRadius,
          colour: "#d9262f",
        },
        eyeBlue: {
          screenSide: "right",
          dollSide: "left",
          centre: frame.eyeRightBlue,
          irisRadius: frame.irisRadius,
          colour: "#5cbcf2",
        },
        mouth: { centre: frame.mouth, width: 0.08 },
        browY: frame.browY,
        chinY: frame.chinY,
        outerCorners: [frame.outerCornerLeftX, frame.outerCornerRightX],
        shaderFrame: {
          uFaceFrame: [round(mid[0]), round(mid[1]), 0.1, round(roll)],
          note: "x, y of the middle of the eyes (bind metres), the unit in metres, the roll of the eye line in radians",
          eyeHalfDistanceUnits: round(
            Math.hypot(eyeB[0] - eyeA[0], eyeB[1] - eyeA[1]) / 2 / 0.1,
            4,
          ),
          mouthUnits: mouthUnits.map((v) => round(v, 3)),
        },
        expressions:
          "scripts/home/models/doll/face/presets.json (24 expressions, 55 floats each) and face.glsl",
        triangles: { face: faceSel.face.length, relief: faceSel.relief.length },
      },
      walk: {
        node: "the clip `walk` in the file",
        ...report.clips.walk,
        note: "in place; 32 keys at 30 fps, the last key equals the first. Play it at rate r and move the doll at speedMetresPerSecond * r (in the file's 1.7 m units: scale the speed with the doll). The hips are lifted so the lowest foot touches y 0 (hipsLiftMetres).",
      },
      armStretch: {
        bone: "LeftArm",
        scaleY: 1.6,
        handCounterScale: [1, 0.625, 1],
        never: "ForeArm (it compounds: 1.6 x 1.6 and the arm leaves the frame)",
        note: "stretches the upper arm, the forearm and the mitten together to about 1.5 to 2 times the reach with no shear (stretch.png). Any arm above the shoulder line puts the hand into the hair mass and it vanishes from every angle (a hang by one hand was tried and is not achievable, see poses.json notAchievable): the best is the reach pose, forward and up, stretched",
      },
      limits: [
        "Hands are bare mittens and legs end in rounded stumps: no gloves, no fingers, no toes, no stirrups.",
        "Head plus hair is 82 percent of the vertices and 59 percent of the height: arms above the shoulder line vanish into the hair from the front. Fists up means forward arms (the 'scream' pose), a body roll of 20 to 35 degrees (Hips z) or the stretch.",
        "A head turn moves the hair as one piece; a raised arm drags the nearby hair locks a little (the hair is bound to Head with a little Shoulder weight).",
        "Hair tips sweep about 0.2 m sideways and clip into the shoulder at a 45 degree head yaw (in the 1.7 m units).",
        "Never mirror a pose by negating X: the left and right bone frames are not mirrors. Write each side.",
        "The Walking clip is in place. No sit, wave, run or fall clip exists: the poses in poses.json are authored.",
      ],
      poses:
        "scripts/home/models/doll/poses.json (turns in model axes, the formula, notes) and poses.png in the check pictures",
      lighting: await page.evaluate(() => window.dollBuild.stage.RECIPE),
      lightingNote:
        "A lit MeshStandardMaterial (the doll's gloss is part of her): a PMREM of RoomEnvironment at 0.45, a warm key 1.0, a cool fill 0.35, a rim 0.5 and a hemisphere 0.25, NoToneMapping. The sum is about 1: more burns the skin to white. This is a recorded exception to the site's unlit style.",
    };
    writeWhole(
      path.join(outDir, "doll-rig.json"),
      Buffer.from(`${JSON.stringify(rig, null, 2)}\n`),
    );

    const summary = {
      bytes: glb.length,
      report: { ...report, walkRows: undefined, bonesWorld: undefined },
      loaded: { ...loaded, nodes: undefined },
      renders,
    };
    fs.mkdirSync(renders, { recursive: true });
    fs.writeFileSync(path.join(renders, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
    fs.writeFileSync(
      path.join(renders, "bones.json"),
      `${JSON.stringify(report.bonesWorld, null, 2)}\n`,
    );
    console.log(JSON.stringify(summary.report, null, 2));
    void speed;
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
