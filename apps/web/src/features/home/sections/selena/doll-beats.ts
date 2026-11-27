/**
 * What the Obsidia doll does in Selena's film (26 Nov 2026), as a pure function of the
 * clip's time `t` (the scroll: going up plays it backwards) and the frame's clock `time` (only for the
 * trembles, the shakes and the kicks, whose size `t` decides). The owner's words: when the drone
 * places her in Selena's hand she is confused; then she sees Silverbolt and is scared for her life at
 * once; then, as he comes closer to eat her, she screams and panics. Cute, with a lot of motion.
 *
 *   GIVE to PLACED   she hops off the drone's head into the air over the palm (a tucked hop)
 *   PLACED to SEE    confused: dot eyes, a hand at her chin, the head tilting one way and the other,
 *                    looking round
 *   SEE to SCARED    she sees him: a start (arms thrown out, a jump), the shocked face
 *   SCARED to PANIC  scared: hands at her mouth, knees in, trembling, backing away, eyes on him
 *   PANIC on         screaming and panicking: fists up, arms flailing, legs running in the air,
 *                    the head shaking, the face swapping between the scream and the panic; it goes on
 *                    in his jaws
 *
 * Every window is at least about a tenth of a clip second, so a hard scroll (the film runs at up to
 * about 2.4 clip seconds a second) still draws each change over a few frames.
 */
import type { MoodStep } from "../../actors/doll/face/sequence";
import type { PoseName } from "../../actors/doll/pose/poses";
import { seg, smooth } from "../vp";

/** The doll leaves the drone's seat: from here she is the scene's (clip seconds). */
export const GIVE = 1.38;
/** She is over the palm. */
export const PLACED = 1.7;
/** She sees Silverbolt. */
const SEE = 2.2;
/** The fright has turned to fear. */
const SCARED = 2.45;
/** She screams and panics (Selena draws her hand back to give the order). */
const PANIC = 2.85;
/** The jaws close on her. */
export const CONTACT = 3.75;

/** Her faces, from `GIVE` (the times of `moodAt` are seconds after it). */
export const DOLL_MOODS: readonly MoodStep[] = (() => {
  const steps: MoodStep[] = [
    { face: "smile", hold: 0.12 },
    { face: "confused", blend: 0.14, hold: 0.56 },
    { face: "shocked", blend: 0.08, hold: 0.17 },
    { face: "scared", blend: 0.12, hold: 0.28 },
    { face: "panic", blend: 0.14, hold: 0.2 },
  ];
  // Then the scream and the panic in turn, on into the jaws (a change of eyes hides behind a blink).
  for (let i = 0; i < 5; i += 1) {
    steps.push({ face: i % 2 === 0 ? "scream" : "panic", blend: 0.1, hold: 0.34 });
  }
  return steps;
})();

/** Her body's poses: each arrives from the one before over `blend` clip seconds, ending at `at`. */
const POSE_KEYS: ReadonlyArray<{ at: number; pose: PoseName; blend: number }> = [
  { at: GIVE, pose: "ride", blend: 0 },
  { at: 1.52, pose: "hop", blend: 0.14 },
  { at: 1.72, pose: "stand", blend: 0.14 },
  { at: 1.88, pose: "puzzle", blend: 0.14 },
  { at: 2.29, pose: "startle", blend: 0.08 },
  { at: 2.57, pose: "cower", blend: 0.14 },
  { at: 3.0, pose: "scream", blend: 0.14 },
];

interface DollBeat {
  poseA: PoseName;
  poseB: PoseName;
  poseW: number;
  flail: number;
  sprint: number;
  sprintPhase: number;
  /** Squash below 0, stretch above. */
  squash: number;
  /** Up and to the screen's right, in her standing heights, on top of where the scene floats her. */
  lift: number;
  side: number;
  /** Her body: a turn to her left (the screen's right) and a roll in the plane of the picture, radians. */
  yaw: number;
  roll: number;
  /** Her head on top of its springs, radians (`DollActor.headTurn`). */
  headRoll: number;
  headNod: number;
  headTurn: number;
  /** Her eyes, -1 to 1 (`DollActor.gaze`). */
  gazeX: number;
  gazeY: number;
  /** How much the screaming mouth works. */
  talk: number;
}

export function newDollBeat(): DollBeat {
  return {
    poseA: "ride",
    poseB: "ride",
    poseW: 0,
    flail: 0,
    sprint: 0,
    sprintPhase: 0,
    squash: 0,
    lift: 0,
    side: 0,
    yaw: 0,
    roll: 0,
    headRoll: 0,
    headNod: 0,
    headTurn: 0,
    gazeX: 0,
    gazeY: 0,
    talk: 0,
  };
}

/** A bump: 0 at both ends of the window, 1 in its middle. */
const bump = (t: number, a: number, b: number): number => Math.sin(Math.PI * seg(t, a, b));

/**
 * The doll at clip time `t`. `time` is the frame's clock (seconds). `toward` is where Silverbolt is
 * from her on the screen, -1 (left) to 1 (right), and `up` the same upward: her eyes go there once
 * she has seen him.
 */
export function dollBeatAt(
  t: number,
  time: number,
  toward: number,
  up: number,
  out: DollBeat = newDollBeat(),
): DollBeat {
  // The pose: the two keys around `t`.
  let a: PoseName = POSE_KEYS[0]!.pose;
  let b: PoseName = a;
  let w = 0;
  for (let i = 1; i < POSE_KEYS.length; i += 1) {
    const key = POSE_KEYS[i]!;
    const prev = POSE_KEYS[i - 1]!;
    if (t >= key.at) {
      a = key.pose;
      b = key.pose;
      w = 0;
      continue;
    }
    if (t > key.at - key.blend) {
      a = prev.pose;
      b = key.pose;
      w = smooth(seg(t, key.at - key.blend, key.at));
    }
    break;
  }
  out.poseA = a;
  out.poseB = b;
  out.poseW = w;

  // How much of each part of the story is on.
  const confused =
    smooth(seg(t, PLACED - 0.05, PLACED + 0.1)) * (1 - smooth(seg(t, SEE, SEE + 0.08)));
  const seen = smooth(seg(t, SEE, SEE + 0.08));
  const scared =
    smooth(seg(t, SCARED - 0.1, SCARED + 0.05)) * (1 - smooth(seg(t, PANIC, PANIC + 0.15)));
  const panic = smooth(seg(t, PANIC, PANIC + 0.2));

  // The hop off the drone: up about half her height and down into the air over the palm, a
  // stretch on the way up and a squash on the landing. Then the start: a jump straight up.
  const hop = 0.4 * bump(t, GIVE, PLACED);
  const start = 0.42 * bump(t, SEE + 0.02, SCARED + 0.04);
  // A floating doll in a panic bounces as she runs in the air.
  const bounce = 0.06 * panic * Math.abs(Math.sin(time * 9.5));
  out.lift = hop + start + bounce;
  out.squash =
    0.16 * bump(t, GIVE, GIVE + 0.14) -
    0.24 * bump(t, PLACED - 0.08, PLACED + 0.12) +
    0.2 * bump(t, SEE + 0.02, SEE + 0.12) -
    0.2 * bump(t, SCARED - 0.04, SCARED + 0.1);

  // Confused: the head tilts one way then the other, she looks round (left, then right), a small
  // shrug of the body. The eyes lead the head.
  const c = seg(t, PLACED, SEE);
  const look = Math.sin(2 * Math.PI * c);
  const tilt = Math.sin(Math.PI * 2 * c + 0.6);
  // Fear: trembling, the head shaking, eyes fixed on him, backing away from his side.
  const tremble = scared * (0.6 + 0.4 * Math.sin(time * 3.1));
  const shiver = Math.sin(time * 47) * 0.6 + Math.sin(time * 31 + 1.3) * 0.4;
  const no = Math.sin(time * 17);

  out.side =
    -0.28 * toward * smooth(seg(t, SCARED, PANIC)) * (1 - 0.5 * panic) +
    0.018 * tremble * shiver +
    0.035 * panic * Math.sin(time * 11.3);
  // Her face stays to the lens: the body and the head turn a little, the eyes do the looking.
  out.yaw =
    confused * 0.14 * look +
    seen * 0.12 * toward * (1 - 0.6 * panic) +
    panic * 0.18 * Math.sin(time * 7.1);
  out.roll = confused * 0.08 * tilt + scared * 0.03 * shiver + panic * 0.12 * Math.sin(time * 12.7);
  out.headRoll = confused * 0.3 * tilt + panic * 0.08 * no;
  out.headNod =
    confused * -0.08 * (0.5 + 0.5 * Math.cos(2 * Math.PI * c)) + scared * 0.08 - panic * 0.12;
  out.headTurn =
    confused * 0.3 * look +
    seen * 0.16 * toward * (1 - panic) +
    scared * 0.05 * shiver +
    panic * 0.38 * no;
  out.gazeX =
    confused * Math.sin(2 * Math.PI * c + 0.35) +
    seen * toward * (1 - 0.5 * panic) +
    panic * 0.5 * Math.sin(time * 21);
  out.gazeY = confused * 0.25 * Math.cos(4 * Math.PI * c) + seen * up * (1 - 0.5 * panic);

  // The panic: arms flailing, legs running in the air, the screaming mouth working.
  out.flail = 0.85 * panic;
  out.sprint = 0.7 * smooth(seg(t, PANIC + 0.05, PANIC + 0.3));
  out.sprintPhase = time * 3.4;
  out.talk = panic * (0.55 + 0.45 * Math.sin(time * 23));
  return out;
}
