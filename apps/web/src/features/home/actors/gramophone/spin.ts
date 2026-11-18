/**
 * The motion of the gramophone's three moving parts as pure steps: the crank (a hand turns it, or a
 * drone cranks it at a set speed, or it coasts), the platter (tied to the crank through a gear and
 * a flywheel) and the tonearm (a lift with a small bounce when the needle lands). Angles are in
 * radians except the arm, which is in degrees (the rig's lift is quoted in degrees).
 */
import { clamp } from "./frame";

export const TAU = Math.PI * 2;

/** Wrap an angle into (-PI, PI]. */
export function wrapAngle(a: number): number {
  const t = (a + Math.PI) % TAU;
  return (t <= 0 ? t + TAU : t) - Math.PI;
}

/** `next` moved by whole turns so that it is within half a turn of `prev` (no jump when a angle wraps). */
export function unwrapNear(prev: number, next: number): number {
  return next - TAU * Math.round((next - prev) / TAU);
}

/**
 * The angle of a pointer in the plane of a circle that the screen shows as an ellipse. `a` is where
 * the circle's local +X axis lands on the screen and `b` where its +Y axis lands (both as offsets
 * from the circle's centre, for one radius); `d` is the pointer's offset from that centre. The 2x2
 * system `[a b] [c s] = d` is solved and the angle is `atan2(s, c)`, so the turn has the right
 * direction however the plane is turned toward the camera. Returns null when the plane is nearly
 * edge on (the system has no good answer).
 */
export function planeAngle(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  dx: number,
  dy: number,
): number | null {
  const det = ax * by - ay * bx;
  const scale = Math.hypot(ax, ay) * Math.hypot(bx, by);
  if (!(scale > 1e-6) || Math.abs(det) < 0.18 * scale) return null;
  const c = (dx * by - dy * bx) / det;
  const s = (ax * dy - ay * dx) / det;
  return Math.atan2(s, c);
}

export interface CrankState {
  angle: number;
  /** Radians per second. */
  omega: number;
}

/** How fast the crank follows a speed that a drone asks for (1 / seconds). Speeding up is quick. */
const CRANK_UP_RATE = 5;
/** And slowing down: a flywheel behind the crank, so a let go crank keeps turning for a moment. */
const CRANK_DOWN_RATE = 1.4;

/**
 * A free crank: its speed eases toward `wantOmega` (a drone's loop, or 0 after a let go) and the
 * angle integrates. The ease is slow when the crank slows down and quick when it speeds up.
 */
export function stepCrank(s: CrankState, wantOmega: number, dt: number): void {
  if (!(dt > 0)) return;
  const slowing = Math.abs(wantOmega) < Math.abs(s.omega) || wantOmega * s.omega < 0;
  const rate = slowing ? CRANK_DOWN_RATE : CRANK_UP_RATE;
  s.omega = wantOmega + (s.omega - wantOmega) * Math.exp(-rate * dt);
  if (Math.abs(s.omega) < 1e-3 && wantOmega === 0) s.omega = 0;
  s.angle += s.omega * dt;
}

/**
 * A crank held by a hand: the angle follows `target` (the pointer's angle) with a short ease, and
 * the speed is the angle's own change, smoothed, so that a let go carries on at the right pace.
 * `maxOmega` keeps a flick from spinning it faster than a hand could.
 */
export function stepCrankHeld(s: CrankState, target: number, dt: number, maxOmega: number): void {
  if (!(dt > 0)) return;
  const follow = 1 - Math.exp(-38 * dt);
  const next = s.angle + (target - s.angle) * follow;
  const measured = clamp((next - s.angle) / dt, -maxOmega, maxOmega);
  s.omega += (measured - s.omega) * (1 - Math.exp(-14 * dt));
  s.angle = next;
}

/**
 * A crank whose angle a section gives every frame (a drone's turn counted by the drone): the angle
 * is exactly `target`, and the speed is read from how the angle moves, smoothed, so the platter
 * follows through the gear. `fresh` is the first frame of a drive (after a gap): the angle is put
 * there with no speed, so a far first value does not spin the platter.
 */
export function stepCrankDriven(
  s: CrankState,
  target: number,
  dt: number,
  fresh: boolean,
  maxOmega: number,
): void {
  if (fresh || !(dt > 0)) {
    s.angle = target;
    if (fresh) s.omega = 0;
    return;
  }
  const measured = clamp((target - s.angle) / dt, -maxOmega, maxOmega);
  s.omega += (measured - s.omega) * (1 - Math.exp(-14 * dt));
  s.angle = target;
}

export interface PlatterState {
  angle: number;
  omega: number;
}

/** Platter turns per crank turn. A winding crank at 2 turns per second gives 36 rpm, near the 33 of a long play. */
export const GEAR = 0.3;
/** The fastest the platter turns: a 78 rpm record. */
export const PLATTER_MAX_OMEGA = (78 / 60) * TAU;
const PLATTER_UP_RATE = 3;
/** The platter is a heavy flywheel: it runs down slowly. */
const PLATTER_DOWN_RATE = 0.55;

/** The platter's speed follows the crank's through the gear with inertia, and the angle integrates. */
export function stepPlatter(p: PlatterState, crankOmega: number, dt: number): void {
  if (!(dt > 0)) return;
  const want = clamp(crankOmega * GEAR, -PLATTER_MAX_OMEGA, PLATTER_MAX_OMEGA);
  const slowing = Math.abs(want) < Math.abs(p.omega) || want * p.omega < 0;
  const rate = slowing ? PLATTER_DOWN_RATE : PLATTER_UP_RATE;
  p.omega = want + (p.omega - want) * Math.exp(-rate * dt);
  if (Math.abs(p.omega) < 2e-3 && want === 0) p.omega = 0;
  p.angle += p.omega * dt;
}

export interface ArmState {
  /** Degrees about the lift axis. 0 is the needle down on the record. Never below 0. */
  angle: number;
  vel: number;
}

const ARM_UP = { omega: 9, zeta: 1 };
const ARM_DOWN = { omega: 15, zeta: 0.5 };
/** The share of its speed the soundbox keeps when it lands (it rebounds a little). */
const RESTITUTION = 0.28;
/** A landing slower than this (degrees per second) does not bounce or click. */
const IMPACT_MIN = 18;

/**
 * The tonearm's lift as a spring toward `target` degrees (0 down, `lift` up). When it comes down it
 * is a little under damped and lands on the record: the angle never goes below 0, it rebounds with
 * a part of its speed and settles, which is the small click. Returns the landing speed in degrees
 * per second when this step was a landing that was fast enough to be heard, else 0.
 */
export function stepArm(s: ArmState, target: number, dt: number): number {
  if (!(dt > 0)) return 0;
  const k = target > s.angle || target > 0.5 ? ARM_UP : ARM_DOWN;
  const steps = Math.max(1, Math.ceil(dt * 240));
  const h = dt / steps;
  let impact = 0;
  for (let i = 0; i < steps; i++) {
    s.vel += (k.omega * k.omega * (target - s.angle) - 2 * k.zeta * k.omega * s.vel) * h;
    s.angle += s.vel * h;
    if (s.angle < 0) {
      const speed = -s.vel;
      s.angle = 0;
      if (speed > IMPACT_MIN) {
        s.vel = speed * RESTITUTION;
        impact = Math.max(impact, speed);
      } else {
        s.vel = 0;
      }
    }
  }
  return impact;
}
