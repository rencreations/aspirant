import { bump, clamp, clamp01, mix, springTo, swingTo, TAU, type Sprung } from "../choreo/ease";
import type { DroneAsk } from "../stage-bus";

import { blendFace, copyFace, faceDistance, FACES, type FaceName, type FaceShape } from "./face";
import type { MarkKind, MarkTone } from "./fx";
import type { Cast, CompanionPose, EarPose, GlovePose } from "./pose";

/**
 * What Guinevere's two drones do. Plain arithmetic, no three and no DOM: each frame it is told the
 * time that has passed, where the pointer and the page's drone are, and it writes two poses.
 *
 * They play one scene, once (a clock): the bold one rolls in behind its own glove and calls the
 * soft one out of hiding; they notice our drone, come up to it, bump fists with it, copy its roll
 * and throw a glove over its head; they wave, shoot off, and cannot stay away. Then they live:
 * they bob, blink, look about, and answer a hover, a press and our drone with a move of its own
 * clock that always finishes. With no drone at their side they play the same scene to the visitor.
 *
 * Every frame starts from a goal (where each part wants to be) and the parts follow it on springs,
 * so the gloves trail the ball, the ears swing after a stop, and no change of mind is a jump.
 */

interface Point {
  x: number;
  y: number;
}

/** The stage, read from the page: its size, the ball's radius and the three places on it. */
export interface StageView {
  width: number;
  height: number;
  radius: number;
  /** Where the bold one and the soft one live, and where our drone rests. */
  a: Point;
  b: Point;
  d: Point;
  /** How wide our drone is drawn at its place. */
  droneSize: number;
}

interface StageInput {
  dt: number;
  /** The pointer on the stage, in CSS pixels, or null when there is none to look at. */
  pointer: Point | null;
  /** Our drone on the stage, and whether it has come to rest at its place here. */
  drone: (Point & { here: boolean }) | null;
  view: StageView;
}

interface Env {
  cue: (kind: MarkKind, x: number, y: number, tone: MarkTone, size: number, turn?: number) => void;
  askDrone: (move: DroneAsk) => void;
}

export interface Performance {
  step: (input: StageInput) => Cast;
  /** Start the scene (once). */
  begin: () => void;
  replay: () => void;
  /** Straight to living, at their places. */
  skip: () => void;
  press: (who: number) => void;
  hover: (who: number, over: boolean) => void;
  /** The visitor pressed our drone while it was at their side. */
  dronePressed: () => void;
  /** The stage is back on the screen after a while away. */
  comeBack: () => void;
  /** A point of the stage our drone should look at, or null. */
  eyes: () => Point | null;
  /** Whether the two can be pressed now. */
  open: () => boolean;
  state: () => { mode: string; clock: number; withDrone: boolean; moves: Array<string | null> };
  /** Show one face on one of them (the probes' face sheets), or null to let it go. */
  hold: (who: number, face: FaceName | null) => void;
  /** Start a move by name (the probes). */
  play: (kind: string, who: number) => void;
}

// The curves -------------------------------------------------------------------------------------

type Ease = "io" | "out" | "in" | "back" | "lin";
type Key = readonly [time: number, value: number, ease?: Ease];

const EASE: Record<Ease, (u: number) => number> = {
  io: (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2),
  out: (u) => 1 - Math.pow(1 - u, 3),
  in: (u) => u * u * u,
  back: (u) => 1 + 2.70158 * Math.pow(u - 1, 3) + 1.70158 * Math.pow(u - 1, 2),
  lin: (u) => u,
};

/** A value through keys. Each key's curve is how the value comes to it from the key before. */
function key(t: number, keys: readonly Key[]): number {
  let from = keys[0];
  if (!from) return 0;
  if (t <= from[0]) return from[1];
  for (let k = 1; k < keys.length; k += 1) {
    const to = keys[k];
    if (!to) break;
    if (t < to[0]) {
      const u = (t - from[0]) / (to[0] - from[0]);
      return from[1] + (to[1] - from[1]) * EASE[to[2] ?? "io"](u);
    }
    from = to;
  }
  return from[1];
}

/** 0 before `a`, 1 after `b`. */
const span = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
/** 0, up to 1 in the middle of [a, b], 0 again. */
const hump = (t: number, a: number, b: number) => (t <= a || t >= b ? 0 : bump((t - a) / (b - a)));

/** A small generator with a seed, so the blinks of a probe's run are the same every time. */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// Goals ------------------------------------------------------------------------------------------

interface GloveGoal extends GlovePose {
  /** True: the place and the turn are the stage's own, not turned with the ball. */
  free: boolean;
  /** How quick the glove follows, and how loose (under 1 it swings past). */
  omega: number;
  zeta: number;
}

interface Goal {
  x: number;
  y: number;
  z: number;
  scale: number;
  yaw: number;
  pitch: number;
  roll: number;
  spin: number;
  squash: number;
  earL: EarPose;
  earR: EarPose;
  /** The glove on the model's left (the right of the screen when it faces us), and the other. */
  gl: GloveGoal;
  gr: GloveGoal;
  face: FaceName;
  /** A point of the stage to look at, and how much the ball turns to it (the eyes always do). */
  look: Point | null;
  turn: number;
  /** A lid held shut by the scene, 0 to 1, and how lit the screen is. */
  lid: number;
  on: number;
  /** How quick the ball follows its place. */
  omega: number;
  /** Whether the ball leans into its own speed. */
  lean: boolean;
  /** True: the ball is put at its place at once (it is off the stage, changing sides). */
  jump: boolean;
}

const earGoal = (): EarPose => ({ splay: 0, fold: 0, twist: 0 });
const gloveGoal = (): GloveGoal => ({
  x: 0,
  y: 0,
  z: 0,
  rx: 0,
  ry: 0,
  rz: 0,
  size: 1,
  free: false,
  omega: 17,
  zeta: 0.55,
});

const newGoal = (): Goal => ({
  x: 0,
  y: 0,
  z: 0,
  scale: 1,
  yaw: 0,
  pitch: 0,
  roll: 0,
  spin: 0,
  squash: 1,
  earL: earGoal(),
  earR: earGoal(),
  gl: gloveGoal(),
  gr: gloveGoal(),
  face: "soft",
  look: null,
  turn: 0,
  lid: 0,
  on: 1,
  omega: 9,
  lean: true,
  jump: false,
});

/** Where a glove rests, in the ball's own frame, in radii. `side` is 1 for the left glove. */
const HOME = { x: 1.72, y: -0.42, z: 0.4, ry: -0.3, rz: -0.22 };

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
  g.omega = 17;
  g.zeta = 0.55;
  return g;
}

// The cast ---------------------------------------------------------------------------------------

type MoveKind =
  // The bold one's answers.
  | "combo"
  | "spin"
  | "flex"
  | "rocket"
  | "fume"
  // The soft one's answers.
  | "hide"
  | "bounce"
  | "behind"
  | "hello"
  | "pout"
  // Both.
  | "dizzy"
  | "bump"
  | "cheer"
  | "greet"
  | "guard"
  | "jabs"
  | "flick";

const SECONDS: Record<MoveKind, number> = {
  combo: 1.5,
  spin: 1.4,
  flex: 1.7,
  rocket: 1.9,
  fume: 1.6,
  hide: 2.3,
  bounce: 1.8,
  behind: 3.1,
  hello: 1.7,
  pout: 1.6,
  dizzy: 2.3,
  bump: 2.5,
  cheer: 1.7,
  greet: 2.2,
  guard: 3.1,
  jabs: 1.1,
  flick: 0.9,
};

/** The answers to a press, in order, for each of the two. Many quick presses make one dizzy. */
const ANSWERS: readonly [readonly MoveKind[], readonly MoveKind[]] = [
  ["combo", "spin", "flex", "rocket"],
  ["hide", "bounce", "behind", "hello"],
];
const DIZZY_PRESSES = 4;
const DIZZY_WINDOW = 2.4;
/** Both pressed within this many seconds: they bump fists. */
const TOGETHER = 2.6;
/** Our drone is greeted again only after it has been gone this long (seconds). */
const MEET_AGAIN = 16;

/** The faces each rests in. */
const OWN: readonly [FaceName, FaceName] = ["bold", "soft"];
/** The soft one is a little smaller. */
const SIZE: readonly [number, number] = [1, 0.9];

interface GloveState {
  x: Sprung;
  y: Sprung;
  z: Sprung;
  rx: Sprung;
  ry: Sprung;
  rz: Sprung;
  size: Sprung;
}

interface Actor {
  who: 0 | 1;
  goal: Goal;
  x: Sprung;
  y: Sprung;
  z: Sprung;
  scale: Sprung;
  yaw: Sprung;
  pitch: Sprung;
  roll: Sprung;
  squash: Sprung;
  ears: [Sprung, Sprung, Sprung, Sprung, Sprung, Sprung];
  gl: GloveState;
  gr: GloveState;
  lookX: Sprung;
  lookY: Sprung;
  /** The face it shows, the one it is leaving, and how far the change has come. */
  faceName: FaceName;
  faceFrom: FaceShape;
  faceT: number;
  faceSwap: boolean;
  blinkAt: number;
  blinkT: number;
  random: () => number;
  /** A move of its own clock. */
  move: { kind: MoveKind; t: number; was: number; seconds: number } | null;
  answers: number;
  presses: number[];
  pressedAt: number;
  hovered: boolean;
  hoverT: number;
  /** When it next does a small thing by itself, and what it looks at. */
  idleAt: number;
  gazeAt: number;
  gazeAt2: number;
  held: FaceName | null;
  pose: CompanionPose;
}

const sprung = (x = 0): Sprung => ({ x, v: 0 });
const gloveState = (): GloveState => ({
  x: sprung(),
  y: sprung(),
  z: sprung(),
  rx: sprung(),
  ry: sprung(),
  rz: sprung(),
  size: sprung(1),
});

const glovePose = (): GlovePose => ({ x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, size: 1 });

function newActor(who: 0 | 1): Actor {
  return {
    who,
    goal: newGoal(),
    x: sprung(),
    y: sprung(),
    z: sprung(),
    scale: sprung(1),
    yaw: sprung(),
    pitch: sprung(),
    roll: sprung(),
    squash: sprung(1),
    ears: [sprung(), sprung(), sprung(), sprung(), sprung(), sprung()],
    gl: gloveState(),
    gr: gloveState(),
    lookX: sprung(),
    lookY: sprung(),
    faceName: OWN[who],
    faceFrom: { ...FACES[OWN[who]] },
    faceT: 1,
    faceSwap: false,
    blinkAt: 1.5 + who,
    blinkT: 1,
    random: seeded(who === 0 ? 20221 : 90917),
    move: null,
    answers: 0,
    presses: [],
    pressedAt: -100,
    hovered: false,
    hoverT: 0,
    idleAt: 5 + who * 2.5,
    gazeAt: 0,
    gazeAt2: 0,
    held: null,
    pose: {
      x: -999,
      y: -999,
      z: 0,
      radius: 40,
      yaw: 0,
      pitch: 0,
      roll: 0,
      spin: 0,
      squash: 1,
      earL: earGoal(),
      earR: earGoal(),
      gloveL: glovePose(),
      gloveR: glovePose(),
      face: { ...FACES[OWN[who]] },
      live: { blinkL: 0, blinkR: 0, lookX: 0, lookY: 0, on: 1, spin: 0 },
    },
  };
}

// The scene's clock ------------------------------------------------------------------------------

/** When the second act (they notice our drone) and the third (they leave) begin, in seconds. */
const ACT2 = 4.3;
const ACT3 = 16.2;
const END = ACT3 + 6.3;

export function createPerformance(env: Env): Performance {
  const cast = [newActor(0), newActor(1)] as const;
  const [bold, soft] = cast;

  let mode: "wait" | "story" | "live" = "wait";
  /** The scene's clock, and the clock of the life after it. */
  let clock = 0;
  let clockWas = 0;
  let life = 0;
  let view: StageView = {
    width: 1200,
    height: 600,
    radius: 50,
    a: { x: 360, y: 300 },
    b: { x: 840, y: 300 },
    d: { x: 600, y: 280 },
    droneSize: 140,
  };
  let pointer: Point | null = null;
  let drone: (Point & { here: boolean }) | null = null;
  /** Whether the scene is played with our drone (it was at their side when they looked up). */
  let withDrone = false;
  let droneWasHere = false;
  let droneGone = 0;
  let droneMet = false;
  let gaze: Point | null = null;
  const gazeOut: Point = { x: 0, y: 0 };
  /** A glove in the air between the two, in the scene: where it is on the stage. */
  const thrown: Point & { on: boolean; turn: number; size: number } = {
    x: 0,
    y: 0,
    on: false,
    turn: 0,
    size: 1,
  };

  const R = () => view.radius;
  const radiusOf = (a: Actor) => view.radius * SIZE[a.who] * a.scale.x;

  /** A mark, at a place given from one of them: across and up, in radii of the ball. */
  const cueAt = (
    a: Actor,
    kind: MarkKind,
    dx: number,
    dy: number,
    tone: MarkTone,
    size = 1,
    turn = 0,
  ) => {
    env.cue(
      kind,
      a.x.x + dx * R(),
      a.y.x - dy * R(),
      tone,
      size * clamp(R() / 56, 0.62, 1.3),
      turn,
    );
  };
  const cuePoint = (kind: MarkKind, p: Point, tone: MarkTone, size = 1, turn = 0) => {
    env.cue(kind, p.x, p.y, tone, size * clamp(R() / 56, 0.62, 1.3), turn);
  };

  /** What the two play round: our drone's place, and how much room it takes. */
  const half = () => (withDrone ? view.droneSize * 0.5 : R());
  /** From the place they play round toward one's home, as a unit vector. */
  const away = (a: Actor): Point => {
    const home = a.who === 0 ? view.a : view.b;
    const dx = home.x - view.d.x;
    const dy = home.y - view.d.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: dx / len, y: dy / len };
  };
  /** Where one stands when the two have come up to our drone. */
  const flank = (a: Actor): Point => {
    const dir = away(a);
    const reach = half() + 2.85 * R();
    return {
      x: clamp(view.d.x + dir.x * reach, 2.4 * R(), view.width - 2.4 * R()),
      y: clamp(view.d.y + dir.y * reach + 0.2 * R(), 2.7 * R(), view.height - 1.7 * R()),
    };
  };
  /** Where a glove's middle is when it touches our drone. */
  const touch = (a: Actor): Point => {
    const dir = away(a);
    const reach = half() * 0.8 + 0.62 * R();
    return { x: view.d.x + dir.x * reach, y: view.d.y + dir.y * reach };
  };

  /** Put a glove at a place of the stage (not of the ball), in pixels. */
  const putAt = (a: Actor, g: GloveGoal, x: number, y: number, z = 0.6, omega = 30): GloveGoal => {
    const r = Math.max(1, radiusOf(a));
    g.free = true;
    g.x = (x - a.x.x) / r;
    g.y = -(y - a.y.x) / r;
    g.z = z;
    g.rx = 0;
    g.ry = 0;
    g.rz = 0;
    g.size = 1;
    g.omega = omega;
    g.zeta = 1;
    return g;
  };
  /** The glove on the side of a point, and the other. */
  const near = (a: Actor, g: Goal, p: Point): [GloveGoal, GloveGoal, number] =>
    p.x >= a.x.x ? [g.gl, g.gr, 1] : [g.gr, g.gl, -1];
  /** The turn that faces a point. */
  const facing = (a: Actor, p: Point, much = 0.8) => clamp((p.x - a.x.x) / (4 * R()), -1, 1) * much;

  // The life: what each does with nothing else to do ------------------------------------------

  const idle = (a: Actor, g: Goal) => {
    const home = a.who === 0 ? view.a : view.b;
    const t = life + a.who * 1.9;
    g.x = home.x + R() * 0.14 * Math.sin(t * 0.62);
    g.y = home.y + R() * 0.17 * Math.sin(t * 1.21 + a.who);
    g.z = a.who * 12;
    g.scale = 1;
    g.yaw = 0;
    g.pitch = 0;
    g.roll = 0.03 * Math.sin(t * 0.8);
    g.spin = 0;
    g.squash = 1 + 0.015 * Math.sin(t * 2.42);
    g.omega = 7;
    g.lean = true;
    g.jump = false;
    g.on = 1;
    g.lid = 0;
    g.face = OWN[a.who];
    for (const [glove, side] of [
      [g.gl, 1],
      [g.gr, -1],
    ] as const) {
      setGlove(
        glove,
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

    // What it looks at: the pointer when it is near, else the other one, our drone, the visitor.
    const other = a.who === 0 ? soft : bold;
    g.turn = 0.55;
    if (pointer && Math.hypot(pointer.x - a.x.x, pointer.y - a.y.x) < 9 * R()) {
      g.look = pointer;
    } else {
      if (life > a.gazeAt) {
        a.gazeAt = life + 2.2 + a.random() * 2.6;
        a.gazeAt2 = Math.floor(a.random() * 3);
      }
      if (a.gazeAt2 === 0) g.look = { x: other.x.x, y: other.y.x };
      else if (a.gazeAt2 === 1 && drone?.here) g.look = drone;
      else g.look = null;
      g.turn = 0.35;
    }
    // Hovered: the bold one squares up, the soft one shrinks behind its gloves.
    a.hoverT = clamp01(a.hoverT + (a.hovered ? 5 : -4) * lastDt);
    const h = EASE.io(a.hoverT);
    if (h > 0.01) {
      if (a.who === 0) {
        g.face = a.hoverT > 0.3 ? "glad" : g.face;
        mixGlove(g.gl, 1.2, 0.5, 1.0, 0, -0.35, -0.2, 1.08, h);
        mixGlove(g.gr, -1.2, 0.35, 1.0, 0, 0.35, 0.2, 1.08, h);
        g.scale = 1 + 0.07 * h;
        g.earL.splay -= 0.2 * h;
        g.earR.splay -= 0.2 * h;
      } else {
        g.face = a.hoverT > 0.3 ? "shy" : g.face;
        mixGlove(g.gl, 0.85, -0.25, 1.15, 0, -0.5, 0.25, 1, h);
        mixGlove(g.gr, -0.85, -0.25, 1.15, 0, 0.5, -0.25, 1, h);
        g.roll += 0.14 * h;
        g.earL.splay += 0.35 * h;
        g.earR.splay += 0.35 * h;
      }
    }
  };

  const mixGlove = (
    g: GloveGoal,
    x: number,
    y: number,
    z: number,
    rx: number,
    ry: number,
    rz: number,
    size: number,
    t: number,
  ) => {
    g.x = mix(g.x, x, t);
    g.y = mix(g.y, y, t);
    g.z = mix(g.z, z, t);
    g.rx = mix(g.rx, rx, t);
    g.ry = mix(g.ry, ry, t);
    g.rz = mix(g.rz, rz, t);
    g.size = mix(g.size, size, t);
  };

  // The moves: one's answer to a press, or something the two do together --------------------------

  const start = (a: Actor, kind: MoveKind) => {
    a.move = { kind, t: 0, was: -1, seconds: SECONDS[kind] };
  };
  const startBoth = (kind: MoveKind) => {
    start(bold, kind);
    start(soft, kind);
  };
  const busyTogether = () =>
    cast.some((a) => {
      const k = a.move?.kind;
      return k === "bump" || k === "guard" || k === "behind" || k === "greet" || k === "cheer";
    });

  /** A punch toward the visitor with one glove, between `from` and `to`. */
  const jab = (g: GloveGoal, side: number, t: number, from: number, to: number) => {
    const p = hump(t, from, to);
    if (p <= 0) return;
    mixGlove(g, side * 0.75, 0.15, 2.9, 0, 0, side * -0.1, 1.5, EASE.out(p));
    g.omega = 34;
    g.zeta = 0.8;
  };
  const guardUp = (g: Goal, much: number) => {
    mixGlove(g.gl, 1.2, 0.45, 1.05, 0, -0.35, -0.2, 1.05, much);
    mixGlove(g.gr, -1.2, 0.3, 1.05, 0, 0.35, 0.2, 1.05, much);
  };

  const act = (a: Actor, g: Goal) => {
    const m = a.move;
    if (!m) return;
    const t = m.t;
    const hit = (at: number) => m.was < at && t >= at;
    const other = a.who === 0 ? soft : bold;
    const end = 1 - span(t, m.seconds - 0.3, m.seconds);
    g.turn = 0;
    switch (m.kind) {
      case "combo": {
        // Jab, jab, cross: at the visitor.
        g.face = "bold";
        guardUp(g, end);
        jab(g.gl, 1, t, 0.12, 0.42);
        jab(g.gr, -1, t, 0.42, 0.72);
        jab(g.gl, 1, t, 0.78, 1.2);
        g.x += R() * 0.3 * (hump(t, 0.12, 0.42) - hump(t, 0.42, 0.72) + hump(t, 0.78, 1.2));
        g.scale = 1 + 0.1 * hump(t, 0.78, 1.2);
        g.squash = 1 - 0.06 * hump(t, 0.7, 0.86);
        if (hit(0.2)) cueAt(a, "lines", 1.1, 1.3, "ink", 0.8, 20);
        if (hit(0.5)) cueAt(a, "lines", -1.1, 1.3, "ink", 0.8, -20);
        if (hit(0.9)) cueAt(a, "spark", 1.0, 1.0, "gold", 1.2);
        if (t > 1.2) g.face = "glad";
        break;
      }
      case "spin": {
        // A wind up the wrong way, then once round like a wheel, the gloves flung out.
        const wind = hump(t, 0, 0.3);
        const go = EASE.io(span(t, 0.25, 1.0));
        g.spin = (a.who === 0 ? -1 : 1) * (TAU * go - 0.5 * wind);
        const fling = hump(t, 0.25, 1.05);
        g.gl.x += 0.7 * fling;
        g.gr.x -= 0.7 * fling;
        g.gl.y += 0.5 * fling;
        g.gr.y += 0.5 * fling;
        g.y -= R() * 0.5 * hump(t, 0.25, 1.0);
        g.squash = 1 - 0.14 * wind + 0.1 * hump(t, 0.3, 0.6) - 0.1 * hump(t, 1.0, 1.15);
        g.face = t < 1.0 ? "squeeze" : "happy";
        g.earL.splay = g.earR.splay = 0.7 * fling;
        if (hit(0.55)) cueAt(a, "spark", -1.7, 1.5, "gold");
        if (hit(0.8)) cueAt(a, "spark", 1.8, 1.2, "pink", 0.8);
        if (hit(1.02)) cueAt(a, "puff", 0, -1.3, "ink", 0.7);
        break;
      }
      case "flex": {
        // Both gloves up, bigger, and a laugh.
        const up = EASE.back(span(t, 0.1, 0.5)) * end;
        mixGlove(g.gl, 1.75, 1.25, 0.5, 0, -0.2, -0.5, 1.2, up);
        mixGlove(g.gr, -1.75, 1.25, 0.5, 0, 0.2, 0.5, 1.2, up);
        g.scale = 1 + 0.16 * up;
        g.squash = 1 - 0.12 * hump(t, 0, 0.22) + 0.06 * hump(t, 0.2, 0.5);
        const pump = Math.sin(span(t, 0.5, 1.3) * TAU * 2);
        g.gl.y += 0.18 * pump * up;
        g.gr.y += 0.18 * pump * up;
        g.face = "happy";
        g.earL.splay = g.earR.splay = -0.25 * up;
        if (hit(0.5)) cueAt(a, "ha", 1.9, 2.6, "pink");
        if (hit(0.95)) cueAt(a, "ha", -1.9, 2.4, "ink", 0.8);
        break;
      }
      case "rocket": {
        // One glove goes off round the ball by itself and is caught again.
        const u = span(t, 0.3, 1.35);
        const wind = hump(t, 0, 0.34);
        g.gl.x += 0.5 * wind;
        g.roll -= 0.2 * wind;
        if (u > 0 && u < 1) {
          const angle = -0.25 + TAU * EASE.io(u);
          const reach = 2.4 + 0.9 * bump(u);
          setGlove(
            g.gl,
            Math.cos(angle) * reach,
            Math.sin(angle) * reach,
            0.6,
            0,
            0,
            angle + 1.2,
            1.15,
          );
          g.gl.free = true;
          g.gl.omega = 40;
          g.gl.zeta = 1;
          g.look = {
            x: a.x.x + Math.cos(angle) * reach * R(),
            y: a.y.x - Math.sin(angle) * reach * R(),
          };
        }
        g.face = u < 1 ? "wide" : "glad";
        g.squash = 1 - 0.1 * hump(t, 1.33, 1.5);
        if (hit(0.32)) cueAt(a, "lines", 2.3, 0, "ink", 0.9, 90);
        if (hit(1.36)) cueAt(a, "spark", 2.0, -0.2, "gold");
        break;
      }
      case "fume": {
        // After the dizziness: cross, a fist shaken at the visitor.
        g.face = "angry";
        g.scale = 1 + 0.1 * end;
        const shake = Math.sin(t * 30) * 0.12 * end;
        mixGlove(g.gl, 1.5, 1.2, 0.9, 0, -0.2, -0.3 + shake * 2, 1.2, end);
        g.x += R() * shake * 0.5;
        g.earL.splay = g.earR.splay = 0.9 * end;
        if (hit(0.1)) cueAt(a, "vein", 1.2, 2.3, "pink", 1.1);
        if (hit(0.7)) cueAt(a, "puff", -1.6, 1.6, "ink", 0.7);
        break;
      }
      case "hide": {
        // A start, then behind its gloves, a peek, and out again.
        const jump = hump(t, 0, 0.36);
        g.y -= R() * 0.9 * jump;
        g.squash = 1 + 0.12 * jump - 0.1 * hump(t, 0.34, 0.5);
        const in1 = EASE.out(span(t, 0.3, 0.55)) * (1 - EASE.io(span(t, 1.75, 2.1)));
        const peek = hump(t, 1.0, 1.7);
        mixGlove(g.gl, 0.55 + 0.5 * peek, 0.1, 1.3, 0, 0, 0.3 + 0.2 * peek, 1, in1);
        mixGlove(g.gr, -0.55, 0.1, 1.3, 0, 0, -0.3, 1, in1);
        g.face = t < 0.4 ? "wide" : t < 1.8 ? "shy" : "soft";
        g.earL.splay = g.earR.splay = 0.7 * in1 - 0.3 * jump;
        g.roll += 0.12 * peek;
        g.look = pointer;
        if (hit(0.05)) cueAt(a, "bang", 0.2, 2.9, "ink");
        if (hit(1.15)) cueAt(a, "drop", 1.5, 1.6, "cyan", 0.8);
        break;
      }
      case "bounce": {
        // Three happy hops and hearts: the face the model was painted with.
        const hops = Math.abs(Math.sin(span(t, 0.1, 1.4) * Math.PI * 3));
        g.y -= R() * 0.75 * hops * end;
        g.squash = 1 + 0.1 * hops - 0.12 * (1 - hops) * span(t, 0.1, 1.4) * end;
        g.face = t < 1.55 ? "love" : "glad";
        mixGlove(g.gl, 1.1, -0.1 + 0.3 * hops, 1.1, 0, -0.5, 0.2, 1, end);
        mixGlove(g.gr, -1.1, -0.1 + 0.3 * hops, 1.1, 0, 0.5, -0.2, 1, end);
        g.earL.splay = 0.3 * Math.sin(t * 14) * end;
        g.earR.splay = -0.3 * Math.sin(t * 14) * end;
        if (hit(0.25)) cueAt(a, "heart", 1.3, 2.3, "pink");
        if (hit(0.7)) cueAt(a, "heart", -1.2, 2.6, "pink", 0.8);
        if (hit(1.15)) cueAt(a, "heart", 0.4, 3.0, "pink", 0.65);
        break;
      }
      case "behind": {
        // Off to hide behind the bold one, a peek over its shoulder, and back.
        const there = EASE.io(span(t, 0.15, 0.7)) * (1 - EASE.io(span(t, 2.4, 3.0)));
        const side = other.x.x < a.x.x ? 1 : -1;
        const peek = hump(t, 1.2, 2.2);
        const home = view.b;
        g.x = mix(home.x, other.x.x + side * R() * (0.9 + 1.0 * peek), there);
        g.y = mix(home.y, other.y.x - R() * (0.5 + 0.5 * peek), there);
        g.z = there > 0.2 ? -700 : 12;
        g.omega = 12;
        g.scale = 1 - 0.08 * there;
        g.face = t < 0.5 ? "wide" : t < 2.4 ? "shy" : "soft";
        g.roll += side * -0.25 * peek;
        g.earL.splay = g.earR.splay = 0.5 * there;
        g.look = pointer;
        if (hit(0.05)) cueAt(a, "bang", 0, 2.9, "ink", 0.9);
        if (hit(0.2)) cueAt(a, "lines", side * 1.6, 0, "ink", 0.8, side * -90);
        if (hit(1.5)) cueAt(a, "drop", side * 1.4, 2.2, "cyan", 0.7);
        break;
      }
      case "guard": {
        // The bold one, while the soft one hides behind it: squared up, between it and the visitor.
        const up = EASE.out(span(t, 0.35, 0.7)) * (1 - EASE.io(span(t, 2.3, 2.9)));
        guardUp(g, up);
        g.scale = 1 + 0.14 * up;
        g.face = up > 0.3 ? "angry" : "bold";
        g.earL.splay = g.earR.splay = 0.55 * up;
        g.look = pointer;
        jab(g.gl, 1, t, 1.3, 1.6);
        jab(g.gr, -1, t, 1.6, 1.9);
        if (hit(0.6)) cueAt(a, "vein", -1.3, 2.3, "pink", 0.9);
        break;
      }
      case "hello": {
        // A small wave and a blush.
        const up = EASE.back(span(t, 0.1, 0.45)) * end;
        const wave = Math.sin(span(t, 0.4, 1.4) * TAU * 2.5) * 0.45;
        mixGlove(g.gl, 1.9, 1.05, 0.5, 0, -0.2, -0.3 + wave, 1, up);
        g.face = "shy";
        g.roll += 0.12 * up;
        g.earR.splay = 0.3 * up * Math.sin(t * 9);
        if (hit(0.5)) cueAt(a, "spark", 2.6, 2.0, "gold", 0.7);
        if (t > 1.3) g.face = "glad";
        break;
      }
      case "pout": {
        // After the dizziness: it turns its back, a little, and looks over its shoulder.
        g.yaw = -1.0 * end;
        g.face = "flat";
        g.earL.splay = g.earR.splay = 0.8 * end;
        g.roll += 0.1 * end;
        if (hit(0.15)) cueAt(a, "puff", 1.5, 1.8, "ink", 0.7);
        break;
      }
      case "dizzy": {
        // Too many presses: round and round.
        const d = 1 - span(t, 1.7, 2.3);
        g.face = "dizzy";
        g.roll += Math.sin(t * 6.5) * 0.42 * d;
        g.x += Math.sin(t * 3.2) * R() * 0.5 * d;
        g.y += Math.cos(t * 6.4) * R() * 0.14 * d;
        g.gl.y -= 0.5 * d;
        g.gr.y -= 0.5 * d;
        g.gl.rz += Math.sin(t * 5) * 0.5 * d;
        g.gr.rz -= Math.sin(t * 5 + 1) * 0.5 * d;
        g.earL.splay = 0.6 * Math.sin(t * 6.5 + 1) * d;
        g.earR.splay = -0.6 * Math.sin(t * 6.5 + 1) * d;
        if (hit(0.1)) cueAt(a, "swirl", 0.3, 2.9, "ink");
        if (hit(0.9)) cueAt(a, "star", -0.8, 2.3, "gold", 0.8);
        if (hit(m.seconds - 0.02)) start(a, a.who === 0 ? "fume" : "pout");
        break;
      }
      case "bump": {
        // Both were pressed: they meet in the middle and bump fists.
        const mid = { x: (view.a.x + view.b.x) / 2, y: (view.a.y + view.b.y) / 2 + R() * 0.9 };
        const home = a.who === 0 ? view.a : view.b;
        const dir = Math.sign(mid.x - home.x) || (a.who === 0 ? 1 : -1);
        const go = EASE.io(span(t, 0.1, 0.75)) * (1 - EASE.io(span(t, 1.75, 2.4)));
        g.x = mix(home.x, mid.x - dir * 2.5 * R(), go);
        g.y = mix(home.y, mid.y, go);
        g.omega = 12;
        g.yaw = dir * 0.6 * go;
        const [mine] = near(a, g, mid);
        const wind = hump(t, 0.7, 1.0);
        const strike = EASE.out(span(t, 0.98, 1.08)) * (1 - span(t, 1.3, 1.6));
        if (go > 0.5) {
          // Held back, drawn farther back, then driven to the middle.
          const back = 1.0 + 1.1 * wind - 0.48 * strike;
          putAt(a, mine, mid.x - dir * R() * back, mid.y - R() * 0.2 * wind, 0.9, 36);
          mine.ry = dir * 1.35;
          mine.size = 1.1;
        }
        g.face = t < 1.02 ? (a.who === 0 ? "bold" : "bars") : "happy";
        g.squash = 1 - 0.1 * hump(t, 1.0, 1.14);
        if (a.who === 0 && hit(1.04)) {
          cuePoint("spark", { x: mid.x, y: mid.y - R() * 0.3 }, "gold", 1.5);
          cuePoint("lines", { x: mid.x, y: mid.y - R() * 1.5 }, "ink", 1.1);
          cuePoint("spark", { x: mid.x - R(), y: mid.y - R() * 1.4 }, "pink", 0.8);
          cuePoint("star", { x: mid.x + R() * 0.6, y: mid.y - R() }, "gold", 0.8);
          if (drone?.here) env.askDrone("hop");
        }
        break;
      }
      case "cheer": {
        // Our drone was pressed: both turn to it and throw their gloves up.
        const up = EASE.back(span(t, 0.05, 0.4)) * end;
        g.yaw = facing(a, view.d, 0.6) * end;
        mixGlove(g.gl, 1.7, 1.35, 0.5, 0, -0.2, -0.5, 1.1, up);
        mixGlove(g.gr, -1.7, 1.35, 0.5, 0, 0.2, 0.5, 1.1, up);
        const hops = Math.abs(Math.sin(span(t, 0.1, 1.3) * Math.PI * 2));
        g.y -= R() * 0.5 * hops * end;
        g.face = a.who === 0 ? "happy" : "glad";
        g.look = view.d;
        if (hit(0.3))
          cueAt(
            a,
            a.who === 0 ? "ha" : "spark",
            a.who === 0 ? -1.6 : 1.6,
            2.5,
            a.who === 0 ? "ink" : "gold",
          );
        break;
      }
      case "greet": {
        // Our drone has come by: a look, a start, and a wave for it.
        const late = a.who === 0 ? 0.35 : 0;
        const see = span(t, late, late + 0.2);
        const up = EASE.back(span(t, late + 0.45, late + 0.8)) * end;
        g.yaw = facing(a, view.d, 0.65) * see * end;
        g.look = view.d;
        const [mine, , side] = near(a, g, view.d);
        const wave = Math.sin(span(t, late + 0.7, late + 1.6) * TAU * 2.5) * 0.45;
        mixGlove(mine, side * 1.85, 1.15, 0.5, 0, side * -0.2, side * -0.3 + wave, 1.05, up);
        g.squash = 1 + 0.1 * hump(t, late, late + 0.3);
        g.y -= R() * 0.4 * hump(t, late, late + 0.35);
        g.face = t < late + 0.5 ? "wide" : a.who === 0 ? "glad" : "happy";
        g.earL.splay = g.earR.splay = -0.3 * hump(t, late, late + 0.6);
        if (hit(late + 0.05)) cueAt(a, "bang", 0.2, 2.9, a.who === 0 ? "pink" : "ink", 0.9);
        if (a.who === 1 && hit(0.9)) env.askDrone("nod");
        if (a.who === 0 && hit(1.3)) cueAt(a, "spark", 2.2, 2.2, "gold", 0.8);
        break;
      }
      case "jabs": {
        // By itself: two lazy jabs at the air.
        g.face = "bold";
        guardUp(g, end * 0.8);
        jab(g.gl, 1, t, 0.2, 0.5);
        jab(g.gr, -1, t, 0.5, 0.8);
        g.turn = 0.2;
        break;
      }
      case "flick": {
        // By itself: an ear flicks, and a slow blink.
        g.earL.splay = -0.5 * hump(t, 0.1, 0.4);
        g.earR.twist = 0.5 * hump(t, 0.3, 0.7);
        g.lid = hump(t, 0.25, 0.75) > 0.6 ? 1 : 0;
        g.turn = 0.35;
        break;
      }
    }
  };

  // The scene --------------------------------------------------------------------------------------

  /** A glove thrown from one place to another, over `top`: where it is at `u`. */
  const arc = (from: Point, to: Point, top: number, u: number): Point => {
    const y = mix(from.y, to.y, u);
    const lift = Math.max(0, mix(from.y, to.y, 0.5) - top);
    return { x: mix(from.x, to.x, u), y: y - 4 * lift * u * (1 - u) };
  };

  const story = (a: Actor, g: Goal) => {
    const t = clock;
    const hit = (at: number) => clockWas < at && t >= at;
    const r = R();
    const W = view.width;
    const home = a.who === 0 ? view.a : view.b;
    const other = a.who === 0 ? soft : bold;
    const D = view.d;
    const edgeL = -3.4 * r;
    const edgeR = W + 3.4 * r;
    g.turn = 0;
    g.look = null;
    g.lean = true;
    g.omega = 14;

    // ---- One: they appear -----------------------------------------------------------------------
    if (t < ACT2) {
      if (a.who === 0) {
        // The bold one. A glove first: it comes in alone and knocks on the air, twice. Then it
        // shoots off across the stage and drags the ball in behind it, rolling like a wheel.
        const turns = Math.max(1, Math.round((home.x - edgeL) / (TAU * r)));
        const roll = EASE.back(span(t, 0.66, 1.24));
        const go = key(t, [
          [0.66, 0],
          [1.24, 1, "back"],
        ]);
        g.x = mix(edgeL, home.x, go);
        g.y = home.y;
        g.omega = 40;
        g.lean = false;
        g.spin =
          -TAU * turns * (1 - Math.pow(1 - span(t, 0.66, 1.3), 3)) +
          0.3 * hump(t, 1.2, 1.5) * (1 - roll);
        const rolling = t < 1.26;
        g.on = key(t, [
          [1.3, 0],
          [1.34, 1, "lin"],
          [1.38, 0.15, "lin"],
          [1.46, 1, "lin"],
        ]);
        g.squash = key(t, [
          [1.2, 1],
          [1.28, 0.8, "out"],
          [1.42, 1.1],
          [1.6, 1],
        ]);
        const flat = rolling ? 1.5 : 0;
        g.earL.splay = g.earR.splay = flat - 0.35 * hump(t, 1.26, 1.5);
        if (rolling) {
          // The glove that leads.
          const lead = key(t, [
            [0.02, -1.4 * r],
            [0.3, 1.5 * r, "out"],
            [0.62, 1.5 * r],
            [1.2, home.x + 2.3 * r, "io"],
          ]);
          const knock = hump(t, 0.34, 0.46) + hump(t, 0.5, 0.62);
          putAt(a, g.gl, lead, home.y + 0.2 * r, 0.8 + knock, 60);
          g.gl.size = 1 + 0.3 * knock;
          g.gl.rz = -0.2 + 0.25 * knock;
          setGlove(g.gr, -2.2, 0.3, 0, 0, 0, 0.6);
          if (hit(0.4)) cuePoint("lines", { x: 1.5 * r, y: home.y - 1.0 * r }, "ink", 0.8);
          if (hit(0.56)) cuePoint("lines", { x: 1.7 * r, y: home.y - 1.1 * r }, "ink", 0.9, 14);
        }
        if (hit(1.24)) cuePoint("puff", { x: home.x - 1.5 * r, y: home.y + 1.1 * r }, "ink", 0.9);
        // It looks about, finds the edge the other hides behind, and waves it in.
        g.face = t < 3.7 ? "bold" : "glad";
        g.yaw = key(t, [
          [1.5, 0],
          [1.68, -0.55],
          [1.9, 0.5],
          [2.1, 0.7],
          [3.9, 0.55],
          [4.25, 0.1],
        ]);
        g.look = t > 1.9 ? { x: other.x.x, y: other.y.x } : null;
        const call = EASE.back(span(t, 2.0, 2.3)) * (1 - span(t, 3.35, 3.6));
        const wave = Math.sin(t * TAU * 2.6) * 0.5;
        if (t > 1.3) mixGlove(g.gl, 2.0, 1.0, 0.6, 0, -0.2, -0.4 + wave, 1.05, call);
        if (hit(2.15)) cueAt(a, "lines", 2.6, 2.1, "ink", 0.8, 30);
        // And a fist in the air when it comes.
        const yes = hump(t, 3.72, 4.2);
        mixGlove(g.gr, -1.5, 1.6, 0.6, 0, 0.2, 0.3, 1.15, EASE.out(yes));
        g.y -= r * 0.5 * hump(t, 3.72, 4.1);
        if (hit(3.8)) cueAt(a, "spark", -1.6, 2.7, "gold");
      } else {
        // The soft one. It peeks round the right edge, ducks back, then comes out behind its
        // gloves and lowers them.
        g.y = home.y;
        g.x = key(t, [
          [1.9, edgeR],
          [2.25, W - 0.2 * r, "out"],
          [2.5, W - 0.2 * r],
          [2.68, edgeR - 1.4 * r, "in"],
          [2.95, edgeR - 1.4 * r],
          [3.72, home.x],
        ]);
        g.omega = 30;
        g.lean = false;
        const peeking = t < 2.7;
        g.roll = peeking ? 0.28 * span(t, 1.9, 2.25) : 0.06 * Math.sin(t * 5);
        g.yaw = peeking ? -0.35 : 0;
        g.look = t < 3.7 ? { x: bold.x.x, y: bold.y.x } : null;
        g.face = t < 3.78 ? "shy" : "soft";
        const cover = t > 2.7 ? 1 - EASE.io(span(t, 3.74, 3.98)) : 0;
        mixGlove(g.gl, 0.56, 0.1, 1.3, 0, 0, 0.3, 1, cover);
        mixGlove(g.gr, -0.56, 0.1, 1.3, 0, 0, -0.3, 1, cover);
        g.earL.splay = g.earR.splay = 0.6 * cover + (peeking ? 0.25 : 0) - 0.3 * hump(t, 3.76, 4.0);
        g.lid = hit(3.98) || (t > 3.98 && t < 4.06) ? 1 : 0;
        if (hit(3.86)) cueAt(a, "spark", 1.4, 2.4, "gold", 0.8);
        // A small wave back.
        const up = EASE.back(span(t, 4.0, 4.2));
        mixGlove(g.gr, -1.9, 0.9, 0.5, 0, 0.2, 0.3 + Math.sin(t * TAU * 2.6) * 0.4, 1, up);
      }
      return;
    }

    // From here the two play round a place: our drone's, with or without it.
    const F = flank(a);
    const C = touch(a);
    const dir = away(a);
    const s = t - ACT2;

    // ---- Two: they notice our drone ---------------------------------------------------------------
    if (t < ACT3) {
      const front = !withDrone;
      // Where each is: at home, then at our drone's side.
      const come =
        a.who === 0
          ? key(s, [
              [2.6, 0],
              [3.15, 1, "back"],
            ])
          : key(s, [
              [2.75, 0],
              [3.2, 0.5],
              [3.45, 0.5],
              [3.95, 1],
            ]);
      g.x = mix(home.x, F.x, come);
      g.y = mix(home.y, F.y, come);
      g.scale = front ? 1 + 0.16 * come : 1;
      const toIt = front ? 0 : facing(a, D, 0.78);
      g.yaw = toIt * span(s, a.who === 0 ? 2.15 : 0.75, a.who === 0 ? 2.3 : 0.95);
      g.look = front ? pointer : D;
      g.face = OWN[a.who];

      if (a.who === 0) {
        // It warms up at the air and sees nothing.
        if (s < 1.5) {
          g.face = "bold";
          g.look = null;
          guardUp(g, 1 - span(s, 1.3, 1.5));
          jab(g.gl, 1, s, 0.15, 0.42);
          jab(g.gr, -1, s, 0.45, 0.72);
          jab(g.gl, 1, s, 0.8, 1.15);
          g.x += r * 0.25 * (hump(s, 0.15, 0.42) - hump(s, 0.45, 0.72) + hump(s, 0.8, 1.15));
          if (hit(ACT2 + 0.25)) cueAt(a, "lines", 1.2, 1.4, "ink", 0.7, 20);
          if (hit(ACT2 + 0.55)) cueAt(a, "lines", -1.2, 1.4, "ink", 0.7, -20);
        } else if (s < 2.15) {
          // A glance at the other one, a shrug of the eyes, back to the front. Then it sinks in.
          g.look = s < 1.82 ? { x: soft.x.x, y: soft.y.x } : null;
          g.yaw = s < 1.82 ? 0.45 : 0;
          g.face = s < 1.82 ? "bold" : "flat";
          g.squash = 1 - 0.08 * hump(s, 2.02, 2.16);
        } else if (s < 2.7) {
          g.face = "wide";
          g.x -= r * 0.7 * hump(s, 2.15, 2.6);
          g.y -= r * 0.6 * hump(s, 2.15, 2.45);
          g.squash = 1 + 0.16 * hump(s, 2.15, 2.4);
          g.earL.splay = g.earR.splay = -0.35;
        }
        if (hit(ACT2 + 2.18)) {
          cueAt(a, "bang", 0.4, 3.0, "pink", 1.15);
          env.askDrone("hop");
        }
        // It looks our drone up and down.
        if (s >= 3.15 && s < 4.2) {
          g.face = s < 3.95 ? "flat" : "glad";
          g.y +=
            r *
            key(s, [
              [3.2, 0],
              [3.5, -1.0],
              [3.8, 0.8],
              [4.15, 0],
            ]);
          g.roll = key(s, [
            [3.2, 0],
            [3.5, 0.22],
            [3.8, -0.22],
            [4.15, 0],
          ]);
        }
        if (hit(ACT2 + 3.55)) cueAt(a, "ask", -0.9, 2.9, "ink");
        if (hit(ACT2 + 3.95)) env.askDrone("nod");
      } else {
        // It watches the bold one box, and then it sees.
        if (s < 0.55) g.look = { x: bold.x.x, y: bold.y.x };
        if (s >= 0.75 && s < 2.6) {
          g.face = "wide";
          g.earL.splay = g.earR.splay = -0.3;
          g.x += r * 0.5 * hump(s, 0.75, 1.1);
          g.squash = 1 + 0.14 * hump(s, 0.75, 1.0);
        }
        if (hit(ACT2 + 0.8)) cueAt(a, "bang", 0.2, 2.9, "ink");
        // It points, and hops, until the other one looks.
        if (s >= 1.1 && s < 2.5) {
          const [mine] = near(a, g, front ? { x: a.x.x - 1, y: 0 } : D);
          const out = EASE.back(span(s, 1.1, 1.35)) * (1 - span(s, 2.3, 2.5));
          if (front) {
            mixGlove(mine, -0.7, 0.2, 2.6, 0, 0, 0, 1.35, out);
          } else {
            const reach = 2.5 * out;
            putAt(a, mine, a.x.x - dir.x * reach * r, a.y.x - dir.y * reach * r - 0.2 * r, 0.8, 26);
            mine.ry = -dir.x * 1.3;
          }
          g.y -= r * 0.45 * (hump(s, 1.3, 1.55) + hump(s, 1.62, 1.87));
          if (hit(ACT2 + 1.36)) cueAt(a, "lines", -dir.x * 2.9, dir.y * 2.5 + 1.0, "ink", 0.7);
        }
        // Coming nearer, behind its gloves.
        if (s >= 2.6 && s < 5.3) {
          g.face = "shy";
          const hold = 1 - span(s, 5.1, 5.3);
          mixGlove(g.gl, 0.8, -0.2, 1.15, 0, -0.5, 0.25, 1, hold);
          mixGlove(g.gr, -0.8, -0.2, 1.15, 0, 0.5, -0.25, 1, hold);
          g.earL.splay = g.earR.splay = 0.4;
        }
      }

      // The fist. The bold one holds it out and waits, and our drone meets it.
      const offer = (from: number, strike: number, shake: number) => {
        const out =
          EASE.io(span(s, from, from + 0.45)) * (1 - EASE.io(span(s, strike + 0.3, strike + 0.6)));
        const go = EASE.out(span(s, strike - 0.1, strike)) * (1 - span(s, strike, strike + 0.25));
        if (out <= 0.01) return;
        const [mine, , side] = near(a, g, front ? { x: a.x.x - (a.who === 0 ? -1 : 1), y: 0 } : D);
        const tremble = Math.sin(s * 44) * shake * (1 - go);
        if (front) {
          mixGlove(mine, side * 0.55, 0.1 + tremble, 2.7 + 0.6 * go, 0, 0, 0, 1.5 + 0.45 * go, out);
          mine.omega = 30;
          mine.zeta = 0.85;
        } else {
          const back = 0.95 * (1 - go);
          putAt(a, mine, C.x + dir.x * back * r, C.y + dir.y * back * r + tremble * r, 0.9, 34);
          mine.ry = -dir.x * 1.4;
          mine.rz = -dir.y * 0.4;
          mine.size = 1.08;
          mine.x = mix(side * HOME.x, mine.x, out);
          mine.y = mix(HOME.y, mine.y, out);
        }
      };
      const mark = (): Point =>
        front
          ? { x: a.x.x + (a.who === 0 ? 0.6 : -0.6) * r, y: a.y.x - 0.2 * r }
          : {
              x: (C.x + D.x + dir.x * half() * 0.9) / 2,
              y: (C.y + D.y + dir.y * half() * 0.9) / 2,
            };
      if (a.who === 0) {
        offer(4.25, 4.9, 0);
        if (hit(ACT2 + 4.9)) {
          cuePoint("spark", mark(), "gold", 1.3);
          cuePoint("spark", { x: mark().x + 0.5 * r, y: mark().y - 0.9 * r }, "cyan", 0.8);
          env.askDrone("hop");
        }
        if (s >= 4.92 && s < 7.0) {
          g.face = "happy";
          g.y -= r * 0.55 * hump(s, 4.95, 5.35);
        }
      } else {
        offer(5.45, 6.2, 0.05);
        if (hit(ACT2 + 5.55)) cueAt(a, "drop", 1.2, 2.3, "cyan", 0.8);
        if (hit(ACT2 + 6.2)) {
          cuePoint("heart", mark(), "pink", 1.1);
          env.askDrone("nod");
        }
        if (s >= 5.3 && s < 6.22) g.face = "shy";
        if (s >= 6.22 && s < 7.1) {
          // The face the model was painted with.
          g.face = "love";
          g.y -= r * 0.6 * EASE.out(span(s, 6.25, 6.7)) * (1 - span(s, 6.9, 7.1));
          g.earL.splay = 0.3 * Math.sin(s * 16);
          g.earR.splay = -0.3 * Math.sin(s * 16);
        }
        if (hit(ACT2 + 6.5)) cueAt(a, "heart", 0.9, 2.8, "pink", 0.8);
        if (hit(ACT2 + 6.8)) cueAt(a, "heart", -0.7, 3.2, "pink", 0.6);
      }

      // Our drone rolls for joy, and the two do as it does.
      if (hit(ACT2 + 7.0) && a.who === 0) env.askDrone("roll");
      if (s >= 7.1 && s < 8.4) {
        const wind = hump(s, 7.1, 7.4);
        const go = EASE.io(span(s, 7.35, 8.15));
        g.spin = (a.who === 0 ? -1 : 1) * (TAU * go - 0.45 * wind);
        const fling = hump(s, 7.35, 8.2);
        g.gl.x += 0.7 * fling;
        g.gr.x -= 0.7 * fling;
        g.gl.y += 0.5 * fling;
        g.gr.y += 0.5 * fling;
        g.y -= r * 0.5 * fling;
        g.squash = 1 - 0.13 * wind - 0.1 * hump(s, 8.15, 8.32);
        g.face = s < 8.15 ? "squeeze" : "happy";
        g.earL.splay = g.earR.splay = 0.7 * fling;
        if (hit(ACT2 + 7.7))
          cueAt(a, "spark", a.who === 0 ? -1.8 : 1.8, 1.7, a.who === 0 ? "gold" : "pink");
      }

      // The glove. The bold one throws one over our drone's head, the soft one catches it and
      // throws it back too hard.
      if (s >= 8.4) {
        const FA = flank(bold);
        const FB = flank(soft);
        const toB = Math.sign(FB.x - FA.x) || 1;
        const hand: Point = { x: FA.x + toB * 1.75 * r, y: FA.y + 0.3 * r };
        const mitt: Point = { x: FB.x - toB * 1.7 * r, y: FB.y - 0.35 * r };
        const crown: Point = { x: FA.x, y: FA.y - 1.5 * r };
        const top = Math.max(1.1 * r, Math.min(hand.y, mitt.y, D.y - half()) - 2.3 * r);
        const out = span(s, 8.85, 9.6);
        const home2 = span(s, 10.25, 10.9);
        let at: Point;
        if (s < 8.85) {
          const wind = EASE.io(span(s, 8.45, 8.82));
          at = { x: hand.x - toB * 2.6 * r * wind, y: hand.y - 0.5 * r * wind };
        } else if (out < 1) at = arc(hand, mitt, top, out);
        else if (s < 10.25) {
          const wind = EASE.io(span(s, 9.95, 10.22));
          at = { x: mitt.x + toB * 1.6 * r * wind + (soft.x.x - FB.x), y: mitt.y + 0.2 * r * wind };
        } else if (home2 < 1)
          at = arc(
            mitt,
            crown,
            Math.max(0.9 * r, top - 1.4 * r),
            EASE.in(home2) * 0.35 + home2 * 0.65,
          );
        else {
          // It bounces off the bold one's head and comes down to its place.
          const b = span(s, 10.9, 11.5);
          at = {
            x: crown.x + toB * 1.75 * r * EASE.out(b),
            y: crown.y - 1.9 * r * bump(b) + (hand.y - crown.y) * EASE.in(b),
          };
        }
        const flying = s < 11.5;
        if (a.who === 0) {
          thrown.on = flying && s > 8.85 && withDrone;
          thrown.x = at.x;
          thrown.y = at.y;
          const [mine, , side] = near(a, g, { x: a.x.x + toB, y: 0 });
          if (flying) {
            putAt(a, mine, at.x, at.y, 0.9, 60);
            const air =
              bump(out) * (out < 1 ? 1 : 0) + bump(home2) * (home2 < 1 && s >= 10.25 ? 1 : 0);
            mine.size = 1 + 0.25 * air;
            mine.rz =
              -toB * TAU * 2 * (out + home2) + (s >= 10.9 ? -toB * 3 * span(s, 10.9, 11.5) : 0);
            mine.ry = s < 8.85 ? side * -0.4 : 0;
          }
          g.face = s < 8.85 ? "bold" : s < 10.9 ? "glad" : "dizzy";
          g.roll = -toB * 0.22 * hump(s, 8.45, 9.0);
          g.x -= toB * r * 0.45 * hump(s, 8.45, 8.95);
          g.look = s < 10.9 ? at : null;
          g.yaw = s < 10.9 ? toB * 0.5 : 0;
          if (hit(ACT2 + 8.87)) cueAt(a, "lines", toB * 2.2, 0.8, "ink", 0.8, toB * 60);
          // The knock on the head.
          if (s >= 10.9) {
            const d = 1 - span(s, 11.3, 11.9);
            g.squash = key(s, [
              [10.9, 1],
              [10.97, 0.8, "out"],
              [11.15, 1.1],
              [11.35, 1],
            ]);
            g.y += r * 0.45 * hump(s, 10.9, 11.2);
            g.roll = Math.sin((s - 10.9) * 9) * 0.35 * d;
            g.x += Math.sin((s - 10.9) * 4.5) * r * 0.35 * d;
            g.earL.splay = g.earR.splay = 1.0 * (1 - span(s, 10.95, 11.5));
          }
          if (hit(ACT2 + 10.9)) {
            cuePoint("star", { x: crown.x - 0.6 * r, y: crown.y - 0.7 * r }, "gold", 1.0);
            cuePoint("star", { x: crown.x + 0.7 * r, y: crown.y - 0.5 * r }, "pink", 0.75);
            cuePoint("lines", { x: crown.x, y: crown.y - 1.4 * r }, "ink", 1.0);
            env.askDrone("hop");
          }
          if (hit(ACT2 + 11.15)) cueAt(a, "swirl", 0.2, 3.0, "ink");
        } else {
          // Ready, both gloves up; the catch pushes it back; then the throw, and the laugh.
          const ready = EASE.out(span(s, 8.7, 9.1)) * (1 - span(s, 10.25, 10.5));
          mixGlove(g.gl, 1.2, 0.7, 0.9, 0, -0.3, -0.3, 1.05, ready);
          mixGlove(g.gr, -1.2, 0.7, 0.9, 0, 0.3, 0.3, 1.05, ready);
          g.x += toB * r * 0.5 * hump(s, 9.58, 9.95) - toB * r * 0.5 * hump(s, 10.22, 10.5);
          g.squash = 1 - 0.12 * hump(s, 9.58, 9.78);
          g.look = s < 10.9 ? at : { x: bold.x.x, y: bold.y.x };
          g.yaw = -toB * 0.5;
          g.face = s < 9.6 ? "wide" : s < 10.25 ? "happy" : s < 10.95 ? "wide" : "squeeze";
          if (hit(ACT2 + 9.6)) cueAt(a, "lines", -toB * 1.9, 1.4, "ink", 0.8, -toB * 40);
          if (s >= 10.95) {
            const hops = Math.abs(Math.sin(span(s, 10.95, 11.85) * Math.PI * 3));
            g.y -= r * 0.5 * hops;
            g.squash = 1 + 0.08 * hops;
            g.roll = 0.1 * Math.sin(s * 12);
          }
          if (hit(ACT2 + 11.05)) cueAt(a, "ha", 1.6, 2.6, "pink");
          if (hit(ACT2 + 11.5)) cueAt(a, "ha", -1.4, 2.9, "ink", 0.8);
        }
      }
      return;
    }

    // ---- Three: they leave, and cannot stay away ---------------------------------------------------
    const e = t - ACT3;
    thrown.on = false;
    const exit: Point = { x: W + 4 * r, y: -3.5 * r };
    const lag = a.who === 0 ? 0 : 0.1;
    const crouch = hump(e, 1.9 + lag, 2.32 + lag);
    const zip = EASE.in(span(e, 2.24 + lag, 2.8 + lag));
    const gone = e >= 2.8 + lag;
    g.face = a.who === 0 ? (e < 0.45 ? "flat" : "glad") : "happy";
    // A shake of the head, a wave with the outer glove, and the soft one bows.
    if (a.who === 0) g.roll = Math.sin(e * 26) * 0.3 * (1 - span(e, 0, 0.5));
    const out = a.who === 0 ? -1 : 1;
    const up = EASE.back(span(e, 0.6, 0.95)) * (1 - span(e, 1.75, 1.95));
    const wave = Math.sin(span(e, 0.8, 1.8) * TAU * 2.5) * 0.45;
    const mine = out > 0 ? g.gl : g.gr;
    g.x = F.x;
    g.y = F.y;
    g.scale = withDrone ? 1 : 1.16;
    mixGlove(mine, out * 1.95, 1.2, 0.5, 0, out * -0.2, out * -0.3 + wave, 1.05, up);
    g.earL.splay = 0.35 * up * Math.sin(e * 10);
    g.earR.splay = -0.35 * up * Math.sin(e * 10);
    g.look = withDrone ? D : pointer;
    g.yaw = withDrone ? facing(a, D, 0.35) : 0;
    if (a.who === 1) g.pitch = 0.55 * hump(e, 1.2, 1.9);
    if (a.who === 0 && hit(ACT3 + 1.0)) env.askDrone("nod");
    if (hit(ACT3 + 0.95)) cueAt(a, "spark", out * 2.6, 2.4, a.who === 0 ? "gold" : "pink", 0.8);
    // Down and back, like a spring, and away to the top right, one behind the other.
    g.x -= r * 0.8 * crouch;
    g.y += r * 0.6 * crouch;
    g.squash = 1 - 0.2 * crouch;
    if (crouch > 0) {
      mixGlove(g.gl, 1.15, -0.3, 0.7, 0, 0, 0, 1, crouch);
      mixGlove(g.gr, -1.15, -0.3, 0.7, 0, 0, 0, 1, crouch);
      g.earL.splay = g.earR.splay = 0.9 * crouch;
      g.face = a.who === 0 ? "bold" : "squeeze";
    }
    if (zip > 0) {
      g.x = mix(F.x, exit.x - (a.who === 1 ? 2 * r : 0), zip);
      g.y = mix(F.y, exit.y + (a.who === 1 ? 2 * r : 0), zip);
      g.omega = 40;
      g.face = a.who === 0 ? "bold" : "happy";
      g.roll = -0.5 * span(e, 2.24 + lag, 2.5 + lag);
      g.earL.splay = g.earR.splay = 0.9;
      g.gl.x -= 0.6 * zip;
      g.gr.x -= 0.6 * zip;
      g.gl.y -= 0.5;
      g.gr.y -= 0.5;
    }
    if (hit(ACT3 + 2.28 + lag))
      cuePoint("lines", { x: F.x - 1.6 * r, y: F.y + 1.5 * r }, "ink", 1.0, -135);
    if (hit(ACT3 + 2.5 + lag)) cuePoint("puff", { x: F.x - 0.6 * r, y: F.y + 0.9 * r }, "ink", 0.8);
    if (!gone) return;

    // Gone. A beat of nothing. Then the soft one looks back in round the right edge.
    g.jump = e < (a.who === 0 ? 4.7 : 3.6);
    g.omega = 30;
    g.lean = false;
    g.roll = 0;
    g.scale = 1;
    g.squash = 1;
    g.earL.splay = g.earR.splay = 0;
    if (a.who === 1) {
      g.y = key(e, [
        [3.6, home.y - 2 * r],
        [5.9, home.y],
      ]);
      g.x = key(e, [
        [3.6, edgeR],
        [3.95, W - 0.25 * r, "out"],
        [4.85, W - 0.25 * r],
        [5.9, home.x],
      ]);
      g.roll = 0.28 * (1 - span(e, 4.85, 5.3));
      g.yaw = -0.35 * (1 - span(e, 4.85, 5.3));
      g.face = e < 4.3 ? "soft" : e < 5.0 ? "love" : "glad";
      g.look = withDrone ? D : pointer;
      const hi = EASE.back(span(e, 4.0, 4.25)) * (1 - span(e, 4.75, 4.95));
      mixGlove(g.gr, -1.7, 0.9, 0.6, 0, 0.2, 0.3 + Math.sin(e * TAU * 2.6) * 0.4, 1, hi);
      if (hit(ACT3 + 4.35)) {
        cueAt(a, "heart", -1.8, 1.9, "pink", 0.9);
        env.askDrone("nod");
      }
    } else {
      // And the bold one, who went all the way round, rolls back in from the left.
      const turns = Math.max(1, Math.round((home.x - edgeL) / (TAU * r)));
      const go = key(e, [
        [4.7, 0],
        [5.45, 1, "back"],
      ]);
      g.x = e < 4.7 ? edgeL : mix(edgeL, home.x, go);
      g.y = home.y;
      g.omega = 40;
      g.spin = e < 4.7 ? 0 : -TAU * turns * (1 - Math.pow(1 - span(e, 4.7, 5.5), 3));
      const rolling = e < 5.45;
      g.earL.splay = g.earR.splay = rolling ? 1.5 : -0.3 * hump(e, 5.45, 5.7);
      g.squash = key(e, [
        [5.4, 1],
        [5.48, 0.82, "out"],
        [5.62, 1.08],
        [5.8, 1],
      ]);
      if (rolling) {
        setGlove(g.gl, 2.3, 0.2, 0.4);
        setGlove(g.gr, -2.2, 0.3, 0, 0, 0, 0.6);
      }
      g.face = e < 5.9 ? "flat" : "bold";
      g.look = { x: soft.x.x, y: soft.y.x };
      if (hit(ACT3 + 5.46))
        cuePoint("puff", { x: home.x - 1.5 * r, y: home.y + 1.1 * r }, "ink", 0.9);
    }
  };

  // The springs: from the goals to the poses ---------------------------------------------------------

  let lastDt = 0;

  const follow = (a: Actor, dt: number, snap: boolean) => {
    const g = a.goal;
    const r = Math.max(1, view.radius * SIZE[a.who]);
    if (snap || g.jump) {
      a.x.x = g.x;
      a.y.x = g.y;
      a.x.v = a.y.v = 0;
    } else {
      springTo(a.x, g.x, g.omega, dt);
      springTo(a.y, g.y, g.omega, dt);
    }
    // What it looks at turns the ball a little, and the eyes all the way.
    let yaw = g.yaw;
    let pitch = g.pitch;
    let lookX = 0;
    let lookY = 0;
    if (g.look) {
      const dx = clamp((g.look.x - a.x.x) / (5 * r), -1, 1);
      const dy = clamp((g.look.y - a.y.x) / (5 * r), -1, 1);
      yaw += dx * 0.75 * g.turn;
      pitch += dy * 0.3 * g.turn;
      lookX = clamp(dx * 1.3 - Math.sin(yaw) * 1.1, -1, 1) * 0.13;
      lookY = clamp(-dy * 1.3 + Math.sin(pitch), -1, 1) * 0.075;
    }
    // It leans into its own speed, and stretches along it.
    const vx = a.x.v / r;
    const vy = a.y.v / r;
    const speed = Math.hypot(vx, vy);
    let roll = g.roll;
    let squash = g.squash;
    if (g.lean) roll -= clamp(vx * 0.03, -0.4, 0.4);
    const stretch = clamp(speed * 0.01, 0, 0.16);
    squash *= 1 + (stretch * (Math.abs(vy) - Math.abs(vx))) / (speed + 0.001);

    if (snap) {
      a.yaw.x = yaw;
      a.pitch.x = pitch;
      a.roll.x = roll;
      a.scale.x = g.scale;
      a.squash.x = squash;
      a.z.x = g.z;
      a.yaw.v = a.pitch.v = a.roll.v = a.scale.v = a.squash.v = 0;
    } else {
      springTo(a.yaw, yaw, 13, dt);
      springTo(a.pitch, pitch, 13, dt);
      swingTo(a.roll, roll, 15, 0.5, dt);
      springTo(a.scale, g.scale, 10, dt);
      swingTo(a.squash, squash, 26, 0.45, dt);
      springTo(a.z, g.z, 30, dt);
    }
    springTo(a.lookX, lookX, 16, dt);
    springTo(a.lookY, lookY, 16, dt);

    // The ears swing after the ball: back from where it is going, and up when it drops.
    const dragX = clamp(vx * 0.045, -0.6, 0.6);
    const dragY = clamp(-vy * 0.05, -0.45, 0.7);
    const ears: Array<[Sprung, number]> = [
      [a.ears[0], g.earL.splay - dragX + dragY],
      [a.ears[1], g.earR.splay + dragX + dragY],
      [a.ears[2], g.earL.fold],
      [a.ears[3], g.earR.fold],
      [a.ears[4], g.earL.twist],
      [a.ears[5], g.earR.twist],
    ];
    for (const [s, target] of ears) {
      if (snap) {
        s.x = target;
        s.v = 0;
      } else swingTo(s, target, 24, 0.32, dt);
    }

    // The gloves: turned with the ball unless they are let go, and a little behind it.
    const cy = Math.cos(a.yaw.x);
    const sy = Math.sin(a.yaw.x);
    const cr = Math.cos(a.roll.x);
    const sr = Math.sin(a.roll.x);
    for (const [state, goal] of [
      [a.gl, g.gl],
      [a.gr, g.gr],
    ] as const) {
      let x = goal.x;
      let y = goal.y;
      let z = goal.z;
      let ry = goal.ry;
      let rz = goal.rz;
      if (!goal.free) {
        const rx1 = x * cr - y * sr;
        const ry1 = x * sr + y * cr;
        x = rx1 * cy + z * sy;
        z = -rx1 * sy + z * cy;
        y = ry1;
        ry += a.yaw.x;
        rz += a.roll.x;
        // Left a little behind by the ball's speed.
        x -= clamp(vx * 0.05, -0.9, 0.9);
        y += clamp(vy * 0.05, -0.9, 0.9);
      }
      const set: Array<[Sprung, number]> = [
        [state.x, x],
        [state.y, y],
        [state.z, z],
        [state.rx, goal.rx],
        [state.ry, ry],
        [state.rz, rz],
        [state.size, goal.size],
      ];
      for (const [s, target] of set) {
        if (snap) {
          s.x = target;
          s.v = 0;
        } else if (goal.zeta >= 1) springTo(s, target, goal.omega, dt);
        else swingTo(s, target, goal.omega, goal.zeta, dt);
      }
    }

    // The face: a like face blends, an unlike one is changed behind a quick blink.
    const wanted = a.held ?? g.face;
    if (wanted !== a.faceName) {
      copyFace(a.faceFrom, a.pose.face);
      a.faceSwap = faceDistance(a.faceFrom, FACES[wanted]) > 0.5;
      a.faceName = wanted;
      a.faceT = snap ? 1 : 0;
    }
    let lid = g.lid;
    if (a.faceT < 1) {
      a.faceT = Math.min(1, a.faceT + dt / (a.faceSwap ? 0.2 : 0.16));
      if (a.faceSwap) {
        lid = Math.max(lid, bump(a.faceT));
        copyFace(a.pose.face, a.faceT < 0.5 ? a.faceFrom : FACES[a.faceName]);
      } else {
        blendFace(a.pose.face, a.faceFrom, FACES[a.faceName], EASE.io(a.faceT));
      }
    } else {
      copyFace(a.pose.face, FACES[a.faceName]);
    }
    // It blinks by itself, at uneven times, now and then twice.
    a.blinkAt -= dt;
    if (a.blinkAt <= 0) {
      a.blinkT = 0;
      a.blinkAt = a.random() < 0.18 ? 0.26 : 1.8 + a.random() * 3.8;
    }
    if (a.blinkT < 1) {
      a.blinkT = Math.min(1, a.blinkT + dt / 0.16);
      const shape = a.pose.face;
      // Arches, chevrons and spirals are not open eyes: they do not blink.
      if (shape.arc + shape.chevron + shape.spiral < 0.5) lid = Math.max(lid, bump(a.blinkT));
    }

    const p = a.pose;
    p.x = a.x.x;
    p.y = a.y.x;
    p.z = a.z.x;
    p.radius = r * a.scale.x;
    p.yaw = a.yaw.x;
    p.pitch = a.pitch.x;
    p.roll = a.roll.x;
    p.spin = g.spin;
    p.squash = clamp(a.squash.x, 0.55, 1.5);
    p.earL.splay = a.ears[0].x;
    p.earR.splay = a.ears[1].x;
    p.earL.fold = a.ears[2].x;
    p.earR.fold = a.ears[3].x;
    p.earL.twist = a.ears[4].x;
    p.earR.twist = a.ears[5].x;
    for (const [out, state] of [
      [p.gloveL, a.gl],
      [p.gloveR, a.gr],
    ] as const) {
      out.x = state.x.x;
      out.y = state.y.x;
      out.z = state.z.x;
      out.rx = state.rx.x;
      out.ry = state.ry.x;
      out.rz = state.rz.x;
      out.size = Math.max(0.2, state.size.x);
    }
    p.live.blinkL = lid;
    p.live.blinkR = lid;
    p.live.lookX = a.lookX.x;
    p.live.lookY = a.lookY.x;
    p.live.on = g.on;
    p.live.spin = (life + clock) * 5;
  };

  /** Off the stage, where each waits before the scene. */
  const park = () => {
    const r = R();
    for (const a of cast) {
      const home = a.who === 0 ? view.a : view.b;
      idle(a, a.goal);
      a.goal.x = a.who === 0 ? -3.4 * r : view.width + 3.4 * r;
      a.goal.y = home.y;
      a.goal.look = null;
    }
  };

  const goLive = () => {
    mode = "live";
    thrown.on = false;
    for (const a of cast) {
      a.move = null;
      a.idleAt = life + 4 + a.who * 2.5 + a.random() * 3;
    }
    droneMet = withDrone;
  };

  const step = (input: StageInput): Cast => {
    const dt = input.dt;
    lastDt = dt;
    view = input.view;
    pointer = input.pointer;
    drone = input.drone;
    const here = drone?.here === true;
    gaze = null;

    if (mode === "wait") {
      park();
      for (const a of cast) follow(a, dt, true);
      return [bold.pose, soft.pose];
    }

    if (mode === "story") {
      clockWas = clock;
      clock += dt;
      // Whether they play it to our drone is settled when they look up from their own entrance.
      if (clockWas < ACT2 && clock >= ACT2) withDrone = here;
      for (const a of cast) {
        idle(a, a.goal);
        story(a, a.goal);
      }
      if (clock >= ACT2 && withDrone) {
        // Our drone looks at whoever is doing something: the one who saw it, the one whose fist
        // is out, the glove in the air, the two as they go.
        const s = clock - ACT2;
        if (thrown.on) gaze = thrown;
        else if (clock >= ACT3) {
          const e = clock - ACT3;
          gaze = e < 3.0 ? bold.pose : e > 3.7 && e < 5.2 ? soft.pose : null;
        } else if (s > 0.85 && s < 2.2) gaze = soft.pose;
        else if (s >= 2.2 && s < 5.35) gaze = bold.pose;
        else if (s >= 5.35 && s < 7.0) gaze = soft.pose;
        else if (s >= 10.9) gaze = bold.pose;
      }
      if (clock >= END) goLive();
    }

    if (mode === "live") {
      life += dt;
      // Our drone comes by after the scene: it is greeted, once in a while.
      if (here && !droneWasHere && (!droneMet || droneGone > MEET_AGAIN) && !busyTogether()) {
        if (!bold.move && !soft.move) {
          startBoth("greet");
          droneMet = true;
        }
      }
      droneGone = here ? 0 : droneGone + dt;
      for (const a of cast) {
        idle(a, a.goal);
        // A small thing by itself, now and then.
        if (!a.move && !a.hovered && life > a.idleAt) {
          a.idleAt = life + 6 + a.random() * 6;
          start(a, a.who === 0 ? "jabs" : "flick");
        }
        if (a.move) {
          a.move.was = a.move.t;
          a.move.t += dt;
          act(a, a.goal);
          if (a.move && a.move.t >= a.move.seconds) a.move = null;
        }
      }
      // Our drone looks at the one that is answering.
      if (here) {
        const moving = cast.find(
          (a) => a.move && a.move.kind !== "jabs" && a.move.kind !== "flick",
        );
        if (moving) gaze = moving.pose;
      }
    }
    droneWasHere = here;

    for (const a of cast) follow(a, dt, false);
    return [bold.pose, soft.pose];
  };

  const press = (who: number) => {
    const a = cast[who === 1 ? 1 : 0];
    const other = cast[who === 1 ? 0 : 1];
    if (mode !== "live") return;
    if (busyTogether()) {
      cueAt(a, "spark", 0, 2.4, "gold", 0.7);
      return;
    }
    const now = life;
    a.presses = a.presses.filter((at) => now - at < DIZZY_WINDOW);
    a.presses.push(now);
    const together = now - other.pressedAt < TOGETHER && other.pressedAt > a.pressedAt;
    a.pressedAt = now;
    if (a.presses.length >= DIZZY_PRESSES) {
      a.presses = [];
      start(a, "dizzy");
      return;
    }
    if (a.move?.kind === "dizzy") return;
    if (together) {
      other.pressedAt = -100;
      a.pressedAt = -100;
      startBoth("bump");
      return;
    }
    const kind = ANSWERS[a.who][a.answers % ANSWERS[a.who].length] ?? "hello";
    a.answers += 1;
    if (kind === "behind") {
      // It needs the other one: if that one is busy, it waves instead.
      if (other.move && other.move.kind !== "jabs" && other.move.kind !== "flick") {
        start(a, "hello");
        return;
      }
      start(a, "behind");
      start(other, "guard");
      return;
    }
    start(a, kind);
  };

  return {
    step,
    begin: () => {
      if (mode !== "wait") return;
      mode = "story";
      clock = 0;
      clockWas = 0;
    },
    replay: () => {
      mode = "story";
      clock = 0;
      clockWas = 0;
      withDrone = false;
      droneMet = false;
      thrown.on = false;
      for (const a of cast) {
        a.move = null;
        a.hovered = false;
      }
      park();
      for (const a of cast) follow(a, 0, true);
    },
    skip: () => {
      goLive();
      for (const a of cast) {
        idle(a, a.goal);
        follow(a, 0, true);
      }
    },
    press,
    hover: (who, over) => {
      const a = cast[who === 1 ? 1 : 0];
      if (over && !a.hovered && mode === "live" && !a.move) {
        cueAt(
          a,
          a.who === 0 ? "spark" : "ask",
          a.who === 0 ? 1.5 : -1.2,
          2.6,
          a.who === 0 ? "gold" : "ink",
          0.75,
        );
      }
      a.hovered = over;
    },
    dronePressed: () => {
      if (mode !== "live" || busyTogether()) return;
      startBoth("cheer");
    },
    comeBack: () => {
      if (mode === "story") {
        goLive();
        for (const a of cast) {
          idle(a, a.goal);
          follow(a, 0, true);
        }
      }
      if (mode === "live" && !bold.move && !soft.move) {
        start(bold, "flex");
        start(soft, "hello");
      }
    },
    eyes: () => {
      if (!gaze) return null;
      gazeOut.x = gaze.x;
      gazeOut.y = gaze.y;
      return gazeOut;
    },
    open: () => mode === "live",
    state: () => ({
      mode,
      clock: mode === "story" ? clock : life,
      withDrone,
      moves: cast.map((a) => a.move?.kind ?? null),
    }),
    hold: (who, name) => {
      cast[who === 1 ? 1 : 0].held = name;
    },
    play: (kind, who) => {
      if (!(kind in SECONDS)) return;
      if (mode !== "live") goLive();
      const k = kind as MoveKind;
      if (k === "bump" || k === "cheer" || k === "greet") startBoth(k);
      else if (k === "behind") {
        start(soft, "behind");
        start(bold, "guard");
      } else start(cast[who === 1 ? 1 : 0], k);
    },
  };
}

/** The scene's length in seconds, for the probes. */
export const SCENE_SECONDS = END;
