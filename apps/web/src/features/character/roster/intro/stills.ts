/**
 * The pictures cleaned from the reference by `scripts/roster-intro/stills.py` (WebP with alpha, in
 * `public/img/roster-intro/`) that the ending still uses: the thin lines drawn in toward the impact
 * point, the red slash of the page, and the fire. The beams and the black arcs of the recording are
 * not used any more (the ending is our own, see `timeline.ts`). Each still is drawn centred.
 */
export type StillName = "speed-lines" | "energy-slash" | "fire";

export interface StillMeta {
  path: string;
  /** The height of the reference frame the picture was cut from, so it can be scaled to the screen. */
  refH: number;
}

const at = (name: StillName): string => `/img/roster-intro/${name}.webp`;

export const STILLS: Record<StillName, StillMeta> = {
  "speed-lines": { path: at("speed-lines"), refH: 1080 },
  "energy-slash": { path: at("energy-slash"), refH: 1080 },
  fire: { path: at("fire"), refH: 1080 },
};

export const STILL_NAMES = Object.keys(STILLS) as StillName[];

/** Obsidia's cut-out, for the impact frame (a hard silhouette). */
export const OBSIDIA_CUTOUT = "/img/char/obsidia/cutout.webp";
