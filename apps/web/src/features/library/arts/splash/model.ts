/**
 * The pure maths of the Splash art stage (no DOM). The page is one fixed screen with a stack of
 * windows. One number, `pos`, is the place in the list in pictures; input only moves a `target` and
 * a frame loop eases `pos` after it. Everything on the screen is a function of `pos` and of the
 * layout, which is a function of the screen's size. See `docs/design/arts-reference.md` for the
 * reference this follows and the calls made.
 *
 * A picture `k` stands at a signed offset `d = signedWrap(k - pos, n)` from the middle. The loop
 * has no jump: a window leaves at one end far outside the screen and comes in at the other.
 */
import { clamp, damp } from "@/lib/math";

import type { FrameRect } from "../core/types";

// The motion -----------------------------------------------------------------------------------

/** The ease of the stepper: `1 - exp(-LAMBDA dt)`, which is the reference's 9 percent a frame at 60 Hz. */
export const LAMBDA = 5.66;
/** While a finger is down the place follows it more closely. */
export const LAMBDA_DRAG = 16;
/** Closer than this to the target (in pictures) the place snaps to it. */
export const SETTLE = 0.002;
/** A window with an offset under this is drawn: five at most. */
export const REACH = 2.5;
/** Pictures within this many places of the one in front have their window mounted and their file asked for. */
export const NEAR = 3;
/** A row of the title list beyond this many places is not drawn. */
export const ROW_REACH = 5.5;
/** The entrance starts this many places down and glides to the first picture. */
export const ENTRANCE_FROM = 3;
/** The stage rises this far, in pixels, while it fades in. */
export const ENTRANCE_RISE = 300;
export const ENTRANCE_MS = 1000;
/** The entrance has landed (the caption may arrive) when it is this close to the first picture: the last hundredths cannot be seen. */
export const LAND_AT = 0.02;
/** The target never runs further than this many places ahead of the place (a held key). */
export const MAX_LEAD = 2;
/** The inner picture moves with this power of the offset (it settles slowly). */
const INNER_POWER = 1.8;

/** `x` brought into `-n/2 .. n/2` (a signed wrap, unlike the plain modulo of `@/lib/math`). */
export function signedWrap(x: number, n: number): number {
  return x - n * Math.round(x / n);
}

/** The plain modulo, 0 to n - 1, for negative numbers too. */
export function mod(i: number, n: number): number {
  return ((i % n) + n) % n;
}

/** The signed offset of picture `k` from the middle when the place is `pos`. */
export function offsetOf(k: number, pos: number, n: number): number {
  return signedWrap(k - pos, n);
}

/** The picture in front: the place rounded, brought into the list. */
export function activeOf(pos: number, n: number): number {
  return mod(Math.round(pos), n);
}

/** One step of the ease. Returns the new place; it is `target` itself once it is close enough. */
export function stepPos(pos: number, target: number, dt: number, lambda = LAMBDA): number {
  if (Math.abs(target - pos) < SETTLE) return target;
  const next = damp(pos, target, lambda, dt);
  return Math.abs(target - next) < SETTLE ? target : next;
}

/** The target one step from `target` (rounded to a whole place first, as the reference does). */
export function stepTarget(target: number, dir: 1 | -1): number {
  return Math.round(target) + dir;
}

/** Keep the target no further than `MAX_LEAD` places from the place. */
export function limitLead(target: number, pos: number, max = MAX_LEAD): number {
  return clamp(target, pos - max, pos + max);
}

/** The whole place of picture `index` that is nearest to the place `pos` (a jump takes the short way round). */
export function slotOf(index: number, pos: number, n: number): number {
  const base = Math.round(pos);
  return base + signedWrap(index - base, n);
}

/** Bring `pos` and `target` back near zero without moving anything on the screen. */
export function rebase(pos: number, target: number, n: number): { pos: number; target: number } {
  const shift = n * Math.floor(pos / n);
  return { pos: pos - shift, target: target - shift };
}

/** The pictures whose window is mounted when the one in front is `active`: `NEAR` each side. */
export function nearIndexes(active: number, n: number, near = NEAR): number[] {
  const out: number[] = [];
  for (let j = -near; j <= near; j += 1) {
    const k = mod(active + j, n);
    if (!out.includes(k)) out.push(k);
  }
  return out;
}

// The layout -----------------------------------------------------------------------------------

type LayoutMode = "wide" | "tablet" | "phone";

export interface Layout {
  mode: LayoutMode;
  /** The title list shows (1024 px and wider). */
  list: boolean;
  /** The window: the part of the picture that shows. */
  ww: number;
  wh: number;
  /** The pane behind the window, that the picture fills. It is the window with `padX` and `padY` more on each side. */
  pw: number;
  ph: number;
  padX: number;
  padY: number;
  /** The share of the picture that the window hides on each side at rest. */
  inset: number;
  /** The distance between two pictures. */
  step: number;
  /** The window parallax: how much less than the step the window moves while it is within one place of the middle. */
  a: number;
  /** The inner parallax: how far the picture moves inside its window (never more than `padY`). */
  b: number;
  /** The distance between two rows of the title list. */
  row: number;
}

const RATIO = 9 / 16;
/** The reference's window width: `(0.5674 w + 165) x 0.74` on a wide screen, `x 0.9` under 1024. */
const FACTOR_WIDE = 0.74;
const FACTOR_NARROW = 0.9;
const INSET_WIDE = 0.1;
const INSET_NARROW = 0.08;

/**
 * Where everything stands on a screen of `w` by `h`. Everything follows the width, and a short
 * screen scales the whole stage so a window is never more than half of the height.
 */
export function computeLayout(w: number, h: number): Layout {
  const mode: LayoutMode = w >= 1024 ? "wide" : w >= 768 ? "tablet" : "phone";
  const wide = mode === "wide";
  const raw = (0.5674 * w + 165) * (wide ? FACTOR_WIDE : FACTOR_NARROW);
  const k = Math.min(1, (0.5 * h) / (raw * RATIO));
  const ww = 2 * Math.round((raw * k) / 2);
  const wh = Math.round(ww * RATIO);
  const sh = w * RATIO * k;
  const step = Math.round(mode === "phone" ? sh * 1.25 : sh * 0.8);
  const g = mode === "phone" ? 0.22 : 0.55;
  const a = Math.round(Math.max(0, Math.min(0.2 * step, g * (step - wh))));
  const inset = wide ? INSET_WIDE : INSET_NARROW;
  const padX = Math.round((ww * inset) / (1 - 2 * inset));
  const padY = Math.round((wh * inset) / (1 - 2 * inset));
  return {
    mode,
    list: wide,
    ww,
    wh,
    pw: ww + 2 * padX,
    ph: wh + 2 * padY,
    padX,
    padY,
    inset,
    step,
    a,
    b: padY,
    row: Math.round(clamp(w * 0.016, 20, 28)),
  };
}

/** The window's own offset from the middle, in pixels, for a picture at offset `d` (+ is below). */
export function windowY(d: number, layout: Pick<Layout, "step" | "a">): number {
  return d * layout.step - clamp(d, -1, 1) * layout.a;
}

/** The picture's offset inside its window, in pixels: the other way from the window, settling slowly. */
export function innerY(d: number, layout: Pick<Layout, "b">): number {
  const dc = clamp(d, -1, 1);
  return -Math.sign(dc) * Math.abs(dc) ** INNER_POWER * layout.b;
}

/**
 * The opacity of a title row `r` places from the one in front (fractions of a place):
 * 1, 0.8, 0.5, 0.2, 0.1 at 0 to 4, then it dies away to nothing at 5.5. Ten ghost rows at 0.1
 * would fill the screen with faint text, so the far ones go.
 */
export function rowOpacity(r: number): number {
  const x = Math.abs(r);
  if (x <= 1) return 1 - 0.2 * x;
  if (x <= 2) return 0.8 - 0.3 * (x - 1);
  if (x <= 3) return 0.5 - 0.3 * (x - 2);
  if (x <= 4) return 0.2 - 0.1 * (x - 3);
  if (x <= 5) return 0.1 - 0.04 * (x - 4);
  if (x <= ROW_REACH) return (0.06 * (ROW_REACH - x)) / (ROW_REACH - 5);
  return 0;
}

/**
 * The part of the picture that the window shows, as fractions of the whole picture. `frame` is the
 * part of the picture that the pane shows; the window shows the middle of the pane, moved by the
 * picture's own offset `iy` (pixels, + is down). The zoom grows the picture from this part.
 */
export function visibleFrame(
  frame: FrameRect,
  layout: Pick<Layout, "ww" | "wh" | "pw" | "ph" | "padX" | "padY">,
  iy = 0,
): FrameRect {
  return {
    x: frame.x + (frame.w * layout.padX) / layout.pw,
    y: frame.y + (frame.h * (layout.padY - iy)) / layout.ph,
    w: (frame.w * layout.ww) / layout.pw,
    h: (frame.h * layout.wh) / layout.ph,
  };
}

// The wheel ------------------------------------------------------------------------------------

/** A wheel turn with less than this (in pixels) is ignored. */
const WHEEL_MIN = 4;
/** A step also needs the wheel to have been still for this long ... */
const WHEEL_IDLE_MS = 120;
/** ... or the turn to be bigger than this share of the biggest turn of the last `WHEEL_WINDOW_MS`. */
const WHEEL_GROW = 0.9;
const WHEEL_WINDOW_MS = 80;
/** Two steps are at least this far apart. */
export const STEP_GAP_MS = 200;

/** A wheel turn in pixels: lines count 16, pages the screen's height. */
export function wheelPixels(deltaY: number, deltaMode: number, screen: number): number {
  if (deltaMode === 1) return deltaY * 16;
  if (deltaMode === 2) return deltaY * screen;
  return deltaY;
}

/**
 * Decides which wheel turns are a step. One swipe on a trackpad is a long tail of shrinking turns:
 * it gives one step, and a new, harder swipe gives another. A notch of a mouse wheel is one step.
 */
export class WheelGate {
  private last = Number.NEGATIVE_INFINITY;
  private stepped = Number.NEGATIVE_INFINITY;
  private recent: Array<{ t: number; d: number }> = [];

  /** Feed one turn (`delta` in pixels, + is down) at time `t` (ms). Returns 1, -1 or 0 for no step. */
  feed(t: number, delta: number): 1 | -1 | 0 {
    const size = Math.abs(delta);
    if (size < WHEEL_MIN) return 0;
    const idle = t - this.last;
    this.recent = this.recent.filter((e) => t - e.t <= WHEEL_WINDOW_MS);
    const biggest = this.recent.reduce((m, e) => Math.max(m, e.d), 0);
    this.recent.push({ t, d: size });
    this.last = t;
    const fresh = idle > WHEEL_IDLE_MS || size > WHEEL_GROW * biggest;
    if (!fresh || t - this.stepped < STEP_GAP_MS) return 0;
    this.stepped = t;
    return delta > 0 ? 1 : -1;
  }
}

// The finger -----------------------------------------------------------------------------------

/** A touch that moved less than this is a tap. */
export const TAP_PX = 6;
/** The finger travels this far, past the dead zone, to take the stage one whole place. */
const TOUCH_FULL_PX = 46;
/** Let go after more than this and the step is made; less and the stage goes back. */
const TOUCH_COMMIT_PX = 16;

/**
 * How far the place is taken while a finger is down, in pictures, from the finger's travel `dy`
 * (+ is down). Up takes the stage to the next picture. It holds at one place.
 */
export function touchPlace(dy: number): number {
  const eff = Math.max(0, Math.abs(dy) - TAP_PX);
  if (eff === 0) return 0;
  return -Math.sign(dy) * Math.min(1, eff / TOUCH_FULL_PX);
}

/** What letting go does: a step in the direction of the move, or none. */
export function touchStep(dy: number): 1 | -1 | 0 {
  if (Math.abs(dy) <= TOUCH_COMMIT_PX) return 0;
  return dy < 0 ? 1 : -1;
}

// The keys -------------------------------------------------------------------------------------

export type KeyAction = 1 | -1 | "first" | "last" | "open";

/** What a key does on the stage, or null when it is not ours. */
export function keyAction(key: string, shift = false): KeyAction | null {
  switch (key) {
    case "ArrowDown":
    case "PageDown":
      return 1;
    case "ArrowUp":
    case "PageUp":
      return -1;
    case " ":
      return shift ? -1 : 1;
    case "Home":
      return "first";
    case "End":
      return "last";
    case "Enter":
      return "open";
    default:
      return null;
  }
}

// The caption wave -----------------------------------------------------------------------------

/**
 * The delay of each letter, in seconds, for a wave from the middle outwards. `distances` are the
 * letters' distances from the middle of the whole caption; the middle goes first and the edges
 * last, over `spread` seconds.
 */
export function waveDelays(distances: readonly number[], spread: number): number[] {
  const far = distances.reduce((m, v) => Math.max(m, v), 0);
  return distances.map((v) => (far > 0 ? (v / far) * spread : 0));
}

/** The time the leaving letters need, from the first to the last, in seconds. */
export const LEAVE = { duration: 0.28, spread: 0.18 } as const;
/** The time the arriving letters need. */
export const ARRIVE = { duration: 0.4, spread: 0.4 } as const;
