/**
 * The pure arithmetic of the doll's poses. A pose is a local rotation for each of the 22 bones, a
 * position for the root bone and a scale for each bone, all in flat typed arrays so a frame
 * allocates nothing. The poses of `poses.ts` are authored as turns about the MODEL's axes (+X the
 * doll's left, +Y up, +Z forward), which is the only safe way on this rig: the limb bones are
 * Blender style frames (local Y along the bone) and the left and right ones are not mirrors.
 *
 *   q_local = inverse(pBind) * R(model axes) * pBind * restLocal
 *
 * where `pBind` is the parent's bind-pose world rotation. The same formula, applied on top of an
 * already posed rotation, is how every procedural layer (a flail, a lean, a head wobble) is added.
 */
import { Euler, Quaternion } from "three";

import { at } from "../motion";
import { RIG_BONES, type RigBone } from "../rig";

import type { PoseDef } from "./poses";

const DEG = Math.PI / 180;

export const BONE_NAMES: readonly string[] = RIG_BONES.map((b) => b.name);
export const BONE_COUNT = BONE_NAMES.length;
const INDEX = new Map(BONE_NAMES.map((name, i) => [name, i] as const));

/** The index of a bone in every array of this file. Throws on a name the rig does not have. */
export function boneIndex(name: string): number {
  const i = INDEX.get(name);
  if (i === undefined) throw new Error(`doll: no bone "${name}"`);
  return i;
}

/** What the rig says about the bind pose, flattened. Built once from the rig numbers. */
export interface Bind {
  readonly count: number;
  /** The parent's index, -1 for the root. */
  readonly parent: Int16Array;
  /** The rest rotation of each bone in its parent's frame (x, y, z, w). */
  readonly rest: Float32Array;
  /** The rest position of each bone in its parent's frame (x, y, z). */
  readonly restPos: Float32Array;
  /** The bind-pose world rotation of each bone's PARENT (identity for the root). */
  readonly parentWorld: Float32Array;
  readonly parentWorldInv: Float32Array;
}

export function buildBind(bones: readonly RigBone[] = RIG_BONES): Bind {
  const n = bones.length;
  const index = new Map(bones.map((b, i) => [b.name, i] as const));
  const parent = new Int16Array(n);
  const rest = new Float32Array(n * 4);
  const restPos = new Float32Array(n * 3);
  const parentWorld = new Float32Array(n * 4);
  const parentWorldInv = new Float32Array(n * 4);
  const world = new Float32Array(n * 4);
  const q = new Quaternion();
  const w = new Quaternion();
  const pw = new Quaternion();
  bones.forEach((b, i) => {
    let p = -1;
    if (b.parent !== null) {
      const found = index.get(b.parent);
      if (found === undefined || found >= i)
        throw new Error(`doll: bone ${b.name} has a bad parent`);
      p = found;
    }
    parent[i] = p;
    q.set(b.q[0], b.q[1], b.q[2], b.q[3]).normalize();
    q.toArray(rest, i * 4);
    restPos.set(b.p, i * 3);
    if (p < 0) pw.identity();
    else pw.fromArray(world, p * 4);
    pw.toArray(parentWorld, i * 4);
    pw.clone()
      .invert()
      .toArray(parentWorldInv, i * 4);
    w.copy(pw).multiply(q);
    w.toArray(world, i * 4);
  });
  return { count: n, parent, rest, restPos, parentWorld, parentWorldInv };
}

const tmpR = new Quaternion();
const tmpP = new Quaternion();
const tmpPi = new Quaternion();
const tmpQ = new Quaternion();
const tmpE = new Euler();
const tmpBase = new Quaternion();
const tmpOut = new Quaternion();

/** `out = inverse(pBind) * R * pBind * base`, R a turn about the model's axes in radians (Euler XYZ). */
export function turnOnto(
  out: Quaternion,
  bind: Bind,
  i: number,
  base: Quaternion,
  rx: number,
  ry: number,
  rz: number,
): Quaternion {
  tmpP.fromArray(bind.parentWorld, i * 4);
  tmpPi.fromArray(bind.parentWorldInv, i * 4);
  tmpR.setFromEuler(tmpE.set(rx, ry, rz, "XYZ"));
  tmpQ.copy(base);
  return out.copy(tmpPi).multiply(tmpR).multiply(tmpP).multiply(tmpQ);
}

/** One pose, flat. `hips` is the root bone's local position, `scale` is x, y, z for each bone. */
export interface PoseData {
  readonly q: Float32Array;
  readonly hips: Float32Array;
  readonly scale: Float32Array;
}

export function createPoseData(count = BONE_COUNT): PoseData {
  const scale = new Float32Array(count * 3);
  scale.fill(1);
  const q = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) q[i * 4 + 3] = 1;
  return { q, hips: new Float32Array(3), scale };
}

export function copyPoseData(dst: PoseData, src: PoseData): void {
  dst.q.set(src.q);
  dst.hips.set(src.hips);
  dst.scale.set(src.scale);
}

/** The bind pose itself. */
export function restPoseData(bind: Bind): PoseData {
  const data = createPoseData(bind.count);
  data.q.set(bind.rest);
  data.hips.set(bind.restPos.subarray(0, 3));
  return data;
}

/** Compile a pose of turns (degrees) into rotations by the formula. A bone the pose omits keeps its rest. */
export function compilePose(bind: Bind, def: PoseDef): PoseData {
  const data = restPoseData(bind);
  const base = new Quaternion();
  const out = new Quaternion();
  for (const [name, t] of Object.entries(def.turns)) {
    const i = boneIndex(name);
    base.fromArray(bind.rest, i * 4);
    turnOnto(out, bind, i, base, t[0] * DEG, t[1] * DEG, t[2] * DEG).normalize();
    out.toArray(data.q, i * 4);
  }
  if (def.hips) {
    for (let k = 0; k < 3; k++) data.hips[k] = at(data.hips, k) + (def.hips[k] ?? 0);
  }
  if (def.scales) {
    for (const [name, s] of Object.entries(def.scales)) {
      data.scale.set(s, boneIndex(name) * 3);
    }
  }
  return data;
}

/**
 * Spherical interpolation of two quaternions stored flat (x, y, z, w) in typed arrays, into `dst`.
 * The shorter way round, normalised, and safe when `dst` is one of the sources.
 */
export function slerpFlat(
  dst: Float32Array,
  d: number,
  a: Float32Array,
  ai: number,
  b: Float32Array,
  bi: number,
  t: number,
): void {
  const ax = at(a, ai);
  const ay = at(a, ai + 1);
  const az = at(a, ai + 2);
  const aw = at(a, ai + 3);
  let bx = at(b, bi);
  let by = at(b, bi + 1);
  let bz = at(b, bi + 2);
  let bw = at(b, bi + 3);
  let cos = ax * bx + ay * by + az * bz + aw * bw;
  if (cos < 0) {
    bx = -bx;
    by = -by;
    bz = -bz;
    bw = -bw;
    cos = -cos;
  }
  let s0 = 1 - t;
  let s1 = t;
  if (cos < 0.9995) {
    const angle = Math.acos(cos);
    const sin = Math.sin(angle);
    s0 = Math.sin((1 - t) * angle) / sin;
    s1 = Math.sin(t * angle) / sin;
  }
  const x = ax * s0 + bx * s1;
  const y = ay * s0 + by * s1;
  const z = az * s0 + bz * s1;
  const w = aw * s0 + bw * s1;
  const len = Math.hypot(x, y, z, w) || 1;
  dst[d] = x / len;
  dst[d + 1] = y / len;
  dst[d + 2] = z / len;
  dst[d + 3] = w / len;
}

/** `out = a` at w 0 and `b` at w 1: a slerp for each rotation, a lerp for the position and the scales. */
export function blendPoseData(out: PoseData, a: PoseData, b: PoseData, w: number): void {
  const t = w < 0 ? 0 : w > 1 ? 1 : w;
  const n = out.q.length / 4;
  for (let i = 0; i < n; i++) slerpFlat(out.q, i * 4, a.q, i * 4, b.q, i * 4, t);
  for (let i = 0; i < 3; i++) out.hips[i] = at(a.hips, i) + (at(b.hips, i) - at(a.hips, i)) * t;
  for (let i = 0; i < out.scale.length; i++) {
    out.scale[i] = at(a.scale, i) + (at(b.scale, i) - at(a.scale, i)) * t;
  }
}

/**
 * Add model-axis turns (radians, three per bone) on top of the rotations of a pose. A bone whose
 * three numbers are all zero is left as it is.
 */
export function applyTurns(bind: Bind, q: Float32Array, turns: Float32Array): void {
  const base = tmpBase;
  const out = tmpOut;
  for (let i = 0; i < bind.count; i++) {
    const rx = at(turns, i * 3);
    const ry = at(turns, i * 3 + 1);
    const rz = at(turns, i * 3 + 2);
    if (rx === 0 && ry === 0 && rz === 0) continue;
    base.fromArray(q, i * 4);
    turnOnto(out, bind, i, base, rx, ry, rz).normalize();
    out.toArray(q, i * 4);
  }
}

/**
 * Stretch an arm. The recipe of the rig: the upper arm bone is scaled along its length and the
 * hand bone is scaled back by the same factor so the mitten stays round. Never the forearm: it
 * would compound. `factor` multiplies what the pose already has, and the arm is held under `MAX_ARM`.
 */
export const MAX_ARM_SCALE = 3.2;

export function stretchArm(scale: Float32Array, arm: number, hand: number, factor: number): void {
  if (factor === 1) return;
  const was = at(scale, arm * 3 + 1);
  const next = Math.min(Math.max(MAX_ARM_SCALE, was), Math.max(0.4, was * factor));
  scale[arm * 3 + 1] = next;
  scale[hand * 3 + 1] = at(scale, hand * 3 + 1) * (was / next);
}
