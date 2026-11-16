import type { Box } from "../film-geometry";
import type { IntroPhase } from "../stage-bus";

import { bump, clamp, clamp01, easeOutQuad, easeTurn, hermite, mix, ramp, TAU } from "./ease";
import type { FaceName } from "./path";

/**
 * The opening, as a pure function of time. The page is empty; the drone comes in from the right
 * and crosses the title on a wavy line with a roll, and the title appears in its trail; at the
 * left edge it banks round, half out of the screen, and comes back toward the visitor; then it
 * comes down to its place with a flip, runs a little past it and settles.
 *
 * Nothing here is linear. The line is made of Hermite pieces that share their speed at every
 * joint, so there is no corner in it, and the landing is the answer of a damped spring to the
 * speed it arrives with, so the overshoot is a real one.
 */
export interface IntroGeo {
  vw: number;
  vh: number;
  /** The box of the whole title on the screen. */
  title: Box;
  /** The drone's place on the first screen, and its turn at rest. */
  hero: { x: number; y: number; size: number };
  restTurn: number;
}

interface IntroFrame {
  x: number;
  y: number;
  size: number;
  yaw: number;
  pitch: number;
  roll: number;
  /** Everything of the title to the right of this x is shown. Falls all through the pass. */
  edge: number;
  phase: Exclude<IntroPhase, "wait">;
  /** How hard the wings work and how far they flare, 0 to 1. */
  effort: number;
  flare: number;
  face: FaceName;
  /** How strong the trail behind the drone is, 0 to 1. */
  trail: number;
}

/** The moments of the opening, in seconds from its start. */
export const INTRO = {
  /** The pass over the title ends: the title is whole. */
  pass: 1.6,
  /** The leftmost point of the turn. */
  apex: 1.96,
  /** Out of the turn, on the way down. */
  out: 2.38,
  /** The drone reaches its place (and runs a little past it). */
  touch: 3.3,
  /** The description and the reel may appear. */
  landed: 3.38,
  /** Everything is at rest. */
  done: 3.95,
} as const;

/** How quick the landing settles, in radians per second. */
const SETTLE = 6.4;

type Key = readonly [time: number, value: number, speed: number];

/** A line through keys, each with its own speed: no corner at any of them. */
function track(keys: readonly Key[], t: number): number {
  const first = keys[0];
  const last = keys[keys.length - 1];
  if (!first || !last) return 0;
  if (t <= first[0]) return first[1];
  if (t >= last[0]) return last[1];
  for (let i = 1; i < keys.length; i += 1) {
    const a = keys[i - 1];
    const b = keys[i];
    if (!a || !b || t > b[0]) continue;
    const span = b[0] - a[0];
    return hermite(a[1], a[2], b[1], b[2], span, (t - a[0]) / span);
  }
  return last[1];
}

/** How far past the title's left end the middle of the drone is when the pass ends, in widths. */
const PASS_PAST = 0.12;
/** How far behind the middle of the drone the title opens, in widths: at its tail. */
const EDGE_BEHIND = 0.36;

/**
 * Where the title has opened to when the drone is at `x`, the fraction `u` of the pass done. The
 * title opens at the drone's tail; over the last of the pass the opening comes up under the body,
 * so the left end of the title is whole while the drone is still on the screen.
 */
function edgeOf(x: number, size: number, u: number): number {
  return x + EDGE_BEHIND * size * (1 - ramp(0.62, 1, u));
}

/** The drone's width while it crosses the title: about the height of the big word. */
export function passSize(geo: IntroGeo): number {
  return clamp(geo.title.h * 0.6, 0.1 * geo.vh, Math.min(0.28 * geo.vh, 0.36 * geo.vw));
}

/** The pass alone: the wavy line over the title. `u` is 0 to 1. */
function passPoint(geo: IntroGeo, u: number): { x: number; y: number } {
  const { vw, title } = geo;
  const size = passSize(geo);
  const from = vw + 0.75 * size;
  // It ends with its middle just past the title's left end, most of it still on the screen.
  const to = title.x - PASS_PAST * size;
  // It comes in fast and is still moving when it leaves: never a stop, and x only ever falls.
  const e = mix(u, easeOutQuad(u), 0.55);
  const mid = title.y + title.h * 0.48;
  const wave = Math.sin(TAU * 1.2 * u + 0.5) * title.h * 0.17 * (1 - 0.45 * u);
  const dive = -title.h * 0.16 * (1 - u) * (1 - u);
  return { x: mix(from, to, e), y: mid + wave + dive };
}

/** The opening at `t` seconds. Before 0 it is the first frame, after the end the last. */
export function introAt(geo: IntroGeo, t: number): IntroFrame {
  const { vw, vh, hero } = geo;
  const time = Math.max(0, t);
  const s0 = passSize(geo);
  const T = INTRO;

  // The end of the pass, with its speed, starts the turn.
  const h = 0.004;
  const end = passPoint(geo, 1);
  const before = passPoint(geo, 1 - h / T.pass);
  const endV = { x: (end.x - before.x) / h, y: (end.y - before.y) / h };
  // The turn: it runs on, half out of the screen, banks round and comes back in lower down.
  const apex = { x: end.x + 0.05 * s0, y: end.y + 0.15 * vh };
  const out = { x: mix(apex.x, hero.x, 0.72), y: mix(apex.y, hero.y, 0.42) };
  const arriveV = { x: 0.03 * vw, y: 0.62 * vh };

  let x: number;
  let y: number;
  if (time <= T.pass) {
    const p = passPoint(geo, time / T.pass);
    x = p.x;
    y = p.y;
  } else {
    x = track(
      [
        [T.pass, end.x, endV.x],
        [T.apex, apex.x, 0],
        [T.out, out.x, (hero.x - apex.x) * 1.5],
        [T.touch, hero.x, arriveV.x],
      ],
      time,
    );
    y = track(
      [
        [T.pass, end.y, endV.y],
        [T.apex, apex.y, 0.5 * vh],
        [T.out, out.y, 0.42 * vh],
        [T.touch, hero.y, arriveV.y],
      ],
      time,
    );
  }

  // Past its place and back: what a damped spring does with the speed the drone arrives with.
  const after = Math.max(0, time - T.touch);
  const settle = after * Math.exp(-SETTLE * after);
  if (time > T.touch) {
    x = hero.x + arriveV.x * settle;
    y = hero.y + arriveV.y * settle;
  }

  // It comes toward the visitor from the turn on, and swells a little as it lands.
  const swell = 0.05 * hero.size * SETTLE * Math.E;
  const size =
    time <= T.pass
      ? s0 * (1 + 0.1 * bump(time / T.pass))
      : time <= T.touch
        ? track(
            [
              [T.pass, s0, 0],
              [T.apex, s0 * 1.4, s0 * 1.1],
              [T.out, mix(s0 * 1.5, hero.size, 0.3), hero.size * 0.75],
              [T.touch, hero.size, swell],
            ],
            time,
          )
        : hero.size + swell * settle;

  // The body. It flies left side-on, a little toward the visitor; comes round through the front
  // in the turn; and ends at its turn at rest.
  const yaw = track(
    [
      [0, -1.2, 0],
      [T.pass, -1.2, 0.4],
      [T.apex, -0.3, 2.6],
      [T.out, geo.restTurn + 0.34, 0.5],
      [T.touch, geo.restTurn, 0],
    ],
    time,
  );

  // A barrel roll over the middle of the title, a deep bank in the turn, a wiggle on landing.
  const rollStart = 0.42;
  const rollEnd = 1.24;
  const barrel = TAU * easeTurn((time - rollStart) / (rollEnd - rollStart));
  const lean = passLean(geo, time);
  const bank = -0.72 * bump((time - T.pass + 0.1) / (T.out - T.pass + 0.3));
  const wiggle = time > T.touch ? 0.2 * Math.sin(13 * after) * Math.exp(-4.2 * after) : 0;
  const roll = barrel + lean.roll + bank + wiggle;

  // The nose follows the wave, dips into the turn, goes right round in a flip on the way down
  // and comes up to brake.
  const flipStart = T.out - 0.06;
  const flipEnd = T.touch - 0.12;
  const flip = TAU * easeTurn((time - flipStart) / (flipEnd - flipStart));
  const dip = 0.3 * bump((time - T.pass) / (T.out - T.pass));
  const brake = -0.26 * bump((time - T.touch + 0.2) / 0.75);
  const pitch = lean.pitch + dip + flip + brake;

  const inRoll = time > rollStart - 0.05 && time < rollEnd + 0.1;
  const inFlip = time > flipStart - 0.05 && time < flipEnd + 0.3;
  return {
    x,
    y,
    size,
    yaw,
    pitch,
    roll,
    edge: time <= T.pass ? edgeOf(x, s0, time / T.pass) : -Infinity,
    phase:
      time < T.pass ? "title" : time < T.landed ? "landing" : time < T.done ? "landed" : "done",
    effort: time < T.pass ? 0.9 : mix(0.75, 0, ramp(T.out, T.touch + 0.5, time)),
    flare: bump((time - T.touch + 0.4) / 0.95),
    face: inRoll || inFlip ? "happy" : "normal",
    trail: 1 - ramp(T.pass, T.out, time),
  };
}

/** How the body leans with the wave of the pass: it banks and noses along the slope. */
function passLean(geo: IntroGeo, time: number): { roll: number; pitch: number } {
  if (time >= INTRO.pass) return { roll: 0, pitch: 0 };
  const u = clamp01(time / INTRO.pass);
  const h = 0.01;
  const a = passPoint(geo, Math.max(0, u - h));
  const b = passPoint(geo, Math.min(1, u + h));
  // The slope of the line it flies: down the screen is nose down. It flies to the left.
  const slope = (b.y - a.y) / Math.max(1, Math.abs(b.x - a.x));
  const fade = 1 - ramp(0.8, 1, u);
  return {
    roll: clamp(slope * 0.5, -0.4, 0.4) * fade,
    pitch: clamp(slope * 0.9, -0.5, 0.5) * fade,
  };
}
