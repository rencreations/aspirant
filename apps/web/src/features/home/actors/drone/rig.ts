/**
 * The drone's moving parts: two wings, two fins and the glowing strip behind each fin. Nothing is
 * keyed. The wings beat from one phase whose rate and depth rise with speed and effort, they open
 * wide to brake, and they breathe slowly at rest. Every part trails the body a little: a loose
 * spring per part is fed with the drone's acceleration. Taken from `about/choreo/rig.ts`, with a
 * `droop` for the sad faces and no allocation per step (the caller owns the pose it is written to).
 *
 * Angles in radians, in the rig's terms: a wing is spread outward and then raised; a fin stands up
 * (or lies back, negative) and splays outward; the strip's tip leans forward (or back).
 */
import { clamp, mix, swingTo, TAU, type Sprung } from "./ease";

export interface RigPose {
  wingSpreadL: number;
  wingSpreadR: number;
  wingRaiseL: number;
  wingRaiseR: number;
  wingTwistL: number;
  wingTwistR: number;
  finStandL: number;
  finStandR: number;
  finSplayL: number;
  finSplayR: number;
  stripL: number;
  stripR: number;
}

export interface Rig {
  /** The phase of the beat, in radians. */
  phase: number;
  liftL: Sprung;
  liftR: Sprung;
  finBack: Sprung;
  finSide: Sprung;
  strip: Sprung;
  /** How hard the wings are working, smoothed, and how far they are flared. */
  drive: number;
  flare: number;
  /** A happy drone holds its fins up and out; a sad one lets them fall. Both smoothed. */
  glee: number;
  droop: number;
}

export interface RigInput {
  /** How much of a flight the movement is, 0 to 1. */
  fast: number;
  /** Extra work asked for by a trick, 0 to 1. */
  effort: number;
  /** The brake: wings wide open, 0 to 1. */
  flare: number;
  /** The drone's acceleration on the screen, in screens per second squared. */
  ax: number;
  ay: number;
  happy: number;
  droop: number;
  time: number;
}

const deg = (d: number) => (d * Math.PI) / 180;

export function createRig(): Rig {
  const zero = (): Sprung => ({ x: 0, v: 0 });
  return {
    phase: 0,
    liftL: zero(),
    liftR: zero(),
    finBack: zero(),
    finSide: zero(),
    strip: zero(),
    drive: 0,
    flare: 0,
    glee: 0,
    droop: 0,
  };
}

export function createRigInput(): RigInput {
  return { fast: 0, effort: 0, flare: 0, ax: 0, ay: 0, happy: 0, droop: 0, time: 0 };
}

export function createRigPose(): RigPose {
  return {
    wingSpreadL: 0,
    wingSpreadR: 0,
    wingRaiseL: 0,
    wingRaiseR: 0,
    wingTwistL: 0,
    wingTwistR: 0,
    finStandL: 0,
    finStandR: 0,
    finSplayL: 0,
    finSplayR: 0,
    stripL: 0,
    stripR: 0,
  };
}

/** Beats per second: a slow breath at rest, a quick beat in flight. */
function beatRate(drive: number): number {
  return mix(0.42, 5.2, drive);
}

/** One step of the rig. Writes the pose to give the bones into `out`. */
export function stepRig(rig: Rig, input: RigInput, dt: number, out: RigPose): RigPose {
  const want = clamp(Math.max(input.fast, input.effort * 0.9), 0, 1);
  // The beat winds up faster than it winds down.
  rig.drive = mix(rig.drive, want, 1 - Math.exp(-(want > rig.drive ? 9 : 3.2) * dt));
  rig.flare = mix(rig.flare, clamp(input.flare, 0, 1), 1 - Math.exp(-10 * dt));
  rig.glee = mix(rig.glee, clamp(input.happy, 0, 1), 1 - Math.exp(-8 * dt));
  rig.droop = mix(rig.droop, clamp(input.droop, 0, 1), 1 - Math.exp(-6 * dt));
  const d = rig.drive;
  rig.phase = (rig.phase + TAU * beatRate(d) * dt) % TAU;

  // What trails the body. A push to the right lifts the left wing; a drop lifts both.
  const side = clamp(input.ax * 0.07, -0.5, 0.5);
  const drop = clamp(input.ay * 0.08, -0.5, 0.5);
  swingTo(rig.liftL, drop + side, 15, 0.36, dt);
  swingTo(rig.liftR, drop - side, 15, 0.36, dt);
  swingTo(rig.finBack, clamp(-d * 0.3 + drop * 0.6, -0.6, 0.5), 19, 0.3, dt);
  swingTo(rig.finSide, clamp(-input.ax * 0.05, -0.35, 0.35), 19, 0.3, dt);
  swingTo(rig.strip, clamp(-d * 0.25 + drop * 0.9, -0.5, 0.5), 24, 0.22, dt);

  const beat = Math.sin(rig.phase);
  const depth = mix(deg(7), deg(34), d);
  const spread = mix(deg(30), deg(56), d) + deg(5) * d * Math.sin(rig.phase + 1.2);
  // A sad drone lets its wings hang a little lower.
  const raise = mix(deg(13), deg(20), d) + depth * beat - deg(9) * rig.droop;
  const twist = deg(8) + deg(11) * d * Math.cos(rig.phase);
  const flare = rig.flare;

  const wingSpread = spread + deg(24) * flare;
  const wingRaise = raise * (1 - 0.6 * flare) + deg(40) * flare;
  const wingTwist = twist + deg(18) * flare;

  // The fins perk up at rest and for joy, lie back in the wind and fall for sorrow. They also flick.
  const flick = Math.pow(Math.max(0, Math.sin(input.time * 0.9 + 2)), 24) * deg(9);
  const finStand = deg(9) + deg(12) * rig.glee - deg(24) * rig.droop + flick + rig.finBack.x;
  const finSplay = deg(5) + deg(11) * rig.glee + deg(6) * flare - deg(4) * rig.droop;

  out.wingSpreadL = Math.min(deg(96), wingSpread + Math.max(0, rig.liftL.x) * 0.3);
  out.wingSpreadR = Math.min(deg(96), wingSpread + Math.max(0, rig.liftR.x) * 0.3);
  out.wingRaiseL = clamp(wingRaise + rig.liftL.x, deg(-55), deg(78));
  out.wingRaiseR = clamp(wingRaise + rig.liftR.x, deg(-55), deg(78));
  out.wingTwistL = wingTwist;
  out.wingTwistR = wingTwist;
  out.finStandL = clamp(finStand, deg(-30), deg(40));
  out.finStandR = clamp(finStand + flick * 0.5, deg(-30), deg(40));
  out.finSplayL = clamp(finSplay + rig.finSide.x, deg(-12), deg(40));
  out.finSplayR = clamp(finSplay - rig.finSide.x, deg(-12), deg(40));
  out.stripL = clamp(rig.strip.x, deg(-22), deg(22));
  out.stripR = clamp(rig.strip.x * 0.9, deg(-22), deg(22));
  return out;
}
