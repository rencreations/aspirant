// The hand: raw export from Blender, the rig, two clips, the pictures, the size pass.
import fs from "node:fs";
import path from "node:path";
import { writeFacts } from "./lib/facts.mjs";
import { fail, runBlender, workDir, writeWhole } from "./lib/env.mjs";
import {
  compressGeometry,
  compressTextures,
  makeIO,
  stripMaterialExtensions,
} from "./lib/optimize.mjs";
import { buildAnimations, normalizeRig } from "./lib/rig.mjs";
import { assemble } from "./hand-facts.mjs";
import { VIEW, check } from "./verify/hand-check.mjs";

const NAME = "hand";
const CLIP_LOOPS = ["breath"];
const CLIP_NAME = (clip) => clip;
const CLIP_ALIAS = { palm_up: "palm_up", breath: "breath" };

export async function build({ out, work, renders, skipBlender = false } = {}) {
  work ??= workDir(NAME);
  if (!skipBlender) runBlender("hand.py", { work });
  const bake = JSON.parse(fs.readFileSync(path.join(work, "hand.bake.json"), "utf8"));
  const io = makeIO();
  const doc = await io.read(path.join(work, "hand.raw.glb"));

  const rigCheck = normalizeRig(doc, bake);
  if (rigCheck.worstTranslation > 1e-4 || rigCheck.worstRotation > 1e-5) {
    fail(`rest nodes differ from the bake: ${JSON.stringify(rigCheck)}`);
  }
  stripMaterialExtensions(doc);
  const root = doc.getRoot();
  const materials = root.listMaterials();
  if (materials.length !== 1) fail(`the hand has ${materials.length} materials`);
  materials[0].setName("selena_hand_glove");
  for (const mesh of root.listMeshes()) mesh.setName("selena_hand");
  for (const node of root.listNodes()) if (node.getMesh()) node.setName("selena_hand");
  const [x0, y0, x1, y1] = bake.pictureBox;
  if (x1 - x0 !== bake.pictureSize || y1 - y0 !== bake.pictureSize)
    fail("the picture box is not the whole atlas: crop it first");

  const names = Object.fromEntries(Object.keys(bake.clips).map((c) => [c, CLIP_NAME(c)]));
  const clipReport = buildAnimations(doc, bake, { names, loops: CLIP_LOOPS });
  const textureReport = await compressTextures(doc, [
    [/body01_d/, { size: 1024, quality: 84 }],
    [/body01_n5x5/, { size: 512, quality: 76 }],
  ]);
  await compressGeometry(doc);
  const pre = path.join(work, "hand.pre.glb");
  writeWhole(pre, await io.writeBinary(doc));

  const checked = await check({
    glb: pre,
    bake,
    renders: renders ?? path.join(work, "renders"),
    loops: CLIP_LOOPS,
  });
  const facts = assemble({
    name: NAME,
    bake,
    checked,
    clipReport,
    alias: CLIP_ALIAS,
    loops: CLIP_LOOPS,
    clipName: CLIP_NAME,
    view: VIEW,
  });
  root.listScenes()[0].setExtras({ home: facts });
  const bytes = await io.writeBinary(doc);
  const file = path.join(out ?? path.join(work, "out"), `${NAME}.glb`);
  writeWhole(file, bytes);
  await writeFacts(path.join(path.dirname(file), `${NAME}.facts.json`), facts);
  console.log(NAME, "bytes", bytes.byteLength);
  return { file, bytes: bytes.byteLength, facts, textureReport };
}
