import type { ClipName } from "./model";

/**
 * One frame of Tetra's body, as the pose system hands it to the rig. Plain numbers: no three here,
 * so every pose, blend and test is arithmetic.
 *
 * A `Turn` is in radians about the doll's own axes: `x` is her left (the right of the screen when
 * she faces us), `y` is up, `z` is forward (toward the visitor). For an arm, `z` raises it sideways
 * (positive for her left arm, negative for her right) and a negative `x` swings it forward. For a
 * leg or a spine, a negative `x` leans or swings forward. For the head, a positive `x` nods down.
 * Every turn is laid on the bone's own pose, in order from the hips outward, so a turn on a parent
 * carries its children.
 */
export interface Turn {
  x: number;
  y: number;
  z: number;
}

/**
 * Where a hand should be, in her own frame (metres, the feet's middle is the origin, y up, z toward
 * the visitor), and how much of the two-bone solve is used: 0 leaves the arm to its turns, 1 puts
 * the hand on the point (as far as the arm reaches).
 */
interface Reach {
  x: number;
  y: number;
  z: number;
  w: number;
}

const TURN_KEYS = [
  "hips",
  "spine",
  "spine2",
  "neck",
  "head",
  "shoulderL",
  "shoulderR",
  "armL",
  "armR",
  "foreL",
  "foreR",
  "wristL",
  "wristR",
  "legL",
  "legR",
  "kneeL",
  "kneeR",
] as const;
export type TurnKey = (typeof TURN_KEYS)[number];

/** The single numbers of a frame: where she stands off her mark, her attitude, her squash. */
const BODY_KEYS = ["x", "y", "z", "yaw", "pitch", "roll", "squash"] as const;
type BodyKey = (typeof BODY_KEYS)[number];

export type Channels = Record<BodyKey, number> &
  Record<TurnKey, Turn> & {
    reachL: Reach;
    reachR: Reach;
    /** A baked clip under the turns, where in it, and how much of it (0 is the rest pose). */
    clip: ClipName | null;
    clipTime: number;
    clipWeight: number;
  };

const turn = (): Turn => ({ x: 0, y: 0, z: 0 });
const reach = (): Reach => ({ x: 0, y: 0, z: 0, w: 0 });

export function restChannels(): Channels {
  return {
    x: 0,
    y: 0,
    z: 0,
    yaw: 0,
    pitch: 0,
    roll: 0,
    squash: 1,
    hips: turn(),
    spine: turn(),
    spine2: turn(),
    neck: turn(),
    head: turn(),
    shoulderL: turn(),
    shoulderR: turn(),
    armL: turn(),
    armR: turn(),
    foreL: turn(),
    foreR: turn(),
    wristL: turn(),
    wristR: turn(),
    legL: turn(),
    legR: turn(),
    kneeL: turn(),
    kneeR: turn(),
    reachL: reach(),
    reachR: reach(),
    clip: null,
    clipTime: 0,
    clipWeight: 0,
  };
}

/** Back to the rest pose, in place (a pose function writes into one object each frame). */
export function clearChannels(c: Channels): void {
  for (const k of BODY_KEYS) c[k] = k === "squash" ? 1 : 0;
  for (const k of TURN_KEYS) {
    const t = c[k];
    t.x = 0;
    t.y = 0;
    t.z = 0;
  }
  clearReach(c.reachL);
  clearReach(c.reachR);
  c.clip = null;
  c.clipTime = 0;
  c.clipWeight = 0;
}

function clearReach(r: Reach): void {
  r.x = 0;
  r.y = 0;
  r.z = 0;
  r.w = 0;
}

function copyReach(a: Reach, b: Reach): void {
  a.x = b.x;
  a.y = b.y;
  a.z = b.z;
  a.w = b.w;
}

/** A hand's target is blended by its weight, so a hand that one side leaves alone does not drag the point. */
function mixReach(o: Reach, p: Reach, q: Reach, s: number, t: number): void {
  const wa = p.w * s;
  const wb = q.w * t;
  const sum = wa + wb;
  if (sum > 1e-6) {
    o.x = (p.x * wa + q.x * wb) / sum;
    o.y = (p.y * wa + q.y * wb) / sum;
    o.z = (p.z * wa + q.z * wb) / sum;
  } else {
    o.x = p.x;
    o.y = p.y;
    o.z = p.z;
  }
  o.w = sum;
}

export function copyChannels(to: Channels, from: Channels): void {
  for (const k of BODY_KEYS) to[k] = from[k];
  for (const k of TURN_KEYS) {
    to[k].x = from[k].x;
    to[k].y = from[k].y;
    to[k].z = from[k].z;
  }
  copyReach(to.reachL, from.reachL);
  copyReach(to.reachR, from.reachR);
  to.clip = from.clip;
  to.clipTime = from.clipTime;
  to.clipWeight = from.clipWeight;
}

/**
 * `out = a + (b - a) * t`, channel by channel. A hand's target is blended by its weight, so a hand
 * that one side does not reach for does not drag the point toward the origin. `out` may be `a`.
 */
export function mixChannels(out: Channels, a: Channels, b: Channels, t: number): void {
  const s = 1 - t;
  for (const k of BODY_KEYS) out[k] = a[k] * s + b[k] * t;
  for (const k of TURN_KEYS) {
    out[k].x = a[k].x * s + b[k].x * t;
    out[k].y = a[k].y * s + b[k].y * t;
    out[k].z = a[k].z * s + b[k].z * t;
  }
  mixReach(out.reachL, a.reachL, b.reachL, s, t);
  mixReach(out.reachR, a.reachR, b.reachR, s, t);
  const wa = a.clipWeight * s;
  const wb = b.clipWeight * t;
  const pickB = wb >= wa;
  out.clip = pickB ? b.clip : a.clip;
  out.clipTime = pickB ? b.clipTime : a.clipTime;
  out.clipWeight = wa + wb;
}
