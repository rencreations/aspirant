import type { ViewMode } from "./types";

/**
 * The arithmetic of the room's camera, with no three in it: the orbit and its limits for each kind
 * of view, the framing of a model, and how the game's wide cinematic frame is fitted into a screen.
 *
 * An orbit is a target, an angle round it (`yaw`, 0 is the front, +Z), an angle above it (`pitch`,
 * 0 is level, positive is above) and a distance.
 */
export interface Orbit {
  yaw: number;
  pitch: number;
  radius: number;
  tx: number;
  ty: number;
  tz: number;
}

export interface OrbitLimits {
  minPitch: number;
  maxPitch: number;
  minRadius: number;
  maxRadius: number;
  /** The target may move between these heights (a character), or anywhere (`pan`). */
  minTargetY: number;
  maxTargetY: number;
  pan: boolean;
}

/** What the room knows of a model's size once it is loaded. */
export interface Bounds {
  /** The middle of its box. */
  cx: number;
  cy: number;
  cz: number;
  /** Half the diagonal of its box. */
  radius: number;
  /** Its lowest and highest point. */
  minY: number;
  maxY: number;
  /** Its widest horizontal extent (the larger of its width and depth), when it was measured. */
  span?: number;
}

const DEG = Math.PI / 180;

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** Frame-rate independent easing of `current` toward `goal` (`rate` per second). */
export function damp(current: number, goal: number, rate: number, dt: number): number {
  return goal + (current - goal) * Math.exp(-rate * Math.max(0, dt));
}

/** The shortest signed turn from angle `a` to angle `b`, in radians. */
export function angleDelta(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * The limits of each mode. A character can be looked at from level with the target up to well
 * above, never from under: the target never drops below her hips (half her height), so even at
 * the closest the camera looks across or down. A free view goes anywhere.
 */
export function limitsFor(mode: ViewMode, b: Bounds): OrbitLimits {
  const size = Math.max(0.05, b.radius);
  if (mode === "character") {
    const height = Math.max(0.05, b.maxY - b.minY);
    return {
      minPitch: 0,
      maxPitch: 80 * DEG,
      minRadius: size * 0.32,
      // Far enough for a tall phone, whose narrow width needs the camera well back.
      maxRadius: size * 10,
      minTargetY: b.minY + height * 0.5,
      maxTargetY: b.minY + height * 0.94,
      pan: false,
    };
  }
  return {
    minPitch: -89 * DEG,
    maxPitch: 89 * DEG,
    minRadius: size * (mode === "free" ? 0.12 : 0.45),
    maxRadius: size * 14,
    minTargetY: -Infinity,
    maxTargetY: Infinity,
    pan: mode === "free",
  };
}

/** The orbit kept inside its limits. A character's target stays on her axis. */
export function clampOrbit(o: Orbit, l: OrbitLimits, b: Bounds): Orbit {
  const out = { ...o };
  out.pitch = clamp(o.pitch, l.minPitch, l.maxPitch);
  out.radius = clamp(o.radius, l.minRadius, l.maxRadius);
  if (l.pan) {
    // A free target wanders at most a few sizes from the model, so it is never lost in space.
    const reach = Math.max(0.05, b.radius) * 3;
    out.tx = clamp(o.tx, b.cx - reach, b.cx + reach);
    out.ty = clamp(o.ty, b.cy - reach, b.cy + reach);
    out.tz = clamp(o.tz, b.cz - reach, b.cz + reach);
  } else {
    out.tx = b.cx;
    out.tz = b.cz;
    out.ty = clamp(o.ty, l.minTargetY, l.maxTargetY);
  }
  return out;
}

/** Where the camera is for an orbit. */
export function orbitPosition(o: Orbit): [number, number, number] {
  const c = Math.cos(o.pitch);
  return [
    o.tx + Math.sin(o.yaw) * c * o.radius,
    o.ty + Math.sin(o.pitch) * o.radius,
    o.tz + Math.cos(o.yaw) * c * o.radius,
  ];
}

/** The orbit that puts a camera at `pos` looking at `target`. */
export function orbitFrom(
  pos: readonly [number, number, number],
  target: readonly [number, number, number],
): Orbit {
  const dx = pos[0] - target[0];
  const dy = pos[1] - target[1];
  const dz = pos[2] - target[2];
  const radius = Math.max(1e-4, Math.hypot(dx, dy, dz));
  return {
    yaw: Math.atan2(dx, dz),
    pitch: Math.asin(clamp(dy / radius, -1, 1)),
    radius,
    tx: target[0],
    ty: target[1],
    tz: target[2],
  };
}

/**
 * How far a camera of this lens must stand so a sphere of `radius` fills `fill` of the narrower
 * side of the screen.
 */
function fitDistance(radius: number, vfovDeg: number, aspect: number, fill = 0.8): number {
  const tv = Math.tan((vfovDeg * DEG) / 2);
  const t = Math.min(tv, tv * aspect) * fill;
  return radius / Math.sin(Math.atan(t));
}

/** The orbit a view opens on: a three quarter turn, a little above, the whole model in view. */
export function homeOrbit(
  mode: ViewMode,
  b: Bounds,
  vfovDeg: number,
  aspect: number,
  /** The visible part of the screen is narrower than the canvas (the panels). */
  fill = 0.82,
): Orbit {
  const l = limitsFor(mode, b);
  if (mode === "character" || mode === "free") {
    const height = Math.max(0.05, b.maxY - b.minY);
    // A figure: frame its height and its width, not its diagonal, so it fills the screen.
    const tv = Math.tan((vfovDeg * DEG) / 2);
    const fitH = (height * 0.5) / (tv * fill);
    // A standing figure is narrower than its box's diagonal. A free view is framed by how wide it
    // really is (a long dragon seen from its side), when that was measured.
    const half = mode === "free" && b.span ? b.span * 0.5 : Math.max(0.05, b.radius) * 0.75;
    const fitW = half / (tv * Math.min(1, aspect) * fill);
    const radius = clamp(Math.max(fitH, fitW), l.minRadius, l.maxRadius);
    const ty = mode === "character" ? b.minY + height * 0.52 : b.cy;
    return clampOrbit(
      { yaw: 0.42, pitch: (mode === "character" ? 6 : 8) * DEG, radius, tx: b.cx, ty, tz: b.cz },
      l,
      b,
    );
  }
  const radius = clamp(fitDistance(b.radius, vfovDeg, aspect, fill), l.minRadius, l.maxRadius);
  return clampOrbit(
    {
      yaw: 0,
      pitch: 0,
      radius,
      tx: b.cx,
      ty: b.cy,
      tz: b.cz,
    },
    l,
    b,
  );
}

/**
 * The game's cinematic frame is wide (2.222 to 1). On a screen as wide or wider, its height is kept
 * and the sides grow. On a narrower one, its whole width is kept, up to `maxGrow` times the frame's
 * height: past that (a phone), the sides are cut and `spare` says how far the window may slide
 * either way and stay inside the frame (0 when the whole width shows), in tan units of the lens,
 * so the room can keep the subject in the middle.
 */
export function fitCinematic(
  vfovDeg: number,
  frameAspect: number,
  viewAspect: number,
  maxGrow = 1.6,
): { vfov: number; spare: number } {
  const t = Math.tan((vfovDeg * DEG) / 2);
  const halfW = t * frameAspect;
  if (viewAspect >= frameAspect) return { vfov: vfovDeg, spare: 0 };
  const need = halfW / viewAspect;
  const use = Math.min(need, t * maxGrow);
  return { vfov: (2 * Math.atan(use)) / DEG, spare: Math.max(0, halfW - use * viewAspect) };
}

/** Linear interpolation of one key of a camera track (8 numbers a key). */
export function sampleTrack(
  keys: ArrayLike<number>,
  fps: number,
  time: number,
  out: number[] = [],
): number[] {
  const n = Math.floor(keys.length / 8);
  if (n === 0) return out;
  const f = clamp(time * fps, 0, n - 1);
  const i = Math.floor(f);
  const j = Math.min(n - 1, i + 1);
  const a = f - i;
  for (let k = 0; k < 8; k += 1) {
    const x = keys[i * 8 + k] ?? 0;
    const y = keys[j * 8 + k] ?? 0;
    out[k] = x + (y - x) * a;
  }
  // The rotation is a quaternion: keep the shorter way and normalise.
  const ax = keys[i * 8 + 3] ?? 0;
  const ay = keys[i * 8 + 4] ?? 0;
  const az = keys[i * 8 + 5] ?? 0;
  const aw = keys[i * 8 + 6] ?? 1;
  let bx = keys[j * 8 + 3] ?? 0;
  let by = keys[j * 8 + 4] ?? 0;
  let bz = keys[j * 8 + 5] ?? 0;
  let bw = keys[j * 8 + 6] ?? 1;
  if (ax * bx + ay * by + az * bz + aw * bw < 0) {
    bx = -bx;
    by = -by;
    bz = -bz;
    bw = -bw;
  }
  const qx = ax + (bx - ax) * a;
  const qy = ay + (by - ay) * a;
  const qz = az + (bz - az) * a;
  const qw = aw + (bw - aw) * a;
  const len = Math.hypot(qx, qy, qz, qw) || 1;
  out[3] = qx / len;
  out[4] = qy / len;
  out[5] = qz / len;
  out[6] = qw / len;
  return out;
}
