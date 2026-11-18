import { TAU, clamp01, ramp } from "./ease";
import { clearChannels, type Channels } from "./channels";
import type { FaceName } from "./face";

/**
 * Tetra's named poses, as functions of time. Each writes the absolute channels of the pose into one
 * object (it clears it first), and says what face goes with it. Pure arithmetic, no three. The
 * actor blends between them, so a pose never has to know what came before.
 *
 * Her model has no feet, no fingers and no brows, and short stubby legs: every move is carried by
 * the whole body (a lean, a hip, a swing of the arms, a squash), and by the face. The turns are
 * about her own axes (see `channels.ts`): for an arm, `z` raises it sideways and a negative `x`
 * swings it forward; for a leg, a negative `x` swings it forward; for the spine, a positive `x`
 * leans it forward; for the head, a positive `x` nods down.
 */
export type PoseName =
  | "idle"
  | "kite"
  | "run"
  | "pant"
  | "wave"
  | "sit"
  | "read"
  | "close"
  | "stand"
  | "bend"
  | "pat"
  | "hug";

export type BendKind = "earth" | "air" | "water" | "fire";

export interface PoseInput {
  /** Her own clock, in seconds (breathing, flow). */
  time: number;
  /** The run cycle, in turns. */
  phase: number;
  /** How fast she runs, 0 (a stand) to 1 (flat out). */
  speed: number;
  /** Which hand waves: -1 her right (the left of the screen), 1 her left. */
  side: number;
  /** The bending stance, how far the stance is worn (0 to 1), where it is aimed (-1 to 1) and its clock in turns. */
  bend: { kind: BendKind; aim: number; phase: number };
  /** Which side a pat comes from (-1 her right, 1 her left) and how far her head is leaned into it. */
  pat: { side: number; lean: number };
  /** The place a hug goes to, in her own frame (metres). */
  hug: { x: number; y: number; z: number };
}

export function createPoseInput(): PoseInput {
  return {
    time: 0,
    phase: 0,
    speed: 1,
    side: 1,
    bend: { kind: "water", aim: 0, phase: 0 },
    pat: { side: 1, lean: 1 },
    hug: { x: 0, y: 0.25, z: 0.2 },
  };
}

/** The face each pose wears if a section asks for none. */
export const POSE_FACE: Readonly<Record<PoseName, FaceName>> = {
  idle: "neutral",
  kite: "happy",
  run: "angry",
  pant: "tired",
  wave: "tired",
  sit: "neutral",
  read: "reading",
  close: "happy",
  stand: "focused",
  bend: "focused",
  pat: "happy",
  hug: "happy",
};

/** The pose of a body at rest: she breathes, shifts her weight, and the hair does the rest. */
function idle(i: PoseInput, c: Channels): void {
  const t = i.time;
  const breath = Math.sin(TAU * 0.3 * t);
  const shift = Math.sin(TAU * 0.09 * t + 0.6);
  c.squash = 1 + 0.011 * breath;
  c.spine.x = 0.022 * Math.sin(TAU * 0.3 * t + 0.7);
  c.hips.z = 0.035 * shift;
  c.legL.z = c.legR.z = -0.035 * shift;
  c.spine.z = -0.02 * shift;
  c.armL.z = 0.06 + 0.035 * breath;
  c.armR.z = -0.06 - 0.035 * Math.sin(TAU * 0.3 * t + 0.5);
  c.armL.x = 0.04 * Math.sin(TAU * 0.17 * t);
  c.armR.x = 0.04 * Math.sin(TAU * 0.17 * t + 2);
  c.head.z = 0.025 * Math.sin(TAU * 0.13 * t + 1.3);
}

/**
 * She flies a kite: both hands on the reel in front of her chest, leaning back against the pull,
 * looking up at it, the wind tugging at her. The pull comes in gusts.
 */
function kite(i: PoseInput, c: Channels): void {
  const t = i.time;
  const gust = 0.5 + 0.5 * Math.sin(TAU * 0.23 * t) * Math.sin(TAU * 0.61 * t + 1);
  c.spine.x = -0.2 - 0.06 * gust;
  c.spine2.x = -0.08;
  c.hips.x = 0.05;
  c.neck.x = -0.12;
  c.head.x = -0.2;
  c.head.z = 0.04 * Math.sin(TAU * 0.31 * t);
  // Feet apart, a little crouch, heels dug in.
  c.legL.z = 0.14;
  c.legR.z = -0.14;
  c.legL.x = -0.12;
  c.legR.x = 0.06;
  c.kneeL.x = 0.12;
  c.kneeR.x = 0.1;
  c.squash = 1 - 0.01 * gust;
  c.pitch = -0.04 * gust;
  c.reachL.x = 0.045;
  c.reachL.y = 0.27;
  c.reachL.z = 0.16;
  c.reachL.w = 1;
  c.reachR.x = -0.045;
  c.reachR.y = 0.29;
  c.reachR.z = 0.16;
  c.reachR.w = 1;
}

/**
 * A run, in profile: legs scissor and fold, arms pump with the elbows bent, the body leans into it
 * and bounces. `phase` is turns of the cycle, `speed` how hard.
 */
function run(i: PoseInput, c: Channels): void {
  const s = clamp01(i.speed);
  const a = TAU * i.phase;
  const sw = Math.sin(a);
  const co = Math.cos(a);
  const bounce = Math.abs(Math.sin(a));
  c.yaw = 0.62;
  c.pitch = 0.04 + 0.08 * s;
  c.y = 0.05 * s * bounce;
  c.squash = 1 - 0.05 * s * (1 - bounce) * 0.6 + 0.03 * s * bounce;
  c.spine.x = 0.1 + 0.18 * s;
  c.spine.y = -0.2 * sw * s;
  c.hips.y = 0.2 * sw * s;
  c.neck.x = -0.12;
  c.head.x = -0.2 - 0.1 * s;
  c.head.y = -0.4;
  // Legs: one forward as the other goes back, the shin folding up behind the one that is off the ground.
  const swing = 0.55 + 0.55 * s;
  c.legL.x = -swing * sw;
  c.legR.x = swing * sw;
  c.kneeL.x = (0.2 + 1.2 * s) * (0.5 + 0.5 * Math.sin(a + 1.1)) * (sw > -0.6 ? 1 : 0.5);
  c.kneeR.x = (0.2 + 1.2 * s) * (0.5 - 0.5 * Math.sin(a - 1.1)) * (sw < 0.6 ? 1 : 0.5);
  // Arms pump against the legs with the forearms folded: furious, fists up.
  const pump = 0.5 + 0.55 * s;
  c.armL.x = pump * sw;
  c.armR.x = -pump * sw;
  c.armL.z = 0.25;
  c.armR.z = -0.25;
  c.foreL.x = -0.9 - 0.2 * co;
  c.foreR.x = -0.9 + 0.2 * co;
}

/** Bent over, hands on her knees, the whole body heaving with each breath. */
function pant(i: PoseInput, c: Channels): void {
  const t = i.time;
  const heave = Math.sin(TAU * 0.9 * t);
  const up = 0.5 + 0.5 * heave;
  c.spine.x = 0.45 + 0.07 * up;
  c.spine2.x = 0.2 + 0.05 * up;
  c.neck.x = -0.38;
  c.head.x = -0.32;
  c.head.z = 0.03 * Math.sin(TAU * 0.45 * t);
  c.hips.x = 0.1;
  c.legL.x = -0.4;
  c.legR.x = -0.35;
  c.kneeL.x = 0.5;
  c.kneeR.x = 0.45;
  c.legL.z = 0.08;
  c.legR.z = -0.08;
  c.y = -0.03;
  c.squash = 1 + 0.03 * heave;
  c.shoulderL.z = 0.1 * up;
  c.shoulderR.z = -0.1 * up;
  c.reachL.x = 0.08;
  c.reachL.y = 0.17;
  c.reachL.z = 0.14;
  c.reachL.w = 1;
  c.reachR.x = -0.08;
  c.reachR.y = 0.17;
  c.reachR.z = 0.14;
  c.reachR.w = 1;
}

/** A tired wave at the visitor, facing them: the arm up and slow, the other hand on her side. */
function wave(i: PoseInput, c: Channels): void {
  const t = i.time;
  const flap = Math.sin(TAU * 1.5 * t);
  const lag = Math.sin(TAU * 1.5 * t - 1.5);
  const side = i.side < 0 ? -1 : 1;
  const arm = side < 0 ? c.armR : c.armL;
  const fore = side < 0 ? c.foreR : c.foreL;
  arm.z = side * (1.14 + 0.22 * flap);
  arm.y = -side * 0.5;
  fore.z = side * (0.42 + 0.4 * lag);
  const other = side < 0 ? c.armL : c.armR;
  other.z = -side * 0.3;
  const heave = Math.sin(TAU * 0.9 * t);
  c.spine.x = 0.22 + 0.04 * heave;
  c.neck.x = -0.1;
  c.head.z = 0.1 * side * Math.sin(TAU * 0.4 * t);
  c.squash = 1 + 0.025 * heave;
  c.legL.x = -0.1;
  c.legR.x = -0.1;
  c.kneeL.x = 0.2;
  c.kneeR.x = 0.2;
  c.y = -0.012;
}

/** Cross-legged on the ground, hands in her lap, breathing. */
function sit(i: PoseInput, c: Channels): void {
  const t = i.time;
  const breath = Math.sin(TAU * 0.3 * t);
  c.y = -0.145;
  c.squash = 1 + 0.01 * breath;
  c.hips.x = -0.02;
  c.spine.x = 0.03 + 0.015 * breath;
  c.legL.x = -1.35;
  c.legR.x = -1.35;
  c.legL.z = 0.7;
  c.legR.z = -0.7;
  c.kneeL.x = 2.1;
  c.kneeR.x = 2.1;
  c.legL.y = -0.55;
  c.legR.y = 0.55;
  c.armL.x = -0.55;
  c.armR.x = -0.55;
  c.armL.z = 0.12;
  c.armR.z = -0.12;
  c.foreL.x = -0.7;
  c.foreR.x = -0.7;
  c.head.z = 0.025 * Math.sin(TAU * 0.13 * t + 1.3);
}

/** Sitting with the book held open in both hands, head bowed over it. */
function read(i: PoseInput, c: Channels): void {
  sit(i, c);
  const t = i.time;
  c.spine.x = 0.13;
  c.neck.x = 0.02;
  c.head.x = 0.08;
  c.head.y = 0.04 * Math.sin(TAU * 0.11 * t);
  c.reachL.x = 0.12;
  c.reachL.y = 0.2;
  c.reachL.z = 0.17;
  c.reachL.w = 1;
  c.reachR.x = -0.12;
  c.reachR.y = 0.2;
  c.reachR.z = 0.17;
  c.reachR.w = 1;
}

/** The book shut and held low, a little pleased, before she gets up. */
function close(i: PoseInput, c: Channels): void {
  sit(i, c);
  c.spine.x = 0.06;
  c.head.x = -0.08;
  c.reachL.x = 0.1;
  c.reachL.y = 0.12;
  c.reachL.z = 0.19;
  c.reachL.w = 1;
  c.reachR.x = -0.1;
  c.reachR.y = 0.12;
  c.reachR.z = 0.19;
  c.reachR.w = 1;
}

/** The ready stance before the bending: feet apart, knees soft, fists up. */
function stand(i: PoseInput, c: Channels): void {
  const t = i.time;
  const breath = Math.sin(TAU * 0.4 * t);
  c.squash = 1 + 0.012 * breath;
  c.legL.z = 0.17;
  c.legR.z = -0.17;
  c.kneeL.x = 0.18;
  c.kneeR.x = 0.18;
  c.legL.x = -0.09;
  c.legR.x = -0.09;
  c.y = -0.012;
  c.spine.x = 0.05;
  c.armL.z = 0.55;
  c.armR.z = -0.55;
  c.armL.x = -0.2;
  c.armR.x = -0.2;
  c.foreL.z = 0.5;
  c.foreR.z = -0.5;
}

/**
 * The bending stances: a wide base, a pivot of the hips and a gesture of the arms. `u` runs 0 to 1
 * over a cycle. She faces the camera, so a push or a punch toward it would be lost: every stance
 * is turned a little toward `aim` (-1 left to 1 right) and gestures up and out, where it can be read.
 */
function bend(i: PoseInput, c: Channels): void {
  stand(i, c);
  const { kind, aim, phase } = i.bend;
  const u = ((phase % 1) + 1) % 1;
  const a = TAU * u;
  const toward = aim < 0 ? -1 : 1;
  // A wide base for every stance: feet apart, knees soft.
  c.legL.z = 0.42;
  c.legR.z = -0.42;
  c.legL.x = -0.12;
  c.legR.x = -0.12;
  c.kneeL.x = 0.28;
  c.kneeR.x = 0.28;
  c.y = -0.03;
  if (kind === "earth") {
    // Down into the stance, then up and a stamp, then both palms push the ground away.
    const lift = ramp(0.1, 0.3, u) * (1 - ramp(0.3, 0.42, u));
    const slam = ramp(0.4, 0.46, u) * (1 - ramp(0.46, 0.7, u));
    const push = ramp(0.46, 0.6, u) * (1 - ramp(0.85, 1, u));
    c.yaw = toward * (0.35 + 0.35 * Math.abs(aim));
    c.y += 0.045 * lift - 0.025 * slam;
    c.squash = 1 + 0.04 * lift - 0.07 * slam;
    c.legL.z = 0.42 + 0.2 * slam;
    c.legR.z = -0.42 - 0.2 * slam;
    c.hips.y = 0.25 * toward * (1 - push) + 0.2 * Math.sin(a);
    c.spine.x = 0.08 + 0.14 * push;
    c.spine2.x = 0.05 + 0.1 * push;
    c.armL.z = 0.55 + 0.5 * lift - 0.35 * push;
    c.armR.z = -0.55 - 0.5 * lift + 0.35 * push;
    c.armL.x = -0.2 - 1.3 * push;
    c.armR.x = -0.2 - 1.3 * push;
    c.foreL.z = 0.4 * (1 - push);
    c.foreR.z = -0.4 * (1 - push);
    c.wristL.z = 0.5 * push;
    c.wristR.z = -0.5 * push;
    c.head.x = 0.1 * slam;
  } else if (kind === "air") {
    // Arms sweep up and over in turn like pushing a wave across the sky, the body leaning into each.
    const s1 = Math.sin(a);
    const s2 = Math.sin(a + Math.PI);
    c.yaw = toward * 0.25 * Math.sin(a * 0.5);
    c.hips.y = 0.4 * toward * s1;
    c.spine.z = -0.3 * s1;
    c.spine2.z = -0.12 * s1;
    c.roll = -0.07 * s1;
    c.armL.z = 1.35 + 0.95 * s1;
    c.armR.z = -(1.35 + 0.95 * s2);
    c.armL.y = -0.5 * Math.cos(a);
    c.armR.y = 0.5 * Math.cos(a);
    c.foreL.z = 0.45 * Math.sin(a - 1);
    c.foreR.z = -0.45 * Math.sin(a + Math.PI - 1);
    c.legL.z = 0.35 + 0.15 * Math.max(0, s1);
    c.legR.z = -0.35 - 0.15 * Math.max(0, s2);
    c.head.z = 0.18 * s1;
  } else if (kind === "water") {
    // Flow: the spine ripples, the arms follow it in a wave from the shoulder to the wrist.
    c.yaw = toward * 0.2 * Math.sin(a);
    c.hips.y = 0.3 * Math.sin(a);
    c.hips.z = -0.14 * Math.sin(a + 0.5);
    c.spine.z = 0.3 * Math.sin(a - 0.2);
    c.spine2.z = 0.22 * Math.sin(a - 1.1);
    c.head.z = -0.22 * Math.sin(a - 0.6);
    c.armL.z = 1.0 + 0.6 * Math.sin(a - 0.4);
    c.armR.z = -1.0 - 0.6 * Math.sin(a + Math.PI - 0.4);
    c.armL.x = -0.35 + 0.35 * Math.sin(a - 0.9);
    c.armR.x = -0.35 + 0.35 * Math.sin(a + Math.PI - 0.9);
    c.foreL.z = 0.7 * Math.sin(a - 1.5);
    c.foreR.z = -0.7 * Math.sin(a + Math.PI - 1.5);
    c.wristL.z = 0.9 * Math.sin(a - 2.4);
    c.wristR.z = -0.9 * Math.sin(a + Math.PI - 2.4);
    c.y += 0.02 * Math.sin(2 * a);
  } else {
    // Fire: alternate strikes up and out. The hips turn into each, the other fist is at her side.
    const l = ramp(0, 0.08, u) * (1 - ramp(0.12, 0.3, u));
    const r = ramp(0.5, 0.58, u) * (1 - ramp(0.62, 0.8, u));
    c.yaw = toward * 0.3 + 0.35 * (r - l);
    c.hips.y = -0.5 * l + 0.5 * r;
    c.spine.y = -0.3 * l + 0.3 * r;
    c.roll = 0.09 * (l - r);
    c.armL.z = 0.35 + 1.9 * l;
    c.armR.z = -0.35 - 1.9 * r;
    c.armL.x = -0.3 * l;
    c.armR.x = -0.3 * r;
    c.foreL.z = 0.9 * (1 - l);
    c.foreR.z = -0.9 * (1 - r);
    c.foreL.x = -0.5 * (1 - l);
    c.foreR.x = -0.5 * (1 - r);
    c.y += -0.02 * (l + r);
    c.squash = 1 - 0.04 * (l + r);
    c.legL.z = 0.42 + 0.12 * l;
    c.legR.z = -0.42 - 0.12 * r;
  }
}

/** A hand on her head: she leans her head into it, squeezes her shoulders and her eyes shut. */
function pat(i: PoseInput, c: Channels): void {
  idle(i, c);
  const { side, lean } = i.pat;
  const k = clamp01(lean);
  c.head.z = 0.25 * side * k;
  c.head.x = 0.22 * k;
  c.neck.z = 0;
  c.spine.z = 0.05 * side * k;
  c.shoulderL.z = 0.1 * k;
  c.shoulderR.z = -0.1 * k;
  c.armL.z = 0.1 + 0.15 * k;
  c.armR.z = -0.1 - 0.15 * k;
  c.legL.x = -0.06 * k;
  c.legR.x = -0.06 * k;
  c.kneeL.x = 0.12 * k;
  c.kneeR.x = 0.12 * k;
  c.y = -0.007 * k;
  c.squash = 1 - 0.025 * k + 0.012 * Math.sin(TAU * 0.5 * i.time);
}

/** Both arms go round something in front of her, and squeeze. */
function hug(i: PoseInput, c: Channels): void {
  idle(i, c);
  const t = i.time;
  const squeeze = 0.5 + 0.5 * Math.sin(TAU * 0.7 * t);
  const { x, y, z } = i.hug;
  c.spine.x = 0.1;
  c.head.x = 0.08;
  c.head.z = 0.05 * Math.sin(TAU * 0.3 * t);
  c.legL.x = -0.05;
  c.legR.x = -0.05;
  c.kneeL.x = 0.1;
  c.kneeR.x = 0.1;
  c.y = -0.006;
  c.squash = 1 - 0.015 * squeeze;
  c.reachL.x = x + 0.06 - 0.012 * squeeze;
  c.reachL.y = y;
  c.reachL.z = z;
  c.reachL.w = 1;
  c.reachR.x = x - 0.06 + 0.012 * squeeze;
  c.reachR.y = y;
  c.reachR.z = z;
  c.reachR.w = 1;
}

const POSES: Readonly<Record<PoseName, (i: PoseInput, c: Channels) => void>> = {
  idle,
  kite,
  run,
  pant,
  wave,
  sit,
  read,
  close,
  stand,
  bend,
  pat,
  hug,
};

/** Write the pose `name` at `input` into `out` (cleared first). */
export function composePose(name: PoseName, input: PoseInput, out: Channels): void {
  clearChannels(out);
  POSES[name](input, out);
}
