// Small helpers on the rig of a gltf-transform document: matrices, the rest pose, skinning.

/** 4x4 column-major product a * b. */
export function mul(a, b) {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = s;
    }
  return o;
}

export function apply(m, p) {
  return [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
  ];
}

export function isIdentity(m, eps = 1e-5) {
  for (let i = 0; i < 16; i++) if (Math.abs(m[i] - (i % 5 === 0 ? 1 : 0)) > eps) return false;
  return true;
}

/** Writes the first key of every channel of `animation` into its node (the file's rest pose). */
export function restFromClip(animation) {
  for (const channel of animation.listChannels()) {
    const node = channel.getTargetNode();
    const value = channel.getSampler().getOutput().getElement(0, []);
    const path = channel.getTargetPath();
    if (path === "translation") node.setTranslation(value);
    else if (path === "rotation") node.setRotation(value);
    else if (path === "scale") node.setScale(value);
  }
}

/** The skinned position of every vertex of a primitive in the pose the nodes hold now. */
export function skinnedPositions(prim, skin) {
  const joints = skin.listJoints();
  const ibm = skin.getInverseBindMatrices();
  const mats = joints.map((joint, i) => mul(joint.getWorldMatrix(), ibm.getElement(i, [])));
  const pos = prim.getAttribute("POSITION");
  const ji = prim.getAttribute("JOINTS_0");
  const wi = prim.getAttribute("WEIGHTS_0");
  const out = [];
  const p = [];
  const j = [];
  const w = [];
  for (let i = 0; i < pos.getCount(); i++) {
    pos.getElement(i, p);
    ji.getElement(i, j);
    wi.getElement(i, w);
    const s = [0, 0, 0];
    for (let k = 0; k < 4; k++) {
      if (!w[k]) continue;
      const q = apply(mats[j[k]], p);
      for (let c = 0; c < 3; c++) s[c] += w[k] * q[c];
    }
    out.push(s);
  }
  return out;
}

/** Moves the clips into new Animation objects in the order of `ids`, so the file lists them so. */
export function orderClips(doc, ids) {
  const root = doc.getRoot();
  const byName = new Map(root.listAnimations().map((a) => [a.getName(), a]));
  for (const id of ids) {
    const old = byName.get(id);
    if (!old) continue;
    const fresh = doc.createAnimation(id).setExtras(old.getExtras());
    for (const sampler of old.listSamplers()) {
      old.removeSampler(sampler);
      fresh.addSampler(sampler);
    }
    for (const channel of old.listChannels()) {
      old.removeChannel(channel);
      fresh.addChannel(channel);
    }
    old.dispose();
  }
}

/** Quaternion product a * b ([x, y, z, w]). */
export function qmul(a, b) {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}

export function qinv(q) {
  return [-q[0], -q[1], -q[2], q[3]];
}

/** Rotates vector v by unit quaternion q. */
export function qrot(q, v) {
  const p = qmul(qmul(q, [v[0], v[1], v[2], 0]), qinv(q));
  return [p[0], p[1], p[2]];
}

/** The value of a channel at time t, as three plays it (linear; quaternions normalised). */
export function channelAt(channel, t) {
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
  if (sampler.getInterpolation() === "STEP") return a;
  const f = (t - input[i - 1]) / (input[i] - input[i - 1]);
  if (channel.getTargetPath() === "rotation") {
    const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
    const s = dot < 0 ? -1 : 1;
    const v = a.map((x, k) => x * (1 - f) + s * b[k] * f);
    const n = Math.hypot(...v);
    return v.map((x) => x / n);
  }
  return a.map((x, k) => x + (b[k] - x) * f);
}

/** Puts every node a clip moves into its pose at time t. */
export function poseAt(animation, t) {
  for (const channel of animation.listChannels()) {
    const node = channel.getTargetNode();
    const value = channelAt(channel, t);
    const path = channel.getTargetPath();
    if (path === "translation") node.setTranslation(value);
    else if (path === "rotation") node.setRotation(value);
    else if (path === "scale") node.setScale(value);
  }
}

/** Axis-aligned box of points: { min, max, centre, size }. */
export function boxOf(points) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const p of points)
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], p[k]);
      max[k] = Math.max(max[k], p[k]);
    }
  return {
    min,
    max,
    centre: min.map((x, k) => (x + max[k]) / 2),
    size: min.map((x, k) => max[k] - x),
  };
}

/**
 * Disposes an animation or a mesh with what it owns (samplers and channels, primitives and their
 * targets). A plain dispose() leaves those alive, and they keep their accessors from prune.
 */
export function disposeDeep(property) {
  if (property.listSamplers) {
    for (const channel of property.listChannels()) channel.dispose();
    for (const sampler of property.listSamplers()) sampler.dispose();
  }
  if (property.listPrimitives) {
    for (const prim of property.listPrimitives()) {
      for (const target of prim.listTargets()) target.dispose();
      prim.dispose();
    }
  }
  property.dispose();
}
