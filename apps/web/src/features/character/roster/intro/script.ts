import type { Slug } from "@/content/types";

/**
 * The beats of each panel, read off the owner's recording (`transitions.mov`, 60 fps). Times are
 * seconds from the start of the intro. A beat sets values from its time onward and they hold until
 * the next beat (the recording is cut on twos and threes, so a step is the right shape). A beat
 * with `lerp` ramps its numbers to the next beat's instead. Every comment names the moment of the
 * recording that the row copies.
 *
 * To retime a panel move its beats. To change how it looks at a beat change that row.
 */
export interface Beat {
  t: number;
  /** Ramp the numbers of this beat to the next beat. */
  lerp?: boolean;
  /** How much of the panel is shown, along the slit that opens its diagonal. 0 to 1. */
  grow?: number;
  /** 0 the welcome clip, 1 the splash art. In between is a cross fade. */
  mix?: number;
  /** The clip time (seconds) at this beat, and how fast the clip runs from here. */
  clip?: number;
  rate?: number;
  /** How many different clip pictures a second are shown (the recording is stepped). */
  step?: number;
  /** Impact frame: the picture as a black and white threshold. Negative is off. */
  thr?: number;
  /** 1 swaps black and white of the impact frame. */
  inv?: number;
  /** A flat white (1) or black (1) panel over the picture. */
  white?: number;
  black?: number;
  /** The white glow outline round the panel. */
  glow?: number;
  /** The rainbow refraction fringe along the left side. */
  fringe?: number;
  /** The prism flare: rays of colour from a point on a black panel. */
  flare?: number;
  /** Panel opacity (a ghost). */
  alpha?: number;
  /** Pulls the picture to a pale purple (the first panel fading). */
  pale?: number;
  /** The blue bevel band along the left edge of the first panel. */
  bevel?: number;
  /** Which edge the slit grows from: 0 the bottom, 1 the top. */
  top?: number;
  /** The picture is scaled up about the middle of the panel, and moved down by this part of its height. */
  zoom?: number;
  shy?: number;
  /** A white and black split along the diagonal of the panel (an impact frame). Negative is off. */
  split?: number;
  /** Black and white bars with a colour fringe (the panels the spear tip meets). */
  stripes?: number;
  /** 1 puts the panel on the real page, in the box of the page's own panel (Obsidia's reveal). */
  page?: number;
  /** Board units added to the bottom edge (the first panel runs past the bottom of the screen). */
  drop?: number;
  /** A number the jagged edges read, changed by hand so they differ from panel to panel. */
  seed?: number;
}

export type Params = Required<Omit<Beat, "t" | "lerp">>;

export const REST: Params = {
  grow: 1,
  mix: 1,
  clip: 0,
  rate: 1,
  step: 30,
  thr: -1,
  inv: 0,
  white: 0,
  black: 0,
  glow: 0,
  fringe: 0,
  flare: 0,
  alpha: 1,
  pale: 0,
  bevel: 0,
  top: 0,
  drop: 0,
  split: -1,
  stripes: 0,
  page: 0,
  zoom: 1,
  shy: 0,
  seed: 0,
};

export interface PanelScript {
  slug: Slug;
  beats: readonly Beat[];
}

/**
 * The order the panels arrive in. The first one is on screen when the picture appears, the others
 * come one by one, each from the end of the row toward the start, in the two staggered rows.
 */
export const FIRST: PanelScript = {
  // The first panel, Fanny, tall on the right third. Frames 0.70 to 1.70 of the recording: a blue
  // plate with the picture part grown into it (0.70 to 0.82), the welcome clip (a slow dive that
  // speeds up), the close up of the eye at 1.33, the splash art close up of her bodice at 1.38,
  // the clip's own white flash at 1.53 to 1.65, then the splash fading in pale.
  slug: "fanny",
  beats: [
    { t: 0.7, grow: 0.6, mix: 0, clip: 0.17, rate: 0, step: 30, bevel: 1, glow: 0, drop: 45 },
    { t: 0.817, grow: 1, bevel: 0.35, rate: 0.5 },
    { t: 0.833, bevel: 0 },
    // The dive: 0.17 to 0.47 of the clip over 0.65 s, then the close up of the eye.
    { t: 1.333, clip: 0.45, rate: 0.3 },
    // 1.38: a cut to the splash art, close on her bodice, and the bottom edge rises.
    { t: 1.383, mix: 1, zoom: 1.7, shy: -0.1, drop: -20 },
    { t: 1.45, shy: -0.28, drop: -12 },
    { t: 1.483, mix: 0, zoom: 1, shy: 0, clip: 0.62, rate: 1, drop: -4 },
    { t: 1.533, glow: 1, drop: 0 },
    { t: 1.65, mix: 0.4, pale: 0.6, glow: 0.8, rate: 0, lerp: true },
    { t: 1.75, glow: 0.3, mix: 1, pale: 0.25 },
    { t: 2.1, glow: 0, pale: 0 },
  ],
};

/** The beats with every value filled in forward, so a lookup needs no search for a gap. */
export interface ResolvedBeat extends Params {
  t: number;
  lerp: boolean;
}

export function resolve(beats: readonly Beat[]): ResolvedBeat[] {
  const out: ResolvedBeat[] = [];
  let prev: Params = { ...REST, grow: 0 };
  let prevT = beats[0]?.t ?? 0;
  for (const b of beats) {
    const { t, lerp, ...rest } = b;
    // A beat that gives no clip time carries on from where the clip had got to.
    const carried = prev.clip + prev.rate * (Math.floor((t - prevT) * prev.step) / prev.step);
    const full = { ...prev, clip: carried, ...rest } as Params;
    out.push({ ...full, t, lerp: lerp ?? false });
    prev = full;
    prevT = t;
  }
  return out;
}
