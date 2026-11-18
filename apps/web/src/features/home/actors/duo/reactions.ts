import { clamp01, TAU } from "@/features/about/choreo/ease";

import { EASE, hump, span } from "./curves";
import { bump, mixGlove, toward, type Ctx } from "./goals";
import type { DuoMarkKind, DuoMarkTone, GloveGoal, DroneGoal } from "./pose";

/**
 * The one-shot moves of the duo: an answer to a press, a hello for a hover, a bump when both are
 * pressed, a cheer a section can call for. Each is a pure function of the seconds since it began,
 * written over the goal the pose has made, and each ends at rest: its offsets are zero on the last
 * frame, so when the clock removes it nothing jumps.
 */

export type Reaction =
  | "spin"
  | "flex"
  | "jabs"
  | "hop"
  | "hello"
  | "shy"
  | "giggle"
  | "wink"
  | "dizzy"
  | "fume"
  | "pout"
  | "bump"
  | "cheer";

/** How long each lasts, in seconds. */
export const SECONDS: Record<Reaction, number> = {
  spin: 1.4,
  flex: 1.7,
  jabs: 1.1,
  hop: 1.0,
  hello: 1.7,
  shy: 1.6,
  giggle: 1.3,
  wink: 0.9,
  dizzy: 2.3,
  fume: 1.6,
  pout: 1.6,
  bump: 3.2,
  cheer: 1.7,
};

/** The answers to a press, in order, for each of the two. (The hello is the hover's: a press does not repeat it.) */
export const ANSWERS: readonly [readonly Reaction[], readonly Reaction[]] = [
  ["spin", "flex", "jabs", "hop"],
  ["giggle", "shy", "wink", "hop"],
];

/** So many presses within so many seconds make one dizzy. */
export const DIZZY_PRESSES = 4;
export const DIZZY_WINDOW = 2.4;
/** Both pressed within this many seconds of each other: they bump. */
export const TOGETHER = 2.6;

/** A move in progress, and the clock of it. */
export interface Move {
  kind: Reaction;
  t: number;
  was: number;
  seconds: number;
}

export function startMove(kind: Reaction): Move {
  return { kind, t: 0, was: -1, seconds: SECONDS[kind] };
}

/** The moves that are a stage of their own (the pair looks at one of them while it plays). */
export const isGesture = (kind: Reaction): boolean =>
  kind !== "jabs" && kind !== "wink" && kind !== "giggle";

const TONE: readonly [DuoMarkTone, DuoMarkTone] = ["pink", "ink"];

function cueAt(
  c: Ctx,
  kind: DuoMarkKind,
  dx: number,
  dy: number,
  tone: DuoMarkTone,
  size = 1,
  turn = 0,
): void {
  c.cue(kind, c.now.x + dx * c.r, c.now.y + dy * c.r, tone, size, turn);
}

/** A punch toward the visitor with one glove, between `from` and `to`. */
function jab(g: GloveGoal, side: number, t: number, from: number, to: number): void {
  const p = hump(t, from, to);
  if (p <= 0) return;
  mixGlove(g, side * 0.75, 0.15, 2.9, 0, 0, side * -0.1, 1.5, EASE.out(p));
  g.omega = 34;
  g.zeta = 0.8;
}

function guardUp(g: DroneGoal, much: number): void {
  mixGlove(g.gl, 1.2, 0.45, 1.05, 0, -0.35, -0.2, 1.05, much);
  mixGlove(g.gr, -1.2, 0.3, 1.05, 0, 0.35, 0.2, 1.05, much);
}

/** The hover: the bold one squares up and the soft one shrinks behind its gloves. `h` is 0 to 1. */
export function hoverGoal(g: DroneGoal, who: 0 | 1, h: number): void {
  if (h <= 0.01) return;
  if (who === 0) {
    if (h > 0.3) g.face = "glad";
    mixGlove(g.gl, 1.2, 0.5, 1.0, 0, -0.35, -0.2, 1.08, h);
    mixGlove(g.gr, -1.2, 0.35, 1.0, 0, 0.35, 0.2, 1.08, h);
    g.radius *= 1 + 0.07 * h;
    g.earL.splay -= 0.2 * h;
    g.earR.splay -= 0.2 * h;
  } else {
    if (h > 0.3) g.face = "shy";
    mixGlove(g.gl, 0.85, -0.25, 1.15, 0, -0.5, 0.25, 1, h);
    mixGlove(g.gr, -0.85, -0.25, 1.15, 0, 0.5, -0.25, 1, h);
    g.roll += 0.14 * h;
    g.earL.splay += 0.35 * h;
    g.earR.splay += 0.35 * h;
  }
}

/** Write one move over the goal. `t` is the seconds since it began. */
export function react(g: DroneGoal, c: Ctx, m: Move): void {
  const t = m.t;
  const R = c.r;
  const hit = (at: number): boolean => m.was < at && t >= at;
  const end = 1 - span(t, m.seconds - 0.3, m.seconds);
  const side = toward(c);
  switch (m.kind) {
    case "spin": {
      // A wind up the wrong way, then once round like a wheel, the gloves flung out.
      const wind = hump(t, 0, 0.3);
      const go = EASE.io(span(t, 0.25, 1.0));
      g.spin += (c.who === 0 ? -1 : 1) * (TAU * go - 0.5 * wind);
      const fling = hump(t, 0.25, 1.05);
      g.gl.x += 0.7 * fling;
      g.gr.x -= 0.7 * fling;
      g.gl.y += 0.5 * fling;
      g.gr.y += 0.5 * fling;
      g.y += R * 0.5 * hump(t, 0.25, 1.0);
      g.squash *= 1 - 0.14 * wind + 0.1 * hump(t, 0.3, 0.6) - 0.1 * hump(t, 1.0, 1.15);
      g.face = t < 1.0 ? "squeeze" : "happy";
      g.earL.splay += 0.7 * fling;
      g.earR.splay += 0.7 * fling;
      if (hit(0.55)) cueAt(c, "spark", -1.7, 1.5, "gold");
      if (hit(0.8)) cueAt(c, "spark", 1.8, 1.2, "pink", 0.8);
      if (hit(1.02)) cueAt(c, "puff", 0, -1.3, "ink", 0.7);
      break;
    }
    case "flex": {
      // Both gloves up, bigger, and a laugh.
      const up = EASE.back(span(t, 0.1, 0.5)) * end;
      mixGlove(g.gl, 1.75, 1.25, 0.5, 0, -0.2, -0.5, 1.2, up);
      mixGlove(g.gr, -1.75, 1.25, 0.5, 0, 0.2, 0.5, 1.2, up);
      g.radius *= 1 + 0.16 * up;
      g.squash *= 1 - 0.12 * hump(t, 0, 0.22) + 0.06 * hump(t, 0.2, 0.5);
      const pump = Math.sin(span(t, 0.5, 1.3) * TAU * 2);
      g.gl.y += 0.18 * pump * up;
      g.gr.y += 0.18 * pump * up;
      g.face = "happy";
      g.earL.splay -= 0.25 * up;
      g.earR.splay -= 0.25 * up;
      if (hit(0.5)) cueAt(c, "ha", 1.9, 2.6, "pink");
      if (hit(0.95)) cueAt(c, "ha", -1.9, 2.4, "ink", 0.8);
      break;
    }
    case "jabs": {
      // Two lazy jabs at the air.
      g.face = "bold";
      guardUp(g, EASE.io(span(t, 0, 0.25)) * end * 0.8);
      jab(g.gl, 1, t, 0.2, 0.5);
      jab(g.gr, -1, t, 0.5, 0.8);
      g.turn = 0.2;
      if (hit(0.3)) cueAt(c, "lines", 1.1, 1.2, "ink", 0.7, 20);
      break;
    }
    case "hop": {
      // Up, stretched, and down with a squash.
      const air = hump(t, 0.1, 0.75);
      g.y += R * 1.0 * air;
      g.squash *=
        1 - 0.14 * hump(t, 0, 0.12) + 0.12 * hump(t, 0.12, 0.5) - 0.1 * hump(t, 0.72, 0.9);
      mixGlove(g.gl, 1.5, 0.9, 0.6, 0, -0.2, -0.4, 1.1, air);
      mixGlove(g.gr, -1.5, 0.9, 0.6, 0, 0.2, 0.4, 1.1, air);
      g.earL.splay += 0.5 * air;
      g.earR.splay -= 0.5 * air;
      g.face = "happy";
      if (hit(0.4)) cueAt(c, "spark", c.who === 0 ? 1.7 : -1.7, 1.8, "gold", 0.8);
      if (hit(0.78)) cueAt(c, "puff", 0, -1.3, "ink", 0.6);
      break;
    }
    case "hello": {
      // A small wave and a blush.
      const up = EASE.back(span(t, 0.1, 0.45)) * end;
      const wave = Math.sin(span(t, 0.4, 1.4) * TAU * 2.5) * 0.45;
      mixGlove(g.gl, 1.9, 1.05, 0.5, 0, -0.2, -0.3 + wave, 1, up);
      g.face = t > 1.3 ? "glad" : "shy";
      g.roll += 0.12 * up;
      g.earR.splay += 0.3 * up * Math.sin(t * 9);
      if (hit(0.5)) cueAt(c, "spark", 2.6, 2.0, "gold", 0.7);
      break;
    }
    case "shy": {
      // It hides its face behind its gloves for a moment.
      const up = EASE.io(span(t, 0, 0.35)) * end;
      mixGlove(g.gl, 0.55, 0.15, 1.5, 0, -0.5, 0.3, 1.1, up);
      mixGlove(g.gr, -0.55, 0.15, 1.5, 0, 0.5, -0.3, 1.1, up);
      g.face = "shy";
      g.roll += 0.12 * up;
      g.squash *= 1 - 0.06 * up;
      g.earL.splay += 0.6 * up;
      g.earR.splay += 0.6 * up;
      if (hit(0.3)) cueAt(c, "heart", 1.5, 2.0, "pink", 0.8);
      break;
    }
    case "giggle": {
      // It shakes with a laugh.
      const shake = Math.sin(t * 22) * 0.05 * end * hump(t, 0, m.seconds);
      g.squash *= 1 + shake * 1.5;
      g.roll += shake * 3;
      g.face = t < 1.0 ? "squeeze" : "happy";
      g.y += R * 0.08 * Math.abs(Math.sin(t * 11)) * end;
      g.earL.splay += 0.3 * Math.sin(t * 15) * end;
      g.earR.splay -= 0.3 * Math.sin(t * 15) * end;
      if (hit(0.1)) cueAt(c, "ha", c.who === 0 ? 1.6 : -1.6, 2.4, TONE[c.who], 0.9);
      if (hit(0.6)) cueAt(c, "ha", c.who === 0 ? -1.5 : 1.5, 2.2, TONE[c.who], 0.7);
      break;
    }
    case "wink": {
      const eye = hump(t, 0.15, 0.7);
      if (c.who === 0) g.winkR = eye;
      else g.winkL = eye;
      g.face = "smug";
      g.roll += 0.08 * eye;
      if (hit(0.35)) cueAt(c, "spark", c.who === 0 ? 1.4 : -1.4, 1.3, "gold", 0.7);
      break;
    }
    case "dizzy": {
      // Too many presses: round and round.
      const d = span(t, 0, 0.25) * (1 - span(t, 1.7, 2.3));
      g.face = "dizzy";
      g.roll += Math.sin(t * 6.5) * 0.42 * d;
      g.x += Math.sin(t * 3.2) * R * 0.5 * d;
      g.y += Math.cos(t * 6.4) * R * 0.14 * d;
      g.gl.y -= 0.5 * d;
      g.gr.y -= 0.5 * d;
      g.gl.rz += Math.sin(t * 5) * 0.5 * d;
      g.gr.rz -= Math.sin(t * 5 + 1) * 0.5 * d;
      g.earL.splay += 0.6 * Math.sin(t * 6.5 + 1) * d;
      g.earR.splay -= 0.6 * Math.sin(t * 6.5 + 1) * d;
      if (hit(0.1)) cueAt(c, "swirl", 0.3, 2.9, "ink");
      if (hit(0.9)) cueAt(c, "star", -0.8, 2.3, "gold", 0.8);
      break;
    }
    case "fume": {
      // After the dizziness: a fist shaken at the visitor.
      g.face = "annoyed";
      const on = span(t, 0, 0.2) * end;
      const shake = Math.sin(t * 30) * 0.12 * on;
      g.radius *= 1 + 0.1 * on;
      mixGlove(g.gl, 1.5, 1.2, 0.9, 0, -0.2, -0.3 + shake * 2, 1.2, on);
      g.x += R * shake * 0.5;
      g.earL.splay += 0.9 * on;
      g.earR.splay -= 0.9 * on;
      if (hit(0.1)) cueAt(c, "vein", 1.2, 2.3, "pink", 1.1);
      if (hit(0.7)) cueAt(c, "puff", -1.6, 1.6, "ink", 0.7);
      break;
    }
    case "pout": {
      // It turns its back, a little, and looks over its shoulder.
      const on = span(t, 0, 0.25) * end;
      g.yaw += -1.0 * on;
      g.face = "annoyed";
      g.earL.splay += 0.8 * on;
      g.earR.splay += 0.8 * on;
      g.roll += 0.1 * on;
      if (hit(0.15)) cueAt(c, "puff", 1.5, 1.8, "ink", 0.7);
      break;
    }
    case "bump":
      bump(g, c, t, 1);
      break;
    case "cheer": {
      // Both throw their gloves up, hop, and look at what they cheer for.
      const up = EASE.back(span(t, 0.05, 0.4)) * end;
      mixGlove(g.gl, 1.7, 1.35, 0.5, 0, -0.2, -0.5, 1.1, up);
      mixGlove(g.gr, -1.7, 1.35, 0.5, 0, 0.2, 0.5, 1.1, up);
      const hops = Math.abs(Math.sin(span(t, 0.1, 1.3) * Math.PI * 2));
      g.y += R * 0.5 * hops * end;
      g.face = c.who === 0 ? "happy" : "joy";
      if (c.target) {
        g.look = c.target;
        g.yaw += clamp01(Math.abs(c.target.x - c.now.x) / (4 * R)) * side * 0.4 * end;
      }
      if (hit(0.3)) {
        cueAt(
          c,
          c.who === 0 ? "ha" : "spark",
          c.who === 0 ? -1.6 : 1.6,
          2.5,
          c.who === 0 ? "ink" : "gold",
        );
      }
      break;
    }
  }
}

// The ambient life: now and then one of them does something and the other answers ----------------

const AMBIENT: readonly Reaction[] = ["hop", "giggle", "wink", "shy", "flex"];
const ECHO: readonly Reaction[] = ["giggle", "hop", "wink", "hello"];

/** What the pair does next with nothing asked of them: a wait, a move of one, and maybe an answer. */
export interface Ambient {
  /** Seconds until the move after this one. */
  wait: number;
  kind: Reaction;
  /** The other drone's answer, and how long after the first move begins it starts. */
  echo: Reaction | null;
  echoAfter: number;
}

/** The next ambient move from a source of numbers in [0, 1). Calm: one every six to twelve seconds. */
export function nextAmbient(rand: () => number): Ambient {
  const wait = 6 + rand() * 6;
  const kind = AMBIENT[Math.floor(rand() * AMBIENT.length)] ?? "hop";
  const answers = rand() < 0.65;
  const echo = ECHO[Math.floor(rand() * ECHO.length)] ?? "giggle";
  return { wait, kind, echo: answers ? echo : null, echoAfter: 0.45 + rand() * 0.4 };
}
