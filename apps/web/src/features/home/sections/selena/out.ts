/**
 * The out animation of the Selena section (round seven). The last scroll zone of the section plays
 * `city_intercation02`, the character's out clip: she turns around and puts her hand out. Then the
 * hand reaches up, takes the edge of a white sheet that hangs above the screen, and pulls it down
 * until it covers everything and the hand has gone below the screen. Everything here is a pure
 * function of `o`, the progress of the zone (0 to 1), so the scroll plays it both ways and a seek
 * into it gives the picture a slow scroll gives.
 *
 *   0.00 to 0.07   the drawer and its words leave
 *   0.00 to 0.55   the clip, scrubbed: the camera pulls back, she turns, her hand comes out
 *   0.52 to 0.66   the reach: the picture closes in on the hand, the hand rises to the top
 *   0.62 to 0.72   the grip: the fingers close on the edge, the edge comes to them
 *   0.70 to 0.97   the pull: the hand takes the sheet down and out of the bottom of the picture
 *   0.00 to 0.05   the pair (drone and doll) fly off to the lower right, before the camera leaves the
 *                  pixel view (the doll is in the cast pass: a baked camera would misplace her)
 *   0.94 to 1.00   the sheet is the whole screen: the white over the canvas takes it, the actors go
 */

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
export const seg = (v: number, a: number, b: number): number => clamp01((v - a) / (b - a));
export const smooth = (x: number): number => x * x * (3 - 2 * x);
export const mix = (a: number, b: number, x: number): number => a + (b - a) * x;

/**
 * The seconds of the clip at which she has turned round and her hand is out (the last pose the clip
 * is shown in: the pull goes on from it). Seen in the frames of `city_intercation02`: she faces the
 * viewer from 4.3 s with the arms out, and goes back to lying from 4.5 s.
 */
export const T_EXT = 4.42;

/**
 * The clip's time against the zone's progress: slow where she is close and where she turns, quick
 * where the camera is far and she is small (1.1 to 3.9 s), then slow into the pose.
 */
export const CLIP_KEYS: ReadonlyArray<readonly [o: number, t: number]> = [
  [0, 0],
  [0.07, 1.0],
  [0.22, 3.8],
  [0.52, T_EXT],
];

/** Where each beat lies, in the zone's progress. */
export const AT = {
  words: [0, 0.07],
  reach: [0.54, 0.66],
  grip: [0.62, 0.72],
  pull: [0.7, 0.97],
  pair: [0, 0.05],
  white: [0.94, 1],
} as const;

/** The first part of the zone, in which the out clip blends in from the idle loop that was showing. */
export const OUT_BLEND = 0.04;

/** The picture's zoom at the end of the reach: the hand fills a good part of the screen. */
export const ZOOM = 4.4;
/** On a phone the fitted camera is already close on her (it fits the width): less zoom keeps her face in. */
export const ZOOM_PORTRAIT = 2.1;
/** Where the clip's wrist is in the zoomed picture (device units, y up) when the reach begins. */
export const WRIST_AT = { x: -0.28, y: -0.2 } as const;
/** Where the hand goes: the top of its reach, in the zoomed picture, and where it ends, below it. */
export const REACH_TO = { x: -0.06, y: 0.52 } as const;
export const PULL_TO = { x: -0.14, y: -0.78 } as const;
/** How far the picture itself is drawn up as the sheet comes down, so the hand leaves by the bottom. */
export const PAN_TO = 0.95;
/** Where the sheet hangs when it is first seen, and where it waits for the hand. */
export const HANG = { from: 1.3, to: 0.86 } as const;
/** The distance of the hand from the camera at the end of the pull, as a share of the clip's. */
export const DEPTH_TO = 0.86;

export interface OutBeats {
  /** Seconds of the clip. */
  t: number;
  /** The picture closes in on the hand, 0 (the clip's own camera) to 1 (`ZOOM`). */
  zoom: number;
  /** The hand's target in the zoomed picture (x, y), blended in by `arm`. */
  handX: number;
  handY: number;
  /** The hand's distance from the camera, a share of the clip's. */
  depth: number;
  /** How much the pull owns the arm, 0 (the clip's) to 1. */
  arm: number;
  /** The fingers closing, 0 to 1. */
  close: number;
  /** The edge: where it hangs (y up, 1 is the top of the screen) and how far the fingers hold it. */
  hang: number;
  grip: number;
  /** The picture drawn up by this much (device units), so the hand ends below the screen. */
  pan: number;
  /** The folds of the sheet, 0 to 1, and their phase. */
  fold: number;
  phase: number;
  /** The drawer and its words, 1 (there) to 0 (gone). */
  room: number;
  /** The pair's exit, 0 (docked) to 1 (gone to the lower right). */
  pair: number;
  /** The white over the canvas, 0 to 1. */
  white: number;
  /** The sheet is drawn at all. */
  sheet: boolean;
  /** The actors are drawn at all (false once the screen is white). */
  actors: boolean;
}

export function newOut(): OutBeats {
  return {
    t: 0,
    zoom: 0,
    handX: 0,
    handY: 0,
    depth: 1,
    arm: 0,
    close: 0,
    hang: HANG.from,
    grip: 0,
    pan: 0,
    fold: 0,
    phase: 0,
    room: 1,
    pair: 0,
    white: 0,
    sheet: false,
    actors: true,
  };
}

/** The clip time for a progress of the zone. */
export function clipTime(o: number): number {
  const first = CLIP_KEYS[0]!;
  const last = CLIP_KEYS[CLIP_KEYS.length - 1]!;
  if (o <= first[0]) return first[1];
  if (o >= last[0]) return last[1];
  for (let i = 1; i < CLIP_KEYS.length; i += 1) {
    const b = CLIP_KEYS[i]!;
    if (o > b[0]) continue;
    const a = CLIP_KEYS[i - 1]!;
    return mix(a[1], b[1], (o - a[0]) / (b[0] - a[0]));
  }
  return last[1];
}

/** All of the beats for a progress of the zone, written into `out`. */
export function outAt(o: number, out: OutBeats = newOut()): OutBeats {
  const p = clamp01(o);
  out.t = clipTime(p);
  out.room = 1 - smooth(seg(p, AT.words[0], AT.words[1]));

  const reach = smooth(seg(p, AT.reach[0], AT.reach[1]));
  const grip = smooth(seg(p, AT.grip[0], AT.grip[1]));
  const pull = seg(p, AT.pull[0], AT.pull[1]);
  // The pull eases in as the sheet takes the weight, and keeps its speed to the end.
  const pulled = pull * pull * (3 - 2 * pull) * 0.55 + pull * 0.45;

  out.zoom = reach;
  out.arm = reach;
  // The hand: from its wrist in the zoomed picture up to the top of its reach, then down and out.
  const upX = mix(WRIST_AT.x, REACH_TO.x, reach);
  const upY = mix(WRIST_AT.y, REACH_TO.y, reach);
  out.handX = mix(upX, PULL_TO.x, pulled) + 0.03 * Math.sin(pulled * Math.PI * 3);
  out.handY = mix(upY, PULL_TO.y, pulled);
  out.depth = mix(1, DEPTH_TO, pulled);
  out.pan = PAN_TO * pulled;
  // The fingers open as the hand rises (a reaching hand), then close on the edge.
  out.close = grip;
  out.grip = grip;
  out.hang = mix(HANG.from, HANG.to, reach);
  out.fold = smooth(seg(p, AT.grip[0], AT.grip[0] + 0.1)) * (1 - smooth(seg(p, 0.9, 0.97)));
  out.phase = pulled * 5.5;
  out.pair = smooth(seg(p, AT.pair[0], AT.pair[1]));
  out.white = smooth(seg(p, AT.white[0], AT.white[1]));
  out.sheet = reach > 0.02;
  out.actors = p < AT.white[1] - 1e-6;
  return out;
}

export interface ViewRect {
  fullWidth: number;
  fullHeight: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
}

/**
 * Close in on a picture: zoom `z` about the point (`cx`, `cy`) of the picture `view` (device units, y
 * up), so that this point appears at (`qx`, `qy`) of the zoomed picture. The view's own full frame is
 * kept; only the window onto it shrinks and moves. Writes `out` and returns it.
 */
export function zoomRect(
  view: ViewRect,
  z: number,
  cx: number,
  cy: number,
  qx: number,
  qy: number,
  out: ViewRect,
): ViewRect {
  const w = view.width / z;
  const h = view.height / z;
  const px = view.offsetX + (cx * 0.5 + 0.5) * view.width;
  const py = view.offsetY + (0.5 - cy * 0.5) * view.height;
  out.fullWidth = view.fullWidth;
  out.fullHeight = view.fullHeight;
  out.width = w;
  out.height = h;
  out.offsetX = px - (qx * 0.5 + 0.5) * w;
  out.offsetY = py - (0.5 - qy * 0.5) * h;
  return out;
}
