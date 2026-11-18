// Selena (the normal form): raw export from Blender, the rig, four clips, the face morphs, the pictures.
import fs from "node:fs";
import path from "node:path";
import { glbJson, morphBytes, writeFacts } from "./lib/facts.mjs";
import { assemble } from "./selena-facts.mjs";
import { SOURCE, fail, runBlender, workDir, writeWhole } from "./lib/env.mjs";
import {
  compressGeometry,
  compressTextures,
  makeIO,
  sparseTargets,
  stripMaterialExtensions,
} from "./lib/optimize.mjs";
import { buildAnimations, normalizeRig } from "./lib/rig.mjs";
import { check } from "./verify/selena-check.mjs";

const NAME = "selena";
const RAW_BLEND = path.join(SOURCE, "raw", "selena_silverbolt_raiko_raw.blend");
const CLIP_LOOPS = ["idle", "interaction_R_loop"];
const CLIP_NAME = (clip) => `city_${clip}`;
const CLIP_ALIAS = {
  idle: "idle",
  interaction_R_loop: "hands_to_mouth_loop",
  interaction_back_R: "hands_to_mouth_release",
  intercation03: "interaction_03",
};
/** A morph delta below this (metres) is noise: zeroed, so the target is sparse and the file small. */
const MORPH_NOISE = 2e-4;
/** A target that does not move any vertex by this much (metres) is dropped. */
const MORPH_MIN = 1e-3;

/** Zeroes the noise in the head's morph targets and drops the targets that do nothing. */
function pruneMorphs(doc) {
  const mesh = doc
    .getRoot()
    .listMeshes()
    .find((m) => m.getName().endsWith("_head"));
  if (!mesh) fail("no head mesh");
  const prim = mesh.listPrimitives()[0];
  const names = mesh.getExtras().targetNames ?? [];
  const targets = prim.listTargets();
  if (targets.length !== names.length)
    fail(`morph names (${names.length}) and targets (${targets.length}) differ`);
  const kept = [];
  const report = {};
  targets.forEach((target, i) => {
    const accessor = target.getAttribute("POSITION");
    const element = [0, 0, 0];
    let largest = 0;
    let moved = 0;
    for (let v = 0; v < accessor.getCount(); v++) {
      accessor.getElement(v, element);
      const length = Math.hypot(...element);
      if (length < MORPH_NOISE) {
        accessor.setElement(v, [0, 0, 0]);
        continue;
      }
      largest = Math.max(largest, length);
      moved++;
    }
    report[names[i]] = { vertices: moved, largestMetres: Math.round(largest * 1e5) / 1e5 };
    if (largest >= MORPH_MIN) kept.push(i);
    else report[names[i]].dropped = true;
  });
  // Remove the dropped targets (back to front, so the indices hold).
  for (let i = targets.length - 1; i >= 0; i--) {
    if (kept.includes(i)) continue;
    prim.removeTarget(targets[i]);
    targets[i].dispose();
  }
  const keptNames = kept.map((i) => names[i]);
  mesh.setExtras({ ...mesh.getExtras(), targetNames: keptNames });
  mesh.setWeights(keptNames.map(() => 0));
  return { names: keptNames, report };
}

/** Material names and the alpha choices the page relies on. */
function tidyMaterials(doc) {
  const rename = {
    body_01: "selena_body_01",
    body_02: "selena_body_02",
    body_03: "selena_body_03_claws",
    eye: "selena_eye",
    hair_01: "selena_hair_01",
    hair_02: "selena_hair_02",
    head: "selena_head",
  };
  for (const material of doc.getRoot().listMaterials()) {
    const key = Object.keys(rename).find((k) => material.getName().endsWith(`_${k}`));
    if (!key) fail(`a material nobody expected: ${material.getName()}`);
    material.setName(rename[key]);
  }
  for (const mesh of doc.getRoot().listMeshes()) {
    const key = Object.keys(rename).find((k) => mesh.getName().endsWith(`_${k}`));
    mesh.setName(rename[key].replace("selena_", "selena_mesh_"));
  }
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (mesh) node.setName(mesh.getName());
  }
}

export async function build({ out, work, renders, skipBlender = false } = {}) {
  work ??= workDir(NAME);
  if (!skipBlender) runBlender("selena.py", { work, raw: RAW_BLEND });
  const bake = JSON.parse(fs.readFileSync(path.join(work, "selena.bake.json"), "utf8"));
  const io = makeIO();
  const doc = await io.read(path.join(work, "selena.raw.glb"));

  const rigCheck = normalizeRig(doc, bake);
  if (rigCheck.worstTranslation > 1e-4 || rigCheck.worstRotation > 1e-5) {
    fail(`rest nodes differ from the bake: ${JSON.stringify(rigCheck)}`);
  }
  stripMaterialExtensions(doc);
  tidyMaterials(doc);
  const morphs = pruneMorphs(doc);
  const names = Object.fromEntries(Object.keys(bake.clips).map((c) => [c, CLIP_NAME(c)]));
  const clipReport = buildAnimations(doc, bake, { names, loops: CLIP_LOOPS });
  for (const [clip, info] of Object.entries(clipReport)) {
    if (info.frames !== bake.clips[clip].frames) fail(`${clip}: frame count changed`);
    if (CLIP_LOOPS.includes(clip) && (info.loopGap > 8e-3 || info.loopGapRotation > 3e-4)) {
      fail(`${clip}: first and last key differ (${info.loopGap} m)`);
    }
  }

  const textureReport = await compressTextures(doc, [
    [/body0[12]_d/, { size: 1024, quality: 86 }],
    [/body0[12]_n5x5/, { size: 512, quality: 78 }],
    [/weapon02_d/, { size: 512, quality: 86 }],
    [/weapon02_n5x5/, { size: 512, quality: 78 }],
    [/hair0[12]_dr/, { size: 512, quality: 88 }],
    [/head0[12]_d/, { size: 256, quality: 92 }],
  ]);
  await compressGeometry(doc, { beforeMeshopt: [sparseTargets] });
  const pre = path.join(work, "selena.pre.glb");
  writeWhole(pre, await io.writeBinary(doc));
  // The brief allows the face targets if they cost under 0.3 MB: count what they take in the file.
  const morphCost = morphBytes(glbJson(fs.readFileSync(pre)));
  if (morphCost > 300_000) fail(`the face targets take ${morphCost} bytes, over 0.3 MB`);
  console.log("  [selena] face targets in the file:", morphCost, "bytes");

  const checked = await check({
    glb: pre,
    bake,
    renders: renders ?? path.join(work, "renders"),
    morphNames: morphs.names,
    loops: CLIP_LOOPS,
  });
  const facts = assemble({
    name: NAME,
    bake,
    checked,
    morphs,
    morphCost,
    clipReport,
    alias: CLIP_ALIAS,
    loops: CLIP_LOOPS,
    clipName: CLIP_NAME,
  });
  doc.getRoot().listScenes()[0].setExtras({ home: facts });
  const bytes = await io.writeBinary(doc);
  const file = path.join(out ?? path.join(work, "out"), `${NAME}.glb`);
  writeWhole(file, bytes);
  await writeFacts(path.join(path.dirname(file), `${NAME}.facts.json`), facts);
  console.log(NAME, "bytes", bytes.byteLength);
  return { file, bytes: bytes.byteLength, facts, textureReport, bake };
}
