import { clamp, clamp01, mix, TAU } from "@/features/about/choreo/ease";

import { crossed, EASE, hump, rand01, span } from "./curves";
import type { FaceName } from "./face";
import {
  gloveOffset,
  type DroneGoal,
  type DroneId,
  type DuoMarkKind,
  type DuoMarkTone,
  type GloveGoal,
  type Vec2,
} from "./pose";

/**
 * What each pose of the duo asks of one drone. Every builder takes the goal and a context and
 * writes into the goal: where the ball wants to be, how it leans, where its gloves are, which face
 * it wears and what it looks at. The springs (`follow.ts`) turn goals into poses, so nothing here
 * moves by itself and nothing jumps: the sine and hump curves all start and end at rest.
 *
 * Plain arithmetic. No three, no DOM. Stage pixels, y up, lengths on a drone in radii of its ball.
 */

export type SimplePose =
  "float" | "dance" | "stare" | "confused" | "question" | "wave" | "bow" | "leave";

type Cue = (
  kind: DuoMarkKind,
  x: number,
  y: number,
  tone: DuoMarkTone,
  size: number,
  turn: number,
) => void;

export interface Ctx {
  who: 0 | 1;
  /** The duo's own clock, in seconds, and the step of this frame. */
  t: number;
  dt: number;
  /** The ball's radius on the screen, in pixels, as the section placed it. */
  r: number;
  /** Where the section placed this drone and the other, and where each is right now. */
  home: Vec2;
  other: Vec2;
  now: Vec2;
  otherNow: Vec2;
  view: { w: number; h: number };
  /** The visitor's pointer on the stage when it is near and live, else null. */
  pointer: Vec2 | null;
  /** The weight of the pose, 0 to 1, and what it was in the frame before. */
  w: number;
  wPrev: number;
  target: Vec2 | null;
  /** The way this drone leaves, a unit vector. */
  dir: Vec2;
  cue: Cue;
}

/** Where a glove rests, in the ball's own frame, in radii. */
const HOME = { x: 1.72, y: -0.42, z: 0.4, ry: -0.3, rz: -0.22 };

/** Tone of the marks of each drone. */
const TONE: readonly [DuoMarkTone, DuoMarkTone] = ["pink", "ink"];

export const OWN: readonly [FaceName, FaceName] = ["bold", "soft"];

export const id = (who: 0 | 1): DroneId => (who === 0 ? "a" : "b");

// The parts ----------------------------------------------------------------------------------------

function setGlove(
  g: GloveGoal,
  x: number,
  y: number,
  z: number,
  rx = 0,
  ry = 0,
  rz = 0,
  size = 1,
): GloveGoal {
  g.x = x;
  g.y = y;
  g.z = z;
  g.rx = rx;
  g.ry = ry;
  g.rz = rz;
  g.size = size;
  g.free = false;
  g.hard = false;
  g.omega = 17;
  g.zeta = 0.55;
  return g;
}

/** The glove goes toward a rest it is given, by `t`. */
export function mixGlove(
  g: GloveGoal,
  x: number,
  y: number,
  z: number,
  rx: number,
  ry: number,
  rz: number,
  size: number,
  t: number,
): void {
  g.x = mix(g.x, x, t);
  g.y = mix(g.y, y, t);
  g.z = mix(g.z, z, t);
  g.rx = mix(g.rx, rx, t);
  g.ry = mix(g.ry, ry, t);
  g.rz = mix(g.rz, rz, t);
  g.size = mix(g.size, size, t);
}

/** Pin a glove to a point of the screen. The point is the stage's own, not the ball's. */
function pinGlove(
  g: GloveGoal,
  px: number,
  py: number,
  z = 0.6,
  omega = 34,
  hard = false,
): GloveGoal {
  g.free = true;
  g.fx = px;
  g.fy = py;
  g.z = z;
  g.rx = 0;
  g.ry = 0;
  g.rz = 0;
  g.size = 1;
  g.omega = omega;
  g.zeta = 1;
  g.hard = hard;
  return g;
}

/** The glove on a side of the screen: +1 the right, -1 the left. The model's left glove is on the right. */
const glove = (g: DroneGoal, side: number): GloveGoal => (side >= 0 ? g.gl : g.gr);

/** +1 when the other is to the right of this one, -1 to the left. */
export const toward = (c: Ctx): number => Math.sign(c.other.x - c.home.x) || (c.who === 0 ? 1 : -1);

const cueAt = (
  c: Ctx,
  kind: DuoMarkKind,
  dx: number,
  dy: number,
  tone: DuoMarkTone,
  size = 1,
  turn = 0,
): void => {
  c.cue(kind, c.now.x + dx * c.r, c.now.y + dy * c.r, tone, size, turn);
};

/** The turn that faces a point. */
const facing = (c: Ctx, p: Vec2, much = 0.8): number =>
  clamp((p.x - c.now.x) / (4 * c.r), -1, 1) * much;

// The life: what each does with nothing else to do ----------------------------------------------

/** The base of every pose: bob, sway, blink, ears, a look. The others write over it. */
export function floatGoal(g: DroneGoal, c: Ctx): void {
  const t = c.t + c.who * 1.9;
  const R = c.r;
  g.x = c.home.x + R * 0.14 * Math.sin(t * 0.62);
  g.y = c.home.y + R * 0.17 * Math.sin(t * 1.21 + c.who);
  g.z = c.who * 14;
  g.radius = R;
  g.yaw = 0;
  g.pitch = 0;
  g.roll = 0.03 * Math.sin(t * 0.8);
  g.spin = 0;
  g.squash = 1 + 0.015 * Math.sin(t * 2.42);
  g.omega = 7;
  g.lean = true;
  g.on = 1;
  g.lid = 0;
  g.winkL = 0;
  g.winkR = 0;
  g.face = OWN[c.who];
  for (const side of [1, -1] as const) {
    setGlove(
      glove(g, side),
      side * HOME.x + 0.04 * Math.sin(t * 1.1 + side),
      HOME.y + 0.09 * Math.sin(t * 1.63 + side * 1.3),
      HOME.z,
      0,
      side * HOME.ry,
      side * HOME.rz + 0.05 * Math.sin(t * 1.3 + side),
    );
  }
  const flick = 0.05 * Math.sin(t * 0.9);
  g.earL.splay = flick;
  g.earR.splay = -flick;
  g.earL.fold = g.earR.fold = 0;
  g.earL.twist = g.earR.twist = 0;

  // What it looks at: the pointer when it is near, else the other one, the target, the visitor.
  g.turn = 0.55;
  if (c.pointer && Math.hypot(c.pointer.x - c.now.x, c.pointer.y - c.now.y) < 9 * R) {
    g.look = c.pointer;
  } else {
    const slot = Math.floor(t / 2.6);
    const pick = Math.floor(rand01(slot * 3 + c.who) * 3);
    if (pick === 0) g.look = c.otherNow;
    else if (pick === 1 && c.target) g.look = c.target;
    else g.look = null;
    g.turn = 0.35;
  }
}

// The poses ---------------------------------------------------------------------------------------

const PHRASE = 3.0;
const PHRASES = 4;
/** The length of the dance before it starts again, in seconds: 24 beats of half a second. */
export const DANCE_LOOP = PHRASE * PHRASES;

/**
 * They dance together, in step. Four phrases of 3 s, six beats each: a sway that mirrors, a turn round each other,
 * a fist bump and a spin each in its own direction. Every phrase begins and ends with both at rest
 * at their places, so the loop has no seam.
 */
export function dance(g: DroneGoal, c: Ctx): void {
  const k = c.w;
  if (k <= 0) return;
  const R = c.r;
  const p = ((c.t % DANCE_LOOP) + DANCE_LOOP) % DANCE_LOOP;
  const phrase = Math.floor(p / PHRASE);
  const u = p - phrase * PHRASE;
  const side = toward(c);
  const mid = { x: (c.home.x + c.other.x) / 2, y: (c.home.y + c.other.y) / 2 };

  // The beat: a bounce every half second, the soft one a hair behind.
  const beat = Math.abs(Math.sin((Math.PI * (c.t - c.who * 0.05)) / 0.5));
  g.y += R * 0.2 * beat * k;
  g.squash *= 1 - 0.06 * Math.pow(1 - beat, 6) * k;
  g.omega = 11;
  g.earL.splay += 0.35 * Math.sin(TAU * 2 * c.t + c.who) * k;
  g.earR.splay -= 0.35 * Math.sin(TAU * 2 * c.t + c.who) * k;
  g.earL.fold += 0.25 * beat * k;
  g.earR.fold += 0.25 * beat * k;
  g.roll += 0.1 * Math.sin(TAU * c.t * 1) * k;
  g.turn = 0.5;
  g.look = c.otherNow;
  g.yaw += facing(c, c.otherNow, 0.5) * k;
  g.face = (["glad", "happy", "happy", "joy"] as const)[phrase] ?? "glad";

  const inner = glove(g, side);
  const outer = glove(g, -side);
  const pump = (up: number) => {
    mixGlove(inner, side * 1.9, 0.7 + 0.5 * up, 0.6, 0, -side * 0.2, -side * 0.3, 1.05, 0.9 * k);
    mixGlove(
      outer,
      -side * 1.7,
      -0.1 + 0.4 * (1 - up),
      0.5,
      0,
      side * 0.2,
      side * 0.3,
      1.0,
      0.9 * k,
    );
  };

  if (phrase === 0) {
    // A sway that mirrors: they lean in and out together.
    const s = Math.sin((TAU * u) / 1.5);
    g.x += side * R * 0.5 * s * k;
    pump(beat);
  } else if (phrase === 1) {
    // A turn round each other: each goes round the middle and comes back to its place.
    let vx = c.home.x - mid.x;
    let vy = c.home.y - mid.y;
    if (Math.hypot(vx, vy) < 0.5 * R) {
      vx = (c.who === 0 ? -1 : 1) * 1.6 * R;
      vy = 0;
    }
    const theta = TAU * EASE.io(span(u, 0.15, 2.85));
    const cs = Math.cos(theta);
    const sn = Math.sin(theta);
    g.x += (vx * cs - vy * sn - vx) * k;
    g.y += (vx * sn + vy * cs - vy) * k;
    g.z += (c.who === 0 ? 1 : -1) * 40 * Math.sin(theta) * k;
    g.roll += -0.3 * Math.sin(theta) * k;
    pump(1 - beat);
  } else if (phrase === 2) {
    bump(g, c, u, k);
  } else {
    // A spin each, in opposite ways, with a hop.
    const ph = EASE.io(span(u, 0.25, 2.45));
    g.spin += (c.who === 0 ? -1 : 1) * TAU * 2 * ph * k;
    g.y += R * 0.9 * hump(u, 0.25, 2.45) * k;
    const fling = hump(u, 0.3, 2.4) * k;
    g.gl.x += 0.7 * fling;
    g.gr.x -= 0.7 * fling;
    g.gl.y += 0.5 * fling;
    g.gr.y += 0.5 * fling;
    g.earL.splay += 0.7 * fling;
    g.earR.splay += 0.7 * fling;
    g.face = u < 2.5 ? "squeeze" : "joy";
    g.look = null;
    if (crossed(u, c.dt, 100, 1.0)) cueAt(c, "spark", c.who === 0 ? -1.8 : 1.8, 1.5, "gold", 1);
    if (crossed(u, c.dt, 100, 2.5)) cueAt(c, "puff", 0, -1.3, "ink", 0.7);
  }
  // A small word of its own at the top of each phrase.
  if (crossed(u, c.dt, 100, 0.05) && phrase !== 2) {
    cueAt(c, "heart", c.who === 0 ? 1.4 : -1.4, 2, TONE[c.who], 0.7);
  }
}

/**
 * A fist bump in the middle, with a wind-up and a strike. `u` is the seconds since it began (it
 * takes 3.2 s as a move of its own; a dance phrase gives it 3 s) and `k` its weight. The dance has it as its third phrase and a press on both drones
 * starts it on its own.
 */
export function bump(g: DroneGoal, c: Ctx, u: number, k: number): void {
  const R = c.r;
  const side = toward(c);
  const mid = { x: (c.home.x + c.other.x) / 2, y: (c.home.y + c.other.y) / 2 };
  const inner = glove(g, side);
  const outer = glove(g, -side);
  let ax = mid.x - c.home.x;
  let ay = mid.y - c.home.y;
  const len = Math.hypot(ax, ay);
  if (len < 1) {
    ax = side;
    ay = 0;
  } else {
    ax /= len;
    ay /= len;
  }
  const gap = Math.max(1.7 * R, Math.min(len, 3.5 * R));
  const go = EASE.io(span(u, 0.2, 1.3)) * (1 - EASE.io(span(u, 1.8, 2.9)));
  const wind = hump(u, 0.85, 1.5);
  const strike = EASE.out(span(u, 1.5, 1.62)) * (1 - span(u, 1.95, 2.2));
  const reach = len - gap;
  g.x += (ax * reach * go - ax * R * 0.7 * wind + ax * R * 0.35 * strike) * k;
  g.y += (ay * reach * go - ay * R * 0.7 * wind + ay * R * 0.35 * strike) * k;
  const meet = go * k;
  // The glove between them goes to the middle; the other swings behind.
  const gx = (mid.x - side * 0.3 * R - (c.home.x + ax * reach * go)) / R;
  const gy = (mid.y - c.home.y) / R;
  mixGlove(inner, gx, gy, 0.9, 0, side * 1.35, 0, 1.12, meet);
  mixGlove(outer, -side * 1.6, 0.35 + 0.2 * wind, 0.6, 0, side * 0.3, side * 0.3, 1, meet);
  g.squash *= 1 - 0.1 * hump(u, 1.45, 1.7) * k;
  g.face = u < 1.55 ? (c.who === 0 ? "bold" : "bars") : "happy";
  if (c.who === 0 && crossed(u, c.dt, 100, 1.55)) {
    c.cue("spark", mid.x, mid.y, "gold", 1.5, 0);
    c.cue("lines", mid.x, mid.y + R * 1.3, "ink", 1.1, 0);
    c.cue("star", mid.x + R * 0.8, mid.y + R * 0.9, "gold", 0.8, 0);
  }
}

/**
 * Side by side, eyes on a target. They turn to it and lean in, hold quite still and do not blink
 * much. Without a target they look at the visitor.
 */
function stare(g: DroneGoal, c: Ctx): void {
  const k = c.w;
  if (k <= 0) return;
  const R = c.r;
  g.turn = 0.45;
  if (c.target) {
    g.look = c.target;
    g.yaw += facing(c, c.target, 0.3) * k;
    g.pitch += clamp((c.now.y - c.target.y) / (5 * R), -0.4, 0.4) * 0.5 * k;
  } else {
    g.look = null;
  }
  // Fixated: a lean toward it, almost no float, a faint tremble.
  g.x = mix(g.x, c.home.x, 0.7 * k);
  g.y = mix(g.y, c.home.y, 0.7 * k);
  g.z += 24 * k;
  g.squash += 0.025 * Math.sin(c.t * 29 + c.who) * k;
  g.roll *= 1 - 0.7 * k;
  if (k > 0.3) g.face = "wide";
  g.earL.splay += 0.18 * k;
  g.earR.splay -= 0.18 * k;
  const side = toward(c);
  mixGlove(glove(g, side), side * 1.45, -0.5, 0.7, 0, -side * 0.25, -side * 0.2, 1, k);
  mixGlove(glove(g, -side), -side * 1.45, -0.5, 0.7, 0, side * 0.25, side * 0.2, 1, k);
}

/**
 * Exaggerated confusion. The head tilts to one side and the other, the eyes are two sizes and
 * turn, one brow is up and one is down, a mouth like a wave. One scratches its head while the
 * other shrugs, and they swap. A "?" rises over each now and then and a drop of sweat falls.
 * With a target they stare at it; without one the eyes search the room.
 */
function confused(g: DroneGoal, c: Ctx): void {
  const k = c.w;
  if (k <= 0) return;
  const R = c.r;
  const side = c.who === 0 ? 1 : -1;
  g.turn = 0.6;
  if (c.target) {
    g.look = c.target;
    g.yaw += facing(c, c.target, 0.3) * k;
  } else {
    // The eyes search: back and forth, up and down, never on the same place for long.
    g.look = {
      x: c.now.x + Math.sin(c.t * 1.3 + c.who * 2) * 7 * R,
      y: c.now.y + Math.cos(c.t * 0.9 + c.who) * 2.2 * R,
    };
  }
  // The head tilts: one way, then the other, the two of them against each other.
  g.roll += 0.3 * Math.sin(c.t * 2.1 + c.who * Math.PI) * k;
  g.squash += 0.03 * Math.sin(c.t * 4 + c.who) * k;
  g.y += R * 0.06 * Math.sin(c.t * 4.2 + c.who * 2) * k;
  const phase = ((((c.t + c.who * 0.9) / 4.2) % 1) + 1) % 1;
  if (k > 0.3) g.face = phase < 0.7 ? "confused" : "befuddled";
  g.earL.splay += 0.55 * k;
  g.earR.splay -= 0.2 * k;
  g.earL.fold += 0.25 * k;

  // One scratches its head, the other shrugs; every six seconds they swap.
  const scratcher = Math.floor(c.t / 6) % 2 === c.who;
  const wiggle = Math.sin(c.t * 12) * 0.16;
  if (scratcher) {
    mixGlove(g.gl, 0.3 + wiggle, 1.55, 0.7, 0, -0.3, -0.8 + wiggle, 1.0, k);
    mixGlove(g.gr, -1.9, 0.5, 0.6, 0, 0.25, 0.65, 1.05, k);
  } else {
    mixGlove(g.gl, 1.95, 0.5, 0.6, 0, -0.25, -0.65, 1.05, k);
    mixGlove(g.gr, -1.95, 0.5, 0.6, 0, 0.25, 0.65, 1.05, k);
  }
  if (crossed(c.t, c.dt, 1.9, c.who * 0.95)) cueAt(c, "ask", side * 0.9, 2.1, TONE[c.who], 1);
  if (crossed(c.t, c.dt, 3.4, 0.4 + c.who * 1.7)) cueAt(c, "drop", side * 1.15, 1.3, "cyan", 0.8);
}

/**
 * They face each other and ask. One speaks (a glove out to the other, a tilt, a "?"), the other
 * shrugs with both gloves out and a worried face; every two seconds they swap.
 */
function question(g: DroneGoal, c: Ctx): void {
  const k = c.w;
  if (k <= 0) return;
  const R = c.r;
  const side = toward(c);
  g.turn = 0.6;
  g.look = c.otherNow;
  g.yaw += facing(c, c.otherNow, 0.25) * k;
  const turnIndex = Math.floor(c.t / 2.2);
  const speaking = turnIndex % 2 === c.who;
  const into = span(c.t - turnIndex * 2.2, 0, 0.35);
  if (speaking) {
    const talk = Math.sin(c.t * 9) * 0.1;
    mixGlove(glove(g, side), side * 2.15, 0.6 + talk, 0.9, 0, -side * 0.5, -side * 0.3, 1.12, k);
    g.roll += -side * 0.2 * into * k;
    g.pitch += 0.1 * into * k;
    g.squash += 0.05 * Math.max(0, Math.sin(c.t * 9)) * k;
    if (k > 0.3) g.face = "confused";
    if (crossed(c.t, c.dt, 2.2 * 2, c.who * 2.2 + 0.1)) {
      cueAt(c, "ask", side * 1.1, 2.2, TONE[c.who], 1.15);
    }
  } else {
    mixGlove(g.gl, 1.95, 0.55, 0.6, 0, -0.25, -0.7, 1.08, k);
    mixGlove(g.gr, -1.95, 0.55, 0.6, 0, 0.25, 0.7, 1.08, k);
    g.roll += side * 0.12 * into * k;
    g.y += R * 0.1 * hump(c.t - turnIndex * 2.2, 0.1, 0.7) * k;
    g.earL.splay += 0.4 * k;
    g.earR.splay -= 0.4 * k;
    if (k > 0.3) g.face = "worry";
    if (crossed(c.t, c.dt, 2.2 * 2, c.who * 2.2 + 0.9))
      cueAt(c, "drop", -side * 1.2, 1.3, "cyan", 0.8);
  }
}

/** A wave to the visitor with the outer glove, and a pleased face. */
function wave(g: DroneGoal, c: Ctx): void {
  const k = c.w;
  if (k <= 0) return;
  const side = -toward(c);
  const up = EASE.back(clamp01(k * 1.2));
  const sway = Math.sin(c.t * 13 + c.who) * 0.45;
  mixGlove(glove(g, side), side * 1.9, 1.15, 0.5, 0, -side * 0.2, -side * 0.3 + sway, 1.05, up);
  g.roll += -side * 0.1 * k + 0.04 * Math.sin(c.t * 6.5) * k;
  g.earL.splay += 0.3 * Math.sin(c.t * 9) * k;
  g.earR.splay -= 0.3 * Math.sin(c.t * 9) * k;
  if (k > 0.3) g.face = c.who === 0 ? "glad" : "joy";
  g.look = c.pointer;
  g.turn = 0.4;
}

/** A bow: `w` is how deep. The face goes down, the gloves come forward together. */
function bow(g: DroneGoal, c: Ctx): void {
  const k = c.w;
  if (k <= 0) return;
  const R = c.r;
  g.pitch += 0.55 * k;
  g.y -= R * 0.3 * k;
  g.squash *= 1 - 0.08 * k;
  mixGlove(g.gl, 0.9, -0.95, 1.4, 0.5, -0.2, -0.1, 1.05, k);
  mixGlove(g.gr, -0.9, -0.95, 1.4, 0.5, 0.2, 0.1, 1.05, k);
  g.earL.fold += 0.5 * k;
  g.earR.fold += 0.5 * k;
  g.look = null;
  if (k > 0.3) g.face = "thanks";
  g.omega = 10;
}

/** The distance from a point to the edge of the screen along a direction. */
export function distToEdge(p: Vec2, dir: Vec2, view: { w: number; h: number }): number {
  const hw = view.w / 2;
  const hh = view.h / 2;
  const tx = dir.x > 1e-6 ? (hw - p.x) / dir.x : dir.x < -1e-6 ? (-hw - p.x) / dir.x : Infinity;
  const ty = dir.y > 1e-6 ? (hh - p.y) / dir.y : dir.y < -1e-6 ? (-hh - p.y) / dir.y : Infinity;
  return Math.max(0, Math.min(tx, ty));
}

/**
 * Off the screen. `w` is the progress: 0 at its place, 1 gone. It crouches first and goes back a
 * little, then zips along its direction with its ears and gloves streaming behind.
 */
export function leave(g: DroneGoal, c: Ctx): void {
  const k = c.w;
  if (k <= 0) return;
  const R = c.r;
  const len = Math.hypot(c.dir.x, c.dir.y) || 1;
  const dx = c.dir.x / len;
  const dy = c.dir.y / len;
  const far = distToEdge(c.home, { x: dx, y: dy }, c.view) + 4 * R;
  const crouch = hump(k, 0, 0.2);
  const go = Math.pow(span(k, 0.12, 1), 1.7);
  g.x += dx * far * go - dx * R * 0.5 * crouch;
  g.y += dy * far * go - dy * R * 0.5 * crouch - R * 0.25 * crouch;
  g.squash *= 1 - 0.18 * crouch + 0.1 * span(k, 0.2, 0.5);
  g.omega = 16;
  g.face = k < 0.3 ? "joy" : "glad";
  g.look = null;
  const stream = span(k, 0.12, 0.4);
  g.earL.splay += 0.9 * stream;
  g.earR.splay -= 0.9 * stream;
  g.gl.x -= dx * 0.9 * stream;
  g.gr.x -= dx * 0.9 * stream;
  g.gl.y -= dy * 0.9 * stream;
  g.gr.y -= dy * 0.9 * stream;
  if (c.wPrev < 0.12 && k >= 0.12) {
    cueAt(c, "lines", -dx * 1.6, -dy * 1.6, "ink", 1, (Math.atan2(dy, dx) * 180) / Math.PI);
  }
}

// The work ----------------------------------------------------------------------------------------

export interface CarryParams {
  /** Where the middle of the payload should be, and how big it is on the screen (pixels). */
  x: number;
  y: number;
  width: number;
  /** How taut it holds (0 to 1), how hard it struggles (0 to 1), how high it lifts (-1 sags, 1 high). */
  tension: number;
  struggle: number;
  lift: number;
}

/** What the carry remembers from one frame to the next, to tell a drop from a lift. */
export interface CarryMemory {
  lift: number;
  seen: boolean;
}

/** Where the glove that holds an end rests in the ball's frame (radii): a little below the middle, forward. */
const GRIP_Y = -0.42;
const GRIP_Z = 0.55;
const held = { x: 0, y: 0, z: 0 };

/** How far a drone's inner glove is from its ball, in radii, when it carries with a given tension. */
export const carryReach = (tension: number): number => 1.72 + 0.5 * clamp01(tension);

/**
 * Two drones carry something between them. The left one holds its left end with the glove on its
 * right, the right one holds the right end. The ball sits beside the end and a little above the
 * hand. A struggle makes them bob against each other, tremble, flail the free glove and go red in
 * the face; a drop of the lift is a jolt and a rise is a heave.
 */
export function carry(g: DroneGoal, c: Ctx, p: CarryParams, mem: CarryMemory): void {
  const R = c.r;
  const end = c.who === 0 ? -1 : 1;
  const tension = clamp01(p.tension);
  const struggle = clamp01(p.struggle);
  const lift = clamp(p.lift, -1, 1);
  const reach = carryReach(tension);
  const rate = c.dt > 0 && mem.seen ? (lift - mem.lift) / c.dt : 0;
  if (c.who === 0) {
    mem.lift = lift;
    mem.seen = true;
  }
  const wobble = struggle * R * 0.16 * Math.sin(c.t * (4 + 3 * struggle) + c.who * 2.5);
  const jitter = struggle * struggle * R * 0.025 * Math.sin(c.t * 47 + c.who * 2);
  // One end sags a little more than the other, and the two trade.
  const weak = struggle * Math.sin(c.t * 1.9) * R * 0.3 * (c.who === 0 ? -1 : 1);
  g.z = c.who * 14;
  g.radius = R;
  g.omega = 11;
  g.roll = -end * 0.3 * tension + 0.05 * Math.sin(c.t * 3 + c.who) * struggle;
  g.yaw = -end * 0.15;
  // The ball stands where its inner glove, turned with the ball, lands on its end of the payload.
  gloveOffset(held, -end * reach, GRIP_Y, GRIP_Z, g.yaw, g.roll);
  g.x = p.x + (end * p.width) / 2 - held.x * R + jitter;
  g.y = p.y + lift * R * 1.1 + wobble + weak - held.y * R;
  g.squash = 1 - 0.06 * struggle * (0.5 + 0.5 * Math.sin(c.t * 6 + c.who));
  g.look = { x: p.x, y: p.y };
  g.turn = 0.3;
  const inner = glove(g, -end);
  const outer = glove(g, end);
  setGlove(inner, -end * reach, GRIP_Y, GRIP_Z, 0, end * 0.2, end * 0.1, 1.08);
  inner.omega = 40;
  inner.zeta = 1;
  const flail = clamp01((struggle - 0.3) / 0.5);
  setGlove(outer, end * 1.72, -0.42, 0.4, 0, -end * 0.3, -end * 0.22, 1);
  mixGlove(
    outer,
    end * 1.9,
    0.9 + 0.4 * Math.sin(c.t * 9 + c.who),
    0.5,
    0,
    -end * 0.3,
    -end * 0.5 + 0.3 * Math.sin(c.t * 11 + c.who),
    1.05,
    flail,
  );
  g.earL.splay = g.earR.splay = 0.5 * struggle;
  g.earL.fold = g.earR.fold = -0.2 * struggle;

  // The face goes with what it costs.
  if (lift < -0.4 && struggle > 0.2) g.face = c.who === 0 ? "worry" : "surprise";
  else if (struggle > 0.75) g.face = "strain";
  else if (struggle > 0.35) g.face = "effort";
  else g.face = OWN[c.who];

  if (struggle > 0.45 && crossed(c.t, c.dt, 1.15, c.who * 0.55)) {
    cueAt(c, "drop", end * 1.1, 1.1, "cyan", 0.8);
  }
  if (struggle > 0.7 && crossed(c.t, c.dt, 1.9, 0.3 + c.who * 0.9)) {
    cueAt(c, "vein", end * 0.8, 1.3, "pink", 0.9);
  }
  if (c.who === 0 && c.dt > 0) {
    if (rate < -2.2) {
      cueAt(c, "bang", -1.0, 1.9, "pink", 1.0);
      cueAt(c, "lines", 0, -1.4, "ink", 0.9, 0);
    } else if (rate > 2.2 && struggle > 0.5) {
      cueAt(c, "spark", 1.0, 1.9, "gold", 1.0);
    }
  }
}

export interface PullParams {
  /** The payload's rectangle on the screen: its middle and its size, in pixels. */
  cx: number;
  cy: number;
  w: number;
  h: number;
  /** How hard they pull, 0 to 1. */
  strain: number;
}

/** The longest a glove may stretch from its ball, in radii. */
const MAX_REACH = 3.4;

/**
 * Two drones pull a payload bigger, one at the bottom left corner and one at the top right, each
 * with the glove on the side of the payload, the ball outside the corner leaning back. The section
 * grows the rectangle; this keeps the hands on its corners and the bodies tugging.
 */
export function pull(g: DroneGoal, c: Ctx, p: PullParams): void {
  const R = c.r;
  const strain = clamp01(p.strain);
  const sx = c.who === 0 ? -1 : 1;
  const sy = c.who === 0 ? -1 : 1;
  const cornerX = p.cx + (sx * p.w) / 2;
  const cornerY = p.cy + (sy * p.h) / 2;
  // Out of the payload along the diagonal, in the proportion of the rectangle.
  let ox = sx * Math.max(p.w, 1);
  let oy = sy * Math.max(p.h, 1);
  const olen = Math.hypot(ox, oy);
  ox /= olen;
  oy /= olen;
  const tug = R * 0.18 * strain * Math.sin(c.t * 6.5 + c.who * Math.PI);
  g.x = cornerX + ox * (1.9 * R + 0.4 * R * strain + tug);
  g.y = cornerY + oy * (1.9 * R + 0.4 * R * strain + tug);
  g.z = c.who * 14;
  g.radius = R;
  g.omega = 14;
  g.roll = -ox * 0.4 * strain;
  g.yaw = -ox * 0.25;
  g.squash = 1 - 0.05 * strain * (0.5 + 0.5 * Math.sin(c.t * 7 + c.who));
  g.look = { x: p.cx, y: p.cy };
  g.turn = 0.3;
  // The hand on the payload's side, pinned to the corner (as far as an arm reaches).
  let px = cornerX;
  let py = cornerY;
  const dx = px - g.x;
  const dy = py - g.y;
  const d = Math.hypot(dx, dy);
  if (d > MAX_REACH * R) {
    px = g.x + (dx / d) * MAX_REACH * R;
    py = g.y + (dy / d) * MAX_REACH * R;
  }
  const hold = glove(g, ox > 0 ? -1 : 1);
  pinGlove(hold, px, py, 0.7, 40, true);
  const brace = glove(g, ox > 0 ? 1 : -1);
  const shake = Math.sin(c.t * 31 + c.who) * 0.05 * strain;
  setGlove(brace, (ox > 0 ? 1 : -1) * 1.8, 0.2 + shake, 0.5, 0, 0, (ox > 0 ? -1 : 1) * 0.4);
  g.earL.splay = g.earR.splay = 0.6 * strain;
  g.face = strain > 0.75 ? "strain" : strain > 0.25 ? "effort" : OWN[c.who];
  if (strain > 0.45 && crossed(c.t, c.dt, 1.2, c.who * 0.6)) {
    cueAt(c, "drop", -ox * 1.1, 1.2, "cyan", 0.8);
  }
  if (strain > 0.7 && crossed(c.t, c.dt, 2.0, 0.4 + c.who))
    cueAt(c, "vein", ox * 0.7, 1.4, "pink", 0.9);
}

export interface CrankParams {
  /** The handle on the screen (pixels), or null when there is none yet. */
  handle: Vec2 | null;
  /** Turns a second, and the angle the crank is at now, in radians. */
  speed: number;
  phase: number;
}

/**
 * One drone turns a crank with a glove pinned to its handle: it rocks with each turn, leans to the
 * handle and puffs more as the crank goes faster.
 */
export function crank(g: DroneGoal, c: Ctx, p: CrankParams): void {
  const R = c.r;
  const h = p.handle;
  const fast = clamp01(p.speed / 1.4);
  g.omega = 10;
  g.face = p.speed < 0.7 ? "glad" : p.speed < 1.2 ? "squeeze" : "effort";
  if (!h) return;
  const side = h.x >= g.x ? 1 : -1;
  g.x += R * 0.08 * Math.cos(p.phase) * side * (0.4 + fast);
  g.y += R * 0.1 * Math.sin(p.phase) * (0.4 + fast);
  g.roll += 0.1 * Math.sin(p.phase) * (0.4 + fast) - side * 0.08;
  g.yaw += side * 0.3;
  g.squash *= 1 + 0.03 * Math.sin(p.phase * 2) * (0.4 + fast);
  g.look = h;
  g.turn = 0.4;
  g.earL.splay += 0.3 * fast;
  g.earR.splay -= 0.3 * fast;
  pinGlove(glove(g, side), h.x, h.y, 0.7, 40, true);
  setGlove(glove(g, -side), -side * 1.95, -0.35, 0.2, 0, side * 0.25, side * 0.2);
  if (fast > 0.8 && crossed(c.t, c.dt, 1.3, 0.2)) cueAt(c, "drop", -side * 1.1, 1.3, "cyan", 0.7);
}

export interface HaulParams {
  /** The handle on the screen (pixels) and how fast it moves (pixels a second). */
  handle: Vec2 | null;
  vel: Vec2;
  /** The way the drone pulls, from the handle to the drone, a unit vector. */
  dir: Vec2;
  /** How hard it pulls, 0 to 1. */
  strain: number;
}

/**
 * One drone drags something along by a handle: it flies ahead of the handle along its direction,
 * glove pinned to the handle, leaning into the pull, bobbing with each step the load makes.
 */
export function haul(g: DroneGoal, c: Ctx, p: HaulParams): void {
  const R = c.r;
  const h = p.handle;
  if (!h) return;
  const strain = clamp01(p.strain);
  const speed = Math.hypot(p.vel.x, p.vel.y);
  const moving = clamp01(speed / (3 * R));
  const len = Math.hypot(p.dir.x, p.dir.y) || 1;
  const dx = p.dir.x / len;
  const dy = p.dir.y / len;
  const bob = R * 0.14 * Math.abs(Math.sin(c.t * (3 + speed / (2 * R)))) * moving;
  g.x = h.x + dx * (2 * R + 0.5 * R * strain);
  g.y = h.y + dy * (2 * R + 0.5 * R * strain) + 0.35 * R + bob;
  g.omega = 12;
  g.roll = -dx * 0.35 * Math.min(1, moving + strain * 0.5);
  g.yaw = dx * -0.4;
  g.squash = 1 - 0.04 * strain * (0.5 + 0.5 * Math.sin(c.t * 8));
  g.look = { x: g.x + dx * 5 * R, y: g.y + dy * 5 * R };
  g.turn = 0.5;
  const side = h.x >= g.x ? 1 : -1;
  pinGlove(glove(g, side), h.x, h.y, 0.7, 40, true);
  setGlove(
    glove(g, -side),
    -side * 1.6,
    0.2 + 0.3 * Math.sin(c.t * 6) * moving,
    0.5,
    0,
    0,
    side * 0.3,
  );
  g.earL.splay += 0.7 * moving;
  g.earR.splay -= 0.7 * moving;
  if (moving > 0.3 || strain > 0.5) g.face = strain > 0.6 ? "effort" : "glad";
  if (strain > 0.6 && crossed(c.t, c.dt, 1.3, 0.2)) cueAt(c, "drop", -side * 1.1, 1.3, "cyan", 0.7);
}

// The dispatch --------------------------------------------------------------------------------------

export type PairMode =
  | { kind: SimplePose }
  | { kind: "carry"; params: CarryParams }
  | { kind: "pull"; params: PullParams };

export type SoloMode =
  { kind: "crank"; params: CrankParams } | { kind: "haul"; params: HaulParams } | null;

/** Write the goal of one drone for the frame: the life first, then the pose over it. */
export function buildGoal(
  g: DroneGoal,
  c: Ctx,
  pair: PairMode,
  solo: SoloMode,
  mem: CarryMemory,
): void {
  floatGoal(g, c);
  switch (pair.kind) {
    case "float":
      break;
    case "dance":
      dance(g, c);
      break;
    case "stare":
      stare(g, c);
      break;
    case "confused":
      confused(g, c);
      break;
    case "question":
      question(g, c);
      break;
    case "wave":
      wave(g, c);
      break;
    case "bow":
      bow(g, c);
      break;
    case "leave":
      leave(g, c);
      break;
    case "carry":
      carry(g, c, pair.params, mem);
      break;
    case "pull":
      pull(g, c, pair.params);
      break;
  }
  if (solo?.kind === "crank") crank(g, c, solo.params);
  else if (solo?.kind === "haul") haul(g, c, solo.params);
}
