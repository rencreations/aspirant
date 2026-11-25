/**
 * When the sticker over Selena's bottom shows, in the Entrance idle (the owner's request: from some
 * angles that pose is too revealing). Plain arithmetic.
 *
 * It shows when the camera is on the side the area faces and near it. It grows in smoothly and goes
 * the same way, so turning round her is never interrupted: from the front, the side or far away it
 * is not there at all.
 */
export interface StickerSight {
  /** From the area's middle to the camera. */
  dx: number;
  dy: number;
  dz: number;
  /** The area's outward direction (unit). */
  nx: number;
  ny: number;
  nz: number;
  /** The area's size, in metres. */
  radius: number;
}

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** How much the sticker should show, 0 to 1. */
export function stickerShow(s: StickerSight): number {
  const d = Math.hypot(s.dx, s.dy, s.dz);
  if (d < 1e-6) return 1;
  const facing = (s.dx * s.nx + s.dy * s.ny + s.dz * s.nz) / d;
  // On its side: from just behind the plane of the area (about 87 degrees off its normal, where
  // her bottom starts to show from behind) in to a straight view.
  const side = smooth(0.05, 0.35, facing);
  // Near: from 14 radii (about 2.2 m for the measured area) to 8.
  const near = smooth(s.radius * 14, s.radius * 8, d);
  return side * near;
}

/**
 * Whether the sticker is on, from how much it should show. It is whole or gone, never half grown:
 * it comes on above 0.4 and goes below 0.2, so a camera at the edge does not make it flicker.
 */
export function stickerOn(wasOn: boolean, level: number): boolean {
  return wasOn ? level > 0.2 : level > 0.4;
}

/** A spring with a little overshoot for the sticker's pop: it settles on `goal`. */
export function stickerSpring(
  state: { value: number; speed: number },
  goal: number,
  dt: number,
): void {
  const k = 170;
  const c = 17;
  const step = Math.min(dt, 1 / 30);
  const a = k * (goal - state.value) - c * state.speed;
  state.speed += a * step;
  state.value += state.speed * step;
  if (goal === 0 && state.value < 0.002 && Math.abs(state.speed) < 0.01) {
    state.value = 0;
    state.speed = 0;
  }
}
