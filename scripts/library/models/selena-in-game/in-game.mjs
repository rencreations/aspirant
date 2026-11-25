// selena-in-game.glb: the normal and the abyssal form in one file, two roots on one spot, the
// clips by their ids, trimmed, and the timing of the two form changes in the scene's extras.
import fs from "node:fs";
import path from "node:path";
import { mergeDocuments, prune, unpartition } from "@gltf-transform/functions";
import {
  ABYSSAL_GLB,
  IN_GAME,
  NORMAL_GLB,
  OUT,
  fail,
  makeIO,
  workDir,
  writeWhole,
} from "./lib/env.mjs";
import { cutClip, seam, stillTail } from "./lib/clips.mjs";
import { disposeDeep, isIdentity, orderClips, restFromClip } from "./lib/rig.mjs";
import { splitOrbs } from "./lib/orbs.mjs";
import {
  compressGeometry,
  compressTextures,
  dropAttributes,
  stripMaterialExtensions,
} from "./lib/optimize.mjs";
import { bleedClear } from "./lib/pictures.mjs";
import {
  ABYSSAL_CLIPS,
  ABYSSAL_PREFIX,
  ABYSSAL_SHIFT,
  CUT_AT_SINK,
  DROPPED,
  DROPPED_MESHES,
  FORMS,
  NORMAL_CLIPS,
  NORMAL_PREFIX,
  PELVIS,
  SINK_Y,
  STILL_EPS,
} from "./config.mjs";

const r4 = (x) => +x.toFixed(4);

/** The pelvis translation channel of a clip. */
function pelvisChannel(animation) {
  const channel = animation
    .listChannels()
    .find((c) => c.getTargetNode()?.getName() === PELVIS && c.getTargetPath() === "translation");
  if (!channel) fail(`${animation.getName()} has no pelvis track`);
  return channel;
}

/** The value of a channel at time t (linear, as three plays it). */
function valueAt(channel, t) {
  const sampler = channel.getSampler();
  const input = sampler.getInput().getArray();
  const out = sampler.getOutput();
  const a = [];
  const b = [];
  if (t <= input[0]) return out.getElement(0, a);
  if (t >= input[input.length - 1]) return out.getElement(input.length - 1, a);
  let i = 1;
  while (input[i] < t) i++;
  out.getElement(i - 1, a);
  out.getElement(i, b);
  const f = (t - input[i - 1]) / (input[i] - input[i - 1]);
  return a.map((x, k) => x + (b[k] - x) * f);
}

/** Renames, shifts and trims the clips of one source. Returns one report row a clip. */
function prepareClips(doc, list, prefix, shift) {
  const byName = new Map(list.map(([id, source]) => [prefix + source, id]));
  const rows = [];
  for (const animation of doc.getRoot().listAnimations()) {
    const name = animation.getName();
    const short = name.startsWith(prefix) ? name.slice(prefix.length) : name;
    if (DROPPED.includes(short)) {
      disposeDeep(animation);
      rows.push({ id: null, source: name, dropped: true });
      continue;
    }
    const id = byName.get(name);
    if (!id) fail(`a clip no table names: ${name}`);
    const tail = stillTail(animation, STILL_EPS);
    if (Math.abs(tail.start - shift) > 1e-4) fail(`${name} starts at ${tail.start}, not ${shift}`);
    let end = tail.end;
    let why = "still keys at the end";
    if (CUT_AT_SINK.includes(id)) {
      // The last key before the game sends the form under the ground.
      const input = pelvisChannel(animation).getSampler().getInput().getArray();
      const sink = input.findIndex((time) => valueAt(pelvisChannel(animation), time)[1] < SINK_Y);
      if (sink < 1) fail(`${id}: no sink found`);
      end = Math.min(end, input[sink - 1]);
      why = `cut at the last key before the sink (pelvis under ${SINK_Y} m at ${r4(input[sink] - shift)} s)`;
    }
    cutClip(doc, animation, tail.start, end);
    animation.setName(id);
    const loop = seam(animation, end - tail.start);
    rows.push({
      id,
      source: name,
      // Three reads a clip's length as its last key; the source's first key is at `shift`.
      before: r4(tail.last),
      after: r4(end - tail.start),
      // The range of the source clip that was kept, in the source's own seconds.
      kept: [r4(tail.start), r4(end)],
      why: end < tail.last - 1e-4 ? why : "nothing to cut",
      // How far the last pose is from the first (a loop that closes is near 0).
      endToStart: { turn: +loop.turn.toFixed(2), move: r4(loop.move) },
    });
  }
  const missing = list.filter(([id]) => !rows.some((r) => r.id === id));
  if (missing.length) fail(`clips not found: ${missing.map(([id]) => id).join(", ")}`);
  return rows;
}

/** The rest pose of a form is the first key of its idle, so the file stands before any clip plays. */
function standAtRest(doc, idle) {
  const animation = doc
    .getRoot()
    .listAnimations()
    .find((a) => a.getName() === idle);
  restFromClip(animation);
  // Both sources hang the joints under a root whose world transform is the identity, so a
  // joint's local translation is its place in the world (the analysis relies on it).
  const pelvis = pelvisChannel(animation).getTargetNode();
  const parent = pelvis.getParentNode();
  if (!isIdentity(parent.getWorldMatrix())) fail(`${parent.getName()} is not at the identity`);
}

/** The eased gap the second form closes after the swap, as a translation track on its root. */
function addCarry(doc, change, root, durations) {
  const first = doc
    .getRoot()
    .listAnimations()
    .find((a) => a.getName() === change.first);
  const second = doc
    .getRoot()
    .listAnimations()
    .find((a) => a.getName() === change.second);
  const from = valueAt(pelvisChannel(first), change.hideAt);
  const to = valueAt(pelvisChannel(second), change.secondFrom);
  const gap = from.map((x, k) => x - to[k]);
  const times = [];
  const values = [];
  const end = durations[change.second];
  const steps = Math.round((end - 0) * 30);
  for (let i = 0; i <= steps; i++) {
    const t = Math.min(end, i / 30);
    const u = Math.min(1, Math.max(0, (t - change.secondFrom) / change.carryFor));
    const keep = 1 - u * u * (3 - 2 * u);
    times.push(t);
    values.push(...gap.map((g) => g * keep));
  }
  const buffer = doc.getRoot().listBuffers()[0];
  const input = doc
    .createAccessor()
    .setType("SCALAR")
    .setArray(new Float32Array(times))
    .setBuffer(buffer);
  const output = doc
    .createAccessor()
    .setType("VEC3")
    .setArray(new Float32Array(values))
    .setBuffer(buffer);
  const sampler = doc
    .createAnimationSampler()
    .setInput(input)
    .setOutput(output)
    .setInterpolation("LINEAR");
  const channel = doc
    .createAnimationChannel()
    .setTargetNode(root)
    .setTargetPath("translation")
    .setSampler(sampler);
  second.addSampler(sampler).addChannel(channel);
  return gap.map(r4);
}

export async function buildInGame({ forms = FORMS, out = OUT } = {}) {
  const io = makeIO();
  const doc = await io.read(NORMAL_GLB);
  const abyssalDoc = await io.read(ABYSSAL_GLB);
  const report = { clips: [] };

  report.droppedMeshes = [];
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh || !DROPPED_MESHES.includes(mesh.getName())) continue;
    report.droppedMeshes.push(mesh.getName());
    node.dispose();
    disposeDeep(mesh);
  }
  if (report.droppedMeshes.length !== DROPPED_MESHES.length) fail("a mesh to drop was not found");
  report.clips.push(...prepareClips(doc, NORMAL_CLIPS, NORMAL_PREFIX, 0));
  report.clips.push(...prepareClips(abyssalDoc, ABYSSAL_CLIPS, ABYSSAL_PREFIX, ABYSSAL_SHIFT));
  standAtRest(doc, "normal/idle");
  standAtRest(abyssalDoc, "abyssal/idle");

  // The abyssal orbs: their own primitive and the game's crystal picture (lib/orbs.mjs).
  {
    const mesh = abyssalDoc
      .getRoot()
      .listMeshes()
      .find((m) => m.getName().endsWith("abyssal_form_body_01"));
    const prim = mesh
      .listPrimitives()
      .find((p) => p.getMaterial().getName().endsWith("abyssal_form_body_03"));
    const skin = abyssalDoc.getRoot().listSkins()[0];
    report.orbs = splitOrbs(
      abyssalDoc,
      mesh,
      prim,
      skin,
      path.join(IN_GAME, "abyssal_form", "matcap1.png"),
    );
  }

  // Two roots, `normal` and `abyssal`, each holding its source armature unchanged (its node
  // transforms, its skin), so three draws each form exactly as it draws the source.
  const map = mergeDocuments(doc, abyssalDoc);
  const scene = doc.getRoot().listScenes()[0];
  const other = map.get(abyssalDoc.getRoot().listScenes()[0]);
  const roots = {};
  for (const [name, from] of [
    [forms.roots.normal, scene],
    [forms.roots.abyssal, other],
  ]) {
    const root = doc.createNode(name);
    for (const child of from.listChildren()) {
      from.removeChild(child);
      root.addChild(child);
    }
    roots[name] = root;
  }
  scene.addChild(roots[forms.roots.normal]).addChild(roots[forms.roots.abyssal]);
  other.dispose();
  doc.getRoot().setDefaultScene(scene);
  scene.setName("selena-in-game");
  // One buffer; the materials and pictures of the dropped mesh go with it.
  await doc.transform(unpartition(), prune({ keepLeaves: true, keepExtras: true }));

  const ids = [...NORMAL_CLIPS, ...ABYSSAL_CLIPS].map(([id]) => id);
  const names = doc
    .getRoot()
    .listAnimations()
    .map((a) => a.getName());
  for (const name of names) if (!ids.includes(name)) fail(`stray clip ${name}`);
  if (new Set(names).size !== names.length) fail("two clips share a name");
  // A clip's length as three reads it: its last key, as stored (float32), not rounded.
  const durations = Object.fromEntries(
    doc
      .getRoot()
      .listAnimations()
      .map((a) => [
        a.getName(),
        Math.max(...a.listChannels().map((c) => c.getSampler().getInput().getMax([])[0])),
      ]),
  );

  // The form changes: resolve "end", check the clips, add the carry when asked.
  const extrasForms = { roots: { ...forms.roots } };
  report.carry = {};
  for (const key of ["toAbyssal", "toNormal"]) {
    const change = { ...forms[key] };
    if (!(change.first in durations) || !(change.second in durations)) fail(`${key}: unknown clip`);
    // Floor to 1e-4 so hideAt is never past the clip's last key.
    if (change.hideAt === "end") change.hideAt = Math.floor(durations[change.first] * 1e4) / 1e4;
    const secondRoot = roots[forms.roots[key === "toAbyssal" ? "abyssal" : "normal"]];
    if (change.carry) report.carry[key] = addCarry(doc, change, secondRoot, durations);
    extrasForms[key] = {
      first: change.first,
      hideAt: change.hideAt,
      second: change.second,
      secondFrom: r4(change.secondFrom),
      // The second form is in place and above the ground from this time of its clip.
      showAt: r4(change.secondFrom),
      ...(change.carry ? { carry: report.carry[key], carryFor: change.carryFor } : {}),
    };
  }
  extrasForms.trim = Object.fromEntries(
    report.clips
      .filter((c) => c.id && (c.kept[0] > 0 || c.kept[1] < c.before - 1e-4))
      .map((c) => [c.id, c.kept]),
  );
  orderClips(doc, ids);

  // Materials: the plain metal-rough material three builds as MeshStandardMaterial.
  stripMaterialExtensions(doc);
  for (const material of doc.getRoot().listMaterials()) {
    material.setMetallicFactor(0).setRoughnessFactor(1);
  }
  dropAttributes(doc, ["COLOR_0", "COLOR_1", "TEXCOORD_1"]);

  // The effect picture: the sparkles of the abyssal form (FX_M_63, pbs_02_m1) are a cut-out on a
  // magenta ground that must not bleed into their edges. The material stays BLEND.
  const fx = {};
  for (const texture of doc.getRoot().listTextures()) {
    const name = texture.getName();
    if (name === "evilgirl_skin11_pbs_02_m1") {
      const bled = await bleedClear(texture.getImage());
      texture.setImage(new Uint8Array(bled.png));
      fx[name] = `clear pixels filled with ${bled.mean} (${bled.filled} px)`;
    }
  }
  report.effects = fx;
  report.materials = doc
    .getRoot()
    .listMaterials()
    .map((m) => ({
      name: m.getName(),
      alphaMode: m.getAlphaMode(),
      doubleSided: m.getDoubleSided(),
      baseColorTexture: m.getBaseColorTexture()?.getName() ?? null,
    }));
  for (const m of report.materials)
    if (!m.baseColorTexture) fail(`material without a picture: ${m.name}`);

  report.textures = await compressTextures(doc, [
    // Pictures of opaque materials: the alpha holds a game mask, which the room must not read.
    [
      /^(selena_skin11_pbs_d|evilgirl_skin11_pbs_d|evilgirl_skin11_pbs_02_d|matcap1)$/,
      { size: 2048, quality: 92, alpha: false },
    ],
    [/^evilgirl_skin11_pbs_02_m1$/, { size: 2048, quality: 92 }],
  ]);
  await compressGeometry(doc);

  // What the room needs that glTF has no place for (the default scene's extras, gltf.scene.userData).
  scene.setExtras({ forms: extrasForms });

  const file = path.join(out, "selena-in-game.glb");
  const bytes = await io.writeBinary(doc);
  writeWhole(file, bytes);
  report.file = file;
  report.bytes = bytes.byteLength;
  report.forms = extrasForms;
  fs.writeFileSync(
    path.join(workDir(), "selena-in-game.report.json"),
    JSON.stringify(report, null, 1),
  );
  return report;
}
