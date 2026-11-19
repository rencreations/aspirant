/**
 * The timing of the one mark the drone makes by itself: the shock mark (a burst of radial lines and
 * a bang, a shake, a fade). A pure function of the time since the mark started, so it can be tested
 * and so a held frame is the same as a played one. No three here.
 */
import { clamp01, easeOutBack, ramp } from "./ease";

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
/** The shortest life a shock mark may be asked for (the pop and the burst need this long). */
export const SHOCK_MIN_SECONDS = 0.45;

export function createShockLook(): ShockLook {
  return { bang: 0, bangRot: 0, bangAlpha: 0, burst: 0, lineAlpha: 0 };
}

/** The shock mark `t` seconds after it began, with a life of `life` seconds. */
export function shockAt(t: number, out: ShockLook, life = SHOCK_SECONDS): ShockLook {
  if (t < 0 || t >= life) {
    out.bang = 0;
    out.bangRot = 0;
    out.bangAlpha = 0;
    out.burst = 0;
    out.lineAlpha = 0;
    return out;
  }
  const left = clamp01((life - t) / 0.3);
  out.bang = easeOutBack(t / 0.17, 2.6);
  out.bangRot = Math.sin(t * 46) * 0.12 * Math.exp(-t * 7);
  out.bangAlpha = ramp(0, 1, left) * clamp01(t / 0.04);
  // The lines fly out fast, and are gone before the bang is.
  const out01 = clamp01(t / 0.3);
  out.burst = 1 - (1 - out01) * (1 - out01) * (1 - out01);
  out.lineAlpha = (1 - ramp(0.25, 0.7, t)) * clamp01(t / 0.03);
  return out;
}
