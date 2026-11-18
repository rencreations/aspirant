/**
 * The drone follows a target on springs and its attitude comes from its own movement, as on the
 * About page (`choreo/follower.ts`): it banks into a turn, pitches along a climb or a dive and
 * points its nose where it goes when it is fast. So a flight is nose first and never a rewind, and
 * when the target stops the drone slows, comes upright and hovers.
 *
 * Everything here is in the SCREEN frame (middle origin, y down, see `coords.ts`) and nothing is
 * allocated: the caller owns the structs and the functions write into them.
 */
import type { Target } from "./coords";
import { clamp, mix, ramp, springTo, type Sprung } from "./ease";

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

/** How the drone is moving, in screens per second, and how much of a flight that is (0 to 1). */
export interface Flight {
  vx: number;
  vy: number;
  speed: number;
  fast: number;
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

export function createFollower(): Follower {
  const zero = (): Sprung => ({ x: 0, v: 0 });
  return {
    x: zero(),
    y: zero(),
    size: { x: 100, v: 0 },
    yaw: zero(),
    pitch: zero(),
    roll: zero(),
    ax: 0,
    ay: 0,
  };
}

export function createFlight(): Flight {
  return { vx: 0, vy: 0, speed: 0, fast: 0 };
}

/** `vh` is the height of the screen, so that a speed is the same fraction of it at any size. */
export function flightOf(f: Follower, vh: number, out: Flight): Flight {
  out.vx = f.x.v / vh;
  out.vy = f.y.v / vh;
  out.speed = Math.hypot(out.vx, out.vy);
  out.fast = ramp(0.16, 0.85, out.speed);
  return out;
}

/** Put the follower exactly on a target, at rest: a jump, a first frame, a drone that was hidden. */
export function snapFollower(f: Follower, t: Target): void {
  f.x.x = t.x;
  f.x.v = 0;
  f.y.x = t.y;
  f.y.v = 0;
  f.size.x = t.size;
  f.size.v = 0;
  f.yaw.x = t.yaw;
  f.yaw.v = 0;
  f.pitch.x = t.pitch;
  f.pitch.v = 0;
  f.roll.x = t.roll;
  f.roll.v = 0;
  f.ax = 0;
  f.ay = 0;
}

/**
 * One step toward the target. `rest` is the attitude the drone takes when it is not moving (the
 * place's own, with the look at a point in it); the target's `roll` is added to the bank.
 */
export function stepFollower(
  f: Follower,
  t: Target,
  rest: { yaw: number; pitch: number },
  vh: number,
  dt: number,
  flight: Flight,
): void {
  if (dt <= 0) return;
  const vx0 = f.x.v;
  const vy0 = f.y.v;
  springTo(f.x, t.x, OMEGA_PLACE, dt);
  springTo(f.y, t.y, OMEGA_PLACE, dt);
  springTo(f.size, t.size, OMEGA_SIZE, dt);
  const k = 1 - Math.exp(-14 * dt);
  f.ax = mix(f.ax, (f.x.v - vx0) / dt, k);
  f.ay = mix(f.ay, (f.y.v - vy0) / dt, k);

  flightOf(f, vh, flight);
  // The nose goes where the drone goes, the more so the faster it is.
  const yaw = mix(rest.yaw, clamp(flight.vx * 1.15, -MAX_YAW, MAX_YAW), flight.fast);
  const pitch = mix(rest.pitch, clamp(flight.vy * 0.8, -MAX_PITCH, MAX_PITCH), flight.fast);
  // It leans into its movement, and a little more into a change of it.
  const roll = clamp(-flight.vx * 0.4 - (f.ax / vh) * 0.035, -MAX_ROLL, MAX_ROLL) + t.roll;
  springTo(f.yaw, yaw, OMEGA_YAW, dt);
  springTo(f.pitch, pitch, OMEGA_PITCH, dt);
  springTo(f.roll, roll, OMEGA_ROLL, dt);
}

/** The small life of a drone that hovers: it floats and sways. `calm` is 1 at rest. */
export function floatOf(
  time: number,
  calm: number,
  size: number,
  out: { dx: number; dy: number; roll: number; pitch: number },
): void {
  out.dx = Math.sin(time * 0.83 + 1.1) * 0.012 * size * calm;
  out.dy = Math.sin(time * 1.55) * 0.026 * size * calm;
  out.roll = Math.sin(time * 1.07 + 0.4) * 0.035 * calm;
  out.pitch = Math.sin(time * 1.55 - 1.2) * 0.03 * calm;
}

/**
 * The turn of the body and the slide of the eyes that look at a point of the screen (in the screen
 * frame). The point is taken to be this far in front of the drone: nearer makes it turn more.
 */
export function lookAt(
  pose: { x: number; y: number; size: number },
  px: number,
  py: number,
  vh: number,
  out: { yaw: number; pitch: number; eyeX: number; eyeY: number },
): void {
  const depth = Math.max(pose.size * 1.05, 0.4 * vh);
  const dx = (px - pose.x) / depth;
  const dy = (py - pose.y) / depth;
  out.yaw = clamp(Math.atan(dx) * 0.92, -0.72, 0.72);
  out.pitch = clamp(Math.atan(dy) * 0.7, -0.42, 0.5);
  out.eyeX = clamp(dx * 0.7, -1, 1);
  out.eyeY = clamp(dy * 0.7, -1, 1);
}
