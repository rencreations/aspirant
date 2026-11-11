/**
 * Pure maths of the shelf (`/collection`): where each cover stands on the desktop shelves, how the
 * phone stack lays out, the poses a cover moves between, the timing of the entrance and the keys
 * that move through the covers. No three.js and no DOM, so every number here is unit tested
 * (`layout.test.ts`). Units are CSS pixels. The origin is the middle of the screen, x to the right,
 * y UP (the scene is a perspective camera set so that one unit at depth 0 is one CSS pixel).
 */

/** Below this width the shelves become one stack in depth. */
export const PHONE_MAX_W = 700;

/** The side of the cover picture the browser draws on, in cover pixels (the files are 1024 square). */
export const COVER_PX = 1024;

/**
 * Where the browser draws the number and the name on the cover picture, in cover pixels. The bottom
 * third of every cover is a flat field on purpose: `scripts/library/covers.py` keeps TITLE_RECT
 * empty. Keep the two in step.
 */
export const COVER_TEXT = {
  /** Left edge of the number and the name. */
  x: 56,
  /** Top of the number (mono, small). */
  numberY: 676,
  numberSize: 30,
  /** The name sits on the bottom of this box and is fitted to its width. */
  nameBox: { x: 56, y: 672, w: 912, h: 296 },
  nameMaxSize: 250,
} as const;

/** Index of a cover that is ever on a shelf: 0 to 9. */
export const COVER_COUNT = 10;
export const COLS = 5;

export interface Pose {
  /** Bottom centre of the cover. */
  x: number;
  y: number;
  z: number;
  /** Uniform scale (1 is the resting size). */
  s: number;
  /** Rotation about the bottom edge: negative leans the top away from the viewer, radians. */
  lean: number;
  /** Turn about the vertical axis: positive shows the left edge, radians. */
  yaw: number;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    z: lerp(a.z, b.z, t),
    s: lerp(a.s, b.s, t),
    lean: lerp(a.lean, b.lean, t),
    yaw: lerp(a.yaw, b.yaw, t),
  };
}

/** Frame rate independent ease toward a target. `rate` is per second (about 10 settles in 0.3 s). */
export function damp(current: number, target: number, rate: number, dt: number): number {
  return target + (current - target) * Math.exp(-rate * dt);
}

const easeOutCubic = (t: number) => 1 - (1 - clamp(t, 0, 1)) ** 3;
export const easeInOutCubic = (t: number) => {
  const x = clamp(t, 0, 1);
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
};

// Text colour --------------------------------------------------------------------------------

function linear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance of `#rrggbb`. */
function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** The ink for text on a field of this colour (same rule as `ink_for` in covers.py). */
export function textOn(hex: string): "#ffffff" | "#0b0b0e" {
  return luminance(hex) > 0.3 ? "#0b0b0e" : "#ffffff";
}

/** The font size that makes a line `measure(size)` wide fit `maxWidth`, never above `maxSize`. */
export function fitFontSize(
  measure: (size: number) => number,
  maxWidth: number,
  maxSize: number,
): number {
  const probe = 100;
  const w = measure(probe);
  if (w <= 0) return maxSize;
  return Math.min(maxSize, Math.floor((probe * maxWidth) / w));
}

// Desktop shelves -----------------------------------------------------------------------------

export interface ShelfGeometry {
  /** Side of a resting cover. */
  size: number;
  /** Distance between the middles of two neighbours on a shelf. */
  pitch: number;
  /** y (up) of the surface each row stands on, row one first. */
  floor: [number, number];
  /** Shelf board: width, thickness of the front edge and the visible depth of its top. */
  boardW: number;
  boardH: number;
  boardDepth: number;
  /** Thickness of a cover. */
  thick: number;
}

export function isPhone(width: number): boolean {
  return width < PHONE_MAX_W;
}

export function shelfGeometry(w: number, h: number): ShelfGeometry {
  const size = Math.max(60, Math.floor(Math.min(w * 0.15, h * 0.215)));
  const pitch = size * 1.125;
  const rowPitch = size * 1.28;
  const block = size + rowPitch;
  const topFromTop = h * 0.47 - block / 2;
  const floor0 = h / 2 - (topFromTop + size);
  return {
    size,
    pitch,
    floor: [floor0, floor0 - rowPitch],
    boardW: pitch * 5.2,
    boardH: Math.max(8, size * 0.06),
    boardDepth: size * 0.16,
    thick: Math.max(6, size * 0.055),
  };
}

export function slotOf(index: number): { row: 0 | 1; col: number } {
  return { row: index < COLS ? 0 : 1, col: index % COLS };
}

/** The pose of cover `index` at rest on its shelf. */
export function restPose(index: number, g: ShelfGeometry): Pose {
  const { row, col } = slotOf(index);
  return {
    x: (col - (COLS - 1) / 2) * g.pitch,
    y: g.floor[row],
    z: 0,
    s: 1,
    lean: -0.07,
    yaw: 0.12,
  };
}

/** The pose of a cover under the pointer: up and forward, a little less leaned. */
export function hoverPose(index: number, g: ShelfGeometry): Pose {
  const rest = restPose(index, g);
  return { ...rest, y: rest.y + g.size * 0.13, z: g.size * 0.3, s: 1.035, lean: -0.025, yaw: 0.07 };
}

// Room for the controls -----------------------------------------------------------------------
//
// The Search button, the Continue button and the phone's name bar are HTML laid over the scene. On
// a phone they stand in rows across the screen, and the focused cover (or the open Video cover)
// must keep clear of them. The component measures them once per layout (`obstacles.ts`) and the
// pure functions below turn those boxes into room. On a wide screen they flank the cover and
// nothing changes.

/** A box on the stage, in CSS px from its top left. */
export interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * Below this height (a phone on its side) there is no room under the controls: the focused cover
 * and the two halves stand between them, the index row steps aside and the halves lose their line.
 * A wide screen this short is the only one whose layout is different; the standard one holds
 * down to about 520 px.
 */
export const SHORT_H = 540;

export function isShort(h: number): boolean {
  return h < SHORT_H;
}

/** The top bar's height: 5rem on a wide screen, 4rem below it (`--nav-h` in tokens.css). */
export function navHeight(w: number): number {
  return w >= 901 ? 80 : 64;
}

/** Air kept between a cover and a control. */
export const CLEAR_GAP = 16;

/** The Open button hangs under the focused cover: this far below it, and this tall. */
export const OPEN_BELOW = 20;
export const OPEN_H = 37;

/** The smallest the focused cover is made to fit a room. */
const FOCUS_MIN = 120;

/** What the component measured: the boxes the focused cover and the open Video cover must clear. */
export interface Obstacles {
  /** The screen is short (`isShort`). */
  short: boolean;
  /** Height of the top bar. */
  navH: number;
  /** Over the focused cover's columns: the tagline and Search, and Continue. */
  focusAbove: readonly Box[];
  /** Under the focused cover's columns: the phone's name bar, or the index row. */
  focusBelow: readonly Box[];
  /** Over the open Video cover: Continue, and on a wide screen the tagline and Search too (a phone hides them). */
  splitAbove: readonly Box[];
}

export function noObstacles(w: number, h: number): Obstacles {
  return { short: isShort(h), navH: navHeight(w), focusAbove: [], focusBelow: [], splitAbove: [] };
}

/** The lowest edge, plus a gap, of the boxes that stand over the columns `from` to `to`. 0 when none does. */
export function clearBelow(
  boxes: readonly Box[],
  from: number,
  to: number,
  gap = CLEAR_GAP,
): number {
  let y = 0;
  for (const b of boxes) if (b.right > from && b.left < to) y = Math.max(y, b.bottom + gap);
  return y;
}

/** The highest edge, minus a gap, of the boxes that stand under the columns `from` to `to`. `limit` when none does. */
export function clearAbove(
  boxes: readonly Box[],
  from: number,
  to: number,
  limit: number,
  gap = CLEAR_GAP,
): number {
  let y = limit;
  for (const b of boxes) if (b.right > from && b.left < to) y = Math.min(y, b.top - gap);
  return y;
}

/**
 * The free columns between the controls at the two sides of a screen `w` wide: `edge` from each
 * side, narrowed by the boxes that lean to the left or to the right.
 */
export function flank(
  boxes: readonly Box[],
  w: number,
  edge: number,
): { from: number; to: number } {
  let from = edge;
  let to = w - edge;
  for (const b of boxes) {
    if (b.left + b.right > w) to = Math.min(to, b.left - CLEAR_GAP);
    else from = Math.max(from, b.right + CLEAR_GAP);
  }
  return { from, to };
}

/** The offset from the middle of the screen that puts a pair `pair` wide inside `span`, nearest the middle. */
function centreIn(w: number, span: { from: number; to: number }, pair: number): number {
  const half = pair / 2;
  return clamp(0, span.from + half - w / 2, span.to - half - w / 2);
}

/** The largest side of the focused cover. */
export function focusTarget(w: number, h: number): number {
  return isPhone(w) ? Math.min(w * 0.8, h * 0.46) : Math.min(h * 0.46, w * 0.34);
}

/** The band of the screen the focused cover and its Open button may use, in px from the top. */
export interface FocusRoom {
  /** The cover starts below this. */
  top: number;
  /** The Open button under the cover ends above this. */
  foot: number;
  /** The columns it may use: the whole width, or on a short screen the span between the controls. */
  from: number;
  to: number;
}

export function focusRoom(w: number, h: number, o: Obstacles): FocusRoom {
  const t = focusTarget(w, h);
  const from = (w - t) / 2;
  const to = (w + t) / 2;
  // A short screen has no room under the controls: they flank the cover.
  const span = o.short ? flank(o.focusAbove, w, 0) : { from: 0, to: w };
  return {
    top: Math.max(o.navH, o.short ? 0 : clearBelow(o.focusAbove, from, to)),
    foot: clearAbove(o.focusBelow, from, to, h - CLEAR_GAP),
    from: span.from,
    to: span.to,
  };
}

/**
 * The pose of the focused cover: scaled up in the middle of the screen. With a `room` it is made
 * smaller and moved down or up until it, and the Open button under it, stand inside the room.
 * Where it already does (every wide screen, a tall phone) nothing moves.
 */
export function focusPose(w: number, h: number, size: number, room?: FocusRoom): Pose {
  const phone = isPhone(w);
  let target = focusTarget(w, h);
  let centreY = phone ? h * 0.1 : h * 0.03;
  let x = 0;
  if (room) {
    const lo = room.top;
    const hi = room.foot - OPEN_BELOW - OPEN_H;
    target = Math.max(FOCUS_MIN, Math.min(target, hi - lo, room.to - room.from));
    x = centreIn(w, room, target);
    // Measured from the top of the screen, then back to y up from the middle.
    const want = h / 2 - centreY;
    const fromTop = Math.max(lo + target / 2, Math.min(want, hi - target / 2));
    if (fromTop !== want) centreY = h / 2 - fromTop;
  }
  const s = target / size;
  return { x, y: centreY - target / 2, z: 0, s, lean: 0, yaw: 0 };
}

// Entrance --------------------------------------------------------------------------------

/** One cover follows the one before it by this long. */
export const DROP_STAGGER_MS = 40;
/** How long one cover takes to fall into place. */
export const DROP_MS = 760;

export interface DropState {
  /** 1 while the cover is still high above the shelf, 0 when it has landed. */
  fall: number;
  /** Extra lean that goes to 0 as it settles. */
  tilt: number;
  /** A small hop after the landing, as a fraction of the cover size. */
  hop: number;
  opacity: number;
}

/** The entrance of cover `index` at `t` ms after the covers start to fall (row one first). */
export function dropState(index: number, t: number): DropState {
  const p = clamp((t - index * DROP_STAGGER_MS) / DROP_MS, 0, 1);
  const land = 0.62;
  const fallP = clamp(p / land, 0, 1);
  const fall = p <= 0 ? 1 : 1 - fallP * fallP;
  const after = clamp((p - land) / (1 - land), 0, 1);
  const hop = p > land ? 0.035 * Math.sin(Math.PI * after) * (1 - after) : 0;
  const tilt = (1 - easeOutCubic(p)) * 0.22;
  return { fall: p >= land ? 0 : fall, tilt, hop, opacity: clamp(p * 6, 0, 1) };
}

/** When the last cover has landed, ms after the start. */
export const ENTRANCE_MS = (COVER_COUNT - 1) * DROP_STAGGER_MS + DROP_MS;

// Keys ---------------------------------------------------------------------------------------

export type ArrowKey = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown";

/** The cover an arrow key moves to. `null` means none yet. Moves stay inside the ten. */
export function moveIndex(current: number | null, key: ArrowKey, phone = false): number {
  const last = COVER_COUNT - 1;
  if (current === null) return key === "ArrowLeft" || key === "ArrowUp" ? last : 0;
  // On the phone the stack is one column: up and left go to the front, down and right further back.
  if (phone) return clamp(current + (key === "ArrowLeft" || key === "ArrowUp" ? -1 : 1), 0, last);
  switch (key) {
    case "ArrowLeft":
      return clamp(current - 1, 0, last);
    case "ArrowRight":
      return clamp(current + 1, 0, last);
    case "ArrowUp":
      return current >= COLS ? current - COLS : current;
    case "ArrowDown":
      return current < COLS ? current + COLS : current;
  }
}

// Phone stack ------------------------------------------------------------------------------

export interface StackGeometry {
  size: number;
  /** How much of each cover behind the front one shows, in pixels. */
  strip: number;
  /** y (up) of the bottom edge of the front cover. */
  frontY: number;
  lean: number;
  thick: number;
}

export function stackGeometry(w: number, h: number): StackGeometry {
  const size = Math.floor(Math.min(w * 0.7, h * 0.32));
  return {
    size,
    strip: size * 0.125,
    frontY: h / 2 - h * 0.79,
    lean: -0.95,
    thick: Math.max(5, size * 0.04),
  };
}

export interface StackPose {
  pose: Pose;
  /** 0 hides the cover (it has been swiped away or is too far back). */
  alpha: number;
  /** Draw order: larger is drawn later (nearer). */
  order: number;
}

/**
 * The pose of cover `index` when the stack is scrolled to `s` (0 shows the first cover in front,
 * 9 the last). The cover in front is full; each one behind it shows a strip above it, a little
 * smaller. A cover that is being swiped away (`index < s`) slides down and fades.
 */
export function stackPose(index: number, s: number, g: StackGeometry): StackPose {
  const d = index - s;
  const leaving = clamp(-d, 0, 1);
  const behind = Math.max(0, d);
  const alpha = d <= -1 ? 0 : clamp(1 + Math.min(d, 0), 0, 1);
  const pose: Pose = {
    x: 0,
    y: g.frontY + behind * g.strip - leaving * g.size * 0.55,
    z: -behind * 14 + leaving * g.size * 0.3,
    s: 1 - behind * 0.009 + leaving * 0.04,
    lean: g.lean,
    yaw: 0,
  };
  return { pose, alpha, order: 100 - d };
}

export function clampStack(s: number): number {
  return clamp(s, 0, COVER_COUNT - 1);
}

/** The scroll position after dragging the finger `dy` pixels (up is negative) from `start`. */
export function dragToStack(start: number, dy: number, g: StackGeometry): number {
  return clampStack(start - dy / (g.strip * 3.2));
}

/** Where the stack settles after a release at `s` with velocity `v` (cover steps per second). */
export function snapStack(s: number, v: number): number {
  return clampStack(Math.round(s + clamp(v, -6, 6) * 0.18));
}

/** The cover shown in front for a scroll position. */
export function frontIndex(s: number): number {
  return clamp(Math.round(s), 0, COVER_COUNT - 1);
}

// Counts -------------------------------------------------------------------------------------

export function formatCount(n: number | undefined): string {
  return typeof n === "number" && Number.isFinite(n) ? n.toLocaleString("en-US") : "";
}

// The Video split ------------------------------------------------------------------------------
//
// The Video cover is a gatefold sleeve: a front panel hinged on the back panel. Opened, the inside
// of the front panel is Films and the face of the back panel is Others. On a wide screen the front
// panel swings open on its left edge, toward the viewer, and the pair ends side by side; on a
// phone it flips up on its top edge and the pair ends one above the other. One number, `p` (0 shut,
// 1 open), drives the whole motion; it moves at a constant speed toward its target, so a reversal
// half way runs back from where it is. Each part of the motion eases inside its own window of `p`.

/** Time of a full opening and of a full closing, at the constant speed of `p`. */
export const SPLIT_OPEN_MS = 980;
export const SPLIT_CLOSE_MS = 640;

/** While `p` is above this the cover holds the focus; below it, it may fly back to the shelf. */
export const SPLIT_RELEASE = 0.1;

/** The windows of `p`: the pair grows and moves into place, the panel swings, the halves part. */
const GROW: [number, number] = [0, 0.66];
const SWING: [number, number] = [0.1, 0.86];
const PART: [number, number] = [0.74, 1];

/** Room the split leaves on a wide screen, in CSS px. */
export const SPLIT_ROOM = {
  /** Under the top bar: the tagline and the search button on the left, Continue on the right. */
  top: 104,
  /** The index row at the foot. */
  bottom: 104,
  /** The line and the Open button under each half, and the Back button under them. */
  caption: 112,
  back: 52,
  side: 48,
} as const;

/** Room the split leaves on a phone, in CSS px. */
export const SPLIT_ROOM_PHONE = {
  /**
   * Under the top bar and the Continue button, which stands on the row under the tagline (about
   * 152 px from the top, 88 under a 64 px bar). The tagline hides while the cover is open.
   */
  top: 104,
  /** The bar with the name and Back at the foot. */
  bottom: 120,
  /** The line and the Open button under each half. */
  caption: 66,
  side: 24,
} as const;

/**
 * Room the split leaves on a short screen (`isShort`: a phone on its side). The index row steps
 * aside and the halves lose their line, so a half has only its count and Open under it. The pair
 * stands between the controls at the two sides, not under them.
 */
export const SPLIT_ROOM_SHORT = {
  top: 8,
  bottom: 16,
  /** The count and the Open button under each half, and the Back button under them. */
  caption: 68,
  back: 52,
  side: 48,
} as const;

const SPLIT_ROOM_PHONE_SHORT = {
  top: 8,
  bottom: 112,
  /** The count and the Open button under each half (a phone's Back is in the bar). */
  caption: 56,
  side: 24,
} as const;

/** The room under a half for its caption, and the distance from the foot of the halves to the top of Back. */
export function splitCaption(w: number, h: number): number {
  if (isPhone(w)) return isShort(h) ? SPLIT_ROOM_PHONE_SHORT.caption : SPLIT_ROOM_PHONE.caption;
  return isShort(h) ? SPLIT_ROOM_SHORT.caption : SPLIT_ROOM.caption;
}

export interface SplitGeometry {
  /** Side of each half when open. */
  size: number;
  /**
   * Distance between the two halves when open. Side by side it is a narrow seam; stacked it holds
   * the line and the Open button of the upper half.
   */
  gap: number;
  /** Centre of the two squares when open (y up, from the middle of the screen). */
  cx: number;
  cy: number;
  /** A phone: Films above Others. Otherwise Films on the left. */
  vertical: boolean;
}

/** What `splitGeometry` may be told about the screen. */
interface SplitInputs {
  /** The screen is short (`isShort`). Taken from `h` when left out. */
  short?: boolean;
  /** The boxes over the open pair that it must clear (`Obstacles.splitAbove`). */
  above?: readonly Box[];
}

/**
 * Where the two halves stand when the cover is open, for a stage of `w` by `h` with a top bar
 * `navH` high. The pair stands under the controls at the top (the fixed room above, or the boxes
 * measured if they reach lower), or, on a short screen, between the controls at the two sides.
 */
export function splitGeometry(
  w: number,
  h: number,
  navH = navHeight(w),
  inputs: SplitInputs = {},
): SplitGeometry {
  const short = inputs.short ?? isShort(h);
  const above = inputs.above ?? [];
  const phone = isPhone(w);
  const lay = (top: number, span: { from: number; to: number }): SplitGeometry =>
    phone
      ? layPhone(w, h, top, short ? SPLIT_ROOM_PHONE_SHORT : SPLIT_ROOM_PHONE, span, short)
      : layWide(w, h, top, short ? SPLIT_ROOM_SHORT : SPLIT_ROOM, span, short);
  const r = phone
    ? short
      ? SPLIT_ROOM_PHONE_SHORT
      : SPLIT_ROOM_PHONE
    : short
      ? SPLIT_ROOM_SHORT
      : SPLIT_ROOM;
  const span = short ? flank(above, w, r.side) : { from: r.side, to: w - r.side };
  const top0 = navH + r.top;
  const g = lay(top0, span);
  if (short) return g;
  // The columns the pair uses. If a measured control reaches lower than the pair starts, the pair
  // is laid out again under that control (a pair that already clears it does not move).
  const half = g.vertical ? g.size / 2 : g.size + g.gap / 2;
  const reach = g.vertical ? g.size + g.gap / 2 : g.size / 2;
  const clear = clearBelow(above, w / 2 + g.cx - half, w / 2 + g.cx + half);
  return clear > h / 2 - g.cy - reach + 0.5 ? lay(Math.max(top0, clear), span) : g;
}

type SplitRoom = { top: number; bottom: number; caption: number; side: number };

function layPhone(
  w: number,
  h: number,
  top: number,
  r: SplitRoom,
  span: { from: number; to: number },
  short: boolean,
): SplitGeometry {
  const room = h - top - r.bottom;
  const width = span.to - span.from;
  const seam = 16;
  // One above the other (a tall phone), or side by side when that gives the larger squares (a
  // short one). Side by side, each line wraps under a narrow half, so it gets twice the room
  // (a short screen has no line, so one row).
  const tall = Math.floor(Math.min(width, (room - r.caption * 2 - seam) / 2));
  const wideGap = 14;
  const rows = short ? 1 : 2;
  const wide = Math.floor(Math.min((width - wideGap) / 2, room - r.caption * rows));
  if (tall >= wide) {
    const size = Math.max(80, tall);
    const gap = r.caption + seam;
    const block = size * 2 + gap + r.caption;
    const blockTop = top + Math.max(0, (room - block) / 2);
    // From the top of the screen to the middle of the two squares.
    const mid = blockTop + size + gap / 2;
    const cx = short ? centreIn(w, span, size) : 0;
    return { size, gap, cx, cy: h / 2 - mid, vertical: true };
  }
  const size = Math.max(80, wide);
  const block = size + r.caption * rows;
  const blockTop = top + Math.max(0, (room - block) / 2);
  const cx = short ? centreIn(w, span, size * 2 + wideGap) : 0;
  return { size, gap: wideGap, cx, cy: h / 2 - (blockTop + size / 2), vertical: false };
}

function layWide(
  w: number,
  h: number,
  top: number,
  r: SplitRoom & { back: number },
  span: { from: number; to: number },
  short: boolean,
): SplitGeometry {
  const room = h - top - r.bottom;
  const gap = Math.round(clamp(w * 0.014, 14, 28));
  const size = Math.floor(
    Math.max(80, Math.min(h * 0.4, room - r.caption - r.back, (span.to - span.from - gap) / 2)),
  );
  const block = size + r.caption + r.back;
  const blockTop = top + Math.max(0, (room - block) / 2);
  const mid = blockTop + size / 2;
  const cx = short ? centreIn(w, span, size * 2 + gap) : 0;
  return { size, gap, cx, cy: h / 2 - mid, vertical: false };
}

function seg(p: number, [a, b]: [number, number]): number {
  return clamp((p - a) / (b - a), 0, 1);
}

/**
 * A swing that lands with a little weight: ease in and out, then a soft swing past flat by about
 * two degrees that settles. The bump is a squared sine, so the speed has no jump anywhere.
 */
export function swingEase(t: number): number {
  const x = clamp(t, 0, 1);
  const u = clamp((x - 0.72) / 0.28, 0, 1);
  return easeInOutCubic(x) + 0.022 * Math.sin(Math.PI * u) ** 2;
}

export interface SplitFrame {
  /** Side of each half now. */
  size: number;
  /** Centre of the back panel (Others). */
  leaf: { x: number; y: number };
  /**
   * The hinge of the front panel: the line its inner edge turns about. Side by side it is the
   * vertical line at `hinge.x`; stacked, the horizontal line at `hinge.y`.
   */
  hinge: { x: number; y: number };
  /** How far the front panel has turned: 0 shut, PI open. */
  angle: number;
  /** 0 to 1, how far the halves have moved apart. */
  part: number;
}

/**
 * The gatefold at progress `p`. `from` is the shut cover (centre and side); `to` is where the open
 * pair stands (`splitGeometry`, in the same units). The pair is kept centred while it opens: the back
 * panel slides by half a side as the front one swings over.
 */
export function splitFrame(
  p: number,
  from: { x: number; y: number; size: number },
  to: { cx: number; cy: number; size: number; gap: number; vertical: boolean },
): SplitFrame {
  const grow = easeInOutCubic(seg(p, GROW));
  const swing = swingEase(seg(p, SWING));
  const part = easeOutCubic(seg(p, PART));
  const size = lerp(from.size, to.size, grow);
  const angle = Math.PI * swing;
  // The share of the slide that keeps the pair centred: 0 shut, 1 open (smooth through the turn).
  const r = (1 - Math.cos(Math.PI * clamp(swing, 0, 1))) / 2;
  const cx = lerp(from.x, to.cx, grow);
  const cy = lerp(from.y, to.cy, grow);
  const gap = to.gap * part;
  if (to.vertical) {
    const leafY = cy - (size / 2) * r - gap / 2;
    return {
      size,
      leaf: { x: cx, y: leafY },
      hinge: { x: cx, y: leafY + size / 2 + gap },
      angle,
      part,
    };
  }
  const leafX = cx + (size / 2) * r + gap / 2;
  return {
    size,
    leaf: { x: leafX, y: cy },
    hinge: { x: leafX - size / 2 - gap, y: cy },
    angle,
    part,
  };
}

/**
 * Depth of the two panels. Before the split starts the front panel is the whole cover and the back
 * panel is hidden, so on the shelf the Video cover is one box exactly like the other nine. Once it
 * starts, each panel is half as thick and the hinge sits between them. The front face stays at 0.
 */
export function gatefoldDepth(
  thick: number,
  started: boolean,
): { flap: number; leaf: number; hingeZ: number } {
  return started
    ? { flap: thick / 2, leaf: thick / 2, hingeZ: -thick / 2 }
    : { flap: thick, leaf: 0, hingeZ: -thick };
}

/** Centre of the front panel (Films) once it has turned by `angle` about its hinge. */
export function flapCentre(f: SplitFrame, vertical: boolean): { x: number; y: number } {
  const c = Math.cos(f.angle) * (f.size / 2);
  return vertical ? { x: f.hinge.x, y: f.hinge.y - c } : { x: f.hinge.x + c, y: f.hinge.y };
}

/** The half an arrow key moves to inside the open Video cover: 0 Films, 1 Others. */
export function moveHalf(current: 0 | 1 | null, key: ArrowKey, vertical: boolean): 0 | 1 {
  const back = vertical ? key === "ArrowUp" : key === "ArrowLeft";
  const forward = vertical ? key === "ArrowDown" : key === "ArrowRight";
  if (back) return 0;
  if (forward) return 1;
  // The other axis toggles.
  return current === 0 ? 1 : 0;
}

/** Brightness of the two faces of the front panel as it turns (no lights in the scene). */
export function flapShade(angle: number): { front: number; back: number } {
  const t = clamp(angle / Math.PI, 0, 1);
  const s = Math.sin(Math.PI * t);
  return {
    front: 1 - 0.42 * clamp(t * 2, 0, 1) ** 1.5,
    back: 0.6 + 0.4 * clamp((t - 0.5) * 2, 0, 1) ** 0.8 - 0.06 * s,
  };
}
