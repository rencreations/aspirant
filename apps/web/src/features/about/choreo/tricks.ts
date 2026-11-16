import { bump, clamp01, easeInOutSine, easeTurn, springTo, TAU, type Sprung } from "./ease";
import type { FaceName } from "./path";

/**
 * The drone's show: one-shot moves on their own clock. A trick starts only while the drone is
 * travelling, they come in a fixed, varied order with air between them, each takes its direction
 * from the direction of travel, and one that has started always finishes, whatever the scroll
 * does. The same clock plays the answers to a press.
 */
export type TrickKind =
  | "barrel"
  | "frontflip"
  | "backflip"
  | "spin"
  | "wiggle"
  | "loop"
  // The answers to a press.
  | "hop"
  | "roll"
  | "nod"
  | "dizzy";

/** What a trick adds to the drone for this frame. `dx` and `dy` are in widths of the drone. */
interface TrickPose {
  yaw: number;
  pitch: number;
  roll: number;
  dx: number;
  dy: number;
  /** How hard the wings work, 0 to 1, and how far they flare open. */
  effort: number;
  flare: number;
  face: FaceName | null;
}

interface ActiveTrick {
  kind: TrickKind;
  t: number;
  /** Left or right (the way it was travelling), and up or down. */
  dir: number;
}

export interface Tricks {
  active: ActiveTrick | null;
  /** Seconds until the next trick may start. */
  wait: number;
  /** How many have been flown: the place in the order. */
  count: number;
}

/** Seconds each takes. */
export const TRICK_SECONDS: Record<TrickKind, number> = {
  barrel: 0.82,
  frontflip: 0.86,
  backflip: 0.86,
  spin: 0.78,
  wiggle: 0.72,
  loop: 1.08,
  hop: 0.95,
  roll: 0.9,
  nod: 0.85,
  dizzy: 1.6,
};

/** The order of the show. "flip" is a front flip on the way down and a back flip on the way up. */
const ORDER: ReadonlyArray<TrickKind | "flip"> = [
  "barrel",
  "flip",
  "spin",
  "loop",
  "wiggle",
  "barrel",
  "flip",
  "wiggle",
  "spin",
];

/** The air between two tricks, in seconds. */
const SPACING = 0.5;
/** A trick starts only when the drone is really under way: this far into a flight, this fast. */
const START_TRAVELLING = 0.15;
const START_SPEED = 0.22;

export function createTricks(): Tricks {
  return { active: null, wait: 0.2, count: 0 };
}

/** Start a move now (a press, or the opening). Refused while another one is playing. */
export function startTrick(tr: Tricks, kind: TrickKind, dir = 1): boolean {
  if (tr.active) return false;
  tr.active = { kind, t: 0, dir: dir < 0 ? -1 : 1 };
  return true;
}

/**
 * One step of the show's clock. `travelling` is the path's (0 at a station), `speed`, `vx` and
 * `vy` are the drone's own, in screens per second.
 */
export function stepTricks(
  tr: Tricks,
  dt: number,
  flight: { travelling: number; speed: number; vx: number; vy: number },
): void {
  if (tr.active) {
    tr.active.t += dt;
    if (tr.active.t >= TRICK_SECONDS[tr.active.kind]) {
      tr.active = null;
      tr.wait = SPACING;
    }
    return;
  }
  tr.wait = Math.max(0, tr.wait - dt);
  if (tr.wait > 0) return;
  if (flight.travelling < START_TRAVELLING || flight.speed < START_SPEED) return;
  const next = ORDER[tr.count % ORDER.length] ?? "barrel";
  const kind: TrickKind = next === "flip" ? (flight.vy < 0 ? "backflip" : "frontflip") : next;
  tr.active = { kind, t: 0, dir: flight.vx < 0 ? -1 : 1 };
  tr.count += 1;
}

const NONE: TrickPose = {
  yaw: 0,
  pitch: 0,
  roll: 0,
  dx: 0,
  dy: 0,
  effort: 0,
  flare: 0,
  face: null,
};

/** What the show adds to the drone right now. */
export function trickPose(tr: Tricks): TrickPose {
  const a = tr.active;
  if (!a) return NONE;
  const p = clamp01(a.t / TRICK_SECONDS[a.kind]);
  const b = bump(p);
  const pose: TrickPose = { ...NONE, effort: 0.35 + 0.65 * b, face: "happy" };
  switch (a.kind) {
    case "barrel":
      // Over the wing on the side it is flying to.
      pose.roll = -a.dir * TAU * easeTurn(p);
      pose.dy = -0.1 * b;
      break;
    case "roll":
      pose.roll = -a.dir * TAU * easeTurn(p);
      pose.dy = -0.2 * b;
      pose.flare = 0.5 * b;
      pose.face = "squint";
      break;
    case "frontflip":
      pose.pitch = TAU * easeTurn(p);
      pose.dy = -0.16 * b;
      break;
    case "backflip":
      pose.pitch = -TAU * easeTurn(p);
      pose.dy = -0.16 * b;
      break;
    case "spin":
      pose.yaw = a.dir * TAU * easeTurn(p);
      pose.dy = -0.06 * b;
      break;
    case "wiggle":
      pose.roll = Math.sin(TAU * 2.5 * p) * 0.42 * b;
      pose.yaw = Math.sin(TAU * 1.5 * p + 1) * 0.2 * b;
      pose.dy = -0.05 * Math.abs(Math.sin(TAU * 2.5 * p)) * b;
      break;
    case "loop": {
      // A whole circle in the air, on its back at the top.
      const angle = TAU * easeInOutSine(p);
      pose.pitch = -angle;
      pose.dx = a.dir * 0.4 * Math.sin(angle);
      pose.dy = -0.4 * (1 - Math.cos(angle));
      break;
    }
    case "hop":
      // A hop with a turn all the way round, wings wide.
      pose.dy = -0.3 * Math.sin(Math.PI * Math.pow(p, 0.8));
      pose.yaw = a.dir * TAU * easeTurn(clamp01((p - 0.06) / 0.8));
      pose.flare = b;
      break;
    case "nod":
      pose.pitch = Math.sin(TAU * 2 * p) * 0.36 * Math.sqrt(1 - p);
      pose.dy = 0.05 * Math.sin(TAU * 2 * p) * (1 - p);
      pose.flare = 0.3 * b;
      break;
    case "dizzy":
      pose.roll = Math.sin(TAU * 1.5 * p) * 0.5 * (1 - p);
      pose.yaw = Math.sin(TAU * 1.1 * p) * 0.85 * (1 - p);
      pose.dx = Math.sin(TAU * 1.5 * p) * 0.1 * (1 - p);
      pose.effort = 0.2;
      pose.face = p < 0.78 ? "dead" : "squint";
      break;
  }
  return pose;
}

/**
 * The turn in the statement. It is tied to the scroll, as the reference's helmet is: so many
 * radians for a pixel, in the direction of the scroll. But a stop must not leave the drone with
 * its back to the visitor, so when the scroll rests the turn is finished forward to the next
 * whole turn, never taken back, and it picks up from there when the scroll moves again.
 */
interface ScrollSpin {
  goal: number;
  value: Sprung;
  dir: number;
  idle: number;
}

export function createSpin(): ScrollSpin {
  return { goal: 0, value: { x: 0, v: 0 }, dir: 1, idle: 1 };
}

/** The scroll counts as resting below this speed (pixels per second), after this long (seconds). */
const REST_SPEED = 14;
const REST_AFTER = 0.14;
/** The part of a turn past a whole one that is taken back at rest, not finished forward. */
const SETTLE_BACK = 0.07;

/**
 * One step. `moved` is the scroll since the last frame in pixels, `rate` the radians a pixel is
 * worth, `inside` whether the scroll is in the statement's stretch. Returns the turn to add.
 */
export function stepSpin(
  sp: ScrollSpin,
  moved: number,
  inside: boolean,
  rate: number,
  dt: number,
): number {
  if (dt <= 0) return sp.value.x;
  if (inside && Math.abs(moved) / dt > REST_SPEED) {
    sp.goal += moved * rate;
    sp.dir = moved < 0 ? -1 : 1;
    sp.idle = 0;
  } else {
    sp.idle += dt;
    if (sp.idle > REST_AFTER) {
      // Forward to the next whole turn. A turn that is only just past a whole one settles back
      // onto it instead (a last pixel of the scroll must not cost a whole turn more).
      const turns = (sp.goal / TAU) * sp.dir;
      const whole = Math.floor(turns + 1e-6);
      sp.goal = sp.dir * (turns - whole < SETTLE_BACK ? whole : whole + 1) * TAU;
    }
  }
  springTo(sp.value, sp.goal, 6.2, dt);
  // At rest on a whole turn the count starts again, so it never grows without end.
  if (sp.idle > 1 && Math.abs(sp.value.x - sp.goal) < 1e-3 && Math.abs(sp.value.v) < 1e-3) {
    sp.goal = 0;
    sp.value = { x: 0, v: 0 };
  }
  return sp.value.x;
}
