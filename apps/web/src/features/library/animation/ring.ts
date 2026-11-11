/**
 * The pure geometry of the carousel (no DOM). The ten panels stand on a tilted ring, like the
 * reference: a ring seen from a camera with a 35 degree field of view, squashed to an ellipse in
 * depth, tilted back and turned a little, with the front panel nearest the viewer. Every panel is a
 * box the size of the screen. Its picture is the full screen view of that character, shown through
 * a window the size of a panel (see `features/story/morph/morph-math.ts`), and one 3D transform
 * puts it on the ring. Launch takes that transform to none and opens the window to the screen, so
 * the panel becomes the full screen view without a cut.
 *
 * Positions on the ring are counted in panels: `p` is the panel in front (a fraction while the ring
 * turns), and the offset of a panel is how many panels it stands from the front, wrapped so that it
 * is between -N/2 and N/2.
 */

import {
  stageFit,
  type Box,
  type Placement,
  type Point,
  type Rect,
} from "@/features/story/morph/morph-math";

/** Horizontal field of view of the camera, as in the reference. */
const FOV = (35 * Math.PI) / 180;
/** The ring has room for this many panels: those further than half of it are hidden behind it. */
const SLOTS = 6;
/** A panel fills this much of its slot, so there is a gap between two panels. */
const FILL = 0.9;
/** The ring is squashed to an ellipse in depth by this much. */
const SQUASH = 0.5;
/** The tilt of the ring (radians): its front is lifted and it turns up to the right. */
const TILT_X = 0.18;
const TILT_Z = -0.12;
/** A panel more than this many panels from the front starts to fade, and is gone one panel later. */
const FADE_FROM = 2.2;
/** Where the picture of a panel is held when the window is narrower than the screen. */
const PANEL_FOCUS: Point = { x: 0.5, y: 0.45 };

export interface RingGeometry {
  /** The screen. */
  readonly view: Box;
  /** The CSS perspective of the scene, in pixels. */
  readonly perspective: number;
  /** The window of the front panel, centred in its box. */
  readonly win: Rect;
  /** Radius of the ring in pixels (before the squash). */
  readonly radius: number;
  /** Where the centre of the front panel is moved to, from the middle of the screen. */
  readonly shift: { readonly x: number; readonly y: number; readonly z: number };
  /** True on a narrow screen: the panels are portrait and the ring sits higher. */
  readonly narrow: boolean;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** The ring for a screen. Pure, so the way back can be worked out before anything is measured. */
export function ringGeometry(view: Box): RingGeometry {
  const W = Math.max(1, view.w);
  const H = Math.max(1, view.h);
  const narrow = W < H;
  let w: number;
  let h: number;
  if (narrow) {
    // Portrait panels: the characters stand, and a phone shows them whole.
    const aspect = 0.68;
    w = Math.min(0.62 * W, 0.46 * H * aspect);
    h = w / aspect;
  } else {
    // The panel has the shape of the screen (within limits), so it shows the full screen view.
    const aspect = clamp(W / H, 1.3, 2);
    w = Math.min(0.62 * W, 0.62 * H * aspect);
    h = w / aspect;
  }
  const perspective = W / 2 / Math.tan(FOV / 2);
  const radius = w / FILL / (2 * Math.sin(Math.PI / SLOTS));
  // The front panel's centre lands where the layout wants it: a little above the middle on a
  // wide screen (the title sits over its lower left corner), in the upper part on a phone.
  const target = narrow ? { x: 0, y: 0.36 * H - H / 2 } : { x: 0, y: 0.47 * H - H / 2 };
  const front = radius * SQUASH;
  // The tilt lifts the front of the ring by front * sin(TILT_X) and moves it back a little.
  const shift = {
    x: target.x,
    y: target.y + front * Math.sin(TILT_X),
    z: -front * Math.cos(TILT_X),
  };
  return {
    view: { w: W, h: H },
    perspective,
    win: { x: (W - w) / 2, y: (H - h) / 2, w, h },
    radius,
    shift,
    narrow,
  };
}

/** `n` wrapped into [-count / 2, count / 2). */
export function wrapOffset(n: number, count: number): number {
  const half = count / 2;
  return ((((n + half) % count) + count) % count) - half;
}

/** Index `i` wrapped into [0, count). */
export function wrapIndex(i: number, count: number): number {
  return ((Math.round(i) % count) + count) % count;
}

/** How far panel `index` stands from the front when the ring is at `p`. */
export function offsetOf(index: number, p: number, count: number): number {
  return wrapOffset(index - p, count);
}

const deg = (rad: number) => Math.round(((rad * 180) / Math.PI) * 1e4) / 1e4;
const px = (n: number) => `${Math.round(n * 100) / 100}px`;

/**
 * The 3D transform of a panel that stands `offset` panels from the front. The list has the same
 * functions whatever the numbers, so the browser animates between two of them function by
 * function (the ring turns, it does not swing through a matrix).
 */
export function placement(g: RingGeometry, offset: number): string {
  const angle = (offset * 2 * Math.PI) / SLOTS;
  return [
    `translate3d(${px(g.shift.x)}, ${px(g.shift.y)}, ${px(g.shift.z)})`,
    `rotateX(${deg(TILT_X)}deg)`,
    `rotateZ(${deg(TILT_Z)}deg)`,
    `scale3d(1, 1, ${SQUASH})`,
    `rotateY(${deg(angle)}deg)`,
    `translateZ(${px(g.radius)})`,
  ].join(" ");
}

/** The same list with every function at rest: the panel lies flat on the screen. */
export const FLAT =
  "translate3d(0px, 0px, 0px) rotateX(0deg) rotateZ(0deg) scale3d(1, 1, 1) rotateY(0deg) translateZ(0px)";

/** How visible a panel is at an offset: the far side of the ring fades out. */
export function visibility(offset: number): number {
  return clamp(FADE_FROM + 1 - Math.abs(offset), 0, 1);
}

/** Where the picture sits inside a panel's window on the ring (screen pixels, origin top left). */
export function ringContent(g: RingGeometry): Placement {
  const fit = stageFit({ w: g.win.w, h: g.win.h }, g.view, PANEL_FOCUS);
  return { x: g.win.x + fit.x, y: g.win.y + fit.y, s: fit.s };
}

/** The window and the picture of the full screen view. */
export function fullWindow(g: RingGeometry): { win: Rect; content: Placement } {
  return { win: { x: 0, y: 0, w: g.view.w, h: g.view.h }, content: { x: 0, y: 0, s: 1 } };
}

// The frame ----------------------------------------------------------------------------------------

/** The shape of the recordings (3840 by 1728, every character, every size). */
export const FRAME_ASPECT = 3840 / 1728;

/**
 * The box of the stage inside a picture the size of the screen: the recording covers the screen,
 * with `focus` (0 to 1 from the left) kept in view, as `object-fit: cover` with that position does.
 * The box has the recording's own shape, so the videos in it show their whole frame.
 */
export function frameBox(view: Box, focus: number): Rect {
  const w = Math.max(1, view.w);
  const h = Math.max(1, view.h);
  if (w / h < FRAME_ASPECT) {
    const fw = h * FRAME_ASPECT;
    return { x: (w - fw) * clamp(focus, 0, 1), y: 0, w: fw, h };
  }
  const fh = w / FRAME_ASPECT;
  return { x: 0, y: (h - fh) / 2, w, h: fh };
}

/** The frame box moved and scaled to fit whole inside the screen, centred (Whole frame). */
export function wholeFrame(view: Box, box: Rect): Placement {
  const s = Math.min(1, view.w / box.w, view.h / box.h);
  return {
    x: (view.w - box.w * s) / 2 - box.x,
    y: (view.h - box.h * s) / 2 - box.y,
    s,
  };
}

/** The transform of the frame box, from its place (origin top left). One list, so it animates. */
export function frameTransform(p: Placement | null): string {
  const { x, y, s } = p ?? { x: 0, y: 0, s: 1 };
  return `translate(${px(x)}, ${px(y)}) scale(${Math.round(s * 1e5) / 1e5})`;
}

// Motion -------------------------------------------------------------------------------------------

/** Time of a step made by a press (the reference: 0.5 s; its own step took 1.15 s). */
export const PRESS_STEP_MS = 650;
export const SNAP_BACK_MS = 300;

/** A drag of the full screen width turns the ring this many panels (the reference: 0.75). */
const DRAG_PANELS_PER_SCREEN = 0.75;
/** A drag shorter than this part of a panel springs back. */
const DRAG_GO = 0.05;

/** The turn of the ring during a drag, from the distance dragged (positive is to the next). */
export function dragTurn(distance: number, screen: number): number {
  return (-distance / Math.max(1, screen)) * DRAG_PANELS_PER_SCREEN;
}

/**
 * Where a drag ends: back where it began when it was short, otherwise the next whole panel in its
 * direction (at least one, more when the drag went further).
 */
export function dragTarget(start: number, now: number): number {
  const turned = now - start;
  if (Math.abs(turned) < DRAG_GO) return start;
  const panels = Math.max(1, Math.round(Math.abs(turned)));
  return start + Math.sign(turned) * panels;
}

/** The wheel: deltas count towards one step a gesture. */
export interface WheelMeter {
  sum: number;
  last: number;
  /** The gesture already gave its step: nothing until the wheel has been quiet. */
  spent: boolean;
}

const WHEEL_STEP = 40;
/** A pause this long between two wheel events starts a new gesture. */
export const WHEEL_GAP_MS = 160;

export function newWheel(): WheelMeter {
  return { sum: 0, last: -Infinity, spent: false };
}

/**
 * Feed one wheel event (its larger delta, positive towards the next panel, in pixels). Gives the
 * step it makes (1, -1) or 0. One gesture makes one step, however long its momentum runs.
 */
export function feedWheel(meter: WheelMeter, delta: number, now: number): -1 | 0 | 1 {
  if (now - meter.last > WHEEL_GAP_MS) {
    meter.sum = 0;
    meter.spent = false;
  }
  meter.last = now;
  if (meter.spent) return 0;
  // A turn the other way within a gesture starts the count again.
  if (Math.sign(delta) !== Math.sign(meter.sum)) meter.sum = 0;
  meter.sum += delta;
  if (Math.abs(meter.sum) < WHEEL_STEP) return 0;
  meter.spent = true;
  return meter.sum > 0 ? 1 : -1;
}

/** A wheel delta in pixels, whatever the event's unit. */
export function wheelPixels(delta: number, mode: number): number {
  return mode === 1 ? delta * 16 : mode === 2 ? delta * 400 : delta;
}
