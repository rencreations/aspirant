import type { Slug } from "@/content/types";

import type { FilmKind, FilmWork } from "./types";

/**
 * The pure parts of the Films room: where each film sits on the endless strip, where a scroll
 * comes to rest, how a film fills the screen, how much of it is buffered, and the words shown.
 *
 * The strip is a ring of slides one screen tall. `pos` is the place on it in screens: slot `k` is
 * drawn `k - pos` screens below the top, and shows film `k` modulo the count. So the end goes on
 * to the beginning and the beginning goes back to the end, for ever.
 */

/** How far the picture of a slide lags behind the slide as it moves (the reference's parallax). */
export const PARALLAX = 0.2;

/** Positive remainder. */
export function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

/** A slot whose film is replaced while a jump runs (the jump lands on a film that is not next). */
export interface Override {
  slot: number;
  film: number;
}

/** The film shown in slot `slot`. */
export function filmAt(slot: number, count: number, override?: Override | null): number {
  if (override?.slot === slot) return override.film;
  return mod(slot, count);
}

/** The slots on screen at `pos`: one at rest, two while one slides over the other. */
export function visibleSlots(pos: number): number[] {
  const top = Math.floor(pos + 1e-6);
  return pos - top > 1e-4 ? [top, top + 1] : [top];
}

/**
 * Where each film is drawn at `pos`: its offset from the top in screens (0 is in place, 0.5 is
 * half a screen down), or null when it is off screen.
 */
export function placeFilms(
  pos: number,
  count: number,
  override?: Override | null,
): Array<number | null> {
  const out: Array<number | null> = Array.from({ length: count }, () => null);
  for (const slot of visibleSlots(pos)) out[filmAt(slot, count, override)] = slot - pos;
  return out;
}

/**
 * The slot a free scroll comes to rest on. A move of less than `threshold` of a screen from the
 * resting slot goes back; past it, the strip goes on to the next slide in the direction it moved.
 */
export function settleSlot(pos: number, rest: number, threshold = 0.12): number {
  const d = pos - rest;
  if (Math.abs(d) < threshold) return rest;
  if (d > 0) {
    const base = Math.floor(pos);
    return pos - base >= threshold ? base + 1 : base;
  }
  const base = Math.ceil(pos);
  return base - pos >= threshold ? base - 1 : base;
}

/** The slot a drag released at `pos` with `velocity` (screens a second, + is down) goes to. */
export function releaseSlot(pos: number, rest: number, velocity: number): number {
  const FLICK = 0.35;
  if (velocity > FLICK) return Math.min(rest + 1, Math.floor(pos) + 1);
  if (velocity < -FLICK) return Math.max(rest - 1, Math.ceil(pos) - 1);
  const slot = settleSlot(pos, rest, 0.3);
  return Math.max(rest - 1, Math.min(rest + 1, slot));
}

/**
 * How to jump from the film on `rest` to `to`: one slide in the shorter direction, with `to` put
 * in the slot it arrives at (unless it is already the neighbour there).
 */
export function jumpPlan(
  rest: number,
  to: number,
  count: number,
): { slot: number; dir: 1 | -1; override: Override | null } | null {
  const from = mod(rest, count);
  if (from === to) return null;
  const ahead = mod(to - from, count);
  const behind = mod(from - to, count);
  const dir = ahead <= behind ? 1 : -1;
  const slot = rest + dir;
  return { slot, dir, override: mod(slot, count) === to ? null : { slot, film: to } };
}

/** The same place on the ring with `film` in `slot`'s place (after a jump has landed). */
export function rebase(slot: number, film: number, count: number): number {
  return slot - mod(slot, count) + film;
}

/** The free scroll of the wheel, in screens. Tuned on the reference: friction, lerp, a snap. */
export const WHEEL = {
  /** Each frame the speed keeps this much of itself. */
  friction: 0.92,
  /** Each frame the place moves this much of the way to where the speed has taken it. */
  lerp: 0.085,
  /**
   * How much of a wheel step (in screens) becomes speed. One notch of a mouse wheel (100 px)
   * carries the strip about a fifth of a screen, past `settleSlot`'s threshold: one notch, one film.
   */
  accel: 0.15,
  /** Top speed, screens a frame. */
  maxVel: 0.6,
  /** Below this the speed is nothing. */
  minVel: 0.0005,
  /** The snap starts once the wheel has been still this long. */
  quietMs: 250,
  /** Each frame the snap moves this much of the way. */
  snapLerp: 0.1,
} as const;

export interface FreeMotion {
  pos: number;
  target: number;
  vel: number;
}

/** One step of the free scroll. `frames` is the time since the last step in 60ths of a second. */
export function stepFree(m: FreeMotion, frames: number): FreeMotion {
  const target = m.target + m.vel * frames;
  const vel = m.vel * WHEEL.friction ** frames;
  const pos = m.pos + (target - m.pos) * (1 - (1 - WHEEL.lerp) ** frames);
  return { pos, target, vel: Math.abs(vel) < WHEEL.minVel ? 0 : vel };
}

/** One step of the snap towards `to`. */
export function stepSnap(pos: number, to: number, frames: number): number {
  return pos + (to - pos) * (1 - (1 - WHEEL.snapLerp) ** frames);
}

/**
 * A wheel event as speed, in screens a frame (+ is down). Lines and pages are turned into pixels,
 * very large steps are cut, the tiny ones of a trackpad at rest are damped.
 */
export function wheelImpulse(deltaY: number, deltaMode: number, screen: number): number {
  let d = deltaY;
  if (deltaMode === 1) d *= 16;
  else if (deltaMode === 2) d *= screen;
  if (Math.abs(d) < 5) d *= 0.2;
  d = Math.max(-240, Math.min(240, d));
  return (d / Math.max(1, screen)) * WHEEL.accel;
}

/** Ease for the timed moves (a step from a key or a button, the end of a film, a jump). */
export function easeInOut(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
}

/** The scale that makes a picture of aspect `film` (width over height) cover a screen of aspect `view`. */
export function coverScale(film: number, view: number): number {
  if (!(film > 0) || !(view > 0)) return 1;
  return Math.max(film / view, view / film);
}

/** Fill the screen (the reference) on a wide screen, fit the whole frame in on a tall one. */
export function defaultFill(viewWidth: number, viewHeight: number): boolean {
  return viewWidth >= viewHeight;
}

/** Something with time ranges, like `HTMLMediaElement.buffered`. */
export interface Ranges {
  readonly length: number;
  start(index: number): number;
  end(index: number): number;
}

/** Seconds buffered after `t`, without a gap. */
export function bufferedAhead(ranges: Ranges, t: number): number {
  for (let i = 0; i < ranges.length; i += 1) {
    const start = ranges.start(i);
    const end = ranges.end(i);
    if (t >= start - 0.3 && t <= end + 0.01) return Math.max(0, end - t);
  }
  return 0;
}

/**
 * How many seconds a film must have in hand before it counts as ready to play from `from`: the
 * target, or what is left of the film when that is less.
 */
export function bufferGoal(target: number, from: number, duration: number): number {
  if (!(duration > 0)) return target;
  return Math.max(0, Math.min(target, duration - from - 0.25));
}

/** `03:07`. */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** `3 minutes 7 seconds`, for assistive technology. */
export function spokenTime(seconds: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  const parts: string[] = [];
  if (m) parts.push(`${m} minute${m === 1 ? "" : "s"}`);
  if (r || !m) parts.push(`${r} second${r === 1 ? "" : "s"}`);
  return parts.join(" ");
}

/** `03`. */
export function two(n: number): string {
  return String(n).padStart(2, "0");
}

/** The three figures of a loading percentage, as the reference writes it: `042%`. */
export function percent(fraction: number): string {
  const p = Math.max(0, Math.min(100, Math.floor(fraction * 100)));
  return `${String(p).padStart(3, "0")}%`;
}

export const KIND_LABEL: Record<FilmKind, string> = {
  "cinematic-trailer": "Cinematic trailer",
  "character-trailer": "Character trailer",
  "animated-trailer": "Animated trailer",
  animation: "Animation",
};

const NAMES: Record<Slug, string> = {
  fanny: "Fanny",
  layla: "Layla",
  ruby: "Ruby",
  angela: "Angela",
  lesley: "Lesley",
  change: "Chang'e",
  guinevere: "Guinevere",
  vexana: "Vexana",
  obsidia: "Obsidia",
  selena: "Selena",
};

/** The two names on the left of a film, the pair it belongs to, in the pair's order. */
export function pairNames(film: Pick<FilmWork, "pair" | "chars">): [string, string] | [string] {
  const order: Record<string, [Slug, Slug]> = {
    "fanny-layla": ["layla", "fanny"],
    "ruby-angela": ["ruby", "angela"],
    "lesley-change": ["lesley", "change"],
    "guinevere-vexana": ["guinevere", "vexana"],
    "selena-obsidia": ["selena", "obsidia"],
  };
  const pair = film.pair ? order[film.pair] : undefined;
  if (pair) return [NAMES[pair[0]], NAMES[pair[1]]];
  const first = film.chars[0];
  return [first ? NAMES[first] : "Aspirants"];
}

/** Which film and second the address asks for (`?i=<id>&t=<seconds>`). */
export function readDeepLink(
  search: string,
  ids: readonly string[],
): { index: number; t: number; asked: boolean } {
  const params = new URLSearchParams(search);
  const id = params.get("i") ?? "";
  const found = ids.indexOf(id);
  const t = Number(params.get("t") ?? "");
  return {
    index: found >= 0 ? found : 0,
    t: found >= 0 && Number.isFinite(t) && t > 0 ? t : 0,
    asked: found >= 0,
  };
}

/** The address of the room with `?i=<id>` set and `t` dropped, keeping anything else. */
export function addressFor(href: string, id: string): string {
  const url = new URL(href);
  url.searchParams.set("i", id);
  url.searchParams.delete("t");
  return `${url.pathname}${url.search}${url.hash}`;
}
