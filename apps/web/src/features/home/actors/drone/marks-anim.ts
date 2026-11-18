/**
 * The timing of the two marks the drone makes by itself: the speech bubble that holds one icon (a
 * pop with a little overshoot, a wobble that dies away, a slow drift up, a fade) and the shock mark
 * (a burst of radial lines and a bang, a shake, a fade). Pure functions of the time since the mark
 * started, so they can be tested and so a held frame is the same as a played one. No three here.
 */
import { clamp01, easeOutBack, ramp } from "./ease";

export interface BubbleLook {
  /** 0 to about 1.1: the size of the bubble. */
  scale: number;
  /** Radians, anticlockwise. */
  rot: number;
  alpha: number;
  /** How far it has drifted up, in sizes of the bubble. */
  lift: number;
}

export const BUBBLE_SECONDS = 1.7;
const POP = 0.24;
const BUBBLE_FADE = 0.3;

export function createBubbleLook(): BubbleLook {
  return { scale: 0, rot: 0, alpha: 0, lift: 0 };
}

/** The bubble `t` seconds after it was asked for, with a life of `life` seconds. */
export function bubbleAt(t: number, life: number, out: BubbleLook): BubbleLook {
  if (t < 0 || t >= life) {
    out.scale = 0;
    out.rot = 0;
    out.alpha = 0;
    out.lift = 0;
    return out;
  }
  const left = life - t;
  const fade = clamp01(left / BUBBLE_FADE);
  out.scale = easeOutBack(t / POP, 2.1) * (0.9 + 0.1 * ramp(0, 1, fade));
  out.rot = Math.sin(t * 17) * 0.16 * Math.exp(-t * 4.5);
  out.alpha = ramp(0, 1, fade) * clamp01(t / 0.06);
  out.lift = 0.06 * ramp(0, life, t);
  return out;
}

export interface ShockLook {
  /** The bang's size, 0 to about 1.3. */
  bang: number;
  bangRot: number;
  bangAlpha: number;
  /** How far out the lines have burst, 0 to 1, and how visible they are. */
  burst: number;
  lineAlpha: number;
}

export const SHOCK_SECONDS = 1.15;

export function createShockLook(): ShockLook {
  return { bang: 0, bangRot: 0, bangAlpha: 0, burst: 0, lineAlpha: 0 };
}

/** The shock mark `t` seconds after it began. */
export function shockAt(t: number, out: ShockLook): ShockLook {
  if (t < 0 || t >= SHOCK_SECONDS) {
    out.bang = 0;
    out.bangRot = 0;
    out.bangAlpha = 0;
    out.burst = 0;
    out.lineAlpha = 0;
    return out;
  }
  const left = clamp01((SHOCK_SECONDS - t) / 0.3);
  out.bang = easeOutBack(t / 0.17, 2.6);
  out.bangRot = Math.sin(t * 46) * 0.12 * Math.exp(-t * 7);
  out.bangAlpha = ramp(0, 1, left) * clamp01(t / 0.04);
  // The lines fly out fast, and are gone before the bang is.
  const out01 = clamp01(t / 0.3);
  out.burst = 1 - (1 - out01) * (1 - out01) * (1 - out01);
  out.lineAlpha = (1 - ramp(0.25, 0.7, t)) * clamp01(t / 0.03);
  return out;
}
