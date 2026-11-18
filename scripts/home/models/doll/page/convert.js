// The doll's FBX files to the GLB, in Chrome, with the site's own three. The work, in order:
//
// 1. the rig file's mesh (a soup of 14,385 triangles) is turned into a clean indexed mesh in the
//    final frame: metres, the feet on y 0, the figure on the Y axis, the front on +Z. The two leaf
//    bones (`head_end`, `headfront`) are folded into `Head`. The painted face is taken out of the
//    maps by bake.py: here the face triangles are marked (`_FACE`) and the lash, lid and brow pieces
//    that stand off the face are pressed flat onto it.
// 2. a skeleton is built again from the world bind pose: no `Armature` turn above it, no scale,
//    `Hips` the root, so the file has no node with a rotation the page has to think about.
// 3. the Mixamo walk is fitted to it as the clip `walk`: 22 rotation tracks and the hips' position.
// 4. GLTFExporter writes one binary file with the three maps given by hand.
import * as THREE from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { loadFbx } from "./source.js";

/** Where the file's own centre is, in the FBX's centimetres: the figure's line and the feet's z. */
export const ORIGIN_CM = [3.6, 0, 19.9];
export const CM = 0.01;
/** The leaf bones that carry skin weight but never move: folded into the head. */
const LEAVES = ["head_end", "headfront"];
/** Triangles whose normals differ by more than this keep a hard edge. */
const CREASE_DEGREES = 60;
/** How far the lash and brow pieces are pressed against the face, cm. */
const RELIEF_OFFSET_CM = 0.05;

const round = (v, p = 5) => Math.round(v * 10 ** p) / 10 ** p;

function decoded(texture) {
  return new Promise((resolve) => {
    const tick = () => {
      const img = texture.image;
      if (img && (img.complete || img.width) && (img.naturalWidth ?? img.width) > 0) resolve();
      else setTimeout(tick, 5);
    };
    tick();
  });
}

async function loadTexture(url, srgb) {
  const texture = await new THREE.TextureLoader().loadAsync(url);
  await decoded(texture);
  texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.flipY = false;
  texture.userData.mimeType = "image/webp";
  texture.anisotropy = 8;
  return texture;
}

function withQuality(pick, work) {
  const original = HTMLCanvasElement.prototype.toBlob;
  HTMLCanvasElement.prototype.toBlob = function toBlob(callback, type) {
    original.call(this, callback, type, pick(this));
  };
  return work().finally(() => {
    HTMLCanvasElement.prototype.toBlob = original;
  });
}

const keyOf = (x, y, z) =>
  `${Math.round(x * 1000)},${Math.round(y * 1000)},${Math.round(z * 1000)}`;

/** The mesh of the rig file as final-frame corners: positions, uvs, weights and the face flag. */
function corners(rig, faceSel, options) {
  const { mesh } = rig;
  const g = mesh.geometry;
  const sourceBones = mesh.skeleton.bones;
  const names = sourceBones.map((b) => b.name);
  const keep = names.filter((n) => !LEAVES.includes(n));
  const newIndex = (oldIndex) => {
    const name = names[oldIndex];
    return keep.indexOf(LEAVES.includes(name) ? "Head" : name);
  };
  const n = g.attributes.position.count;
  const tris = n / 3;
  const pos = new Float32Array(n * 3);
  const uv = new Float32Array(n * 2);
  const joints = new Uint8Array(n * 4);
  const weights = new Float32Array(n * 4);
  const v = new THREE.Vector3();
  const bind = mesh.bindMatrix;
  for (let c = 0; c < n; c++) {
    v.fromBufferAttribute(g.attributes.position, c).applyMatrix4(bind);
    pos[c * 3] = v.x;
    pos[c * 3 + 1] = v.y;
    pos[c * 3 + 2] = v.z;
    uv[c * 2] = g.attributes.uv.getX(c);
    uv[c * 2 + 1] = g.attributes.uv.getY(c);
    // Weights: the leaves fold into the head, equal bones are added, the four strongest stay.
    const acc = new Map();
    for (let k = 0; k < 4; k++) {
      const w = g.attributes.skinWeight.getComponent(c, k);
      if (w <= 0) continue;
      const bone = newIndex(g.attributes.skinIndex.getComponent(c, k));
      acc.set(bone, (acc.get(bone) ?? 0) + w);
    }
    const sorted = [...acc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
    const total = sorted.reduce((s, e) => s + e[1], 0);
    sorted.forEach(([bone, w], k) => {
      joints[c * 4 + k] = bone;
      weights[c * 4 + k] = w / total;
    });
  }

  // The face: the triangles chosen by face-select.py, and the relief pieces pressed onto them.
  const face = new Uint8Array(tris);
  for (const t of faceSel.face) face[t] = 1;
  for (const t of faceSel.relief) face[t] = 1;
  const pressed = new Map();
  for (const t of faceSel.relief) {
    const z = faceSel.reliefZ[String(t)];
    for (let k = 0; k < 3; k++) {
      const c = t * 3 + k;
      pressed.set(keyOf(pos[c * 3], pos[c * 3 + 1], pos[c * 3 + 2]), z[k] + RELIEF_OFFSET_CM);
    }
  }
  let movedCorners = 0;
  const pressedFlag = new Uint8Array(n);
  for (let c = 0; c < n; c++) {
    const z = pressed.get(keyOf(pos[c * 3], pos[c * 3 + 1], pos[c * 3 + 2]));
    if (z !== undefined) {
      pos[c * 3 + 2] = Math.min(pos[c * 3 + 2], z);
      pressedFlag[c] = 1;
      movedCorners++;
    }
  }
  return { pos, uv, joints, weights, face, keep, tris, movedCorners, names, pressedFlag };
}

/**
 * Smooths the shell of the face. The original face has small sculpted rims where its painted eyes
 * were (the sockets, the lids): with the paint gone they would show as dents and fins that the
 * drawn eyes do not follow. Taubin smoothing (a step in, a step out, so nothing shrinks) of the
 * vertices that touch only face triangles; the edge of the face and everything else stay as they are.
 * `faceOf` is the flag of every triangle.
 */
function smoothFace(pos, tris, faceOf, iterations) {
  const corner = (t, k) =>
    keyOf(pos[t * 9 + k * 3], pos[t * 9 + k * 3 + 1], pos[t * 9 + k * 3 + 2]);
  const index = new Map();
  const neighbours = [];
  const inside = [];
  const points = [];
  const idOf = (key, t, k) => {
    let id = index.get(key);
    if (id === undefined) {
      id = points.length;
      index.set(key, id);
      points.push(new THREE.Vector3().fromArray(pos, t * 9 + k * 3));
      neighbours.push(new Set());
      inside.push(true);
    }
    return id;
  };
  for (let t = 0; t < tris; t++) {
    const ids = [0, 1, 2].map((k) => idOf(corner(t, k), t, k));
    for (let k = 0; k < 3; k++) {
      if (!faceOf[t]) inside[ids[k]] = false;
      neighbours[ids[k]].add(ids[(k + 1) % 3]);
      neighbours[ids[k]].add(ids[(k + 2) % 3]);
    }
  }
  const before = points.map((p) => p.clone());
  const step = (factor) => {
    const next = points.map((p) => p.clone());
    points.forEach((p, i) => {
      if (!inside[i]) return;
      const mean = new THREE.Vector3();
      for (const j of neighbours[i]) mean.add(points[j]);
      mean.multiplyScalar(1 / neighbours[i].size);
      next[i].addScaledVector(mean.sub(p), factor);
    });
    next.forEach((p, i) => points[i].copy(p));
  };
  for (let n = 0; n < iterations; n++) {
    step(0.55);
    step(-0.58);
  }
  let changed = 0;
  let largest = 0;
  const out = new Float32Array(pos);
  for (let t = 0; t < tris; t++) {
    for (let k = 0; k < 3; k++) {
      const id = index.get(corner(t, k));
      if (!inside[id]) continue;
      points[id].toArray(out, t * 9 + k * 3);
      largest = Math.max(largest, before[id].distanceTo(points[id]));
      changed++;
    }
  }
  return { pos: out, changed, largest };
}

/**
 * Normals with a crease: each corner averages the triangles at its position that lean at most so far.
 * The pieces pressed flat onto the face (`relief`) are slivers whose own normals mean nothing: they do
 * not count for their neighbours, and their corners take the normal of the face under them.
 */
function creaseNormals(pos, tris, degrees, relief) {
  const faceN = new Float32Array(tris * 3);
  const area = new Float32Array(tris);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let t = 0; t < tris; t++) {
    a.fromArray(pos, t * 9);
    b.fromArray(pos, t * 9 + 3);
    c.fromArray(pos, t * 9 + 6);
    n.crossVectors(b.sub(a), c.sub(a));
    area[t] = n.length() / 2;
    if (area[t] > 1e-12) n.normalize();
    faceN.set(n.toArray(), t * 3);
  }
  const corner = (t, k) =>
    keyOf(pos[t * 9 + k * 3], pos[t * 9 + k * 3 + 1], pos[t * 9 + k * 3 + 2]);
  const at = new Map();
  for (let t = 0; t < tris; t++) {
    for (let k = 0; k < 3; k++) {
      const key = corner(t, k);
      if (!at.has(key)) at.set(key, []);
      at.get(key).push(t);
    }
  }
  const limit = Math.cos((degrees * Math.PI) / 180);
  const out = new Float32Array(tris * 9);
  const sum = new THREE.Vector3();
  const plain = new Map();
  // The smooth normal of a position from the triangles that are not pressed pieces.
  const standing = (key) => {
    sum.set(0, 0, 0);
    for (const o of at.get(key)) {
      if (!relief[o] && area[o] > 1e-12)
        sum.addScaledVector(new THREE.Vector3().fromArray(faceN, o * 3), area[o]);
    }
    return sum.lengthSq() > 1e-20 ? sum.clone().normalize() : null;
  };
  for (const key of at.keys()) plain.set(key, standing(key));
  // Positions only pressed pieces use: the mean of the known normals around them, a few passes.
  for (let pass = 0; pass < 6; pass++) {
    for (const [key, tl] of at.entries()) {
      if (plain.get(key)) continue;
      const acc = new THREE.Vector3();
      let count = 0;
      for (const t of tl) {
        for (let k = 0; k < 3; k++) {
          const other = plain.get(corner(t, k));
          if (other) {
            acc.add(other);
            count++;
          }
        }
      }
      if (count) plain.set(key, acc.normalize());
    }
  }
  for (let t = 0; t < tris; t++) {
    const own = new THREE.Vector3().fromArray(faceN, t * 3);
    for (let k = 0; k < 3; k++) {
      const key = corner(t, k);
      let result;
      if (relief[t]) {
        result = plain.get(key) ?? own;
      } else {
        sum.set(0, 0, 0);
        for (const o of at.get(key)) {
          if (relief[o]) continue;
          const other = new THREE.Vector3().fromArray(faceN, o * 3);
          if (area[o] > 1e-12 && other.dot(own) >= limit) sum.addScaledVector(other, area[o]);
        }
        result = sum.lengthSq() < 1e-20 ? own : sum.clone().normalize();
      }
      out.set(result.toArray(), t * 9 + k * 3);
    }
  }
  return out;
}

/**
 * The face has only 750 triangles, so its shading shows the facets at a close view. The normals of the
 * vertices that touch only face triangles are averaged with their neighbours a few times (the shell
 * itself is not moved), which rounds the shading without changing the shape. The edge of the face and
 * everything else keep their normals. `nrm` is per corner, in place.
 */
function smoothFaceNormals(pos, tris, faceOf, nrm, rounds) {
  const corner = (t, k) =>
    keyOf(pos[t * 9 + k * 3], pos[t * 9 + k * 3 + 1], pos[t * 9 + k * 3 + 2]);
  const index = new Map();
  const neighbours = [];
  const inside = [];
  const normals = [];
  const id = (key) => {
    let i = index.get(key);
    if (i === undefined) {
      i = normals.length;
      index.set(key, i);
      normals.push(new THREE.Vector3());
      neighbours.push(new Set());
      inside.push(true);
    }
    return i;
  };
  const counts = [];
  for (let t = 0; t < tris; t++) {
    const ids = [0, 1, 2].map((k) => id(corner(t, k)));
    for (let k = 0; k < 3; k++) {
      if (!faceOf[t]) inside[ids[k]] = false;
      neighbours[ids[k]].add(ids[(k + 1) % 3]);
      neighbours[ids[k]].add(ids[(k + 2) % 3]);
      normals[ids[k]].add(new THREE.Vector3().fromArray(nrm, t * 9 + k * 3));
      counts[ids[k]] = (counts[ids[k]] ?? 0) + 1;
    }
  }
  normals.forEach((n) => n.normalize());
  for (let r = 0; r < rounds; r++) {
    const next = normals.map((n) => n.clone());
    normals.forEach((n, i) => {
      if (!inside[i]) return;
      const mean = new THREE.Vector3();
      for (const j of neighbours[i]) mean.add(normals[j]);
      next[i].copy(n).multiplyScalar(0.5).addScaledVector(mean.normalize(), 0.5).normalize();
    });
    next.forEach((n, i) => normals[i].copy(n));
  }
  for (let t = 0; t < tris; t++) {
    for (let k = 0; k < 3; k++) {
      const i = index.get(corner(t, k));
      if (inside[i]) normals[i].toArray(nrm, t * 9 + k * 3);
    }
  }
}

/** Weld corners into vertices (same position, normal, uv, face flag, joints and weights). */
function weld(c, normals) {
  const index = new Uint16Array(c.tris * 3);
  const verts = [];
  const seen = new Map();
  for (let i = 0; i < c.tris * 3; i++) {
    const t = Math.floor(i / 3);
    const key = [
      keyOf(c.pos[i * 3], c.pos[i * 3 + 1], c.pos[i * 3 + 2]),
      Math.round(c.uv[i * 2] * 1e5),
      Math.round(c.uv[i * 2 + 1] * 1e5),
      c.face[t],
      Math.round(normals[i * 3] * 200),
      Math.round(normals[i * 3 + 1] * 200),
      Math.round(normals[i * 3 + 2] * 200),
      Array.from(c.joints.subarray(i * 4, i * 4 + 4)).join("."),
      Array.from(c.weights.subarray(i * 4, i * 4 + 4), (w) => Math.round(w * 1000)).join("."),
    ].join("|");
    let id = seen.get(key);
    if (id === undefined) {
      id = verts.length;
      seen.set(key, id);
      verts.push(i);
    }
    index[i] = id;
  }
  if (verts.length > 65535) throw new Error(`too many vertices: ${verts.length}`);
  return { index, verts };
}

/** Skin weights as 8 bit numbers that add up to 255 exactly. */
function bytes(weights) {
  const out = new Uint8Array(weights.length);
  for (let i = 0; i < weights.length; i += 4) {
    let total = 0;
    let big = 0;
    for (let k = 0; k < 4; k++) {
      out[i + k] = Math.round(weights[i + k] * 255);
      total += out[i + k];
      if (weights[i + k] > weights[i + big]) big = k;
    }
    out[i + big] += 255 - total;
  }
  return out;
}

/** The skeleton again from the world bind pose, in the final frame. Returns the bones by name. */
function buildSkeleton(rig, keep) {
  const bones = new Map();
  const byName = new Map(rig.mesh.skeleton.bones.map((b) => [b.name, b]));
  const worldQuat = (b) => b.getWorldQuaternion(new THREE.Quaternion());
  const worldPos = (b) => b.getWorldPosition(new THREE.Vector3());
  const origin = new THREE.Vector3(...ORIGIN_CM);
  for (const name of keep) {
    const b = new THREE.Bone();
    b.name = name;
    bones.set(name, b);
  }
  for (const name of keep) {
    const source = byName.get(name);
    const bone = bones.get(name);
    const parentSource = source.parent && source.parent.isBone ? source.parent : null;
    const q = worldQuat(source);
    const p = worldPos(source);
    if (parentSource) {
      const parent = bones.get(parentSource.name);
      const qp = worldQuat(parentSource);
      const inv = qp.clone().invert();
      bone.position.copy(p.sub(worldPos(parentSource)).applyQuaternion(inv).multiplyScalar(CM));
      bone.quaternion.copy(inv.multiply(q));
      parent.add(bone);
    } else {
      bone.position.copy(p.sub(origin).multiplyScalar(CM));
      bone.quaternion.copy(q);
    }
  }
  return bones;
}

/** The track of the walk file fitted to the rebuilt rig. Returns the clip and its facts. */
function fitWalk(rig, walk, keep, lift = 0) {
  const clip = walk.animations[0];
  const kept = new Set(keep);
  const armature = rig.mesh.skeleton.bones.find((b) => b.name === "Hips").parent;
  const qArm = armature.getWorldQuaternion(new THREE.Quaternion());
  const rigHips = rig.mesh.skeleton.bones.find((b) => b.name === "Hips");
  const walkHips = walk.mesh.skeleton.bones.find((b) => b.name === "Hips");
  const rigHipsWorld = rigHips.getWorldPosition(new THREE.Vector3());
  const walkHipsBind = walkHips.getWorldPosition(new THREE.Vector3());
  const walkArm = walkHips.parent.matrixWorld;
  const origin = new THREE.Vector3(...ORIGIN_CM);
  const tracks = [];
  const dropped = [];
  for (const track of clip.tracks) {
    const [name, property] = track.name.split(".");
    if (!kept.has(name) || property === "scale") {
      dropped.push(track.name);
      continue;
    }
    if (property === "quaternion") {
      // Constant tracks carry nothing the rest pose does not: dropped.
      let varies = false;
      for (let i = 4; i < track.values.length && !varies; i++) {
        if (Math.abs(track.values[i] - track.values[i % 4]) > 1e-5) varies = true;
      }
      if (!varies && name !== "Hips") {
        dropped.push(track.name);
        continue;
      }
      const values = Float32Array.from(track.values);
      if (name === "Hips") {
        const q = new THREE.Quaternion();
        for (let i = 0; i < values.length; i += 4) {
          q.fromArray(values, i);
          q.premultiply(qArm);
          q.toArray(values, i);
        }
      }
      tracks.push(new THREE.QuaternionKeyframeTrack(track.name, track.times, values));
    } else if (property === "position" && name === "Hips") {
      const values = new Float32Array(track.values.length);
      const v = new THREE.Vector3();
      for (let i = 0; i < values.length; i += 3) {
        v.fromArray(track.values, i).applyMatrix4(walkArm);
        v.sub(walkHipsBind).add(rigHipsWorld);
        v.sub(origin).multiplyScalar(CM);
        v.y += lift;
        v.toArray(values, i);
      }
      tracks.push(new THREE.VectorKeyframeTrack(track.name, track.times, values));
    } else {
      dropped.push(track.name);
    }
  }
  const out = new THREE.AnimationClip("walk", clip.duration, tracks);
  return { clip: out, dropped, keys: Math.max(...clip.tracks.map((t) => t.times.length)) };
}

/**
 * The source rig posed by the walk file at time t (the same tracks, the same hips retarget), so the
 * rebuilt model can be compared with it vertex by vertex. Returns a function giving the position of
 * a source corner in the final frame.
 */
export function sourceAtWalk(rig, walk, t, lift = 0) {
  const clip = walk.animations[0];
  const bones = rig.mesh.skeleton.bones;
  const by = new Map(bones.map((b) => [b.name, b]));
  if (!rig.restPose) {
    rig.restPose = bones.map((b) => ({ q: b.quaternion.clone(), p: b.position.clone() }));
  }
  bones.forEach((b, i) => {
    b.quaternion.copy(rig.restPose[i].q);
    b.position.copy(rig.restPose[i].p);
  });
  const walkHips = walk.mesh.skeleton.bones.find((b) => b.name === "Hips");
  if (!walk.restHips) walk.restHips = walkHips.getWorldPosition(new THREE.Vector3());
  const walkArm = walkHips.parent.matrixWorld;
  const rigHips = by.get("Hips");
  const armInverse = rigHips.parent.matrixWorld.clone().invert();
  const rigHipsWorld = new THREE.Vector3().setFromMatrixPosition(rigHips.matrixWorld);
  void rigHipsWorld;
  for (const track of clip.tracks) {
    const [name, property] = track.name.split(".");
    const bone = by.get(name);
    if (!bone) continue;
    const value = track.createInterpolant().evaluate(t);
    if (property === "quaternion") bone.quaternion.fromArray(value);
    if (property === "position" && name === "Hips") {
      const walkWorld = new THREE.Vector3().fromArray(value).applyMatrix4(walkArm);
      const delta = walkWorld.sub(walk.restHips);
      // The new world position, back into the source's own local frame (under the Armature).
      const target = (rig.restHipsWorld ??= rigHips.getWorldPosition(new THREE.Vector3()).clone())
        .clone()
        .add(delta);
      bone.position.copy(target.applyMatrix4(armInverse));
    }
  }
  rig.root.updateMatrixWorld(true);
  const v = new THREE.Vector3();
  const origin = new THREE.Vector3(...ORIGIN_CM);
  return (corner) => {
    rig.mesh.getVertexPosition(corner, v);
    v.applyMatrix4(rig.mesh.matrixWorld);
    v.sub(origin).multiplyScalar(CM);
    v.y += lift;
    return v.clone();
  };
}

/** Where the lowest points of the feet are, over the cycle, and how fast the planted foot goes back. */
export function walkFacts(model, clip, samples = 32) {
  const mesh = model.mesh;
  const mixer = new THREE.AnimationMixer(model.root);
  const action = mixer.clipAction(clip);
  action.play();
  const index = mesh.geometry.index;
  // Foot vertices: the ones whose strongest bone is a foot, toe or lower leg.
  const names = mesh.skeleton.bones.map((b) => b.name);
  const feet = [];
  for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
    let best = 0;
    let bw = -1;
    for (let k = 0; k < 4; k++) {
      const w = mesh.geometry.attributes.skinWeight.getComponent(i, k);
      if (w > bw) {
        bw = w;
        best = mesh.geometry.attributes.skinIndex.getComponent(i, k);
      }
    }
    if (/Foot|Toe|Leg$/.test(names[best]))
      feet.push({ i, side: names[best].startsWith("Left") ? 0 : 1 });
  }
  void index;
  const v = new THREE.Vector3();
  const rows = [];
  for (let s = 0; s < samples; s++) {
    const t = (clip.duration * s) / samples;
    mixer.setTime(t);
    model.root.updateMatrixWorld(true);
    const low = [Infinity, Infinity];
    const lowZ = [0, 0];
    for (const f of feet) {
      mesh.getVertexPosition(f.i, v);
      v.applyMatrix4(mesh.matrixWorld);
      if (v.y < low[f.side]) {
        low[f.side] = v.y;
        lowZ[f.side] = v.z;
      }
    }
    const hips = model.hips.getWorldPosition(new THREE.Vector3());
    rows.push({ t, low, lowZ, hipsY: hips.y, hipsZ: hips.z });
  }
  mixer.stopAllAction();
  const lowest = Math.min(...rows.flatMap((r) => r.low));
  // The planted foot: the lower one of the two. Its z relative to the hips falls as the doll walks.
  let travelled = 0;
  let time = 0;
  for (let s = 0; s < rows.length; s++) {
    const a = rows[s];
    const b = rows[(s + 1) % rows.length];
    const dt = (b.t > a.t ? b.t : clip.duration) - a.t;
    const side = a.low[0] < a.low[1] ? 0 : 1;
    if (a.low[side] - lowest < 0.006 && b.low[side] - lowest < 0.006) {
      travelled += a.lowZ[side] - a.hipsZ - (b.lowZ[side] - b.hipsZ);
      time += dt;
    }
  }
  return { rows, lowest, speed: time > 0 ? travelled / time : 0, planted: time };
}

/**
 * `urls`: { rig, walk, face (json), base, normal, orm }. Returns the GLB (base64) and the report.
 */
export async function convert(
  urls,
  {
    quality = { base: 0.85, small: 0.85 },
    lift = 0,
    normals = "crease",
    smoothIterations = 8,
  } = {},
) {
  const rig = await loadFbx(urls.rig);
  const walk = await loadFbx(urls.walk);
  const faceSel = await (await fetch(urls.face)).json();
  const c = corners(rig, faceSel, {});
  const options = { smoothIterations };

  // Into metres and the final frame (positions only: the rotations are already the world's).
  const origin = ORIGIN_CM;
  const metres = new Float32Array(c.pos.length);
  for (let i = 0; i < c.pos.length; i += 3) {
    metres[i] = (c.pos[i] - origin[0]) * CM;
    metres[i + 1] = (c.pos[i + 1] - origin[1]) * CM;
    metres[i + 2] = (c.pos[i + 2] - origin[2]) * CM;
  }
  c.pos = metres;
  let smoothed = null;
  if (options.smoothIterations > 0) {
    // The smoothing works on the picture of the face triangles in centimetres-free metres: the
    // same arithmetic, so the number below is in metres.
    const flag = new Uint8Array(c.tris);
    for (const t of faceSel.face) flag[t] = 1;
    for (const t of faceSel.relief) flag[t] = 1;
    smoothed = smoothFace(c.pos, c.tris, flag, options.smoothIterations);
    c.pos = smoothed.pos;
  }
  let nrm;
  if (normals === "source") {
    nrm = new Float32Array(rig.mesh.geometry.attributes.normal.array);
  } else {
    const reliefFlag = new Uint8Array(c.tris);
    for (const t of faceSel.relief) reliefFlag[t] = 1;
    nrm = creaseNormals(c.pos, c.tris, CREASE_DEGREES, reliefFlag);
    if (smoothIterations > 0) {
      const flag = new Uint8Array(c.tris);
      for (const t of faceSel.face) flag[t] = 1;
      for (const t of faceSel.relief) flag[t] = 1;
      smoothFaceNormals(c.pos, c.tris, flag, nrm, 6);
    }
  }
  const { index, verts } = weld(c, nrm);
  const count = verts.length;
  const position = new Float32Array(count * 3);
  const normal = new Float32Array(count * 3);
  const uvq = new Uint16Array(count * 2);
  const jointsOut = new Uint8Array(count * 4);
  const weightsF = new Float32Array(count * 4);
  const faceOut = new Float32Array(count);
  verts.forEach((corner, i) => {
    position.set(c.pos.subarray(corner * 3, corner * 3 + 3), i * 3);
    normal.set(nrm.subarray(corner * 3, corner * 3 + 3), i * 3);
    uvq[i * 2] = Math.round(THREE.MathUtils.clamp(c.uv[corner * 2], 0, 1) * 65535);
    uvq[i * 2 + 1] = Math.round(THREE.MathUtils.clamp(1 - c.uv[corner * 2 + 1], 0, 1) * 65535);
    jointsOut.set(c.joints.subarray(corner * 4, corner * 4 + 4), i * 4);
    weightsF.set(c.weights.subarray(corner * 4, corner * 4 + 4), i * 4);
    faceOut[i] = c.face[Math.floor(corner / 3)];
  });
  const weightsOut = bytes(weightsF);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(position, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(normal, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvq, 2, true));
  geometry.setAttribute("skinIndex", new THREE.BufferAttribute(jointsOut, 4));
  geometry.setAttribute("skinWeight", new THREE.BufferAttribute(weightsOut, 4, true));
  geometry.setAttribute("face", new THREE.BufferAttribute(faceOut, 1));
  geometry.setIndex(new THREE.BufferAttribute(index, 1));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  const bones = buildSkeleton(rig, c.keep);
  const hips = bones.get("Hips");
  const boneList = c.keep.map((n) => bones.get(n));

  const material = new THREE.MeshStandardMaterial({ name: "doll", metalness: 1, roughness: 1 });
  const base = await loadTexture(urls.base, true);
  const normalMap = await loadTexture(urls.normal, false);
  const orm = await loadTexture(urls.orm, false);
  material.map = base;
  material.normalMap = normalMap;
  material.metalnessMap = orm;
  material.roughnessMap = orm;
  const widths = new Map([
    [normalMap.image.width, quality.small],
    [orm.image.width, quality.small],
    [base.image.width, quality.base],
  ]);

  const root = new THREE.Group();
  root.name = "doll";
  root.add(hips);
  const body = new THREE.SkinnedMesh(geometry, material);
  body.name = "doll_body";
  root.add(body);
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(boneList);
  body.bind(skeleton, body.matrixWorld);

  // Sockets: empty nodes the page hangs things on.
  const socket = (name, parent, x, y, z) => {
    const o = new THREE.Object3D();
    o.name = name;
    o.position.set(x, y, z);
    bones.get(parent).add(o);
    return o;
  };
  socket("socket_hand_L", "LeftHand", 0, 0.06, 0);
  socket("socket_hand_R", "RightHand", 0, 0.06, 0);
  socket("socket_head_top", "Head", 0, 0.596, 0);
  root.updateMatrixWorld(true);

  // The walk, fitted. Foot contact is measured on the rebuilt model and the hips lifted to match.
  const model = { root, mesh: body, hips };
  const trial = fitWalk(rig, walk, c.keep, 0);
  const trialFacts = walkFacts(model, trial.clip);
  const fitted = fitWalk(rig, walk, c.keep, lift || -trialFacts.lowest);
  const facts = walkFacts(model, fitted.clip);
  const clipFacts = {
    walk: {
      seconds: round(fitted.clip.duration, 4),
      keys: fitted.keys,
      tracks: fitted.clip.tracks.length,
      droppedTracks: fitted.dropped.length,
      hipsLiftMetres: round(lift || -trialFacts.lowest, 5),
      lowestFootBeforeLift: round(trialFacts.lowest, 5),
      lowestFootAfterLift: round(facts.lowest, 5),
      speedMetresPerSecond: round(facts.speed, 4),
      plantedSeconds: round(facts.planted, 4),
    },
  };
  hips.updateMatrixWorld(true);

  // The same pose of the source and of the rebuilt model must agree: this proves the turn of the
  // Armature, the recentring, the scale and the weights all at once.
  const lifted = lift || -trialFacts.lowest;
  const overlay = [];
  const mixer = new THREE.AnimationMixer(root);
  mixer.clipAction(fitted.clip).play();
  const v = new THREE.Vector3();
  for (const f of [0, 0.25, 0.5, 0.75]) {
    const t = fitted.clip.duration * f;
    const at = sourceAtWalk(rig, walk, t, lifted);
    mixer.setTime(t);
    root.updateMatrixWorld(true);
    let max = 0;
    let sum = 0;
    let used = 0;
    for (let i = 0; i < count; i += 3) {
      if (c.pressedFlag[verts[i]] || faceOut[i]) continue;
      body.getVertexPosition(i, v);
      v.applyMatrix4(body.matrixWorld);
      const d = v.distanceTo(at(verts[i]));
      max = Math.max(max, d);
      sum += d;
      used++;
    }
    overlay.push({ t: round(t, 4), maxMetres: round(max, 5), meanMetres: round(sum / used, 6) });
  }
  mixer.stopAllAction();
  hips.updateMatrixWorld(true);

  root.userData = { kind: "doll", frame: "metres, Y up, feet on y 0, front +Z", clips: clipFacts };
  body.userData = { faceAttribute: "_FACE" };

  const warnings = [];
  const warn = console.warn;
  console.warn = (...args) => warnings.push(args.join(" "));
  let glb;
  try {
    glb = await withQuality(
      (canvas) => widths.get(canvas.width) ?? 0.85,
      () =>
        new GLTFExporter().parseAsync(root, {
          binary: true,
          onlyVisible: false,
          embedImages: true,
          animations: [fitted.clip],
        }),
    );
  } finally {
    console.warn = warn;
  }
  let binary = "";
  const raw = new Uint8Array(glb);
  for (let i = 0; i < raw.length; i += 0x8000) {
    binary += String.fromCharCode.apply(null, raw.subarray(i, i + 0x8000));
  }
  geometry.computeBoundingBox();
  return {
    base64: btoa(binary),
    report: {
      bytes: glb.byteLength,
      warnings,
      sourceCorners: c.tris * 3,
      vertices: count,
      triangles: c.tris,
      reliefCornersPressed: c.movedCorners,
      faceSmoothing: smoothed
        ? {
            iterations: smoothIterations,
            corners: smoothed.changed,
            largestMoveMetres: round(smoothed.largest, 5),
          }
        : null,
      faceVertices: faceOut.reduce((s, v) => s + v, 0),
      bones: c.keep.length,
      clips: clipFacts,
      overlay,
      walkRows: facts.rows,
      box: {
        min: geometry.boundingBox.min.toArray().map((v) => round(v)),
        max: geometry.boundingBox.max.toArray().map((v) => round(v)),
      },
      bonesWorld: Object.fromEntries(
        c.keep.map((n) => [
          n,
          {
            parent: bones.get(n).parent?.isBone ? bones.get(n).parent.name : null,
            world: bones
              .get(n)
              .getWorldPosition(new THREE.Vector3())
              .toArray()
              .map((v) => round(v, 5)),
            localQuat: bones
              .get(n)
              .quaternion.toArray()
              .map((v) => round(v, 6)),
            localPos: bones
              .get(n)
              .position.toArray()
              .map((v) => round(v, 6)),
          },
        ]),
      ),
    },
  };
}
