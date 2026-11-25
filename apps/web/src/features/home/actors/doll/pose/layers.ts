/**
 * The procedural layers of the doll's body: motion that is a pure function of time (and a few
 * numbers a section sets) and that is added to a pose as model-axis turns, in radians, three per
 * bone. Nothing here keeps state, so a jump in time (a scrollbar drag, a frozen frame) is safe.
 *
 * Signs follow the rig notes: a positive turn about +X on a limb that hangs down swings it
 * backward, and the left and right arms rotate about Z with opposite signs.
 */
import { at } from "../motion";

import { boneIndex } from "./math";

const DEG = Math.PI / 180;

export const BONE = {
  hips: boneIndex("Hips"),
  spine02: boneIndex("Spine02"),
  spine01: boneIndex("Spine01"),
  spine: boneIndex("Spine"),
  neck: boneIndex("neck"),
  head: boneIndex("Head"),
  armL: boneIndex("LeftArm"),
  foreL: boneIndex("LeftForeArm"),
  handL: boneIndex("LeftHand"),
  armR: boneIndex("RightArm"),
  foreR: boneIndex("RightForeArm"),
  handR: boneIndex("RightHand"),
  upLegL: boneIndex("LeftUpLeg"),
  legL: boneIndex("LeftLeg"),
  upLegR: boneIndex("RightUpLeg"),
  legR: boneIndex("RightLeg"),
} as const;

function add(turns: Float32Array, bone: number, x: number, y: number, z: number): void {
  const k = bone * 3;
  turns[k] = at(turns, k) + x;
  turns[k + 1] = at(turns, k + 1) + y;
  turns[k + 2] = at(turns, k + 2) + z;
}

/**
 * The flail of a fall: every limb moves at its own rate, so the sum never lines up and never
 * repeats in a way the eye picks out. `amount` 0 to 1 scales every swing, `rate` is a multiplier
 * on the speed (1 is a frantic wave of about two beats a second).
 */
export function addFlail(turns: Float32Array, t: number, amount: number, rate = 1): void {
  if (amount <= 0) return;
  const w = t * rate;
  const a = amount;
  // Arms: a wave about the front-to-back axis and a flap up and down. The flap of the right arm
  // has the opposite sign because the bones are not mirrors.
  add(
    turns,
    BONE.armL,
    a * 38 * DEG * Math.sin(w * 11.3 + 0.3),
    0,
    a * 48 * DEG * Math.sin(w * 8.1 + 1.1),
  );
  add(
    turns,
    BONE.armR,
    a * 38 * DEG * Math.sin(w * 9.7 + 2.2),
    0,
    -a * 48 * DEG * Math.sin(w * 7.3 + 0.2),
  );
  add(turns, BONE.foreL, a * 24 * DEG * Math.sin(w * 13.1 + 0.9), 0, 0);
  add(turns, BONE.foreR, a * 24 * DEG * Math.sin(w * 12.3 + 2.7), 0, 0);
  // Legs: kicks forward and back, a little spread, and knees that only bend one way.
  add(
    turns,
    BONE.upLegL,
    a * 32 * DEG * Math.sin(w * 8.9 + 0.5),
    0,
    a * 14 * DEG * Math.sin(w * 6.1 + 2.0),
  );
  add(
    turns,
    BONE.upLegR,
    a * 32 * DEG * Math.sin(w * 7.9 + 3.3),
    0,
    -a * 14 * DEG * Math.sin(w * 5.3 + 0.7),
  );
  add(turns, BONE.legL, a * 26 * DEG * (0.5 + 0.5 * Math.sin(w * 10.3 + 1.4)), 0, 0);
  add(turns, BONE.legR, a * 26 * DEG * (0.5 + 0.5 * Math.sin(w * 9.1 + 4.0)), 0, 0);
  // The trunk and the head shake along.
  add(
    turns,
    BONE.spine02,
    a * 6 * DEG * Math.sin(w * 6.7 + 0.1),
    0,
    a * 8 * DEG * Math.sin(w * 5.9 + 2.5),
  );
  add(
    turns,
    BONE.head,
    a * 9 * DEG * Math.sin(w * 7.7 + 1.9),
    0,
    a * 10 * DEG * Math.sin(w * 6.3 + 0.6),
  );
}

/**
 * The cartoon sprint (25 Nov 2026): a doll that runs for her life. It is not the baked walk made
 * faster: the legs scissor wide with high knees, the arms are thrown up and swing against the legs,
 * the trunk leans far forward and twists with each stride, and the head bobs. `phase` is in cycles
 * (any real number, one cycle is two strides) and `amount` 0 to 1 scales every swing. It is added on
 * top of the standing pose, so the walk clip is off while it runs (`walk(0)`). A pure function of its
 * two numbers: a jump in time is safe.
 */
export function addSprint(turns: Float32Array, phase: number, amount: number): void {
  if (amount <= 0) return;
  const a = amount;
  const w = phase * Math.PI * 2;
  const s = Math.sin(w);
  const c = Math.cos(w);
  const s2 = Math.sin(2 * w);
  // Legs. A hip turned about +X swings the leg back: forward is negative. The knee bends most while
  // the leg swings through (cos above 0) and hardly at all while it pushes back.
  const swing = (side: 1 | -1) => {
    const t = side * s;
    const tc = side * c;
    return {
      hip: -a * (20 + 56 * t) * DEG,
      knee: a * (14 + 82 * Math.max(0, tc) ** 1.1) * DEG,
    };
  };
  const left = swing(1);
  const right = swing(-1);
  add(turns, BONE.upLegL, left.hip, 0, a * 6 * DEG);
  add(turns, BONE.upLegR, right.hip, 0, -a * 6 * DEG);
  add(turns, BONE.legL, left.knee, 0, 0);
  add(turns, BONE.legR, right.knee, 0, 0);
  // Arms: flung up and forward, swinging against the legs, the forearms flapping at the wrists.
  add(turns, BONE.armL, a * (-112 - 34 * s) * DEG, 0, a * (22 + 10 * c) * DEG);
  add(turns, BONE.armR, a * (-112 + 34 * s) * DEG, 0, -a * (22 - 10 * c) * DEG);
  add(turns, BONE.foreL, a * (-42 - 30 * Math.sin(w + 1.1)) * DEG, 0, 0);
  add(turns, BONE.foreR, a * (-42 + 30 * Math.sin(w + 1.1)) * DEG, 0, 0);
  // The trunk: a hard lean into it, a twist against the hips and a roll with every stride.
  add(turns, BONE.hips, a * 9 * DEG, a * 7 * DEG * s, 0);
  add(turns, BONE.spine, a * 8 * DEG, a * 8 * DEG * s, a * 4 * DEG * c);
  add(turns, BONE.spine02, a * 14 * DEG, a * 10 * DEG * s, a * 5 * DEG * s2);
  // The head is thrown back a little and bobs with each footfall.
  add(turns, BONE.head, a * (-9 + 5 * s2) * DEG, 0, a * 7 * DEG * s);
}

/** A slow breath: the trunk and the head sway a degree. Always on, so a held doll is alive. */
export function addBreath(turns: Float32Array, t: number, amount = 1): void {
  const s = Math.sin(t * 2.2);
  add(turns, BONE.spine02, amount * 0.9 * DEG * s, 0, amount * 0.5 * DEG * Math.sin(t * 1.3));
  add(
    turns,
    BONE.head,
    amount * 0.7 * DEG * Math.sin(t * 2.2 - 0.6),
    0,
    amount * 0.9 * DEG * Math.sin(t * 1.1),
  );
}

/**
 * The run: a forward lean of the trunk and bent elbows, on top of the baked walk. `amount` 0 to 1.
 * The pose's own run contact is a still frame; a running doll is the walk clip at a fast rate with
 * this lean.
 */
export function addRunLean(turns: Float32Array, amount: number): void {
  if (amount <= 0) return;
  add(turns, BONE.spine02, amount * 10 * DEG, 0, 0);
  add(turns, BONE.spine, amount * 6 * DEG, 0, 0);
  add(turns, BONE.foreL, -amount * 55 * DEG, 0, 0);
  add(turns, BONE.foreR, -amount * 55 * DEG, 0, 0);
}

/** The legs of a seated doll swing over an edge: the knees open and close. `phase` is in cycles. */
export function addDangle(turns: Float32Array, t: number, amount: number): void {
  if (amount <= 0) return;
  add(turns, BONE.legL, amount * 14 * DEG * Math.sin(t * 3.1), 0, 0);
  add(turns, BONE.legR, amount * 14 * DEG * Math.sin(t * 3.1 + 1.7), 0, 0);
}

/** The turns of the head spring and the look: a roll, a nod and a turn, in radians. */
export function addHead(turns: Float32Array, roll: number, nod: number, turn: number): void {
  add(turns, BONE.head, nod, turn, roll);
}
