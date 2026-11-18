// Rig work on a glTF document: a clean skeleton and the baked clips.
//
// Blender writes the armature as a node that is turned +90 degrees about X, and the bones
// under it are turned by the Y-up swizzle (the exporter's two turns cancel for the world,
// not for the local axes). A viewer that sets `bone.position` would move along turned axes.
// `normalizeRig` takes the armature node out: bones hang on the scene, their local
// transform is the plain armature-space transform that blender/common.py baked, and the
// inverse bind matrices are rebuilt from the rest pose. A model built this way has world
// space = armature space = the space the camera data is in.
import { THREE, fail } from "./env.mjs";

const { Matrix4, Quaternion, Vector3 } = THREE;

/** Ten numbers (translation, quaternion x y z w, scale) to a matrix. */
export function rowToMatrix(row, offset = 0) {
  const m = new Matrix4();
  m.compose(
    new Vector3(row[offset], row[offset + 1], row[offset + 2]),
    new Quaternion(row[offset + 3], row[offset + 4], row[offset + 5], row[offset + 6]).normalize(),
    new Vector3(row[offset + 7], row[offset + 8], row[offset + 9]),
  );
  return m;
}

/** World rest matrices of the bones of `bake`, from its node-local rest transforms. */
export function restWorld(bake) {
  const world = new Map();
  const visit = (name) => {
    if (world.has(name)) return world.get(name);
    const local = rowToMatrix(bake.restLocal[name]);
    const parent = bake.parent[name];
    const m = parent == null ? local : visit(parent).clone().multiply(local);
    world.set(name, m);
    return m;
  };
  for (const name of bake.bones) visit(name);
  return world;
}

function sameRotation(a, b) {
  const dot = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]);
  return 1 - Math.min(1, dot);
}

/**
 * Replaces the armature node and the bone transforms. Returns what it measured so that the
 * build can print it: the largest difference between the exporter's rest nodes and the rest
 * transforms computed from the Blender matrices (they must agree: it proves the maths).
 */
export function normalizeRig(doc, bake) {
  const root = doc.getRoot();
  const scene = root.listScenes()[0];
  const byName = new Map(root.listNodes().map((n) => [n.getName(), n]));
  const armature = root.listNodes().find((n) => /_armature$/.test(n.getName()));
  if (!armature) fail("no armature node in the raw file");

  let worstTranslation = 0;
  let worstRotation = 0;
  for (const name of bake.bones) {
    const node = byName.get(name);
    if (!node) fail(`the raw file has no bone ${name}`);
    if (bake.parent[name] == null) continue; // roots are re-written below
    const row = bake.restLocal[name];
    const t = node.getTranslation();
    worstTranslation = Math.max(
      worstTranslation,
      Math.hypot(t[0] - row[0], t[1] - row[1], t[2] - row[2]),
    );
    worstRotation = Math.max(worstRotation, sameRotation(node.getRotation(), row.slice(3, 7)));
  }

  // Bones: local transforms from the bake, roots on the scene.
  for (const name of bake.bones) {
    const node = byName.get(name);
    const row = bake.restLocal[name];
    node.setTranslation(row.slice(0, 3));
    node.setRotation(row.slice(3, 7));
    node.setScale(row.slice(7, 10));
    if (bake.parent[name] == null) {
      armature.removeChild(node);
      scene.addChild(node);
    }
  }
  // Meshes: out of the armature, identity.
  for (const node of root.listNodes()) {
    if (!node.getMesh()) continue;
    node.setTranslation([0, 0, 0]);
    node.setRotation([0, 0, 0, 1]);
    node.setScale([1, 1, 1]);
    if (node.getParentNode() === armature) {
      armature.removeChild(node);
      scene.addChild(node);
    }
  }
  scene.removeChild(armature);
  armature.dispose();

  // Inverse bind matrices from the rest world matrices. The vertices are stored in the same
  // space as the bones (armature space), so the rest pose must give back the vertices.
  const world = restWorld(bake);
  for (const skin of root.listSkins()) {
    const joints = skin.listJoints();
    const out = new Float32Array(joints.length * 16);
    joints.forEach((joint, i) => {
      const w = world.get(joint.getName());
      if (!w) fail(`the skin has a joint (${joint.getName()}) that is not in the bake`);
      out.set(w.clone().invert().elements, i * 16);
    });
    skin.getInverseBindMatrices().setArray(out);
  }
  return { worstTranslation, worstRotation };
}

const EPS_TRANSLATION = 1e-5;
const EPS_ROTATION = 1e-6;
const EPS_SCALE = 1e-5;

function spread(values, size, frames) {
  let worst = 0;
  for (let k = 0; k < size; k++) {
    let lo = Infinity;
    let hi = -Infinity;
    for (let f = 0; f < frames; f++) {
      const v = values[f * size + k];
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
    worst = Math.max(worst, hi - lo);
  }
  return worst;
}

/**
 * Writes the baked clips as glTF animations, one key per frame, 24 per second, time zero at
 * the first key. A clip of N frames lasts (N - 1) / 24 s: the clip ends on its last key and
 * nothing is held after it. `loops` names the clips whose last key is the first one again:
 * their last key is set to the first one exactly, so wrapping at the duration shows no jump.
 * A channel is written only where the clip moves the bone away from its rest transform.
 */
export function buildAnimations(doc, bake, { names, loops = [], fps = bake.fps, minMotion = {} }) {
  const byName = new Map(
    doc
      .getRoot()
      .listNodes()
      .map((n) => [n.getName(), n]),
  );
  const report = {};
  for (const clip of Object.keys(bake.clips)) {
    const data = bake.clips[clip];
    const frames = data.frames;
    const anim = doc.createAnimation(names?.[clip] ?? clip);
    const times = new Float32Array(frames);
    for (let f = 0; f < frames; f++) times[f] = f / fps;
    const input = doc.createAccessor().setType("SCALAR").setArray(times);
    let channels = 0;
    let motion = 0;
    let loopGap = 0;
    let loopGapRotation = 0;
    for (const bone of bake.bones) {
      const row = data.tracks[bone];
      if (row.length !== frames * 10)
        fail(`${clip}: ${bone} has ${row.length / 10} keys, not ${frames}`);
      const t = new Float32Array(frames * 3);
      const q = new Float32Array(frames * 4);
      const s = new Float32Array(frames * 3);
      for (let f = 0; f < frames; f++) {
        const o = f * 10;
        t.set(row.slice(o, o + 3), f * 3);
        const rot = new Quaternion(row[o + 3], row[o + 4], row[o + 5], row[o + 6]).normalize();
        q.set([rot.x, rot.y, rot.z, rot.w], f * 4);
        s.set(row.slice(o + 7, o + 10), f * 3);
      }
      if (loops.includes(clip)) {
        const last = frames - 1;
        loopGap = Math.max(
          loopGap,
          Math.hypot(t[0] - t[last * 3], t[1] - t[last * 3 + 1], t[2] - t[last * 3 + 2]),
        );
        loopGapRotation = Math.max(
          loopGapRotation,
          sameRotation(q.slice(0, 4), q.slice(last * 4, last * 4 + 4)),
        );
        t.copyWithin(last * 3, 0, 3);
        q.copyWithin(last * 4, 0, 4);
        s.copyWithin(last * 3, 0, 3);
      }
      const rest = bake.restLocal[bone];
      const node = byName.get(bone);
      const moves = (track, size, restSlice, eps) =>
        spread(track, size, frames) > eps ||
        (size === 4
          ? sameRotation(track.slice(0, 4), restSlice) > eps
          : Math.max(...restSlice.map((v, i) => Math.abs(v - track[i]))) > eps);
      const add = (path, array, size, restSlice, eps) => {
        motion = Math.max(motion, spread(array, size, frames));
        if (!moves(array, size, restSlice, eps)) return;
        const output = doc
          .createAccessor()
          .setType(size === 4 ? "VEC4" : "VEC3")
          .setArray(array);
        const sampler = doc
          .createAnimationSampler()
          .setInput(input)
          .setOutput(output)
          .setInterpolation("LINEAR");
        anim.addSampler(sampler);
        anim.addChannel(
          doc.createAnimationChannel().setTargetNode(node).setTargetPath(path).setSampler(sampler),
        );
        channels++;
      };
      add("translation", t, 3, rest.slice(0, 3), EPS_TRANSLATION);
      add("rotation", q, 4, rest.slice(3, 7), EPS_ROTATION);
      add("scale", s, 3, rest.slice(7, 10), EPS_SCALE);
    }
    // The clip must be a clip: one key a frame, and something moves (a clip that evaluates one
    // pose for every frame is the failure the entrance file invites, see blender/common.py).
    if (input.getCount() !== frames) fail(`${clip}: ${input.getCount()} keys, not ${frames}`);
    const floor = minMotion[clip] ?? 1e-3;
    if (motion < floor)
      fail(`${clip}: nothing moves (largest track spread ${motion}, floor ${floor})`);
    report[clip] = { name: anim.getName(), frames, channels, motion, loopGap, loopGapRotation };
  }
  return report;
}
