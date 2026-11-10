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

/** The pose of the focused cover: scaled up in the middle of the screen. */
export function focusPose(w: number, h: number, size: number): Pose {
  const phone = isPhone(w);
  const target = phone ? Math.min(w * 0.8, h * 0.46) : Math.min(h * 0.46, w * 0.34);
  const centreY = phone ? h * 0.1 : h * 0.03;
  const s = target / size;
  return { x: 0, y: centreY - target / 2, z: 0, s, lean: 0, yaw: 0 };
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
  /** Under the top bar and the Continue button (the tagline hides while the cover is open). */
  top: 64,
  /** The bar with the name and Back at the foot. */
  bottom: 120,
  /** The line and the Open button under each half. */
  caption: 66,
  side: 24,
} as const;

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

/** Where the two halves stand when the cover is open, for a stage of `w` by `h` with a top bar `navH` high. */
export function splitGeometry(w: number, h: number, navH = w >= 901 ? 80 : 64): SplitGeometry {
  if (isPhone(w)) {
    const r = SPLIT_ROOM_PHONE;
    const top = navH + r.top;
    const room = h - top - r.bottom;
    const seam = 16;
    // One above the other (a tall phone), or side by side when that gives the larger squares (a
    // short one). Side by side, each line wraps under a narrow half, so it gets twice the room.
    const tall = Math.floor(Math.min(w - r.side * 2, (room - r.caption * 2 - seam) / 2));
    const wideGap = 14;
    const wide = Math.floor(Math.min((w - r.side * 2 - wideGap) / 2, room - r.caption * 2));
    if (tall >= wide) {
      const size = Math.max(80, tall);
      const gap = r.caption + seam;
      const block = size * 2 + gap + r.caption;
      const blockTop = top + Math.max(0, (room - block) / 2);
      // From the top of the screen to the middle of the two squares.
      const mid = blockTop + size + gap / 2;
      return { size, gap, cx: 0, cy: h / 2 - mid, vertical: true };
    }
    const size = Math.max(80, wide);
    const block = size + r.caption * 2;
    const blockTop = top + Math.max(0, (room - block) / 2);
    return { size, gap: wideGap, cx: 0, cy: h / 2 - (blockTop + size / 2), vertical: false };
  }
  const r = SPLIT_ROOM;
  const top = navH + r.top;
  const room = h - top - r.bottom;
  const gap = Math.round(clamp(w * 0.014, 14, 28));
  const size = Math.floor(
    Math.max(80, Math.min(h * 0.4, room - r.caption - r.back, (w - r.side * 2 - gap) / 2)),
  );
  const block = size + r.caption + r.back;
  const blockTop = top + Math.max(0, (room - block) / 2);
  const mid = blockTop + size / 2;
  return { size, gap, cx: 0, cy: h / 2 - mid, vertical: false };
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
