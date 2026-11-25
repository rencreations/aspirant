import {
  blendFace,
  copyFace,
  FACES,
  LIVE_REST,
  type BunnyFace,
  type BunnyFaceName,
  type BunnyLive,
} from "../bunny/face";
import { BUNNY_TARGETS } from "../bunny/model";

import { bump, clamp, clamp01, springTo, swingTo, TAU, type Sprung } from "./ease";
import type { FriendBit, Gesture, Mood } from "./routines";

/**
 * Mr. Bunny's body: Chang'e's drone, a round shell with two long ears, two foot blades and a face
 * on its screen. Every frame it is told where it should be (`friends.ts`), what a routine adds
 * (`routines.ts`) and what to look at, and it writes the pose the scene draws: its place, its
 * attitude, the turns of its ears and feet, the weights of its seventeen shapes and its face.
 * Plain arithmetic, no three.
 *
 * Everything that moves follows a spring, and the soft parts follow loose ones: the ears swing
 * after every start and stop and flop when it lands, the feet trail its flight, the shell squashes
 * and stretches along its speed and leans into a turn. Its moods are faces and shapes together: a
 * happy bunny puffs up and perks its ears, a sad one lets them droop, a cross one lowers its brow
 * and lays them back. The bones and shapes are the model's (`scripts/about/bunny/README.md`).
 *
 * Places are CSS pixels of the screen (y down). Its size is its width across the ears, in pixels.
 * L and R are its own left and right (its left is the viewer's right when it faces the visitor).
 */

/**
 * An ear's turn at its hinge, in radians: leans out, tips forward, turns about its length. The ear
 * bends only by its shapes (droop, fold, perk, curl), never by its two upper bones as well: the
 * model's README says the two do not add up, and the hinge's turn combines with every shape.
 */
export interface BunnyEar {
  splay: number;
  fold: number;
  twist: number;
}

interface BunnyFoot {
  /** Radians: swings the tip forward, leans out. */
  swing: number;
  splay: number;
}

export interface BunnyPose {
  x: number;
  y: number;
  /** Its depth among the friends, in pixels toward the visitor. */
  z: number;
  /** Its width across the ears, in pixels. */
  size: number;
  yaw: number;
  pitch: number;
  roll: number;
  earL: BunnyEar;
  earR: BunnyEar;
  footL: BunnyFoot;
  footR: BunnyFoot;
  /** The weight of each shape, in the model's order (`BUNNY_TARGETS`). */
  targets: Float32Array;
  face: BunnyFace;
  live: BunnyLive;
}

const T: Record<string, number> = Object.fromEntries(BUNNY_TARGETS.map((n, i) => [n, i]));
const DEG = Math.PI / 180;

interface EarState {
  splay: Sprung;
  fold: Sprung;
  twist: Sprung;
}

export interface BunnyBody {
  x: Sprung;
  y: Sprung;
  yaw: Sprung;
  pitch: Sprung;
  roll: Sprung;
  squash: Sprung;
  lean: Sprung;
  earL: EarState;
  earR: EarState;
  footL: Sprung;
  footR: Sprung;
  /** The shapes, each on a spring toward what the mood and the flight ask. */
  shapes: Sprung[];
  lookX: Sprung;
  lookY: Sprung;
  faceName: BunnyFaceName;
  faceFrom: BunnyFace;
  faceT: number;
  blinkAt: number;
  blinkT: number;
  seed: number;
  life: number;
  /** When it next flicks an ear by itself, and which. */
  flickAt: number;
  flickEar: "ear_L_curl" | "ear_R_curl";
  placed: boolean;
  pose: BunnyPose;
}

const sprung = (x = 0): Sprung => ({ x, v: 0 });
const ear = (): EarState => ({ splay: sprung(), fold: sprung(), twist: sprung() });
const earPose = (): BunnyEar => ({ splay: 0, fold: 0, twist: 0 });

export function createBunny(): BunnyBody {
  return {
    x: sprung(),
    y: sprung(),
    yaw: sprung(),
    pitch: sprung(),
    roll: sprung(),
    squash: sprung(),
    lean: sprung(),
    earL: ear(),
    earR: ear(),
    footL: sprung(),
    footR: sprung(),
    shapes: BUNNY_TARGETS.map(() => sprung()),
    lookX: sprung(),
    lookY: sprung(),
    faceName: "neutral",
    faceFrom: { ...FACES.neutral },
    faceT: 1,
    blinkAt: 2.1,
    blinkT: 1,
    seed: 30424,
    life: 0,
    flickAt: 3.5,
    flickEar: "ear_L_curl",
    placed: false,
    pose: {
      x: 0,
      y: 0,
      z: 0,
      size: 10,
      yaw: 0,
      pitch: 0,
      roll: 0,
      earL: earPose(),
      earR: earPose(),
      footL: { swing: 0, splay: 0 },
      footR: { swing: 0, splay: 0 },
      targets: new Float32Array(BUNNY_TARGETS.length),
      face: { ...FACES.neutral },
      live: { ...LIVE_REST },
    },
  };
}

function random(b: BunnyBody): number {
  b.seed = (Math.imul(b.seed, 1664525) + 1013904223) >>> 0;
  return b.seed / 4294967296;
}

/** The face a mood is, on the bunny. */
function faceOf(mood: Mood | null): BunnyFaceName {
  switch (mood) {
    case "happy":
    case "glad":
      return "happy";
    case "love":
      return "love";
    case "squint":
      return "laugh";
    case "wide":
      return "surprised";
    case "sad":
      return "sad";
    case "angry":
      return "angry";
    case "bold":
      return "smug";
    case "dizzy":
      return "dizzy";
    case "shy":
      return "wink";
    default:
      return "neutral";
  }
}

/** What a face does to the shell and the ears, beside the screen. */
interface Wants {
  shapes: Float32Array;
  earL: BunnyEar;
  earR: BunnyEar;
  footL: number;
  footR: number;
}

function moodShapes(face: BunnyFaceName, w: Wants): void {
  const s = w.shapes;
  const both = (name: string, v: number) => {
    s[T[`ear_L_${name}`] ?? 0] = Math.max(s[T[`ear_L_${name}`] ?? 0] ?? 0, v);
    s[T[`ear_R_${name}`] ?? 0] = Math.max(s[T[`ear_R_${name}`] ?? 0] ?? 0, v);
  };
  const set = (name: string, v: number) => {
    const i = T[name];
    if (i !== undefined) s[i] = Math.max(s[i] ?? 0, v);
  };
  switch (face) {
    case "happy":
      set("puff", 0.25);
      both("perk", 0.45);
      break;
    case "laugh":
      set("puff", 0.3);
      both("perk", 0.3);
      break;
    case "love":
      set("puff", 0.4);
      both("curl", 0.25);
      set("pods_out", 0.4);
      break;
    case "surprised":
      set("brow_up", 1);
      both("perk", 1);
      set("stretch", 0.25);
      set("pods_out", 0.5);
      break;
    case "sad":
      both("droop", 0.85);
      set("squash", 0.15);
      break;
    case "angry":
      set("brow_down", 1);
      w.earL.fold -= 38 * DEG;
      w.earR.fold -= 38 * DEG;
      set("puff", 0.2);
      break;
    case "smug":
      set("brow_down", 0.4);
      s[T.ear_L_curl ?? 0] = 0.35;
      break;
    case "dizzy":
      both("droop", 0.35);
      break;
    case "wink":
      s[T.ear_L_fold ?? 0] = 0.5;
      set("puff", 0.15);
      break;
    case "sleepy":
      both("droop", 0.6);
      break;
    default:
      break;
  }
}

/** A gesture of a routine, on what the body wants (`side` is the side of the drone it is on). */
function gesture(kind: Gesture, at: number, side: number, w: Wants, sq: { v: number }): void {
  const env = clamp01(at / 0.15) * (1 - clamp01((at - 0.85) / 0.15));
  // The ear away from the drone: its own right ear when it is on the drone's left.
  const outer = side < 0 ? w.earR : w.earL;
  switch (kind) {
    case "wave": {
      const wave = Math.sin(at * TAU * 3.2);
      outer.twist += 35 * DEG * wave * env;
      outer.splay += (22 + 18 * wave) * DEG * env;
      w.shapes[T[side < 0 ? "ear_R_perk" : "ear_L_perk"] ?? 0] = env;
      break;
    }
    case "bow":
      w.earL.fold += 45 * DEG * bump(at);
      w.earR.fold += 45 * DEG * bump(at);
      w.footL -= 40 * DEG * bump(at);
      w.footR -= 40 * DEG * bump(at);
      break;
    case "cheer": {
      w.shapes[T.ear_L_perk ?? 0] = env;
      w.shapes[T.ear_R_perk ?? 0] = env;
      w.shapes[T.puff ?? 0] = Math.max(w.shapes[T.puff ?? 0] ?? 0, 0.45 * env);
      w.shapes[T.pods_out ?? 0] = env;
      const kick = Math.sin(at * TAU * 3);
      w.footL += 55 * DEG * Math.max(0, kick) * env;
      w.footR += 55 * DEG * Math.max(0, -kick) * env;
      w.earL.splay += 20 * DEG * env;
      w.earR.splay += 20 * DEG * env;
      break;
    }
    case "bounce": {
      const hop = Math.sin(at * TAU * 3);
      sq.v += 0.18 * hop * env;
      w.earL.splay += 18 * DEG * Math.abs(hop) * env;
      w.earR.splay += 18 * DEG * Math.abs(hop) * env;
      break;
    }
    case "hide":
      w.shapes[T.ear_L_fold ?? 0] = env;
      w.shapes[T.ear_R_fold ?? 0] = env;
      w.earL.fold += 30 * DEG * env;
      w.earR.fold += 30 * DEG * env;
      w.earL.splay -= 15 * DEG * env;
      w.earR.splay -= 15 * DEG * env;
      break;
    case "punch":
    case "jab":
      w.shapes[T[side < 0 ? "lean_L" : "lean_R"] ?? 0] = env;
      w.earL.fold += 25 * DEG * env;
      w.earR.fold += 25 * DEG * env;
      break;
    case "flex":
      w.shapes[T.puff ?? 0] = env;
      w.shapes[T.pods_out ?? 0] = env;
      w.shapes[T.ear_L_perk ?? 0] = env;
      w.shapes[T.ear_R_perk ?? 0] = env;
      break;
  }
}

export interface BunnyInput {
  dt: number;
  /** Where it should be on the screen, and its width in pixels. */
  x: number;
  y: number;
  size: number;
  z: number;
  bit: FriendBit | null;
  look: { x: number; y: number } | null;
}

const wants: Wants = {
  shapes: new Float32Array(BUNNY_TARGETS.length),
  earL: earPose(),
  earR: earPose(),
  footL: 0,
  footR: 0,
};

/** One frame of the body. Returns the pose to draw (the same object every time). */
export function stepBunny(b: BunnyBody, input: BunnyInput): BunnyPose {
  const dt = input.dt;
  b.life += dt;
  const t = b.life;
  const snap = !b.placed;
  b.placed = true;
  const bit = input.bit;
  const r = Math.max(1, input.size);

  // Where it is: the place is already smooth (the director springs it); this adds a little weight.
  if (snap) {
    b.x = { x: input.x, v: 0 };
    b.y = { x: input.y, v: 0 };
  } else {
    springTo(b.x, input.x, 14, dt);
    springTo(b.y, input.y, 14, dt);
  }
  const vx = b.x.v / r;
  const vy = b.y.v / r;
  const speed = Math.hypot(vx, vy);

  // What it looks at turns it a little, and its eyes all the way.
  let yaw = bit?.yaw ?? 0;
  let pitch = (bit?.pitch ?? 0) + 0.04 * Math.sin(t * 1.4);
  let lookX = 0;
  let lookY = 0;
  if (input.look) {
    const dx = clamp((input.look.x - b.x.x) / (2.5 * r), -1, 1);
    const dy = clamp((input.look.y - b.y.x) / (2.5 * r), -1, 1);
    yaw += dx * 0.5;
    pitch += dy * 0.2;
    lookX = dx * 3.2;
    lookY = -dy * 2.4;
  }
  // It leans into its flight, and turns its nose a little where it goes.
  yaw += clamp(vx * 0.04, -0.5, 0.5);
  pitch += clamp(vy * 0.03, -0.35, 0.35);
  const roll = clamp((bit?.roll ?? 0) - vx * 0.035 + 0.05 * Math.sin(t * 0.9), -1.1, 1.1);
  springTo(b.yaw, yaw, 11, dt);
  springTo(b.pitch, pitch, 11, dt);
  swingTo(b.roll, roll, 13, 0.5, dt);
  springTo(b.lookX, lookX, 16, dt);
  springTo(b.lookY, lookY, 16, dt);

  // The face.
  const faceName = faceOf(bit?.mood ?? null);
  if (faceName !== b.faceName) {
    copyFace(b.faceFrom, b.pose.face);
    b.faceName = faceName;
    b.faceT = snap ? 1 : 0;
  }
  b.faceT = Math.min(1, b.faceT + dt / 0.18);
  const ease = (u: number) => u * u * (3 - 2 * u);
  blendFace(b.pose.face, b.faceFrom, FACES[b.faceName], ease(b.faceT));

  // What the mood, the gesture and the flight ask of the shell, the ears and the feet.
  wants.shapes.fill(0);
  for (const e of [wants.earL, wants.earR]) {
    e.splay = 0;
    e.fold = 0;
    e.twist = 0;
  }
  wants.footL = 0;
  wants.footR = 0;
  // At rest the ears sway, out of step, and the feet swing slowly.
  wants.earL.fold = 5 * DEG * Math.sin(t * 1.7);
  wants.earR.fold = 5 * DEG * Math.sin(t * 1.7 + 1.2);
  wants.earL.splay = 4 * DEG * Math.sin(t * 1.1 + 0.4);
  wants.earR.splay = 4 * DEG * Math.sin(t * 1.1 + 2.1);
  wants.footL = 10 * DEG * Math.sin(t * 2.3);
  wants.footR = 10 * DEG * Math.sin(t * 2.3 + 1.6);
  // A breath: the side discs swell and settle.
  wants.shapes[T.pods_out ?? 0] = 0.12 + 0.12 * Math.sin(t * 2.1);
  moodShapes(b.faceName, wants);
  const sq = { v: 0 };
  if (bit?.gesture) gesture(bit.gesture, bit.at, bit.side, wants, sq);
  // Now and then an ear flicks by itself.
  const flick = t - b.flickAt;
  if (flick > 0 && flick < 0.5) {
    const curl = T[b.flickEar] ?? 0;
    wants.shapes[curl] = Math.max(wants.shapes[curl] ?? 0, 0.7 * bump(flick / 0.5));
  } else if (flick >= 0.5) {
    b.flickAt = t + 3 + random(b) * 5;
    b.flickEar = random(b) < 0.5 ? "ear_L_curl" : "ear_R_curl";
  }
  // The flight: it stretches along its speed, its ears stream back and its feet trail.
  const fast = clamp01(speed / 6);
  wants.earL.fold -= 30 * DEG * fast + clamp(vy * 0.02, -0.4, 0.4);
  wants.earR.fold -= 30 * DEG * fast + clamp(vy * 0.02, -0.4, 0.4);
  wants.earL.splay -= clamp(vx * 0.03, -0.4, 0.4);
  wants.earR.splay += clamp(vx * 0.03, -0.4, 0.4);
  wants.footL -= 40 * DEG * fast;
  wants.footR -= 40 * DEG * fast;
  const stretch = clamp(speed * 0.02, 0, 0.35);
  // Its own squash: the routine's, and a little under its speed.
  swingTo(b.squash, (bit ? 1 - bit.squash : 0) * 2 + sq.v, 24, 0.4, dt);
  const s = b.squash.x;
  wants.shapes[T.squash ?? 0] = Math.max(wants.shapes[T.squash ?? 0] ?? 0, clamp(s, 0, 1));
  wants.shapes[T.stretch ?? 0] = Math.max(
    wants.shapes[T.stretch ?? 0] ?? 0,
    clamp(-s, 0, 1) + stretch,
  );
  swingTo(b.lean, clamp(vx * 0.05, -1, 1), 12, 0.6, dt);
  wants.shapes[T.lean_L ?? 0] = Math.max(wants.shapes[T.lean_L ?? 0] ?? 0, clamp(-b.lean.x, 0, 1));
  wants.shapes[T.lean_R ?? 0] = Math.max(wants.shapes[T.lean_R ?? 0] ?? 0, clamp(b.lean.x, 0, 1));

  // The springs: the shapes quick, the ears loose.
  const p = b.pose;
  for (let i = 0; i < b.shapes.length; i += 1) {
    const sp = b.shapes[i];
    if (!sp) continue;
    const want = clamp(wants.shapes[i] ?? 0, 0, 1);
    if (snap) {
      sp.x = want;
      sp.v = 0;
    } else swingTo(sp, want, 18, 0.55, dt);
    p.targets[i] = clamp(sp.x, 0, 1);
  }
  const earStep = (state: EarState, want: BunnyEar, out: BunnyEar) => {
    for (const key of ["splay", "fold", "twist"] as const) {
      if (snap) state[key] = { x: want[key], v: 0 };
      else swingTo(state[key], want[key], 16, 0.3, dt);
      out[key] = state[key].x;
    }
    out.splay = clamp(out.splay, -25 * DEG, 60 * DEG);
    out.fold = clamp(out.fold, -60 * DEG, 40 * DEG);
    out.twist = clamp(out.twist, -45 * DEG, 45 * DEG);
  };
  earStep(b.earL, wants.earL, p.earL);
  earStep(b.earR, wants.earR, p.earR);
  if (snap) {
    b.footL = { x: wants.footL, v: 0 };
    b.footR = { x: wants.footR, v: 0 };
  } else {
    swingTo(b.footL, wants.footL, 14, 0.4, dt);
    swingTo(b.footR, wants.footR, 14, 0.4, dt);
  }
  p.footL.swing = clamp(b.footL.x, -100 * DEG, 110 * DEG);
  p.footR.swing = clamp(b.footR.x, -100 * DEG, 110 * DEG);
  p.footL.splay = 8 * DEG;
  p.footR.splay = 8 * DEG;

  // It blinks by itself, at uneven times, now and then twice.
  b.blinkAt -= dt;
  if (b.blinkAt <= 0) {
    b.blinkT = 0;
    b.blinkAt = random(b) < 0.2 ? 0.25 : 1.7 + random(b) * 3.6;
  }
  let lid = 0;
  if (b.blinkT < 1) {
    b.blinkT = Math.min(1, b.blinkT + dt / 0.15);
    lid = bump(b.blinkT);
  }
  // A change of face that is a change of drawing hides behind a quick blink.
  if (b.faceT < 1) lid = Math.max(lid, 0.6 * bump(b.faceT));

  p.x = b.x.x;
  p.y = b.y.x;
  p.z = input.z;
  p.size = r * (bit?.scale ?? 1);
  p.yaw = b.yaw.x;
  p.pitch = b.pitch.x;
  p.roll = b.roll.x + (bit?.spin ?? 0);
  p.live.blinkL = lid;
  p.live.blinkR = lid;
  p.live.lookX = b.lookX.x;
  p.live.lookY = b.lookY.x;
  p.live.talk =
    bit?.mood === "squint" || bit?.mood === "love" ? 0.35 * (0.5 + 0.5 * Math.sin(t * 20)) : 0;
  p.live.spin = t * 4;
  p.live.on = 1;
  p.live.glow = 0.4;
  p.live.pixel = 1;
  return p;
}
