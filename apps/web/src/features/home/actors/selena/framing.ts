/**
 * Placing the figure in the stage's pixel frame (origin in the middle, x right, y up, one unit one
 * CSS pixel at z = 0; the perspective camera sits `distance` away). Pure maths.
 *
 * The anchor is a fixed point of her body: `place({ x, y })` puts it at (x, y) on the screen, and
 * `height` is how tall a reference length of her is on the screen. Both are fixed numbers, never read
 * from the pose of the frame, so she does not pulse when the clip changes.
 */
export interface PlaceInput {
  /** Where her anchor point (near the pelvis) goes, in the stage's pixel frame. */
  x: number;
  y: number;
  /** Pixels toward the camera (default 0). */
  z?: number;
  /** Her on-screen height in CSS pixels, at that depth (the standing height of the reference). */
  height: number;
  /** Radians about her vertical axis (default 0: she faces the camera). */
  yaw?: number;
  /** Radians about the view axis (default 0). */
  roll?: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The scale (pixels of the stage's world a metre of the model takes) for an on-screen height. */
export function worldScale(
  height: number,
  modelHeight: number,
  z: number,
  distance: number,
): number {
  const depth = distance - z;
  return (height / modelHeight) * (depth > 1 ? depth / distance : 1 / distance);
}

/** The world point that projects to the screen point (x, y) at depth z. */
export function worldPoint(
  x: number,
  y: number,
  z: number,
  distance: number,
): [number, number, number] {
  const k = (distance - z) / distance;
  return [x * k, y * k, z];
}

/** The box a pose fills, in her own space: its middle and its size, in metres. */
export interface PoseFitBox {
  cx: number;
  cy: number;
  w: number;
  h: number;
}

/**
 * Where to put her and how tall to make her so a pose fills a rectangle of the screen (CSS pixels,
 * origin top left, like `getBoundingClientRect`). `anchor` is the point of her space that `place`
 * puts at (x, y), `refHeight` the metres that `height` stands for, `fill` the share of the
 * rectangle the pose may take. The pose's middle lands on the rectangle's middle.
 */
export function frameFor(
  rect: Rect,
  viewport: { w: number; h: number },
  fit: PoseFitBox,
  anchor: { x: number; y: number },
  refHeight: number,
  fill = 0.94,
): { x: number; y: number; height: number } {
  const pxPerMetre = Math.min((rect.h * fill) / fit.h, (rect.w * fill) / fit.w);
  const cx = rect.x + rect.w / 2 - viewport.w / 2;
  const cy = viewport.h / 2 - (rect.y + rect.h / 2);
  return {
    x: cx - (fit.cx - anchor.x) * pxPerMetre,
    y: cy - (fit.cy - anchor.y) * pxPerMetre,
    height: pxPerMetre * refHeight,
  };
}

/** True when a screen point (CSS pixels, origin top left) is inside a rectangle. */
export function inside(rect: Rect | null, x: number, y: number): boolean {
  if (!rect) return true;
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}
