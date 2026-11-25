// silverbolt.glb: Silverbolt alone (the meshes abyssal_devil_01 and _02 of the entrance file and
// only the joints they need), with one clip, `idle`, the dragon's own idle
// (selena_silverbolt_raiko_entrance_city_idle), in place and centred near the origin.
//
// The dragon's root `D_she_root` places, turns and scales the whole dragon beside Selena: in
// city_idle it sits at (-0.40, 1.06, 0.43), tilted about 20 degrees, at scale 0.4. Here its
// scale is 1 (the size it is modelled at), its place is fixed so the dragon's box over the loop
// is centred on the origin, and its turn is the rest turn (head toward +Z, upright) with the
// small sway of the idle kept on top of it.
import fs from "node:fs";
import path from "node:path";
import { ENTRANCE_GLB, OUT, fail, makeIO, workDir, writeWhole } from "./lib/env.mjs";
import { cutClip, seam, stillTail } from "./lib/clips.mjs";
import { boxOf, disposeDeep, poseAt, qinv, qmul, skinnedPositions } from "./lib/rig.mjs";
import {
  compressGeometry,
  compressTextures,
  dropAttributes,
  stripMaterialExtensions,
} from "./lib/optimize.mjs";

const MESHES = [
  "selena_silverbolt_raiko_entrance_abyssal_devil_01",
  "selena_silverbolt_raiko_entrance_abyssal_devil_02",
];
const ROOT = "D_she_root";
const CLIP = "selena_silverbolt_raiko_entrance_city_idle";
const r4 = (x) => +x.toFixed(4);

export async function buildSilverbolt({ out = OUT } = {}) {
  const io = makeIO();
  const doc = await io.read(ENTRANCE_GLB);
  const root = doc.getRoot();
  const report = {};

  // 1. The two meshes and the joints they are skinned to, with their ancestors up to the root.
  const meshNodes = MESHES.map((name) => {
    const node = root.listNodes().find((n) => n.getMesh()?.getName() === name);
    if (!node) fail(`no ${name}`);
    return node;
  });
  const oldSkin = meshNodes[0].getSkin();
  if (meshNodes.some((n) => n.getSkin() !== oldSkin)) fail("the two meshes have different skins");
  const oldJoints = oldSkin.listJoints();
  const dragonRoot = root.listNodes().find((n) => n.getName() === ROOT);
  const used = new Set();
  for (const node of meshNodes)
    for (const prim of node.getMesh().listPrimitives()) {
      const J = prim.getAttribute("JOINTS_0");
      const W = prim.getAttribute("WEIGHTS_0");
      for (let i = 0; i < J.getCount(); i++) {
        const j = J.getElement(i, []);
        const w = W.getElement(i, []);
        for (let k = 0; k < 4; k++) if (w[k] > 0) used.add(oldJoints[j[k]]);
      }
    }
  const keep = new Set();
  for (const joint of used) {
    let p = joint;
    while (p && p !== dragonRoot) {
      keep.add(p);
      p = p.getParentNode();
    }
    if (!p) fail(`${joint.getName()} is not under ${ROOT}`);
  }
  keep.add(dragonRoot);
  const kept = oldJoints.filter((j) => keep.has(j));
  report.joints = kept.length;
  report.jointsInSource = oldJoints.length;

  // 2. The clip: city_idle only, its channels on the kept joints only, moved to start at 0 and
  // cut where it stops moving.
  const clip = root.listAnimations().find((a) => a.getName() === CLIP);
  if (!clip) fail(`no ${CLIP}`);
  for (const a of root.listAnimations()) if (a !== clip) disposeDeep(a);
  for (const channel of clip.listChannels()) {
    if (keep.has(channel.getTargetNode())) continue;
    const sampler = channel.getSampler();
    channel.dispose();
    sampler.dispose();
  }
  const tail = stillTail(clip, 1e-4);
  cutClip(doc, clip, tail.start, tail.end);
  clip.setName("idle");
  const length = tail.end - tail.start;
  report.clip = {
    source: CLIP,
    before: r4(tail.last),
    after: r4(length),
    kept: [r4(tail.start), r4(tail.end)],
    endToStart: (({ turn, move }) => ({ turn: +turn.toFixed(2), move: r4(move) }))(
      seam(clip, length),
    ),
  };

  // 3. The dragon's root: scale 1, the rest turn with the idle's sway on top, a fixed place.
  const rootChannels = clip.listChannels().filter((c) => c.getTargetNode() === dragonRoot);
  const rest = dragonRoot.getRotation();
  for (const channel of rootChannels) {
    const sampler = channel.getSampler();
    if (channel.getTargetPath() !== "rotation") {
      report[`root ${channel.getTargetPath()} in the source`] = sampler
        .getOutput()
        .getElement(0, [])
        .map(r4);
      channel.dispose();
      sampler.dispose();
      continue;
    }
    const out_ = sampler.getOutput();
    const first = out_.getElement(0, []);
    const fix = qmul(rest, qinv(first));
    const values = new Float32Array(out_.getCount() * 4);
    for (let i = 0; i < out_.getCount(); i++) values.set(qmul(fix, out_.getElement(i, [])), i * 4);
    out_.setArray(values);
  }
  dragonRoot.setScale([1, 1, 1]);

  // 4. A new top node holds the dragon's root and the two meshes; everything else goes.
  const top = doc.createNode("silverbolt");
  const scene = root.listScenes()[0];
  for (const child of scene.listChildren()) scene.removeChild(child);
  scene.addChild(top);
  dragonRoot.getParentNode()?.removeChild(dragonRoot);
  top.addChild(dragonRoot);
  for (const node of meshNodes) {
    node.getParentNode()?.removeChild(node);
    node.setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]).setScale([1, 1, 1]);
    top.addChild(node);
  }
  const ibm = oldSkin.getInverseBindMatrices();
  const newIbm = new Float32Array(kept.length * 16);
  kept.forEach((joint, i) => newIbm.set(ibm.getElement(oldJoints.indexOf(joint), []), i * 16));
  const buffer = root.listBuffers()[0];
  const skin = doc
    .createSkin("silverbolt")
    .setSkeleton(dragonRoot)
    .setInverseBindMatrices(
      doc.createAccessor().setType("MAT4").setArray(newIbm).setBuffer(buffer),
    );
  for (const joint of kept) skin.addJoint(joint);
  const remap = new Map(kept.map((joint, i) => [oldJoints.indexOf(joint), i]));
  for (const node of meshNodes) {
    node.setSkin(skin);
    for (const prim of node.getMesh().listPrimitives()) {
      const J = prim.getAttribute("JOINTS_0");
      const W = prim.getAttribute("WEIGHTS_0");
      const out_ = new Uint8Array(J.getCount() * 4);
      for (let i = 0; i < J.getCount(); i++) {
        const j = J.getElement(i, []);
        const w = W.getElement(i, []);
        for (let k = 0; k < 4; k++) out_[i * 4 + k] = w[k] > 0 ? remap.get(j[k]) : 0;
      }
      prim.setAttribute(
        "JOINTS_0",
        doc.createAccessor().setType("VEC4").setArray(out_).setBuffer(buffer),
      );
    }
  }
  oldSkin.dispose();
  const keepNodes = new Set([top, ...kept, ...meshNodes]);
  for (const node of root.listNodes()) if (!keepNodes.has(node)) node.dispose();
  for (const mesh of root.listMeshes()) if (!MESHES.includes(mesh.getName())) disposeDeep(mesh);

  // 5. The place: the dragon's box over the loop is centred on the origin.
  const samples = [];
  for (let i = 0; i <= 12; i++) {
    poseAt(clip, (length * i) / 12);
    for (const node of meshNodes)
      for (const prim of node.getMesh().listPrimitives())
        samples.push(...skinnedPositions(prim, skin));
  }
  const before = boxOf(samples);
  const t = dragonRoot.getTranslation();
  dragonRoot.setTranslation(t.map((x, k) => x - before.centre[k]));
  report.box = {
    size: before.size.map(r4),
    shiftedBy: before.centre.map((x) => r4(-x)),
  };
  // The rest pose is the first key of the idle, so the file stands before the clip plays.
  poseAt(clip, 0);

  // 6. Materials: base colour only (the normal map is a game input the room never reads).
  stripMaterialExtensions(doc);
  for (const material of root.listMaterials()) {
    material.setNormalTexture(null).setMetallicFactor(0).setRoughnessFactor(1);
  }
  dropAttributes(doc, ["TEXCOORD_1", "TEXCOORD_2", "TEXCOORD_3", "COLOR_0", "COLOR_1"]);
  report.materials = root.listMaterials().map((m) => ({
    name: m.getName(),
    alphaMode: m.getAlphaMode(),
    baseColorTexture: m.getBaseColorTexture()?.getName() ?? null,
  }));
  for (const m of report.materials)
    if (!m.baseColorTexture) fail(`material without a picture: ${m.name}`);
  const { prune } = await import("@gltf-transform/functions");
  await doc.transform(prune({ keepLeaves: true, keepExtras: true }));
  report.textures = await compressTextures(doc, [
    [/weapon01_d/, { size: 2048, quality: 92, alpha: false }],
    [/fx01_d/, { size: 2048, quality: 92 }],
  ]);
  await compressGeometry(doc);

  const file = path.join(out, "silverbolt.glb");
  const bytes = await io.writeBinary(doc);
  writeWhole(file, bytes);
  report.file = file;
  report.bytes = bytes.byteLength;
  fs.writeFileSync(path.join(workDir(), "silverbolt.report.json"), JSON.stringify(report, null, 1));
  console.log(JSON.stringify({ joints: report.joints, clip: report.clip, box: report.box }));
  return report;
}
