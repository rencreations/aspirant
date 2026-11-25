import type { FaceName } from "@/features/home/actors/doll/face/presets";
import { RIG_BONES } from "@/features/home/actors/doll/rig";

import { DOLL_POSE_NAMES, type DollPoseName } from "./doll-poses";
import { bump, clamp, clamp01, mix, ramp, swingTo, TAU, type Sprung } from "./ease";

/**
 * The Obsidia doll on the drone's head: what she does, as plain numbers. Every frame she is told
 * how the drone is flying, what trick it is turning, whether the visitor pressed it and what has
 * just happened (she has been picked up, she is on her way home), and she answers with the weights
 * of her poses over her seat (`doll-poses.ts`), the turns her bones add, her face and where her
 * eyes look. The scene turns that into bones and a face with the home's own doll (`drone/doll.ts`).
 *
 * Three layers, so she is never still and never stiff:
 * - the ride: she holds on harder the faster the drone flies, throws her arms up on a dive, leans
 *   against every start, stop and turn (her trunk and her head on loose springs), and her legs
 *   swing over the front of the helmet;
 * - the tricks: a roll, a flip or a loop of the drone is a scream and a tight hold, and a dizzy
 *   spell after; a spin is a "wheee";
 * - her acts: one-shots on her own clock that always finish. At rest she waves, giggles, points,
 *   makes heart eyes, peeks over the edge, claps, yawns, pats the drone's head and winks, in a fixed
 *   order with air between; a press makes her jump and then laugh; she cheers when she is picked up
 *   and blows a goodbye on the way home.
 *
 * Angles in radians, speeds in screens a second, times in seconds.
 */

export type DollAct =
  | "wave"
  | "giggle"
  | "point"
  | "heart"
  | "peek"
  | "clap"
  | "yawn"
  | "pat"
  | "wink"
  | "cheer"
  | "bye"
  | "startle"
  | "dizzy";

export const DOLL_ACT_SECONDS: Record<DollAct, number> = {
  wave: 2.2,
  giggle: 1.9,
  point: 2.1,
  heart: 2.3,
  peek: 2.5,
  clap: 1.9,
  yawn: 2.7,
  pat: 2.1,
  wink: 1.3,
  cheer: 2.0,
  bye: 2.6,
  startle: 1.5,
  dizzy: 1.5,
};

/** The acts she plays at rest, in order. */
const AT_REST: readonly DollAct[] = [
  "wave",
  "giggle",
  "point",
  "heart",
  "peek",
  "clap",
  "wink",
  "yawn",
  "pat",
];

/** The bones, by name, as the rig orders them. */
const BONE: Record<string, number> = Object.fromEntries(RIG_BONES.map((b, i) => [b.name, i]));
const DOLL_BONES = RIG_BONES.length;

export interface DollFrame {
  /** The weight of each pose over her seat, 0 to 1. */
  weights: Record<DollPoseName, number>;
  /** Turns added to each bone, three a bone (about the model's X, Y, Z), in the rig's order. */
  turns: Float32Array;
  /** Her face: `a` going to `b`, `w` of the way. */
  face: { a: FaceName; b: FaceName; w: number };
  /** How much she is talking (laughing, screaming), 0 to 1. */
  talk: number;
  /** Where her eyes look, -1 to 1 each way (right and down positive). */
  lookX: number;
  lookY: number;
  /** Squash (below 0) or stretch, and a hop off the seat in her own heights. */
  squash: number;
  hop: number;
}

interface Act {
  kind: DollAct;
  t: number;
}

export interface Doll {
  time: number;
  act: Act | null;
  wait: number;
  rest: number;
  count: number;
  /** The drone's trick she is living through, and how long she stays dizzy after it. */
  trick: string | null;
  /** How fast and how much of a dive the flight is, smoothed. */
  fast: number;
  dive: number;
  /** What trails the flight: her trunk's lean and nod, her head. */
  leanX: Sprung;
  leanY: Sprung;
  headX: Sprung;
  headY: Sprung;
  squash: Sprung;
  hop: Sprung;
  look: { x: Sprung; y: Sprung };
  frame: DollFrame;
  face: { from: FaceName; to: FaceName; t: number };
}

export function createDoll(): Doll {
  const weights = Object.fromEntries(DOLL_POSE_NAMES.map((n) => [n, 0])) as Record<
    DollPoseName,
    number
  >;
  const zero = (): Sprung => ({ x: 0, v: 0 });
  return {
    time: 0,
    act: null,
    wait: 1.2,
    rest: 0,
    count: 0,
    trick: null,
    fast: 0,
    dive: 0,
    leanX: zero(),
    leanY: zero(),
    headX: zero(),
    headY: zero(),
    squash: zero(),
    hop: zero(),
    look: { x: zero(), y: zero() },
    frame: {
      weights,
      turns: new Float32Array(DOLL_BONES * 3),
      face: { a: "smile", b: "smile", w: 1 },
      talk: 0,
      lookX: 0,
      lookY: 0,
      squash: 0,
      hop: 0,
    },
    face: { from: "smile", to: "smile", t: 1 },
  };
}

export interface DollInput {
  dt: number;
  /** The drone's flight: speed and its parts, and acceleration (screens a second, and squared). */
  vx: number;
  vy: number;
  speed: number;
  ax: number;
  ay: number;
  /** The drone's trick now, and how far through it (0 to 1), or null. */
  trick: { kind: string; p: number } | null;
  /** The drone sits at a station. */
  atRest: boolean;
  /** Where her eyes should look (-1 to 1 each way), or null to look at the visitor. */
  look: { x: number; y: number } | null;
  /** This frame: the visitor pressed the drone; she has just come out of her picture; the drone
   * has set off to take her home. */
  pressed: boolean;
  arrived: boolean;
  homeward: boolean;
}

/** Start an act now (an event, a probe). An act already playing gives way to an event. */
export function startAct(doll: Doll, kind: DollAct): void {
  doll.act = { kind, t: 0 };
}

const hump = (t: number, a: number, b: number) => (t <= a || t >= b ? 0 : bump((t - a) / (b - a)));
const rise = (t: number, a: number, b: number) => ramp(a, b, t);
const DEG = Math.PI / 180;

function add(turns: Float32Array, bone: string, x: number, y: number, z: number): void {
  const i = BONE[bone];
  if (i === undefined) return;
  turns[i * 3] = (turns[i * 3] ?? 0) + x;
  turns[i * 3 + 1] = (turns[i * 3 + 1] ?? 0) + y;
  turns[i * 3 + 2] = (turns[i * 3 + 2] ?? 0) + z;
}

/** One step. Returns her frame (the same object every time). */
export function stepDoll(doll: Doll, input: DollInput): DollFrame {
  const dt = input.dt;
  doll.time += dt;
  const time = doll.time;
  const out = doll.frame;
  const turns = out.turns;
  turns.fill(0);

  // Events come first: they cut in on whatever she was doing at rest.
  if (input.pressed) startAct(doll, "startle");
  if (input.arrived) startAct(doll, "cheer");
  if (input.homeward && doll.act?.kind !== "bye") startAct(doll, "bye");

  // The drone's trick. When one ends she is dizzy for a moment, or laughs.
  const trick = input.trick;
  if (trick && doll.trick !== trick.kind) doll.trick = trick.kind;
  if (!trick && doll.trick) {
    const was = doll.trick;
    doll.trick = null;
    if (was !== "hop" && was !== "nod" && doll.act?.kind !== "cheer") {
      startAct(doll, was === "wiggle" || was === "spin" ? "giggle" : "dizzy");
    }
  }

  // Her own acts at rest.
  doll.rest = input.atRest ? doll.rest + dt : 0;
  if (doll.act) {
    doll.act.t += dt;
    if (doll.act.t >= DOLL_ACT_SECONDS[doll.act.kind]) {
      doll.act = null;
      doll.wait = 1.4 + ((doll.count * 0.61) % 1) * 1.6;
    }
  } else {
    doll.wait = Math.max(0, doll.wait - dt);
    if (doll.wait <= 0 && doll.rest > 0.7) {
      startAct(doll, AT_REST[doll.count % AT_REST.length] ?? "wave");
      doll.count += 1;
    }
  }

  // The ride. How fast, and how much of a dive (down the screen, fast).
  const k = 1 - Math.exp(-8 * dt);
  doll.fast = mix(doll.fast, ramp(0.15, 0.9, input.speed), k);
  doll.dive = mix(doll.dive, ramp(0.35, 1.1, input.vy) * ramp(0.3, 0.8, input.speed), k);
  // Her trunk and head lag behind every change of the flight.
  swingTo(doll.leanX, clamp(-input.ax * 0.05, -0.4, 0.4), 11, 0.42, dt);
  swingTo(doll.leanY, clamp(input.ay * 0.035, -0.32, 0.32), 11, 0.42, dt);
  swingTo(doll.headX, clamp(-input.ax * 0.07, -0.5, 0.5), 15, 0.3, dt);
  swingTo(doll.headY, clamp(input.ay * 0.05, -0.4, 0.4), 15, 0.3, dt);

  const w: Record<DollPoseName, number> = {
    hold: 0,
    cheer: 0,
    wave: 0,
    wheee: 0,
    point: 0,
    hug: 0,
    clap: 0,
    stretch: 0,
    scared: 0,
    peek: 0,
    cheeks: 0,
  };
  let face: FaceName = doll.fast > 0.45 ? "determined" : "smile";
  let talk = 0;
  let look: { x: number; y: number } | null = input.look;
  let hopKick = 0;
  let squashKick = 0;

  w.hold = clamp01(doll.fast * 1.25);
  w.wheee = clamp01(doll.dive * 1.2);
  if (doll.dive > 0.5) face = "laughing";
  if (input.vy < -0.5 && doll.fast > 0.4) face = "determined";

  if (trick) {
    const p = trick.p;
    switch (trick.kind) {
      case "barrel":
      case "roll":
      case "frontflip":
      case "backflip":
      case "loop":
        w.hold = 1;
        face = p < 0.15 ? "shocked" : "scream";
        talk = 0.8 * bump(p);
        look = { x: 0, y: -0.2 };
        break;
      case "spin":
      case "hop":
        w.wheee = Math.max(w.wheee, bump(p));
        face = "grin";
        talk = 0.5 * bump(p);
        break;
      case "wiggle":
      case "nod":
        w.hold = Math.max(w.hold, 0.6);
        face = "laughing";
        talk = 0.6;
        break;
      case "dizzy":
        face = "dizzy";
        w.hold = 0.8;
        break;
    }
  }

  const act = doll.act;
  if (act) {
    const t = act.t;
    const T = DOLL_ACT_SECONDS[act.kind];
    const env = rise(t, 0, 0.28) * (1 - rise(t, T - 0.35, T));
    switch (act.kind) {
      case "wave": {
        w.wave = env;
        const wave = Math.sin(TAU * 3 * t) * env;
        add(turns, "RightForeArm", 0, 0, 28 * DEG * wave);
        add(turns, "RightHand", 0, 0, 20 * DEG * wave);
        add(turns, "Head", 0, -6 * DEG * env, 10 * DEG * env);
        face = t < 0.35 ? "smile" : "grin";
        look = null;
        talk = 0.35 * env;
        break;
      }
      case "giggle": {
        w.cheeks = 0.55 * env;
        const shake = Math.sin(TAU * 8.5 * t) * env;
        add(turns, "Spine02", 4 * DEG * shake, 0, 3 * DEG * shake);
        add(turns, "Head", 6 * DEG * shake, 0, 0);
        face = "laughing";
        talk = 0.9 * env;
        squashKick = 0.04 * Math.abs(shake);
        break;
      }
      case "point": {
        w.point = env;
        add(turns, "Head", -6 * DEG * env, 0, 0);
        face = t < 1.1 ? "determined" : "grin";
        look = { x: 0.4, y: -0.1 };
        talk = t > 1.1 ? 0.4 * env : 0;
        break;
      }
      case "heart": {
        w.cheeks = env;
        const sway = Math.sin(TAU * 0.9 * t) * env;
        add(turns, "Head", 0, 0, 14 * DEG * sway);
        add(turns, "Spine02", 0, 0, 5 * DEG * sway);
        face = "heartEyes";
        look = null;
        break;
      }
      case "peek": {
        w.peek = env;
        face = t < 0.9 ? "worried" : t < 1.5 ? "shocked" : "laughing";
        look = { x: 0, y: 0.8 };
        talk = t > 1.5 ? 0.6 * env : 0;
        break;
      }
      case "clap": {
        w.clap = env;
        const clap = Math.abs(Math.sin(TAU * 3.2 * t)) * env;
        add(turns, "LeftArm", 0, 0, 16 * DEG * clap);
        add(turns, "RightArm", 0, 0, -16 * DEG * clap);
        face = "grin";
        look = null;
        talk = 0.3 * env;
        break;
      }
      case "wink": {
        w.point = 0.55 * env;
        add(turns, "Head", 0, 0, -12 * DEG * env);
        face = t > 0.2 && t < 1.0 ? "winkR" : "smug";
        look = null;
        break;
      }
      case "yawn": {
        w.stretch = hump(t, 0.1, 2.2);
        face = t < 1.7 ? "sleepy" : "smile";
        talk = 0.9 * hump(t, 0.4, 1.6);
        look = { x: 0, y: -0.4 };
        break;
      }
      case "pat": {
        w.hug = 0.55 * env;
        const pat = Math.max(0, Math.sin(TAU * 3.6 * t)) * env;
        add(turns, "RightArm", 24 * DEG * pat, 0, 0);
        add(turns, "Head", 8 * DEG * env, 0, 10 * DEG * env);
        face = t < 1.2 ? "smile" : "winkL";
        look = { x: 0, y: 0.7 };
        break;
      }
      case "cheer": {
        w.cheer = env;
        hopKick = 0.1 * Math.abs(Math.sin(TAU * 1.6 * t)) * env;
        const wave = Math.sin(TAU * 2.4 * t) * env;
        add(turns, "LeftForeArm", 0, 0, 18 * DEG * wave);
        add(turns, "RightForeArm", 0, 0, -18 * DEG * wave);
        face = t < 0.7 ? "sparkle" : "grin";
        talk = 0.7 * env;
        look = null;
        break;
      }
      case "bye": {
        w.wave = env;
        const wave = Math.sin(TAU * 2.6 * t) * env;
        add(turns, "RightForeArm", 0, 0, 30 * DEG * wave);
        add(turns, "Head", 0, 0, 12 * DEG * env);
        face = t < 1.4 ? "smile" : "heartEyes";
        talk = t < 1.4 ? 0.4 * env : 0;
        look = null;
        break;
      }
      case "startle": {
        w.scared = hump(t, 0, 0.7);
        hopKick = 0.16 * hump(t, 0, 0.45);
        squashKick = -0.12 * hump(t, 0.4, 0.6);
        face = t < 0.6 ? "shocked" : "laughing";
        talk = t > 0.6 ? 0.8 * env : 0;
        break;
      }
      case "dizzy": {
        const d = env * (1 - rise(t, 0.6, T));
        add(
          turns,
          "Head",
          12 * DEG * Math.sin(TAU * 1.8 * t) * d,
          0,
          14 * DEG * Math.cos(TAU * 1.8 * t) * d,
        );
        add(turns, "Spine02", 0, 0, 6 * DEG * Math.sin(TAU * 1.8 * t + 1) * d);
        face = t < 1.0 ? "dizzy" : "laughing";
        talk = t > 1.0 ? 0.5 * env : 0;
        break;
      }
    }
  }

  // The weights ease to what is asked (a tenth of a second), so no pose ever snaps.
  const ease = 1 - Math.exp(-11 * dt);
  for (const name of DOLL_POSE_NAMES) {
    out.weights[name] = mix(out.weights[name], clamp01(w[name]), ease);
  }

  // The ride's own life: her trunk leans against the flight, her head lags, her legs swing.
  add(turns, "Spine02", doll.leanY.x, 0, doll.leanX.x);
  add(turns, "Head", doll.headY.x * 0.8, 0, doll.headX.x);
  const swing = 1 + 2.2 * doll.fast;
  const legs = (12 + 10 * doll.fast) * DEG * (1 - 0.8 * out.weights.hold);
  add(turns, "LeftUpLeg", legs * Math.sin(time * 3.1 * swing), 0, 0);
  add(turns, "RightUpLeg", legs * Math.sin(time * 3.1 * swing + 1.9), 0, 0);
  add(turns, "LeftLeg", legs * 1.2 * Math.sin(time * 3.1 * swing + 0.6), 0, 0);
  add(turns, "RightLeg", legs * 1.2 * Math.sin(time * 3.1 * swing + 2.5), 0, 0);
  // A breath, always.
  add(turns, "Spine02", 1.2 * DEG * Math.sin(time * 2.2), 0, 0.6 * DEG * Math.sin(time * 1.3));
  add(turns, "Head", 0.8 * DEG * Math.sin(time * 2.2 - 0.6), 0, 1 * DEG * Math.sin(time * 1.1));
  // In a fast flight her arms shake a little as she holds on.
  if (doll.fast > 0.3) {
    const shake = (doll.fast - 0.3) * Math.sin(time * 37);
    add(turns, "LeftForeArm", 4 * DEG * shake, 0, 0);
    add(turns, "RightForeArm", -4 * DEG * shake, 0, 0);
  }

  // Her eyes: where she is told to look, or the visitor; her head turns a little with them.
  const lx = look ? clamp(look.x, -1, 1) : 0;
  const ly = look ? clamp(look.y, -1, 1) : 0;
  swingTo(doll.look.x, lx, 18, 0.9, dt);
  swingTo(doll.look.y, ly, 18, 0.9, dt);
  add(turns, "Head", ly * 10 * DEG, lx * 16 * DEG, 0);

  // A hop and a squash on their springs.
  swingTo(doll.hop, hopKick, 26, 0.5, dt);
  swingTo(doll.squash, squashKick, 30, 0.35, dt);

  // The face: a change takes a few hundredths of a second (a change of eye family hides behind
  // a blink, which the face's own mixing draws).
  if (face !== doll.face.to) {
    doll.face.from = doll.face.t >= 0.5 ? doll.face.to : doll.face.from;
    doll.face.to = face;
    doll.face.t = 0;
  }
  doll.face.t = Math.min(1, doll.face.t + dt / 0.18);
  out.face.a = doll.face.from;
  out.face.b = doll.face.to;
  out.face.w = doll.face.t;
  out.talk = talk;
  out.lookX = doll.look.x.x;
  out.lookY = doll.look.y.x;
  out.squash = doll.squash.x;
  out.hop = Math.max(0, doll.hop.x);
  return out;
}
