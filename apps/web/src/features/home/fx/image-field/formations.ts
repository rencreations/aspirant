/**
 * The named formations of the field, all pure. `buildFormations` makes the layout for a viewport
 * (the scatter, the ring, the wall and the rows, with each card's slot in them) and `poseOf` gives
 * the pose of one card in one formation. A section never builds poses by hand: it asks the field
 * to show a formation at a progress, or to blend two.
 *
 *   scatter   the floating hero field around the logo
 *   origin    every card small and in a heap behind the logo (the cards expand from here to the scatter)
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
import { alongAtRest, arrangePictures } from "./arrange";
import { wallGrid, type WallGrid } from "./grid";
import { clamp, mix, qSlerp, ramp, smootherstep } from "./math";
import {
  buildStory,
  storyAt,
  storyLens,
  TIMELINE,
  type StoryLayout,
  type StoryOptions,
} from "./story";
import { copyPose, makePose, type CardPose, type Vp } from "./types";
import { WALL_DISTANCE, rowWay, wallSlotPose, type WallGeom, type WallOptions } from "./wall";

export type FormationName =
  "scatter" | "origin" | "gather" | "ring" | "land" | "wall" | "rows" | "story";

export interface FormationSet {
  /** The cards of the hero (the story's). */
  readonly n: number;
  /** Every card of the field: the story's, then the wall-only cells that fill the rest of the plane. */
  readonly total: number;
  readonly vp: Vp;
  readonly story: StoryLayout;
  /** The plane: the wall is the part of it inside the clip, the rows are all of it. */
  readonly rows: WallGeom;
  readonly grid: WallGrid;
  /** The wall and the rows are one plane, so a slide of the wall is the same slide of the rows. */
  readonly rowsPerWall: number;
  /** The wall slot of each wall-only cell (card `n + j`). */
  readonly extraSlot: Int32Array;
  /** 0 to 1: how late a wall-only cell comes in while the wall lands (the middle of the frame first). */
  readonly extraRank: Float64Array;
  /** The picture (an index into the pool) that every slot shows. */
  readonly slotPic: Int32Array;
}

export interface FormationOptions extends StoryOptions {
  /** The wall options of the full-screen rows (a bigger card by default). */
  rows?: Partial<WallOptions>;
  /** The character of each picture of the pool, or null, in the pool's order (a card lands on its own). */
  poolKeys?: ReadonlyArray<string | null>;
  /** The look-alike group of each picture of the pool, or null (never near each other). */
  poolGroups?: ReadonlyArray<string | null>;
}

/** The story progress at which the ring is complete and still (the middle of the hold). */
export const RING_P = (TIMELINE.gatherEnd + TIMELINE.leaveStart) / 2;

export function buildFormations(n: number, vp: Vp, options: FormationOptions = {}): FormationSet {
  const grid = wallGrid(vp);
  const geom = grid.geom;
  // No picture twice in a row or in two rows next to each other, a gap before the same picture or
  // Aspirant comes back (`arrange.ts`).
  const slotPic = arrangePictures(
    geom,
    options.poolKeys ?? [null],
    alongAtRest(geom),
    1,
    options.poolGroups,
  );
  const slotKeys = options.poolKeys
    ? Array.from(slotPic, (p) => options.poolKeys![p] ?? null)
    : undefined;
  const story = buildStory(n, vp, { ...options, grid, slotKeys });
  // The slots no story card landed on belong to wall-only cells.
  const taken = new Uint8Array(geom.n);
  for (const s of story.wallSlot) taken[s] = 1;
  const extras: number[] = [];
  for (let s = 0; s < geom.n; s++) if (taken[s] === 0) extras.push(s);
  const extraSlot = Int32Array.from(extras);
  const extraRank = new Float64Array(extras.length);
  const c = { x: 0, y: 0 };
  let far = 1;
  const dist = extras.map((s) => {
    wallSlotPose(geom, s, 0, scratchA);
    c.x = scratchA.x - grid.wall.cx;
    c.y = scratchA.y - grid.wall.cy;
    const d = Math.hypot(c.x, c.y);
    far = Math.max(far, d);
    return d;
  });
  dist.forEach((d, j) => {
    extraRank[j] = clamp(d / far);
  });
  return {
    n,
    total: n + extras.length,
    vp,
    story,
    rows: geom,
    grid,
    rowsPerWall: 1,
    extraSlot,
    extraRank,
    slotPic,
  };
}

/** The wall slot of cell `i` (a story card's own, or the one of a wall-only cell). */
export function slotOf(set: FormationSet, i: number): number {
  return i < set.n ? set.story.wallSlot[i]! : set.extraSlot[i - set.n]!;
}

/** The wall-only cells fly in between these story positions (the cards of the hero land by 0.94). */
const EXTRA_WINDOW = { from: 0.5, spread: 0.26, flight: 0.18 } as const;

/**
 * How far a wall-only cell has come in (0 not there, 1 there) while the story is at `p`. Every cell
 * of the plane flies in from off screen along its own row as the cards of the hero land, the ones
 * nearest the middle of the wall first (round three: nothing is ever just there). The cells outside
 * the wall's frame fly in too: the plane covers the screen while the cards land, and the clip then
 * closes on the frame, as premotio's does. So a cell that slides into the frame later was already there.
 */
export function extraIn(set: FormationSet, j: number, p: number): number {
  const from = EXTRA_WINDOW.from + EXTRA_WINDOW.spread * set.extraRank[j]!;
  return smootherstep(ramp(p, from, from + EXTRA_WINDOW.flight));
}

/** The story progress of a named window at `t` (0 to 1). */
export function storyProgress(name: FormationName, t: number): number {
  switch (name) {
    case "scatter":
    case "origin":
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
  if (i >= set.n) return extraPoseOf(set, name, t, i - set.n, slide, out);
  switch (name) {
    case "scatter":
      return copyPose(set.story.scatter[i]!, out);
    case "origin":
      return originPose(set, i, out);
    case "rows":
      return wallSlotPose(set.rows, set.story.wallSlot[i]!, slide * set.rowsPerWall, out);
    default:
      return storyAt(set.story, storyProgress(name, t), i, slide, out);
  }
}

/** How small a card is in the heap behind the logo (`origin`), and how far across from the middle (a share of its scatter place). */
export const ORIGIN_SCALE = 0.12;

/**
 * The pose of card `i` in the heap behind the logo: in the logo's own band (the middle of the screen,
 * a tenth of the way across to its scatter place), a tenth of its size, flat (no tilt), so it is
 * hidden whatever the shape of the screen. The cards fly out of here, growing and turning to their
 * scatter pose.
 */
function originPose(set: FormationSet, i: number, out: CardPose): CardPose {
  copyPose(set.story.scatter[i]!, out);
  out.x *= ORIGIN_SCALE;
  out.y = 0;
  out.h *= ORIGIN_SCALE;
  out.q[0] = 0;
  out.q[1] = 0;
  out.q[2] = 0;
  out.q[3] = 1;
  return out;
}

/**
 * The pose of wall-only cell `j`: on its slot once it has landed, before that flying in along its row
 * from beyond the screen's edge, the way the row slides (so it arrives moving the way its neighbours
 * move), and faded in over the first part of the flight while it is still off screen.
 */
function extraPoseOf(
  set: FormationSet,
  name: FormationName,
  t: number,
  j: number,
  slide: number,
  out: CardPose,
): CardPose {
  const slot = set.extraSlot[j]!;
  wallSlotPose(set.rows, slot, slide, out);
  const k =
    name === "wall" || name === "rows"
      ? 1
      : name === "scatter" || name === "origin" || name === "gather" || name === "ring"
        ? 0
        : extraIn(set, j, storyProgress(name, t));
  if (k >= 1) return out;
  const g = set.rows;
  const row = g.slotRow[slot]!;
  // Half a wrap window further back along the row: past the screen's edge for every cell of it.
  const back = -rowWay(row) * g.rowCount[row]! * g.pitch * EXTRA_BACK * (1 - k) * (1 - k);
  out.x += back * g.right[0];
  out.y += back * g.right[1];
  out.z += back * g.right[2];
  out.opacity = ramp(k, 0, 0.1);
  return out;
}

/** The distance a cell flies in from, as a share of its row's wrap length. */
const EXTRA_BACK = 0.55;

/** The camera distance a formation is seen through: the pixel lens, or the long lens of the wall. */
export function lensOf(name: FormationName, t: number): number {
  switch (name) {
    case "wall":
    case "rows":
      return WALL_DISTANCE;
    case "scatter":
    case "origin":
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
export type RankBy = "top" | "bottom" | "left" | "right" | "index" | "centre";

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
  const n = set.total;
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
      case "centre": {
        // How far the card's scatter place is from the middle (the heap's own poses are all in a band).
        const sc = i < set.n ? set.story.scatter[i] : undefined;
        const near = lensOf("scatter", 0);
        key[i] = sc ? Math.hypot(sc.x, sc.y) * (near / (near - sc.z)) : Infinity;
        break;
      }
    }
  }
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => key[a]! - key[b]! || a - b);
  // The ranks of "centre" are the hero's own cards' (0 to 1): the wall-only cells come last.
  const span = by === "centre" ? Math.max(1, set.n - 1) : n > 1 ? n - 1 : 1;
  order.forEach((card, rank) => {
    out[card] = Math.min(1, rank / span);
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
