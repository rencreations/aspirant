import { clamp, mix, swingTo, TAU, type Sprung } from "./ease";

/**
 * The drone's moving parts: two wings, two fins and the glowing strip behind each fin. Nothing is
 * keyed. The wings beat from one phase whose rate and depth rise with speed and effort, they open
 * wide to brake, and they breathe slowly at rest. On top of that every part trails the body a
 * little: a loose spring per part is fed with the drone's acceleration, so a start, a stop and a
 * turn show in the wings and the fins a moment later.
 *
 * (The rig's own file describes a spring solver. It is not used: it resets the bones it owns each
 * frame, so it fights anything that also moves them.)
 *
 * Angles in radians, in the rig's terms: a wing is spread outward and then raised; a fin stands up
 * (or lies back, negative) and splays outward; the strip's tip leans forward (or back).
 */
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

interface Rig {
  /** The phase of the beat, in radians. */
  phase: number;
  /** What trails: the lift of each wing, the fins fore and aft and sideways, the strips. */
  liftL: Sprung;
  liftR: Sprung;
  finBack: Sprung;
  finSide: Sprung;
  strip: Sprung;
  /** How hard the wings are working, smoothed, and how far they are flared. */
  drive: number;
  flare: number;
}

export interface RigInput {
  /** How much of a flight the movement is, 0 to 1 (`flightOf`). */
  fast: number;
  /** Extra work asked for by a trick or the opening, 0 to 1. */
  effort: number;
  /** The brake: wings wide open, 0 to 1. */
  flare: number;
  /** The drone's acceleration on the screen, in screens per second squared. */
  ax: number;
  ay: number;
  /** A happy drone holds its fins up and out, 0 to 1. */
  happy: number;
  time: number;
}

const deg = (d: number) => (d * Math.PI) / 180;

export function createRig(): Rig {
  const zero = () => ({ x: 0, v: 0 });
  return {
    phase: 0,
    liftL: zero(),
    liftR: zero(),
    finBack: zero(),
    finSide: zero(),
    strip: zero(),
    drive: 0,
    flare: 0,
  };
}

/** Beats per second: a slow breath at rest, a quick beat in flight. */
export function beatRate(drive: number): number {
  return mix(0.42, 5.2, drive);
}

/** One step of the rig. Returns the pose to give the bones. */
export function stepRig(rig: Rig, input: RigInput, dt: number): RigPose {
  const want = clamp(Math.max(input.fast, input.effort * 0.9), 0, 1);
  // The beat winds up faster than it winds down.
  rig.drive = mix(rig.drive, want, 1 - Math.exp(-(want > rig.drive ? 9 : 3.2) * dt));
  rig.flare = mix(rig.flare, clamp(input.flare, 0, 1), 1 - Math.exp(-10 * dt));
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
  const raise = mix(deg(13), deg(20), d) + depth * beat;
  const twist = deg(8) + deg(11) * d * Math.cos(rig.phase);
  const flare = rig.flare;

  const wingSpread = spread + deg(24) * flare;
  const wingRaise = raise * (1 - 0.6 * flare) + deg(40) * flare;
  const wingTwist = twist + deg(18) * flare;

  // The fins perk up at rest and for joy, and lie back in the wind. They also flick now and then.
  const flick = Math.pow(Math.max(0, Math.sin(input.time * 0.9 + 2)), 24) * deg(9);
  const finStand = deg(9) + deg(12) * input.happy + flick + rig.finBack.x;
  const finSplay = deg(5) + deg(11) * input.happy + deg(6) * flare;

  return {
    wingSpreadL: Math.min(deg(96), wingSpread + Math.max(0, rig.liftL.x) * 0.3),
    wingSpreadR: Math.min(deg(96), wingSpread + Math.max(0, rig.liftR.x) * 0.3),
    wingRaiseL: clamp(wingRaise + rig.liftL.x, deg(-55), deg(78)),
    wingRaiseR: clamp(wingRaise + rig.liftR.x, deg(-55), deg(78)),
    wingTwistL: wingTwist,
    wingTwistR: wingTwist,
    finStandL: clamp(finStand, deg(-30), deg(40)),
    finStandR: clamp(finStand + flick * 0.5, deg(-30), deg(40)),
    finSplayL: clamp(finSplay + rig.finSide.x, deg(-12), deg(40)),
    finSplayR: clamp(finSplay - rig.finSide.x, deg(-12), deg(40)),
    stripL: clamp(rig.strip.x, deg(-22), deg(22)),
    stripR: clamp(rig.strip.x * 0.9, deg(-22), deg(22)),
  };
}
