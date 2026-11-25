// Selena's Entrance view: the owner's file cut down to Selena (normal form) and Silverbolt, the
// fourteen clips of the room by their ids, the cameras fitted to the game's recordings and the
// sticker's anchor, written to the R2 mirror.
//
//   node scripts/library/models/selena-entrance/build.mjs            the whole build and the checks
//   node scripts/library/models/selena-entrance/build.mjs --no-check the file only
//
// README.md says what it reads, what it writes and what was checked. Never edit the output.
import fs from "node:fs";
import path from "node:path";
import { CLIPS, DROPPED_CLIPS, PREFIX } from "./clips.mjs";
import { cameraExtras } from "./cameras.mjs";
import { OUT_FILE, SOURCE_GLB, fail, option, readJson, workDir, writeWhole } from "./lib/env.mjs";
import {
  compressGeometry,
  compressTextures,
  makeIO,
  stripMaterialExtensions,
} from "./lib/optimize.mjs";
import {
  foldArmature,
  loopGap,
  pruneSkin,
  rewriteClip,
  sampleClip,
  stillFrom,
  usedJoints,
} from "./lib/rig.mjs";
import { STICKER } from "./sticker.mjs";
import { prune } from "@gltf-transform/functions";
import sharp from "sharp";

/**
 * The meshes of the abyssal form go. So do `accessory_01` and `_02`: the phone and its four
 * message cards, parked 3.5 to 4 m to the side on a bone that never moves (the game puts the
 * phone in her hand by itself; the room has the phone as a view of its own).
 */
const DROP_MESH = /_(abyssal_form(_hair_0[12])?|accessory_0[12])$/;
/** Still means: no bone turns by more than this, moves by more than this, scales by more than this. */
const STILL = { rotation: (0.05 * Math.PI) / 180, translation: 1e-4, scale: 1e-4 };
const TEXTURES = [
  [/body0[12]_d/, { size: 2048, quality: 88 }],
  [/weapon0[12]_d/, { size: 2048, quality: 88 }],
  [/hair0[12]_dr/, { size: 2048, quality: 90 }],
  [/head0[12]_d/, { size: 2048, quality: 92 }],
  [/fx0[123]_d/, { size: 2048, quality: 90 }],
];

const work = workDir("work");

/** Mesh, skin, clips: the file as the room needs it, before the size pass. */
async function model() {
  const io = makeIO();
  const doc = await io.read(SOURCE_GLB);
  const root = doc.getRoot();
  const scene = root.listScenes()[0];
  const armature = scene.listChildren().find((n) => n.getName() === `${PREFIX}armature`);
  if (!armature) fail("no armature node");
  const skins = root.listSkins();
  if (skins.length !== 1) fail(`expected one skin, found ${skins.length}`);
  const skin = skins[0];

  // 1. Meshes.
  const meshNodes = root.listNodes().filter((n) => n.getMesh());
  const dropped = meshNodes.filter((n) => DROP_MESH.test(n.getName()));
  const kept = meshNodes.filter((n) => !DROP_MESH.test(n.getName()));
  if (dropped.length !== 5) fail(`expected five meshes to drop, found ${dropped.length}`);
  for (const node of dropped) {
    const mesh = node.getMesh();
    node.dispose();
    mesh.dispose();
  }

  // 2. Bones: the ones that skin a kept mesh and their ancestors.
  const keptMeshes = kept.map((n) => n.getMesh());
  const { used, keep } = usedJoints(skin, keptMeshes);
  const before = skin.listJoints();
  const skinReport = pruneSkin(doc, skin, keep, keptMeshes);
  const droppedBones = before.filter((j) => !keep.has(j));
  const droppedSet = new Set([...droppedBones, ...dropped]);
  // A node that is neither a joint nor a mesh would be lost silently: there must be none.
  for (const node of armature.listChildren()) {
    if (!node.getMesh() && !before.includes(node)) fail(`${node.getName()}: not a joint`);
  }

  // 3. Clips: the dropped ones go, channels of removed bones go.
  for (const animation of root.listAnimations()) {
    const short = animation.getName().replace(PREFIX, "");
    if (DROPPED_CLIPS.includes(short)) {
      for (const channel of animation.listChannels()) {
        const sampler = channel.getSampler();
        channel.dispose();
        sampler.dispose();
      }
      animation.dispose();
      continue;
    }
    for (const channel of animation.listChannels()) {
      if (channel.getTargetNode() && !droppedSet.has(channel.getTargetNode())) continue;
      const sampler = channel.getSampler();
      channel.dispose();
      sampler.dispose();
    }
  }
  // Leaves first, so no kept node loses a child it needs.
  for (const node of droppedBones.reverse()) {
    if (node.listChildren().some((c) => !droppedSet.has(c)))
      fail(`${node.getName()} has a kept child`);
    node.dispose();
  }

  // 4. The armature node is folded into the root bones.
  foldArmature(doc, armature);

  // 5. Each clip: its id, its first key at 0 s, cut where it stops moving.
  const cameraBake = readJson(path.join(work, "cameras.game.json"));
  const clipReport = {};
  const buffer = root.listBuffers()[0];
  for (const clip of CLIPS) {
    const animation = root.listAnimations().find((a) => a.getName() === `${PREFIX}${clip.action}`);
    if (!animation) fail(`no clip ${clip.action}`);
    animation.setName(clip.id);
    const sampled = sampleClip(animation);
    if (Math.abs(sampled.start - 1 / 24) > 1e-4) fail(`${clip.id} starts at ${sampled.start}`);
    const bones = stillFrom(sampled, STILL);
    const camera = cameraStill(cameraBake.clips[clip.id]);
    // The camera's own path counts as motion: an in clip must not stop before its camera does.
    const lastFrame = Math.max(1, bones.still, Math.ceil(camera.still * 24 - 1e-6));
    const end = Math.min(sampled.frames - 1, lastFrame);
    const written = rewriteClip(doc, animation, sampled, end, buffer);
    const gap = loopGap(sampled, end);
    clipReport[clip.id] = {
      source: `${PREFIX}${clip.action}`,
      loop: Boolean(clip.loop),
      sourceFrames: sampled.frames,
      sourceSeconds: round((sampled.frames - 1) / 24),
      frames: written.frames,
      seconds: round(written.duration),
      stillFromSeconds: round(bones.still / 24),
      lastToSettle: bones.mover,
      cameraStillFromSeconds: round(camera.still),
      trimmedSeconds: round((sampled.frames - 1 - end) / 24),
      firstToLast: {
        degrees: round((gap.rotation * 180) / Math.PI, 3),
        metres: round(gap.translation, 5),
        scale: round(gap.scale, 5),
        worst: gap.worst,
      },
    };
  }
  if (root.listAnimations().length !== CLIPS.length)
    fail(`${root.listAnimations().length} clips left, expected ${CLIPS.length}`);

  // 6. Materials: base colour only (the room reads nothing else), no specular extension.
  await doc.transform(prune({ keepLeaves: true, keepAttributes: true, keepExtras: true }));
  stripMaterialExtensions(doc);
  // The UV set of the base colour becomes the first one (two materials paint on their second).
  const uvOf = new Map();
  for (const material of root.listMaterials()) {
    const info = material.getBaseColorTextureInfo();
    if (!material.getBaseColorTexture()) fail(`${material.getName()}: no base colour`);
    uvOf.set(material, info.getTexCoord());
    info.setTexCoord(0);
    material
      .setNormalTexture(null)
      .setOcclusionTexture(null)
      .setEmissiveTexture(null)
      .setMetallicRoughnessTexture(null)
      .setMetallicFactor(0)
      .setRoughnessFactor(1)
      .setName(material.getName().replace(PREFIX, ""));
  }
  for (const mesh of root.listMeshes()) {
    mesh.setName(mesh.getName().replace(PREFIX, ""));
    for (const prim of mesh.listPrimitives()) {
      const uv = uvOf.get(prim.getMaterial());
      if (uv !== 0) {
        const attribute = prim.getAttribute(`TEXCOORD_${uv}`);
        if (!attribute) fail(`${mesh.getName()}: no TEXCOORD_${uv}`);
        prim.setAttribute("TEXCOORD_0", attribute);
      }
      for (const semantic of prim.listSemantics()) {
        if (/^TEXCOORD_[1-9]/.test(semantic) || /^COLOR_/.test(semantic))
          prim.setAttribute(semantic, null);
      }
    }
  }
  for (const node of root.listNodes()) if (node.getMesh()) node.setName(node.getMesh().getName());
  skin.setName("selena_silverbolt");
  // Blended only where it is really see-through: a BLEND material whose base colour has no texel
  // under full alpha is drawn opaque (hair_01: blended hair sorts badly from a free camera).
  const opaqued = [];
  for (const material of root.listMaterials()) {
    if (material.getAlphaMode() !== "BLEND" || material.getBaseColorFactor()[3] < 1) continue;
    const { data } = await sharp(Buffer.from(material.getBaseColorTexture().getImage()))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    let solid = true;
    for (let i = 3; i < data.length && solid; i += 4) solid = data[i] === 255;
    if (!solid) continue;
    material.setAlphaMode("OPAQUE");
    opaqued.push(material.getName());
  }
  await doc.transform(prune({ keepLeaves: true, keepAttributes: false, keepExtras: true }));

  const file = path.join(work, "model.glb");
  writeWhole(file, await io.writeBinary(doc));
  const report = {
    meshes: kept.map((n) => n.getName()),
    droppedMeshes: dropped.length,
    bones: { ...skinReport, weighted: used.size },
    drawnOpaque: opaqued,
    blended: root
      .listMaterials()
      .filter((m) => m.getAlphaMode() === "BLEND")
      .map((m) => m.getName()),
    clips: clipReport,
  };
  writeWhole(path.join(work, "model.report.json"), JSON.stringify(report, null, 2));
  return report;
}

/** When the game's camera of a clip stops moving (seconds; 30 keys a second). */
function cameraStill(cam) {
  const keys = cam.keys;
  const n = keys.length / 7;
  const row = (i) => keys.slice(i * 7, i * 7 + 7);
  const last = row(n - 1);
  for (let i = n - 2; i >= 0; i--) {
    const r = row(i);
    const move = Math.hypot(r[0] - last[0], r[1] - last[1], r[2] - last[2]);
    const dot = Math.abs(r[3] * last[3] + r[4] * last[4] + r[5] * last[5] + r[6] * last[6]);
    if (move > STILL.translation || 2 * Math.acos(Math.min(1, dot)) > STILL.rotation)
      return { still: (i + 1) / 30 };
  }
  return { still: 0 };
}

function round(v, d = 4) {
  return Math.round(v * 10 ** d) / 10 ** d;
}

/** The size pass and the scene's extras: the file the room loads. */
async function pack(report) {
  const io = makeIO();
  const doc = await io.read(path.join(work, "model.glb"));
  const textureReport = await compressTextures(doc, TEXTURES);
  await compressGeometry(doc);
  const clips = Object.fromEntries(
    Object.entries(report.clips).map(([id, c]) => [id, { frames: c.frames, seconds: c.seconds }]),
  );
  doc
    .getRoot()
    .listScenes()[0]
    .setExtras({ cameras: cameraExtras(clips), sticker: STICKER });
  const bytes = await io.writeBinary(doc);
  writeWhole(OUT_FILE, bytes);
  return { bytes: bytes.byteLength, textures: textureReport };
}

const report = option("pack-only") ? readJson(path.join(work, "model.report.json")) : await model();
for (const [id, c] of Object.entries(report.clips)) {
  console.log(
    `${id.padEnd(20)} ${c.sourceSeconds.toFixed(3)} s -> ${c.seconds.toFixed(3)} s` +
      ` (bones still from ${c.stillFromSeconds}, camera ${c.cameraStillFromSeconds})` +
      (c.loop ? ` loop gap ${c.firstToLast.degrees} deg ${c.firstToLast.metres} m` : ""),
  );
}
console.log("bones", JSON.stringify(report.bones), "meshes", report.meshes.length);
const packed = await pack(report);
console.log(`${OUT_FILE} ${packed.bytes} bytes`);
writeWhole(
  path.join(work, "pack.report.json"),
  JSON.stringify({ bytes: packed.bytes, textures: packed.textures }, null, 2),
);
if (!option("no-check")) {
  const { check } = await import("./verify/check.mjs");
  await check({ file: OUT_FILE, report });
}
if (fs.existsSync(`${OUT_FILE}.part`)) fail("a partial file was left behind");
