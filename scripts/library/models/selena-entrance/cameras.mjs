// `extras.cameras` of the Entrance file: one key every 1/30 s for each clip, in the file's world
// space (glTF, metres, Y up), three.js camera convention (looking down local -Z), the vertical
// field of view in degrees over a frame 2.2222 wide (the recordings are 3840 by 1728).
//
// Each clip's camera is the game's own camera path (blender/cameras.py bakes it from the
// `cam_city_*` actions) corrected by the fit in cameras/fits.json, found against the game's
// recordings (README.md says how):
//
//   camera(t) = W(t) * G(t * rate + shift) * L(t)
//
// G is the game's key at that time, L an offset in the camera's own axes and W an offset in world
// space; L, W and the field of view are given at anchor times of the clip and read between them
// on a cubic curve. A static camera ("static") replaces the path with one key held for the whole
// clip, and a hold ("holds": from, to, p, q, vfov) does the same for a stretch of it. Where the
// recording's camera does not follow the game's path at all, "keys" give the camera itself
// (solved from the recording's frames, see fit/).
import fs from "node:fs";
import path from "node:path";
import { HERE, WORK, fail, readJson } from "./lib/env.mjs";

export const FPS = 30;
export const ASPECT = 2.2222;
export const DEFAULT_VFOV = 60;

const FITS = path.join(HERE, "cameras", "fits.json");

// Rigid transforms as { p: [x, y, z], q: [x, y, z, w] }.
function qmul(a, b) {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}
function qrot(q, v) {
  const p = qmul(qmul(q, [v[0], v[1], v[2], 0]), [-q[0], -q[1], -q[2], q[3]]);
  return [p[0], p[1], p[2]];
}
export function compose(a, b) {
  const r = qrot(a.q, b.p);
  return { p: [a.p[0] + r[0], a.p[1] + r[1], a.p[2] + r[2]], q: norm(qmul(a.q, b.q)) };
}
/** The inverse of a rigid transform. */
export function invert(a) {
  const q = [-a.q[0], -a.q[1], -a.q[2], a.q[3]];
  const p = qrot(q, a.p);
  return { p: [-p[0], -p[1], -p[2]], q };
}
function norm(q) {
  const l = Math.hypot(...q);
  return q.map((v) => v / l);
}
function slerp(a, b, f) {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  const s = d < 0 ? -1 : 1;
  d = Math.abs(d);
  if (d > 0.9995) return norm(a.map((v, k) => v + (s * b[k] - v) * f));
  const th = Math.acos(d);
  const wa = Math.sin((1 - f) * th) / Math.sin(th);
  const wb = (s * Math.sin(f * th)) / Math.sin(th);
  return a.map((v, k) => v * wa + b[k] * wb);
}
/** A rotation vector (radians, axis times angle) as a quaternion. */
export function fromRotvec(v) {
  const a = Math.hypot(...v);
  if (a < 1e-12) return [0, 0, 0, 1];
  const s = Math.sin(a / 2) / a;
  return [v[0] * s, v[1] * s, v[2] * s, Math.cos(a / 2)];
}
/** The game's camera of a clip at time t (seconds), interpolated between its 30 fps keys. */
export function gameAt(cam, t) {
  const n = cam.keys.length / 7;
  const x = Math.max(0, Math.min(n - 1, t * FPS));
  const i = Math.floor(x);
  const j = Math.min(n - 1, i + 1);
  const f = x - i;
  const a = cam.keys.slice(i * 7, i * 7 + 7);
  const b = cam.keys.slice(j * 7, j * 7 + 7);
  return {
    p: [0, 1, 2].map((k) => a[k] + (b[k] - a[k]) * f),
    q: slerp(a.slice(3, 7), b.slice(3, 7), f),
  };
}

/**
 * A field of the anchors at time t: a vector (a rotation vector, a move or a field of view) read
 * through a cubic Hermite curve over the anchors (tangents from the neighbours, flat at the
 * first and the last anchor, so a clip starts and ends at rest on its anchors). Before the first
 * anchor and after the last one the value is held.
 */
function field(anchors, t, get) {
  const list = (anchors ?? []).filter((a) => get(a) !== undefined).sort((a, b) => a.t - b.t);
  if (!list.length) return null;
  const v = list.map(get);
  if (t <= list[0].t) return v[0];
  const last = list.length - 1;
  if (t >= list[last].t) return v[last];
  let i = 0;
  while (t > list[i + 1].t) i++;
  const t0 = list[i].t;
  const t1 = list[i + 1].t;
  const h = t1 - t0;
  const tangent = (k) => {
    if (k === 0 || k === last) return v[k].map(() => 0);
    return v[k].map((x, c) => (v[k + 1][c] - v[k - 1][c]) / (list[k + 1].t - list[k - 1].t));
  };
  const m0 = tangent(i);
  const m1 = tangent(i + 1);
  const s = (t - t0) / h;
  const h00 = 2 * s ** 3 - 3 * s ** 2 + 1;
  const h10 = s ** 3 - 2 * s ** 2 + s;
  const h01 = -2 * s ** 3 + 3 * s ** 2;
  const h11 = s ** 3 - s ** 2;
  return v[i].map((x, c) => h00 * x + h10 * h * m0[c] + h01 * v[i + 1][c] + h11 * h * m1[c]);
}
function offsetAt(anchors, t, kind) {
  const turn = field(anchors, t, (a) => a[kind]?.turn ?? (a[kind] ? [0, 0, 0] : undefined));
  const move = field(anchors, t, (a) => a[kind]?.move ?? (a[kind] ? [0, 0, 0] : undefined));
  return { p: move ?? [0, 0, 0], q: turn ? fromRotvec(turn) : [0, 0, 0, 1] };
}

/** The fitted camera of a clip at time t: { p, q, vfov }. */
export function fittedAt(fit, cam, t) {
  if (fit?.static) {
    return { p: fit.static.p, q: norm(fit.static.q), vfov: fit.vfov ?? DEFAULT_VFOV };
  }
  // A hold: the recording's camera stands still there (the game's path sways a little).
  for (const hold of fit?.holds ?? []) {
    if (t >= hold.from - 1e-9 && t <= hold.to + 1e-9)
      return { p: hold.p, q: norm(hold.q), vfov: hold.vfov ?? fit.vfov ?? DEFAULT_VFOV };
  }
  // Keys: the recording's own camera, solved at frames of the recording (fit/pnp.mjs) and
  // smoothed (fit/keys.py): positions, and turns as rotation vectors from `ref`, on the cubic
  // curve between keys. Used where the game's path is not the recording's.
  if (fit?.keys) {
    const p = field(fit.keys, t, (k) => k.p);
    const r = field(fit.keys, t, (k) => k.r);
    const vfov = field(fit.keys, t, (k) => (k.vfov === undefined ? undefined : [k.vfov]))?.[0];
    return { p, q: norm(qmul(fit.ref, fromRotvec(r))), vfov: vfov ?? fit.vfov ?? DEFAULT_VFOV };
  }
  const rate = fit?.rate ?? 1;
  const shift = fit?.shift ?? 0;
  const g = gameAt(cam, t * rate + shift);
  const local = offsetAt(fit?.anchors, t, "local");
  const world = offsetAt(fit?.anchors, t, "world");
  const m = compose(world, compose(g, local));
  const vfov =
    field(fit?.anchors, t, (a) => (a.vfov === undefined ? undefined : [a.vfov]))?.[0] ??
    fit?.vfov ??
    DEFAULT_VFOV;
  return { ...m, vfov };
}

export function readFits() {
  return fs.existsSync(FITS) ? readJson(FITS) : { clips: {} };
}

/**
 * The extras for the file. `clips`: { id: { frames, seconds } } of the finished clips. A clip
 * with frames F (24 fps) and length S seconds gets round(S * 30) + 1 keys.
 */
export function cameraExtras(clips, { fits = readFits(), bake } = {}) {
  bake ??= readJson(path.join(WORK, "work", "cameras.game.json"));
  const out = { fps: FPS, aspect: ASPECT, clips: {} };
  for (const [id, clip] of Object.entries(clips)) {
    const cam = bake.clips[id];
    if (!cam) fail(`no game camera for ${id}`);
    const fit = fits.clips[id];
    const frames = Math.round(clip.seconds * FPS) + 1;
    const keys = [];
    let previous = null;
    for (let i = 0; i < frames; i++) {
      const c = fittedAt(fit, cam, i / FPS);
      let q = c.q;
      if (
        previous &&
        q[0] * previous[0] + q[1] * previous[1] + q[2] * previous[2] + q[3] * previous[3] < 0
      )
        q = q.map((v) => -v);
      previous = q;
      keys.push(...c.p.map((v) => r(v, 5)), ...q.map((v) => r(v, 6)), r(c.vfov, 3));
    }
    out.clips[id] = { frames, keys };
  }
  return out;
}

function r(v, d) {
  return Math.round(v * 10 ** d) / 10 ** d;
}
