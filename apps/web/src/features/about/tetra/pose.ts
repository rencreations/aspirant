import type { ClipName, MouthName } from "./model";

/**
 * One frame of Tetra, as the performance hands it to the scene. No three here: the performance is
 * plain arithmetic, the scene turns this into bones.
 *
 * A `Turn` is in radians about the doll's own axes: `x` is her left, `y` is up, `z` is forward
 * (toward the visitor when she faces the screen). So for an arm, `z` raises it sideways (positive
 * for her left arm, negative for her right) and a negative `x` swings it forward.
 */
export interface Turn {
  x: number;
  y: number;
  z: number;
}

export interface TetraPose {
  /** Where her feet are on the stage, in metres from her mark: across, up, toward the visitor. */
  x: number;
  y: number;
  z: number;
  /** The whole doll: `yaw` faces the right of the screen, `pitch` tips her forward on her feet. */
  yaw: number;
  pitch: number;
  roll: number;
  /** 1 as modelled, under 1 squashed (and wider), over 1 stretched (and thinner). */
  squash: number;
  /** A clip under the turns, where in it, and how much of it (0 is the rest pose). */
  clip: ClipName | null;
  clipTime: number;
  clipWeight: number;
  hips: Turn;
  spine: Turn;
  head: Turn;
  armL: Turn;
  armR: Turn;
  foreL: Turn;
  foreR: Turn;
  legL: Turn;
  legR: Turn;
  /** The eyes: 0 open to 1 shut, the squeezed "> <" eyes, the wide eyes, the look (-1 to 1). */
  blinkL: number;
  blinkR: number;
  squeeze: number;
  wide: number;
  lookX: number;
  lookY: number;
  /** The mouth's drawing and how big it is drawn, 0 to 1. */
  mouth: MouthName;
  mouthSize: number;
}

const turn = (): Turn => ({ x: 0, y: 0, z: 0 });

export function restPose(): TetraPose {
  return {
    x: 0,
    y: 0,
    z: 0,
    yaw: 0,
    pitch: 0,
    roll: 0,
    squash: 1,
    clip: null,
    clipTime: 0,
    clipWeight: 0,
    hips: turn(),
    spine: turn(),
    head: turn(),
    armL: turn(),
    armR: turn(),
    foreL: turn(),
    foreR: turn(),
    legL: turn(),
    legR: turn(),
    blinkL: 0,
    blinkR: 0,
    squeeze: 0,
    wide: 0,
    lookX: 0,
    lookY: 0,
    mouth: "smile_mouth",
    mouthSize: 0,
  };
}

/** Back to the rest pose, in place (the performance keeps one pose and writes it every frame). */
export function clearPose(p: TetraPose): void {
  Object.assign(p, restPose());
}

/** Where things are on the stage's canvas after a frame, in CSS pixels. */
export interface TetraMarks {
  /** The middle of her face, the top of her head and her chest. */
  head: { x: number; y: number };
  crown: { x: number; y: number };
  chest: { x: number; y: number };
  /** The ground under her, where the shadow lies. */
  ground: { x: number; y: number };
  /** Her two hands (her own right and left). */
  handR: { x: number; y: number };
  handL: { x: number; y: number };
  /** Pixels for a metre at her depth. */
  scale: number;
}
