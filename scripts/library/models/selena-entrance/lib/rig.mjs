// The skeleton and the clips of the Entrance file: what to keep, the armature node folded away,
// the clips renamed, moved to start at 0 and cut where they stop moving.
import { fail } from "./env.mjs";

const FRAME = 1 / 24;

/** The skin's joints that carry a weight on any primitive of `meshes`, and their ancestors. */
export function usedJoints(skin, meshes, minWeight = 1e-5) {
  const joints = skin.listJoints();
  const used = new Set();
  const j = [0, 0, 0, 0];
  const w = [0, 0, 0, 0];
  for (const mesh of meshes) {
    for (const prim of mesh.listPrimitives()) {
      const ja = prim.getAttribute("JOINTS_0");
      const wa = prim.getAttribute("WEIGHTS_0");
      if (!ja || !wa) fail(`${mesh.getName()} has no skin attributes`);
      if (prim.getAttribute("JOINTS_1")) fail(`${mesh.getName()} has a second joint set`);
      for (let i = 0; i < ja.getCount(); i++) {
        ja.getElement(i, j);
        wa.getElement(i, w);
        for (let k = 0; k < 4; k++) if (w[k] > minWeight) used.add(joints[j[k]]);
      }
    }
  }
  const keep = new Set(used);
  for (const node of used) {
    let parent = node.getParentNode();
    while (parent && joints.includes(parent)) {
      keep.add(parent);
      parent = parent.getParentNode();
    }
  }
  return { used, keep };
}

/**
 * A new joint list (the kept joints in their old order), the inverse bind matrices that go with
 * it, and JOINTS_0 of every primitive in `meshes` remapped. A weight on a dropped joint (only ever
 * below `minWeight`) is removed and the others are scaled back to a sum of 1.
 */
export function pruneSkin(doc, skin, keep, meshes) {
  const old = skin.listJoints();
  const ibm = skin.getInverseBindMatrices();
  const element = new Array(16).fill(0);
  const map = new Map();
  const kept = [];
  const rows = [];
  old.forEach((joint, i) => {
    if (!keep.has(joint)) return;
    map.set(i, kept.length);
    kept.push(joint);
    ibm.getElement(i, element);
    rows.push(...element);
  });
  const accessor = doc
    .createAccessor(`${skin.getName()}_ibm`)
    .setType("MAT4")
    .setArray(new Float32Array(rows))
    .setBuffer(ibm.getBuffer());
  for (const joint of old) skin.removeJoint(joint);
  for (const joint of kept) skin.addJoint(joint);
  skin.setInverseBindMatrices(accessor);
  if (ibm.listParents().length <= 1) ibm.dispose();

  let movedWeight = 0;
  const j = [0, 0, 0, 0];
  const w = [0, 0, 0, 0];
  const remapped = new Map();
  for (const mesh of meshes) {
    for (const prim of mesh.listPrimitives()) {
      const ja = prim.getAttribute("JOINTS_0");
      const wa = prim.getAttribute("WEIGHTS_0");
      if (remapped.has(ja)) {
        prim.setAttribute("JOINTS_0", remapped.get(ja)[0]);
        prim.setAttribute("WEIGHTS_0", remapped.get(ja)[1]);
        continue;
      }
      const out = doc
        .createAccessor()
        .setType("VEC4")
        .setArray(new Uint16Array(ja.getCount() * 4))
        .setBuffer(ja.getBuffer());
      const outW = doc
        .createAccessor()
        .setType("VEC4")
        .setArray(new Float32Array(wa.getCount() * 4))
        .setBuffer(wa.getBuffer());
      for (let i = 0; i < ja.getCount(); i++) {
        ja.getElement(i, j);
        wa.getElement(i, w);
        let sum = 0;
        for (let k = 0; k < 4; k++) {
          if (map.has(j[k])) {
            j[k] = map.get(j[k]);
          } else {
            movedWeight = Math.max(movedWeight, w[k]);
            j[k] = 0;
            w[k] = 0;
          }
          sum += w[k];
        }
        if (sum <= 0) fail(`${mesh.getName()}: vertex ${i} lost all its weight`);
        for (let k = 0; k < 4; k++) w[k] /= sum;
        out.setElement(i, j);
        outW.setElement(i, w);
      }
      prim.setAttribute("JOINTS_0", out);
      prim.setAttribute("WEIGHTS_0", outW);
      remapped.set(ja, [out, outW]);
      if (ja.listParents().length <= 1) ja.dispose();
      if (wa.listParents().length <= 1) wa.dispose();
    }
  }
  return {
    joints: kept.length,
    dropped: old.length - kept.length,
    largestDroppedWeight: movedWeight,
  };
}

// Small quaternion and vector helpers (x, y, z, w).
export function qmul(a, b) {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

export function qrotate(q, v) {
  const p = qmul(qmul(q, [v[0], v[1], v[2], 0]), [-q[0], -q[1], -q[2], q[3]]);
  return [p[0], p[1], p[2]];
}

/**
 * Takes the armature node out: its children move to the scene root, the bones keep their world
 * transform (the armature's turn is folded into each root bone and into its keys), the meshes get
 * an identity transform. A skinned mesh's own node transform is ignored by glTF, so the picture
 * does not change; with an identity mesh node three.js binds with an identity matrix too.
 */
export function foldArmature(doc, armature) {
  const t = armature.getTranslation();
  const r = armature.getRotation();
  const s = armature.getScale();
  if (Math.hypot(...t) > 1e-9) fail("the armature node is moved; only a turn can be folded");
  if (s.some((v) => Math.abs(v - 1) > 1e-9)) fail("the armature node is scaled");
  const scene = doc.getRoot().listScenes()[0];
  const children = armature.listChildren();
  const animated = new Map();
  for (const animation of doc.getRoot().listAnimations()) {
    for (const channel of animation.listChannels()) {
      const node = channel.getTargetNode();
      if (!children.includes(node)) continue;
      const list = animated.get(node) ?? [];
      list.push(channel);
      animated.set(node, list);
    }
  }
  const touched = new Set();
  // An output may be shared by several samplers (the exporter shares equal arrays). That is fine
  // when every user is a channel of a root bone with the same path: all get the same turn.
  const users = new Map();
  for (const animation of doc.getRoot().listAnimations()) {
    for (const channel of animation.listChannels()) {
      const output = channel.getSampler().getOutput();
      const list = users.get(output) ?? [];
      list.push(channel);
      users.set(output, list);
    }
  }
  for (const child of children) {
    armature.removeChild(child);
    scene.addChild(child);
    if (child.getMesh()) {
      if (animated.has(child)) fail(`${child.getName()}: an animated mesh node`);
      child.setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]).setScale([1, 1, 1]);
      continue;
    }
    child.setTranslation(qrotate(r, child.getTranslation()));
    child.setRotation(qmul(r, child.getRotation()));
    for (const channel of animated.get(child) ?? []) {
      const path = channel.getTargetPath();
      const output = channel.getSampler().getOutput();
      if (touched.has(output)) continue;
      touched.add(output);
      // A scale is not changed by the fold (it is checked to be even below), so it may be shared.
      for (const other of path === "scale" ? [] : users.get(output))
        if (!children.includes(other.getTargetNode()) || other.getTargetPath() !== path)
          fail(`${child.getName()}: a ${path} output shared with another kind of channel`);
      if (channel.getSampler().getInterpolation() === "CUBICSPLINE")
        fail(`${child.getName()}: a cubic channel`);
      const v = [0, 0, 0, 0];
      for (let i = 0; i < output.getCount(); i++) {
        output.getElement(i, v);
        if (path === "translation") output.setElement(i, qrotate(r, v.slice(0, 3)));
        else if (path === "rotation") output.setElement(i, qmul(r, v.slice(0, 4)));
        else if (path === "scale") {
          const e = v.slice(0, 3);
          if (Math.max(...e) - Math.min(...e) > 1e-6)
            fail(`${child.getName()}: a root bone scaled unevenly under a turned armature`);
        }
      }
    }
  }
  armature.dispose();
}

/** Value of a channel at time `time` (LINEAR or STEP; rotation by normalised lerp of the short way). */
function sample(input, output, path, time, interpolation, size) {
  const n = input.getCount();
  const a = [0, 0, 0, 0];
  const b = [0, 0, 0, 0];
  if (time <= input.getScalar(0)) return output.getElement(0, a).slice(0, size);
  if (time >= input.getScalar(n - 1)) return output.getElement(n - 1, a).slice(0, size);
  let i = 0;
  while (i < n - 2 && input.getScalar(i + 1) < time) i++;
  const t0 = input.getScalar(i);
  const t1 = input.getScalar(i + 1);
  output.getElement(i, a);
  output.getElement(i + 1, b);
  if (interpolation === "STEP") return a.slice(0, size);
  const f = (time - t0) / (t1 - t0);
  if (path === "rotation") {
    const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
    const sign = dot < 0 ? -1 : 1;
    const q = [0, 1, 2, 3].map((k) => a[k] + (sign * b[k] - a[k]) * f);
    const len = Math.hypot(...q);
    return q.map((v) => v / len);
  }
  return [0, 1, 2].slice(0, size).map((k) => a[k] + (b[k] - a[k]) * f);
}

function differs(path, a, b, tol) {
  if (path === "rotation") {
    const dot = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]);
    return 2 * Math.acos(Math.min(1, dot)) > tol.rotation;
  }
  const limit = path === "translation" ? tol.translation : tol.scale;
  return Math.max(...a.map((v, k) => Math.abs(v - b[k]))) > limit;
}

/**
 * Every channel of a clip sampled on the 24 fps grid of the source (frame 1 at 1/24 s), as
 * { node, path, frames: [[...], ...] }. The grid has `frames` steps.
 */
export function sampleClip(animation) {
  const channels = animation.listChannels();
  let end = 0;
  let start = Infinity;
  for (const channel of channels) {
    const input = channel.getSampler().getInput();
    start = Math.min(start, input.getScalar(0));
    end = Math.max(end, input.getScalar(input.getCount() - 1));
  }
  const frames = Math.round((end - start) / FRAME) + 1;
  const out = [];
  for (const channel of channels) {
    const sampler = channel.getSampler();
    const path = channel.getTargetPath();
    if (sampler.getInterpolation() === "CUBICSPLINE") fail("a cubic channel");
    const size = path === "rotation" ? 4 : 3;
    const values = [];
    for (let f = 0; f < frames; f++) {
      const time = start + f * FRAME;
      values.push(
        sample(
          sampler.getInput(),
          sampler.getOutput(),
          path,
          time,
          sampler.getInterpolation(),
          size,
        ),
      );
    }
    out.push({ channel, node: channel.getTargetNode(), path, values });
  }
  return { start, frames, channels: out };
}

/**
 * The first frame from which nothing moves any more: every channel stays within `tol` of its value
 * on the last frame from there to the end. Returns { still, mover } (the last channel to settle).
 */
export function stillFrom(sampled, tol) {
  let still = 0;
  let mover = null;
  for (const c of sampled.channels) {
    const last = c.values[c.values.length - 1];
    for (let f = c.values.length - 2; f >= 0; f--) {
      if (differs(c.path, c.values[f], last, tol)) {
        if (f + 1 > still) {
          still = f + 1;
          mover = `${c.node.getName()}.${c.path}`;
        }
        break;
      }
    }
  }
  return { still, mover };
}

/** How far the last frame is from the first, per channel kind (radians, metres, scale). */
export function loopGap(sampled, lastFrame) {
  const gap = { rotation: 0, translation: 0, scale: 0, worst: {} };
  for (const c of sampled.channels) {
    const a = c.values[0];
    const b = c.values[lastFrame];
    let d;
    if (c.path === "rotation") {
      const dot = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]);
      d = 2 * Math.acos(Math.min(1, dot));
    } else d = Math.max(...a.map((v, k) => Math.abs(v - b[k])));
    if (d > gap[c.path]) {
      gap[c.path] = d;
      gap.worst[c.path] = c.node.getName();
    }
  }
  return gap;
}

/**
 * Writes the clip again from its sampled frames 0..lastFrame, the first at 0 s, one key a frame
 * (a channel that does not change gets two keys). The old accessors are disposed of when nothing
 * else uses them.
 */
export function rewriteClip(doc, animation, sampled, lastFrame, buffer) {
  const count = lastFrame + 1;
  const times = new Float32Array(count);
  for (let f = 0; f < count; f++) times[f] = f * FRAME;
  const grid = doc.createAccessor().setType("SCALAR").setArray(times).setBuffer(buffer);
  const pair = doc
    .createAccessor()
    .setType("SCALAR")
    .setArray(new Float32Array([0, lastFrame * FRAME]))
    .setBuffer(buffer);
  const disposable = new Set();
  for (const c of sampled.channels) {
    const sampler = c.channel.getSampler();
    disposable.add(sampler.getInput());
    disposable.add(sampler.getOutput());
    const size = c.path === "rotation" ? 4 : 3;
    const values = c.values.slice(0, count);
    const constant = values.every((v) => v.every((x, k) => Math.abs(x - values[0][k]) < 1e-7));
    const rows = constant ? [values[0], values[0]] : values;
    const array = new Float32Array(rows.length * size);
    rows.forEach((v, i) => array.set(v, i * size));
    const output = doc
      .createAccessor()
      .setType(size === 4 ? "VEC4" : "VEC3")
      .setArray(array)
      .setBuffer(buffer);
    sampler
      .setInput(constant ? pair : grid)
      .setOutput(output)
      .setInterpolation("LINEAR");
  }
  for (const accessor of disposable) if (accessor.listParents().length <= 1) accessor.dispose();
  return { frames: count, duration: lastFrame * FRAME };
}
