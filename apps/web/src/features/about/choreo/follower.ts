import { clamp, mix, ramp, springTo, type Sprung } from "./ease";

/**
 * The drone itself: it follows the path's point on springs, and its attitude comes from its own
 * movement. It banks into a turn, pitches along a climb or a dive, and points its nose where it
 * is going when it is fast. So a scroll up is a flight up, nose first, and never the flight down
 * played backwards; and when the point stops, the drone slows, comes upright and hovers.
 *
 * Angles are in radians: yaw turns the face to the right of the screen, pitch puts the nose down,
 * roll is counter-clockwise as the visitor sees it.
 */
export interface Follower {
  x: Sprung;
  y: Sprung;
  size: Sprung;
  yaw: Sprung;
  pitch: Sprung;
  roll: Sprung;
  /** Acceleration on the screen, smoothed, in pixels per second squared. */
  ax: number;
  ay: number;
}

/** How quick the springs are, in radians per second. Critically damped: quick, and no wobble. */
const OMEGA_PLACE = 7.2;
const OMEGA_SIZE = 6.4;
const OMEGA_YAW = 7.5;
const OMEGA_PITCH = 8.5;
const OMEGA_ROLL = 9.5;

/** The most the drone leans by itself. A trick turns it further, on top. */
const MAX_YAW = 1.22;
const MAX_PITCH = 0.72;
const MAX_ROLL = 0.66;

export function createFollower(x: number, y: number, size: number, yaw = 0): Follower {
  return {
    x: { x, v: 0 },
    y: { x: y, v: 0 },
    size: { x: size, v: 0 },
    yaw: { x: yaw, v: 0 },
    pitch: { x: 0, v: 0 },
    roll: { x: 0, v: 0 },
    ax: 0,
    ay: 0,
  };
}

/** How the drone is moving, in screens per second, and how much of a flight that is (0 to 1). */
interface Flight {
  vx: number;
  vy: number;
  speed: number;
  fast: number;
}

export function flightOf(f: Follower, vh: number): Flight {
  const vx = f.x.v / vh;
  const vy = f.y.v / vh;
  const speed = Math.hypot(vx, vy);
  return { vx, vy, speed, fast: ramp(0.16, 0.85, speed) };
}

/**
 * One step toward the target. `rest` is the attitude the drone takes when it is not moving (the
 * station's turn, with the look at the pointer in it).
 */
export function stepFollower(
  f: Follower,
  target: { x: number; y: number; size: number },
  rest: { yaw: number; pitch: number },
  vh: number,
  dt: number,
): void {
  if (dt <= 0) return;
  const vx0 = f.x.v;
  const vy0 = f.y.v;
  springTo(f.x, target.x, OMEGA_PLACE, dt);
  springTo(f.y, target.y, OMEGA_PLACE, dt);
  springTo(f.size, target.size, OMEGA_SIZE, dt);
  const k = 1 - Math.exp(-14 * dt);
  f.ax = mix(f.ax, (f.x.v - vx0) / dt, k);
  f.ay = mix(f.ay, (f.y.v - vy0) / dt, k);

  const { vx, vy, fast } = flightOf(f, vh);
  // The nose goes where the drone goes, the more so the faster it is.
  const yaw = mix(rest.yaw, clamp(vx * 1.15, -MAX_YAW, MAX_YAW), fast);
  const pitch = mix(rest.pitch, clamp(vy * 0.8, -MAX_PITCH, MAX_PITCH), fast);
  // It leans into its movement, and a little more into a change of it.
  const roll = clamp(-vx * 0.4 - (f.ax / vh) * 0.035, -MAX_ROLL, MAX_ROLL);
  springTo(f.yaw, yaw, OMEGA_YAW, dt);
  springTo(f.pitch, pitch, OMEGA_PITCH, dt);
  springTo(f.roll, roll, OMEGA_ROLL, dt);
}

/**
 * Put the follower where something else has just drawn the drone (the opening), with the speed
 * it had there, so the flight carries on from that frame without a jump.
 */
export function syncFollower(
  f: Follower,
  pose: { x: number; y: number; size: number; yaw: number; pitch: number; roll: number },
  dt: number,
): void {
  const speed = (now: number, was: number) => (dt > 0 ? (now - was) / dt : 0);
  const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
  f.x = { x: pose.x, v: speed(pose.x, f.x.x) };
  f.y = { x: pose.y, v: speed(pose.y, f.y.x) };
  f.size = { x: pose.size, v: speed(pose.size, f.size.x) };
  // A turn of the opening that is part way round is taken up by the shorter way.
  f.yaw = { x: wrap(pose.yaw), v: 0 };
  f.pitch = { x: wrap(pose.pitch), v: 0 };
  f.roll = { x: wrap(pose.roll), v: 0 };
}

/** The small life of a drone that hovers: it floats and sways. `calm` is 1 at rest. */
export function floatOf(
  time: number,
  calm: number,
  size: number,
): { dx: number; dy: number; roll: number; pitch: number } {
  return {
    dx: Math.sin(time * 0.83 + 1.1) * 0.012 * size * calm,
    dy: Math.sin(time * 1.55) * 0.026 * size * calm,
    roll: Math.sin(time * 1.07 + 0.4) * 0.035 * calm,
    pitch: Math.sin(time * 1.55 - 1.2) * 0.03 * calm,
  };
}

/**
 * The turn of the body and the slide of the eyes that look at a point of the screen. With no
 * point there is no look.
 */
export function lookAt(
  pose: { x: number; y: number; size: number },
  point: { x: number; y: number } | null,
  vh: number,
): { yaw: number; pitch: number; eyeX: number; eyeY: number } {
  if (!point) return { yaw: 0, pitch: 0, eyeX: 0, eyeY: 0 };
  // The point is taken to be this far in front of the drone: nearer makes it turn more.
  const depth = Math.max(pose.size * 1.05, 0.4 * vh);
  const dx = (point.x - pose.x) / depth;
  const dy = (point.y - pose.y) / depth;
  return {
    yaw: clamp(Math.atan(dx) * 0.92, -0.72, 0.72),
    pitch: clamp(Math.atan(dy) * 0.7, -0.42, 0.5),
    eyeX: clamp(dx * 0.7, -1, 1),
    eyeY: clamp(dy * 0.7, -1, 1),
  };
}
