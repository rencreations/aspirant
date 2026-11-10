/**
 * The shape of one disc, as plain numbers. The disc has a radius of 1 and lies in the x y plane,
 * facing +z. From the middle out:
 *
 *  - the hole (nothing drawn, the page shows through),
 *  - a frosted ring, a bright metal ring and a clear ring (the hub, with a ridged top),
 *  - the printed face, from the hub to just inside the rim,
 *  - the rim: a thin edge with a small bevel on both sides.
 *
 * The profiles are lists of `[radius, height]` points that a lathe turns around the axis.
 */
export const DISC = {
  /** Total thickness of the disc. */
  thickness: 0.01,
  /** Radius of the hole. */
  hole: 0.14,
  /** Outer radius of the hub (the face starts here). */
  hub: 0.24,
  /** Where the face stops and the rim begins. */
  faceOut: 0.974,
  /** Size of the bevel on the rim. */
  bevel: 0.007,
  /** Share of the hub (beyond the frosted ring) that is the metal ring. */
  metalShare: 0.4,
  /** Share of the hub width that is frosted, next to the hole. */
  frostShare: 0.34,
} as const;

export type Profile = Array<[number, number]>;

/** The rim: from the edge of the face, out to the bevelled edge and back on the other side. */
export function rimProfile(): Profile {
  const h = DISC.thickness / 2;
  const b = DISC.bevel;
  return [
    [DISC.faceOut, h],
    [1 - b, h],
    [1, h - b],
    [1, -h + b],
    [1 - b, -h],
    [DISC.faceOut, -h],
  ];
}

/**
 * One ring of the hub, from `inner` to `outer`, `height` thick, with a ridged top and bottom
 * (`ridge` is how deep the ridges go, as a share of the half height).
 */
export function hubRingProfile(
  inner: number,
  outer: number,
  height: number,
  ridge: number,
): Profile {
  const h = height / 2;
  const a = Math.max(0.002, inner);
  const w = Math.max(1e-4, outer - a);
  const top = (t: number) => h * (1 - ridge) + h * ridge * (0.6 + 0.4 * Math.cos(t * Math.PI * 3));
  const points: Profile = [
    [a, -h],
    [a, h],
  ];
  for (let i = 0; i <= 5; i += 1) {
    const t = i / 5;
    points.push([a + w * t, top(t)]);
  }
  points.push([outer, h * 0.92], [outer, -h * 0.92]);
  for (let i = 5; i >= 0; i -= 1) {
    const t = i / 5;
    points.push([a + w * t, -top(t)]);
  }
  return points;
}

/** The three rings of the hub: frosted next to the hole, then metal, then clear. */
export function hubRings(): {
  frost: [number, number];
  metal: [number, number];
  clear: [number, number];
} {
  const width = DISC.hub - DISC.hole;
  const frostOut = DISC.hole + width * DISC.frostShare;
  const metalOut = frostOut + width * DISC.metalShare;
  return {
    frost: [DISC.hole, frostOut],
    metal: [frostOut, metalOut],
    clear: [metalOut, DISC.hub],
  };
}
