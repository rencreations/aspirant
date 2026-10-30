/**
 * The pictures cleaned from the reference by `scripts/roster-intro/build.py` (WebP with alpha, in
 * `public/img/roster-intro/`). `refH` is the height of the reference frame the picture was cut
 * from (1080), so the picture can be scaled to the screen; `tip` is where the point of the shape
 * is, as fractions of the picture, so the timeline can say where on the screen the point goes.
 */
export type StillName =
  | "beam-pink"
  | "beam-hold"
  | "beam-blue"
  | "beam-thin"
  | "speed-lines"
  | "energy-slash"
  | "ring-arcs"
  | "fire";

export interface StillMeta {
  path: string;
  /** The height of the reference frame the picture was cut from, so it can be scaled to the screen. */
  refH: number;
  /** Where the point of the shape is, as fractions of the picture. */
  tip: { u: number; v: number };
  /** The picture was cut at the edge of the frame: it must still reach that edge on any screen. */
  reach: boolean;
}

const at = (name: StillName): string => `/img/roster-intro/${name}.webp`;

export const STILLS: Record<StillName, StillMeta> = {
  "beam-pink": { path: at("beam-pink"), refH: 1080, tip: { u: 0.001, v: 0.461 }, reach: true },
  "beam-hold": { path: at("beam-hold"), refH: 1080, tip: { u: 0.998, v: 0.519 }, reach: true },
  "beam-blue": { path: at("beam-blue"), refH: 1080, tip: { u: 0.998, v: 0.565 }, reach: true },
  "beam-thin": { path: at("beam-thin"), refH: 1080, tip: { u: 0.997, v: 0.5 }, reach: true },
  "speed-lines": { path: at("speed-lines"), refH: 1080, tip: { u: 0.5, v: 0.5 }, reach: false },
  "energy-slash": { path: at("energy-slash"), refH: 1080, tip: { u: 0.5, v: 0.5 }, reach: false },
  "ring-arcs": { path: at("ring-arcs"), refH: 1080, tip: { u: 0, v: 0 }, reach: false },
  fire: { path: at("fire"), refH: 1080, tip: { u: 0.5, v: 0.5 }, reach: false },
};

export const STILL_NAMES = Object.keys(STILLS) as StillName[];
