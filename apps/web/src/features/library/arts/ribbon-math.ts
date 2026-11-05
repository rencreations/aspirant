/**
 * How the splash ribbon reacts to the pointer. `d` is the pointer's place against a panel's
 * middle, in panel widths: (pointer x minus middle) divided by the panel's width, so it is
 * positive for a panel that is to the left of the pointer. The panel under the pointer
 * rises and grows, its neighbours step aside a little, and the picture inside slides toward the
 * pointer, so the panels seem to turn toward it. Every result is a transform value.
 */
export interface Pose {
  /** Scale of the panel. */
  scale: number;
  /** Lift in pixels (negative is up). */
  lift: number;
  /** Sideways step in pixels. */
  push: number;
  /** Slide of the picture inside toward the pointer, in percent of its width. */
  slide: number;
}

export const REST: Pose = { scale: 1, lift: 0, push: 0, slide: 0 };

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export function ribbonPose(d: number): Pose {
  const near = Math.exp(-d * d * 1.4);
  const sign = Math.sign(d) || 0;
  const away = Math.abs(d) * Math.exp(-d * d * 0.9);
  return {
    scale: 1 + 0.1 * near,
    lift: -14 * near,
    // A panel to the left of the pointer (d > 0 here means the pointer is to its right) steps left.
    push: -sign * 22 * away + 0, // `+ 0` turns a negative zero into a plain zero
    slide: clamp(d, -1.5, 1.5) * 4,
  };
}
