/**
 * Where a section puts Tetra, and how that becomes a spot on the canvas. The stage's frame has its
 * origin in the middle of the screen, x to the right, y UP, one unit one CSS pixel at z = 0, and a
 * perspective camera 1000 away: a thing `z` toward the camera is drawn larger by 1000 / (1000 - z)
 * about the middle. Pure arithmetic.
 */
const PIXEL_DISTANCE = 1000;

export interface TetraPlace {
  /** Where her feet are (or her middle, with `origin: "middle"`), in the stage's frame. */
  x: number;
  y: number;
  /** Toward the camera, in pixels. 0 is the picture plane. */
  z?: number;
  /** How tall she stands on screen at z = 0, in CSS pixels. */
  height: number;
  /** Turn her about up, in radians; positive faces the right of the screen. */
  yaw?: number;
  /** Faces the left of the screen (the doll is mirrored). */
  flip?: boolean;
  /** What (x, y) is: between her feet (the default), or the middle of her standing height. */
  origin?: "feet" | "middle";
}

/** What the scene needs: her mark and height in the canvas's own pixels (y down). */
export interface Placed {
  markX: number;
  groundY: number;
  tall: number;
}

/** The size and the position a perspective camera at 1000 gives a thing `z` toward it. */
export function perspectiveScale(z: number): number {
  return PIXEL_DISTANCE / Math.max(50, PIXEL_DISTANCE - z);
}

export function placeToCanvas(p: TetraPlace, width: number, height: number, out: Placed): Placed {
  const k = perspectiveScale(p.z ?? 0);
  const feetY = p.origin === "middle" ? p.y - 0.5 * p.height : p.y;
  out.tall = p.height * k;
  out.markX = width / 2 + p.x * k;
  out.groundY = height / 2 - feetY * k;
  return out;
}

/** The stage's frame to client pixels (the canvas fills the window). */
export function stageToClient(
  x: number,
  y: number,
  width: number,
  height: number,
  out: { x: number; y: number },
): { x: number; y: number } {
  out.x = width / 2 + x;
  out.y = height / 2 - y;
  return out;
}

export function clientToStage(
  cx: number,
  cy: number,
  width: number,
  height: number,
  out: { x: number; y: number },
): { x: number; y: number } {
  out.x = cx - width / 2;
  out.y = height / 2 - cy;
  return out;
}
