/**
 * Procedural poses of Silverbolt: a hover (always on, small), the flight loop and the dance. Each
 * is a pure function of a phase (radians) and an amplitude, and writes a `Pose`: angles for the
 * wings, the head, the body and the seven tail bones. The poses are additive, so the actor can mix
 * them by weight (`addScaled`) and nothing pops when a section changes from one to another.
 */

/** Angles in radians. `blade` is ordered like `BLADES`: even indexes are the dragon's left. */
export class Pose {
  wingRoot = 0;
  readonly blade = new Float64Array(6);
  readonly bladeSpread = new Float64Array(6);
  cheekRaise = 0;
  cheekSpread = 0;
  crest = 0;
  tongue = 0;
  headYaw = 0;
  headPitch = 0;
  headRoll = 0;
  bodyYaw = 0;
  bodyPitch = 0;
  bodyRoll = 0;
  /** A rise of the whole body, in metres at the rest scale. */
  bob = 0;
  readonly tailYaw = new Float64Array(7);
  readonly tailPitch = new Float64Array(7);

  reset(): this {
    this.wingRoot = 0;
    this.blade.fill(0);
    this.bladeSpread.fill(0);
    this.cheekRaise = 0;
    this.cheekSpread = 0;
    this.crest = 0;
    this.tongue = 0;
    this.headYaw = 0;
    this.headPitch = 0;
    this.headRoll = 0;
    this.bodyYaw = 0;
    this.bodyPitch = 0;
    this.bodyRoll = 0;
    this.bob = 0;
    this.tailYaw.fill(0);
    this.tailPitch.fill(0);
    return this;
  }

  /** `this += src * w`. */
  addScaled(src: Pose, w: number): this {
    if (w === 0) return this;
    this.wingRoot += src.wingRoot * w;
    for (let i = 0; i < 6; i++) {
      this.blade[i] = this.blade[i]! + src.blade[i]! * w;
      this.bladeSpread[i] = this.bladeSpread[i]! + src.bladeSpread[i]! * w;
    }
    this.cheekRaise += src.cheekRaise * w;
    this.cheekSpread += src.cheekSpread * w;
    this.crest += src.crest * w;
    this.tongue += src.tongue * w;
    this.headYaw += src.headYaw * w;
    this.headPitch += src.headPitch * w;
    this.headRoll += src.headRoll * w;
    this.bodyYaw += src.bodyYaw * w;
    this.bodyPitch += src.bodyPitch * w;
    this.bodyRoll += src.bodyRoll * w;
    this.bob += src.bob * w;
    for (let i = 0; i < 7; i++) {
      this.tailYaw[i] = this.tailYaw[i]! + src.tailYaw[i]! * w;
      this.tailPitch[i] = this.tailPitch[i]! + src.tailPitch[i]! * w;
    }
    return this;
  }
}

/** A wing beat: a slower rise and a sharper down stroke. Between about -1.25 and 1.25. */
export function beat(phase: number): number {
  return Math.sin(phase) + 0.25 * Math.sin(2 * phase + 0.6);
}

/**
 * The hover that is always there: slow breath of the wings, the tail, the head. `phase` is a
 * clock that the actor advances by `dt * breath`, so a faster breath speeds it up without a jump.
 */
export function hoverPose(out: Pose, phase: number): Pose {
  out.reset();
  const t = phase;
  out.wingRoot = 0.05 * Math.sin(t * 1.9);
  for (let i = 0; i < 6; i++) {
    const pair = i >> 1;
    out.blade[i] = 0.06 * Math.sin(t * 1.9 - 0.5 * (pair + 1));
    out.bladeSpread[i] = 0.03 * Math.sin(t * 1.3 + pair);
  }
  out.cheekRaise = 0.03 * Math.sin(t * 1.6);
  out.headPitch = 0.025 * Math.sin(t * 1.1);
  out.headYaw = 0.02 * Math.sin(t * 0.7 + 1);
  out.bodyRoll = 0.02 * Math.sin(t * 0.8);
  out.bob = 0.025 * Math.sin(t * 1.3);
  for (let j = 0; j < 7; j++) {
    out.tailYaw[j] = 0.035 * (0.5 + j / 12) * Math.sin(t * 1.1 - 0.7 * j);
    out.tailPitch[j] = 0.018 * Math.sin(t * 1.4 - 0.9 * j);
  }
  return out;
}

/**
 * The flight loop. `phase` runs 2 PI per wing beat. The six blades follow the wing root with a
 * delay each, so the beat ripples out along the wing; the body rises on the down stroke; the tail
 * trails with a wave that is a half beat slower than the wings and grows toward the tip.
 */
export function flightPose(out: Pose, phase: number, amplitude: number): Pose {
  out.reset();
  const a = amplitude;
  out.wingRoot = a * 0.42 * beat(phase);
  for (let i = 0; i < 6; i++) {
    const pair = i >> 1;
    out.blade[i] = a * 0.5 * beat(phase - 0.55 * (pair + 1));
    out.bladeSpread[i] = a * 0.14 * Math.sin(phase + 1.1 - 0.3 * pair);
  }
  out.cheekRaise = a * 0.14 * Math.sin(phase - 0.3);
  out.cheekSpread = a * 0.08 * Math.sin(phase + 0.8);
  out.crest = a * 0.05 * Math.sin(phase - 0.6);
  out.headPitch = a * 0.07 * Math.sin(phase + 0.8);
  out.bodyPitch = a * 0.05 * Math.sin(phase + 1.6);
  out.bodyRoll = a * 0.07 * Math.sin(phase * 0.5);
  out.bob = a * 0.08 * Math.sin(phase + 1.6);
  for (let j = 0; j < 7; j++) {
    out.tailYaw[j] = a * 0.11 * (0.4 + (0.6 * j) / 6) * Math.sin(phase * 0.5 - 0.75 * j);
    out.tailPitch[j] = a * 0.08 * Math.sin(phase - 0.9 * j - 0.4);
  }
  return out;
}

/**
 * The dance: a bob of the head on every beat, the wings flapping in turn (left, then right), the
 * body swaying from side to side and the tail swishing in a wave. `phase` is 2 PI per bar of two
 * beats.
 */
export function dancePose(out: Pose, phase: number, amplitude: number): Pose {
  out.reset();
  const a = amplitude;
  out.wingRoot = a * 0.22 * Math.sin(2 * phase);
  for (let i = 0; i < 6; i++) {
    const pair = i >> 1;
    const side = i % 2 === 0 ? 0 : Math.PI;
    out.blade[i] = a * 0.55 * beat(phase + side - 0.35 * pair);
    out.bladeSpread[i] = a * 0.16 * Math.sin(2 * phase + pair);
  }
  out.cheekRaise = a * 0.2 * Math.sin(2 * phase);
  out.cheekSpread = a * 0.12 * Math.sin(phase);
  out.crest = a * 0.1 * Math.sin(2 * phase - 0.4);
  out.tongue = a * 0.25 * Math.max(0, Math.sin(2 * phase + 1));
  out.headPitch = a * 0.2 * Math.sin(2 * phase);
  out.headYaw = a * 0.16 * Math.sin(phase);
  out.headRoll = a * 0.12 * Math.sin(phase + 0.5);
  out.bodyRoll = a * 0.2 * Math.sin(phase);
  out.bodyYaw = a * 0.1 * Math.sin(phase + Math.PI / 2);
  out.bodyPitch = a * 0.05 * Math.sin(2 * phase);
  out.bob = a * 0.07 * Math.abs(Math.sin(phase));
  for (let j = 0; j < 7; j++) {
    out.tailYaw[j] = a * 0.15 * (0.4 + (0.6 * j) / 6) * Math.sin(phase - 0.6 * j);
    out.tailPitch[j] = a * 0.07 * Math.sin(2 * phase - 0.8 * j);
  }
  return out;
}

/** The largest absolute angle a pose asks of any joint (a test keeps the poses within the rig's limits). */
export function poseExtent(p: Pose): number {
  let m = Math.max(Math.abs(p.wingRoot), Math.abs(p.cheekRaise), Math.abs(p.headPitch));
  for (let i = 0; i < 6; i++) m = Math.max(m, Math.abs(p.blade[i]!));
  for (let j = 0; j < 7; j++) {
    m = Math.max(m, Math.abs(p.tailYaw[j]!), Math.abs(p.tailPitch[j]!));
  }
  return m;
}
