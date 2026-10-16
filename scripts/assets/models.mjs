// OBJ/MTL -> GLB with Blender (headless), verification renders, and the Emote PNGs -> WebP.
import fs from "node:fs";
import path from "node:path";
import {
  BLENDER,
  FORCE,
  REPO,
  TMP,
  ensureDirFor,
  exec,
  fileSize,
  getSharp,
  isFresh,
  log,
  mkdirp,
  pad2,
  pub,
  rel,
  saveStage,
  src,
  srcRel,
} from "./lib.mjs";

const D3 = "media/layla-and-fanny/art/3d";
const MODELS = [
  { slug: "layla", obj: `${D3}/layla/hero_shooter_skin08_high_add.obj`, dir: `${D3}/layla` },
  { slug: "fanny", obj: `${D3}/fanny/hero_fanny_skin09_high_add.obj`, dir: `${D3}/fanny` },
];
const SCRIPT = path.join(REPO, "scripts", "assets", "blender", "convert.py");
const VERIFY = path.join(REPO, "scripts", "assets", "blender", "verify.py");

function parseVerify(stdout) {
  const line = stdout.split(/\r?\n/).find((l) => l.startsWith("VERIFY meshes"));
  const bbox = stdout.split(/\r?\n/).find((l) => l.startsWith("VERIFY bbox"));
  const unt = stdout.split(/\r?\n/).find((l) => l.startsWith("VERIFY untextured"));
  return { line, bbox, unt };
}

export async function run() {
  const records = [];
  const notes = [];
  const sharp = await getSharp();
  const previewDir = path.join(TMP, "model-previews");
  await mkdirp(previewDir);

  for (const m of MODELS) {
    const out = pub("models", `${m.slug}.glb`);
    const inputs = [
      src(m.obj),
      SCRIPT,
      ...fs
        .readdirSync(src(m.dir))
        .filter((f) => /\.(png|mtl)$/i.test(f))
        .map((f) => path.join(src(m.dir), f)),
    ];
    let verifyInfo = null;
    if (!isFresh(out, inputs)) {
      await ensureDirFor(out);
      const { stdout } = await exec(BLENDER, [
        "--background",
        "--python",
        SCRIPT,
        "--",
        src(m.obj),
        src(m.dir),
        out,
        m.slug,
        "1024",
        "1",
        "0",
      ]);
      log(
        "models",
        stdout
          .split(/\r?\n/)
          .filter((l) => /^(IMPORTED|CORE_BOUNDS_AFTER|ALL_BOUNDS_AFTER|EXPORTED)/.test(l))
          .join("\n         "),
      );
    }
    // Verify by loading the GLB back and rendering previews (always; it is quick).
    const v = await exec(BLENDER, [
      "--background",
      "--python",
      VERIFY,
      "--",
      out,
      path.join(previewDir, m.slug),
      "640",
    ]);
    verifyInfo = parseVerify(v.stdout);
    log(
      "models",
      `${m.slug}.glb ${((await fileSize(out)) / 1024).toFixed(0)} KB | ${verifyInfo.line} | ${verifyInfo.unt}`,
    );
    records.push({
      id: `model-${m.slug}`,
      kind: "model",
      path: rel(out),
      bytes: await fileSize(out),
      pair: "fanny-layla",
      slug: m.slug,
      role: "model-3d",
      source: srcRel(src(m.obj)),
      notes:
        "Y-up GLB, Draco compressed, textures embedded (512 px originals, max 1024). Character is 2 units tall with its bounding box centred on the origin and faces +Z. Separate nodes: body, face, hair_eyes (character), weapon, robot, robot_screen (companion). The weapon and robot sit beside the character in model space (as in the source), so hide or reposition them. " +
        verifyInfo.line,
    });
  }

  // Emote textures (512x512 RGBA) -> img/emote/{slug}/NN.webp
  for (const m of MODELS) {
    const dir = src(m.dir, "Emote");
    const files = fs.readdirSync(dir).filter((f) => /emote\d+_d\.png$/i.test(f));
    for (const f of files) {
      const n = parseInt(f.match(/emote(\d+)_d/i)[1], 10);
      const out = pub("img", "emote", m.slug, `${pad2(n)}.webp`);
      if (!isFresh(out, path.join(dir, f))) {
        await ensureDirFor(out);
        await sharp(path.join(dir, f))
          .resize(512, 512, { fit: "inside" })
          .webp({ quality: 92, alphaQuality: 100, effort: 5 })
          .toFile(out);
      }
      records.push({
        id: `emote-${m.slug}-${pad2(n)}`,
        kind: "image",
        path: rel(out),
        bytes: await fileSize(out),
        width: 512,
        height: 512,
        pair: "fanny-layla",
        slug: m.slug,
        role: "emote",
        source: srcRel(path.join(dir, f)),
        notes: "Face-screen texture of the robot companion (one of 8 expressions).",
      });
    }
  }
  notes.push({
    about: "models",
    note: "Layla and Fanny share the same robot companion (jiqiren) and 8 emote face textures; the emote PNGs and the robot texture are byte-identical between the two source folders, so emote/layla and emote/fanny hold the same eight images. Preview renders (Workbench, textured) were checked from the front and side during the build; they are written to the scratch folder, not the repo.",
  });
  await saveStage(
    "models",
    records.sort((a, b) => a.id.localeCompare(b.id)),
    { notes },
  );
}
