/**
 * The named formations of the field, all pure. `buildFormations` makes the layout for a viewport
 * (the scatter, the ring, the wall and the rows, with each card's slot in them) and `poseOf` gives
 * the pose of one card in one formation. A section never builds poses by hand: it asks the field
 * to show a formation at a progress, or to blend two.
 *
 *   scatter   the floating hero field around the logo
 *   gather    scatter to ring: the cards highest on the screen leave first and spiral into the ring
 *   ring      the standing ring
 *   land      ring to wall: the cards leave the ring one by one and lie down as the wall
 *   wall      the three sliding rows in the frame (the left part of the screen)
 *   rows      the same rows over the whole screen
 *   story     the whole chain at p in [0, 1] (what gather and land are windows of)
 *
 * `slide` is one number for the whole field: the wall's slide in the wall plane's pixels. The rows
 * read it through the ratio of the two plane scales, so a blend between wall and rows keeps every
 * card at the same phase of its row however far the rows have slid.
 */
import { clamp, mix, qSlerp, smootherstep } from "./math";
import {
  buildStory,
  storyAt,
  storyLens,
  TIMELINE,
  type StoryLayout,
  type StoryOptions,
} from "./story";
import { copyPose, makePose, type CardPose, type Vp } from "./types";
import {
  WALL_DISTANCE,
  wallFrame,
  wallGeom,
  wallSlotPose,
  type WallGeom,
  type WallOptions,
} from "./wall";

export type FormationName = "scatter" | "gather" | "ring" | "land" | "wall" | "rows" | "story";

export interface FormationSet {
  readonly n: number;
  readonly vp: Vp;
  readonly story: StoryLayout;
  readonly rows: WallGeom;
  /** How far the rows slide for one pixel of the wall's slide (the ratio of their card widths). */
  readonly rowsPerWall: number;
}

export interface FormationOptions extends StoryOptions {
  /** The wall options of the full-screen rows (a bigger card by default). */
  rows?: Partial<WallOptions>;
}

/** The story progress at which the ring is complete and still (the middle of the hold). */
export const RING_P = (TIMELINE.gatherEnd + TIMELINE.leaveStart) / 2;

export function buildFormations(n: number, vp: Vp, options: FormationOptions = {}): FormationSet {
  const tall = vp.h > vp.w;
  const story = buildStory(n, vp, {
    ...options,
    wall: { size: tall ? 0.5 : 0.36, ...options.wall },
  });
  const rows = wallGeom(n, wallFrame(vp, "rows"), { size: tall ? 0.5 : 0.34, ...options.rows });
  return { n, vp, story, rows, rowsPerWall: rows.cardW / story.wall.cardW };
}

/** The story progress of a named window at `t` (0 to 1). */
export function storyProgress(name: FormationName, t: number): number {
  switch (name) {
    case "scatter":
      return 0;
    case "gather":
      return mix(TIMELINE.freeze, RING_P, clamp(t));
    case "ring":
      return RING_P;
    case "land":
      return mix(RING_P, 1, clamp(t));
    case "wall":
    case "rows":
      return 1;
    case "story":
      return clamp(t);
  }
}

/** Write the pose of card `i` in a formation. `t` is the progress inside the window of the name. */
export function poseOf(
  set: FormationSet,
  name: FormationName,
  t: number,
  i: number,
  slide: number,
  out: CardPose,
): CardPose {
  switch (name) {
    case "scatter":
      return copyPose(set.story.scatter[i]!, out);
    case "rows":
      return wallSlotPose(set.rows, set.story.wallSlot[i]!, slide * set.rowsPerWall, out);
    default:
      return storyAt(set.story, storyProgress(name, t), i, slide, out);
  }
}

/** The camera distance a formation is seen through: the pixel lens, or the long lens of the wall. */
export function lensOf(name: FormationName, t: number): number {
  switch (name) {
    case "wall":
    case "rows":
      return WALL_DISTANCE;
    case "scatter":
      return storyLens(0);
    default:
      return storyLens(storyProgress(name, t));
  }
}

/** The lens of a blend: the two lenses mixed with the blend's own progress (one per frame, never per card). */
export function blendLens(from: number, to: number, t: number): number {
  return mix(from, to, smootherstep(t));
}

/** Blend pose `a` into pose `b` at `t`. Safe when `out` is `a`. */
function blendPose(a: CardPose, b: CardPose, t: number, out: CardPose): CardPose {
  out.x = mix(a.x, b.x, t);
  out.y = mix(a.y, b.y, t);
  out.z = mix(a.z, b.z, t);
  qSlerp(a.q, b.q, t, out.q);
  out.h = mix(a.h, b.h, t);
  out.aspect = mix(a.aspect, b.aspect, t);
  out.shape = mix(a.shape, b.shape, t);
  out.opacity = mix(a.opacity, b.opacity, t);
  out.live = mix(a.live, b.live, t);
  return out;
}

/**
 * The progress of one card when a blend is staggered: `rank` (0 to 1) says how late the card
 * starts, `spread` (0 to 1) how much of the blend the starts are spread over. Every card is done
 * when `t` is 1.
 */
export function staggered(t: number, rank: number, spread: number): number {
  if (spread <= 0) return clamp(t);
  return clamp((t - rank * spread) / (1 - spread));
}

/** What a rank may follow: the card's height on the screen, its place across, or its index. */
export type RankBy = "top" | "bottom" | "left" | "right" | "index";

/**
 * Rank every card 0 (first) to 1 (last) by where it is in `from`. "top" sends the cards highest on
 * the screen first (the owner's gather), "bottom" the lowest first. Ties keep the card order.
 */
export function rankCards(
  set: FormationSet,
  from: { name: FormationName; t?: number },
  by: RankBy,
  slide: number,
  out: Float64Array,
): Float64Array {
  const n = set.n;
  const key = new Float64Array(n);
  const pose = makePose();
  for (let i = 0; i < n; i++) {
    poseOf(set, from.name, from.t ?? 0, i, slide, pose);
    // The position on the screen, not in the frame: a near card is shifted outward by the lens.
    const s = lensOf(from.name, from.t ?? 0) / (lensOf(from.name, from.t ?? 0) - pose.z);
    switch (by) {
      case "top":
        key[i] = -pose.y * s;
        break;
      case "bottom":
        key[i] = pose.y * s;
        break;
      case "left":
        key[i] = pose.x * s;
        break;
      case "right":
        key[i] = -pose.x * s;
        break;
      case "index":
        key[i] = i;
        break;
    }
  }
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => key[a]! - key[b]! || a - b);
  const span = n > 1 ? n - 1 : 1;
  order.forEach((card, rank) => {
    out[card] = rank / span;
  });
  return out;
}

const scratchA = makePose();
const scratchB = makePose();

/** A blend of two formations at `t`, the card starting after `rank` (0 to 1) of the `spread`. */
export function blendFormations(
  set: FormationSet,
  from: { name: FormationName; t?: number },
  to: { name: FormationName; t?: number },
  t: number,
  spread: number,
  rank: number,
  i: number,
  slide: number,
  out: CardPose,
): CardPose {
  const k = staggered(t, rank, spread);
  poseOf(set, from.name, from.t ?? 0, i, slide, scratchA);
  poseOf(set, to.name, to.t ?? 0, i, slide, scratchB);
  return blendPose(scratchA, scratchB, k, out);
}
