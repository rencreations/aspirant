/**
 * The text wheel of the five pairs (the tib "text wheel": a barrel of lines of which one is in
 * focus). Pure arithmetic: `wheelItem(r)` says where the item `r` places away from the focus
 * (r = 0 is in focus, 1 is the next one down) goes, with a transform and an opacity only.
 */
import { BEAT, WHEEL_FROM, WHEEL_ITEMS, WHEEL_STEP } from "./stations";

export interface WheelItem {
  /** Vertical distance in em (the font size of the item). */
  y: number;
  /** Depth in px, negative is away. */
  z: number;
  scale: number;
  /** The tilt about the horizontal axis, degrees. */
  rotX: number;
  opacity: number;
}

/** The vertical spacing of the lines, in em. */
const SPACING = 1.12;

export function wheelItem(r: number, out: WheelItem): WheelItem {
  const a = Math.abs(r);
  out.y = r * SPACING;
  out.z = -100 * a;
  out.scale = 1 - 0.15 * a;
  out.rotX = -25 * r;
  out.opacity = a > 1.5 ? 0 : Math.max(0, 1 - 0.6 * a);
  return out;
}

/** The CSS transform of an item. Rounded, so an item that has not moved writes the same string. */
export function wheelTransform(item: WheelItem): string {
  return `translate3d(0, ${item.y.toFixed(3)}em, ${item.z.toFixed(1)}px) scale(${item.scale.toFixed(3)}) rotateX(${item.rotX.toFixed(2)}deg)`;
}

const smooth = (v: number): number => {
  const x = Math.min(1, Math.max(0, v));
  return x * x * (3 - 2 * x);
};

/** How much of the wheel shows at `t`: it fades in as the dragon lands and out as it rears. */
export function wheelEnvelope(t: number): number {
  return smooth((t - (WHEEL_FROM - 0.5)) / 0.45) * (1 - smooth((t - BEAT.leave) / 0.35));
}

/** The position of the wheel in items at `t`, clamped a little beyond the first and the last. */
export function wheelPlace(t: number): number {
  const a = (t - WHEEL_FROM) / WHEEL_STEP;
  return Math.min(WHEEL_ITEMS - 1 + 0.8, Math.max(-0.8, a));
}
