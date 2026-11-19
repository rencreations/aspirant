/**
 * The text wheel of the five pairs, as the tibdigital.com "Since 2007" wheel (measured, see
 * `docs/design/home-reference/ref-psychoactive-tib.md` 2.5): small centred lines on a barrel, the one
 * in focus in the middle, the one before above and the one after below as dim previews. The wheel's
 * position is continuous (`a` = how many pairs the scroll has turned it, from 0 to 4), never a station.
 * For an item `i`, with `r = i - a`:
 *
 *   transform  translateY(r * 90px) translateZ(-100|r| px) scale(1 - 0.15|r|) rotateX(-25 r deg)
 *   opacity    0 past |r| 1.5, else max(0, 1 - 0.6|r|)
 *   grey       102 + 153 * max(0, 1 - 1.5|r|) of 255 (white in focus, a dim grey for the previews)
 *
 * Pure arithmetic: a transform and an opacity only, written by the runtime.
 */

export interface WheelItem {
  /** Vertical distance in pixels at the reference size (72 px), so it scales with the font. */
  y: number;
  /** Depth in px, negative is away. */
  z: number;
  scale: number;
  /** The tilt about the horizontal axis, degrees. */
  rotX: number;
  opacity: number;
}

/** The reference's text is 72 px and its spacing 90 px: the spacing is 1.25 of the font size. */
const SPACING_EM = 90 / 72;

export function wheelItem(r: number, out: WheelItem): WheelItem {
  const a = Math.abs(r);
  out.y = r * SPACING_EM;
  out.z = -100 * a;
  out.scale = 1 - 0.15 * a;
  out.rotX = -25 * r;
  // The reference's opacity times the grey of its text, folded into one number: the previews are
  // dim and small, the line in focus is whole.
  const grey = (102 + 153 * Math.max(0, 1 - 1.5 * a)) / 255;
  out.opacity = a > 1.5 ? 0 : Math.max(0, 1 - 0.6 * a) * grey;
  return out;
}

/** The CSS transform of an item (the y is in em). Rounded, so an item that has not moved writes the same string. */
export function wheelTransform(item: WheelItem): string {
  return `translate3d(0, ${item.y.toFixed(3)}em, ${item.z.toFixed(1)}px) scale(${item.scale.toFixed(3)}) rotateX(${item.rotX.toFixed(2)}deg)`;
}
