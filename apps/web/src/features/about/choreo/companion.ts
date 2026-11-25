import { blendFace, copyFace, faceDistance, FACES, type FaceName } from "../companions/face";
import type { CompanionPose, EarPose, GlovePose } from "../companions/pose";

import { bump, clamp, clamp01, mix, springTo, swingTo, TAU, type Sprung } from "./ease";
import type { FriendBit, Gesture, Mood } from "./routines";

/**
 * The body of one of Guinevere's two drones: a ball with two cat's ears, two boxing gloves that
 * float beside it and a face drawn on its screen. Every frame it is told where it should be (the
 * friends' place, `friends.ts`), what a routine adds (`routines.ts`) and what to look at, and it
 * writes the pose the scene draws (`companions/pose.ts`). Plain arithmetic, no three.
 *
 * Every part follows its goal on a spring, so the gloves trail the ball, the ears swing after a
 * stop and no change of mind is a jump. The goals and the gestures are the ones the two had in
 * their corner of the fourth phase until 25 Nov 2026; the scene they played there is gone.
 *
 * Places are in CSS pixels of the screen (y down); a glove's place is in radii of its ball.
 */

/** The bold one (the first) and the soft one (the second). */
export type CompanionWho = 0 | 1;

interface GloveGoal extends GlovePose {
  /** How quick the glove follows, and how loose (under 1 it swings past). */
  omega: number;
  zeta: number;
}

interface Goal {
  x: number;
  y: number;
  scale: number;
  yaw: number;
  pitch: number;
  roll: number;
  spin: number;
  squash: number;
  earL: EarPose;
  earR: EarPose;
  gl: GloveGoal;
  gr: GloveGoal;
  face: FaceName;
  look: { x: number; y: number } | null;
  /** How much the ball turns toward what it looks at (the eyes always do). */
  turn: number;
}

interface GloveState {
  x: Sprung;
  y: Sprung;
  z: Sprung;
  rx: Sprung;
  ry: Sprung;
  rz: Sprung;
  size: Sprung;
}

export interface CompanionBody {
  who: CompanionWho;
  goal: Goal;
  x: Sprung;
  y: Sprung;
  scale: Sprung;
  yaw: Sprung;
  pitch: Sprung;
  roll: Sprung;
  spin: Sprung;
  squash: Sprung;
  ears: [Sprung, Sprung, Sprung, Sprung, Sprung, Sprung];
  gl: GloveState;
  gr: GloveState;
  lookX: Sprung;
  lookY: Sprung;
  faceName: FaceName;
  faceFrom: ReturnType<typeof copyFace>;
  faceT: number;
  faceSwap: boolean;
  blinkAt: number;
  blinkT: number;
  seed: number;
  life: number;
  /** Seconds until it next does a small thing by itself, and what. */
  idleAt: number;
  idleKind: number;
  /** It has been placed once (the first frame snaps). */
  placed: boolean;
  pose: CompanionPose;
}

/** The faces each rests in. */
const OWN: readonly [FaceName, FaceName] = ["bold", "soft"];
/** The soft one is a little smaller. */
const COMPANION_SCALE: readonly [number, number] = [1, 0.9];
/** Where a glove rests, in the ball's own frame, in radii: right, up, toward the visitor. */
const HOME = { x: 1.72, y: -0.42, z: 0.4, ry: -0.3, rz: -0.22 };

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
const ear = (): EarPose => ({ splay: 0, fold: 0, twist: 0 });
const glove = (): GloveGoal => ({
  x: 0,
  y: 0,
  z: 0,
  rx: 0,
  ry: 0,
  rz: 0,
  size: 1,
  omega: 17,
  zeta: 0.55,
});

export function createCompanion(who: CompanionWho): CompanionBody {
  return {
    who,
    goal: {
      x: 0,
      y: 0,
      scale: 1,
      yaw: 0,
      pitch: 0,
      roll: 0,
      spin: 0,
      squash: 1,
      earL: ear(),
      earR: ear(),
      gl: glove(),
      gr: glove(),
      face: OWN[who],
      look: null,
      turn: 0.5,
    },
    x: sprung(),
    y: sprung(),
    scale: sprung(1),
    yaw: sprung(),
    pitch: sprung(),
    roll: sprung(),
    spin: sprung(),
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
    seed: who === 0 ? 20221 : 90917,
    life: 0,
    idleAt: 4 + who * 2.5,
    idleKind: 0,
    placed: false,
    pose: {
      x: 0,
      y: 0,
      z: 0,
      radius: 10,
      yaw: 0,
      pitch: 0,
      roll: 0,
      spin: 0,
      squash: 1,
      earL: ear(),
      earR: ear(),
      gloveL: { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, size: 1 },
      gloveR: { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, size: 1 },
      face: { ...FACES[OWN[who]] },
      live: { blinkL: 0, blinkR: 0, lookX: 0, lookY: 0, on: 1, spin: 0 },
    },
  };
}

function random(b: CompanionBody): number {
  b.seed = (Math.imul(b.seed, 1664525) + 1013904223) >>> 0;
  return b.seed / 4294967296;
}

function setGlove(g: GloveGoal, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, size = 1) {
  g.x = x;
  g.y = y;
  g.z = z;
  g.rx = rx;
  g.ry = ry;
  g.rz = rz;
  g.size = size;
  g.omega = 17;
  g.zeta = 0.55;
}

function mixGlove(
  g: GloveGoal,
  x: number,
  y: number,
  z: number,
  ry: number,
  rz: number,
  size: number,
  t: number,
): void {
  g.x = mix(g.x, x, t);
  g.y = mix(g.y, y, t);
  g.z = mix(g.z, z, t);
  g.ry = mix(g.ry, ry, t);
  g.rz = mix(g.rz, rz, t);
  g.size = mix(g.size, size, t);
}

const hump = (t: number, a: number, b: number) => (t <= a || t >= b ? 0 : bump((t - a) / (b - a)));
const ease = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const back = (u: number) => 1 + 2.70158 * Math.pow(u - 1, 3) + 1.70158 * Math.pow(u - 1, 2);

/** The face a mood is on this one. */
function faceOf(who: CompanionWho, mood: Mood | null): FaceName {
  switch (mood) {
    case "happy":
      return "happy";
    case "love":
      return "love";
    case "shy":
    case "sad":
      return "shy";
    case "wide":
      return "wide";
    case "squint":
      return "squeeze";
    case "dizzy":
      return "dizzy";
    case "glad":
      return "glad";
    case "angry":
      return "angry";
    case "bold":
      return who === 0 ? "bold" : "bars";
    default:
      return OWN[who];
  }
}

/** The life of one that is doing nothing else: it bobs, sways, flicks an ear. */
function idle(b: CompanionBody, g: Goal): void {
  const t = b.life + b.who * 1.9;
  g.scale = 1;
  g.yaw = 0;
  g.pitch = 0;
  g.roll = 0.03 * Math.sin(t * 0.8);
  g.spin = 0;
  g.squash = 1 + 0.015 * Math.sin(t * 2.42);
  g.face = OWN[b.who];
  g.turn = 0.4;
  for (const [gl, side] of [
    [g.gl, 1],
    [g.gr, -1],
  ] as const) {
    setGlove(
      gl,
      side * HOME.x + 0.04 * Math.sin(t * 1.1 + side),
      HOME.y + 0.09 * Math.sin(t * 1.63 + side * 1.3),
      HOME.z,
      0,
      side * HOME.ry,
      side * HOME.rz + 0.05 * Math.sin(t * 1.3 + side),
    );
  }
  const flick = 0.05 * Math.sin(t * 0.9);
  g.earL = { splay: flick, fold: 0, twist: 0 };
  g.earR = { splay: -flick, fold: 0, twist: 0 };
  // Now and then something small: the bold one jabs the air, the soft one flicks an ear.
  const u = b.life - b.idleAt;
  if (u > 0 && u < 1.1) {
    if (b.who === 0) {
      const jab = (gl: GloveGoal, side: number, from: number, to: number) => {
        const p = hump(u, from, to);
        if (p > 0)
          mixGlove(gl, side * 0.75, 0.15, 2.9, 0, side * -0.1, 1.4, 1 - Math.pow(1 - p, 3));
      };
      jab(g.gl, 1, 0.15, 0.45);
      jab(g.gr, -1, 0.45, 0.75);
    } else {
      g.earL.splay -= 0.5 * hump(u, 0.1, 0.4);
      g.earR.twist = 0.5 * hump(u, 0.3, 0.7);
    }
  } else if (u >= 1.1) {
    b.idleAt = b.life + 5 + random(b) * 6;
  }
}

/** A gesture of a routine, on the goal (`side` is the side of the drone it is on). */
function act(
  g: Goal,
  kind: Gesture,
  at: number,
  side: number,
  who: CompanionWho,
  radius: number,
): void {
  const end = 1 - clamp01((at - 0.82) / 0.18);
  // The glove on the drone's side, and the other.
  const near = side > 0 ? g.gr : g.gl;
  const far = side > 0 ? g.gl : g.gr;
  const s = side > 0 ? -1 : 1;
  switch (kind) {
    case "wave": {
      const up = back(clamp01(at / 0.25)) * end;
      const wave = Math.sin(at * TAU * 3.2) * 0.45;
      mixGlove(far, -s * 1.9, 1.05, 0.5, -s * 0.2, -s * 0.3 + wave, 1.05, up);
      g.roll += s * -0.1 * up;
      break;
    }
    case "bow":
      g.pitch += 0.55 * bump(at);
      g.earL.fold += 0.4 * bump(at);
      g.earR.fold += 0.4 * bump(at);
      break;
    case "cheer": {
      const up = back(clamp01(at / 0.25)) * end;
      mixGlove(g.gl, 1.7, 1.35, 0.5, -0.2, -0.5, 1.1, up);
      mixGlove(g.gr, -1.7, 1.35, 0.5, 0.2, 0.5, 1.1, up);
      g.earL.splay -= 0.3 * up;
      g.earR.splay -= 0.3 * up;
      break;
    }
    case "jab": {
      // Jab, jab, cross, at the drone beside it.
      const p = [hump(at, 0, 0.3), hump(at, 0.3, 0.6), hump(at, 0.62, 0.98)];
      const one = Math.max(p[0] ?? 0, p[2] ?? 0);
      const two = p[1] ?? 0;
      mixGlove(near, s * 2.7, 0.25, 0.6, s * 1.3, 0, 1.35, ease(one));
      mixGlove(far, s * 2.4, 0.4, 0.9, s * 1.3, 0, 1.3, ease(two));
      g.x += s * 0.25 * radius * (one + two);
      near.omega = far.omega = 34;
      near.zeta = far.zeta = 0.8;
      break;
    }
    case "punch": {
      // A fist held out to the drone for a bump.
      const out = ease(clamp01(at / 0.35)) * end;
      mixGlove(near, s * 2.6, 0.1, 0.5, s * 1.35, 0, 1.15, out);
      near.omega = 30;
      near.zeta = 0.85;
      break;
    }
    case "hide": {
      const cover = ease(clamp01(at / 0.3)) * end;
      mixGlove(g.gl, 0.55, 0.1, 1.3, 0, 0.3, 1, cover);
      mixGlove(g.gr, -0.55, 0.1, 1.3, 0, -0.3, 1, cover);
      g.earL.splay += 0.6 * cover;
      g.earR.splay += 0.6 * cover;
      break;
    }
    case "bounce": {
      const up = Math.abs(Math.sin(at * Math.PI * 3));
      mixGlove(g.gl, 1.1, -0.1 + 0.3 * up, 1.1, -0.5, 0.2, 1, end);
      mixGlove(g.gr, -1.1, -0.1 + 0.3 * up, 1.1, 0.5, -0.2, 1, end);
      g.earL.splay += 0.3 * Math.sin(at * 30) * end;
      g.earR.splay -= 0.3 * Math.sin(at * 30) * end;
      break;
    }
    case "flex": {
      const up = back(clamp01(at / 0.3)) * end;
      mixGlove(g.gl, 1.75, 1.25, 0.5, -0.2, -0.5, 1.2, up);
      mixGlove(g.gr, -1.75, 1.25, 0.5, 0.2, 0.5, 1.2, up);
      const pump = Math.sin(clamp01((at - 0.3) / 0.6) * TAU * 2) * up;
      g.gl.y += 0.18 * pump;
      g.gr.y += 0.18 * pump;
      g.scale *= 1 + 0.12 * up;
      if (who === 0) {
        g.earL.splay -= 0.25 * up;
        g.earR.splay -= 0.25 * up;
      }
      break;
    }
  }
}

export interface CompanionInput {
  dt: number;
  /** Where it should be on the screen, and its radius in pixels. */
  x: number;
  y: number;
  radius: number;
  /** Its depth among the friends, in pixels toward the visitor. */
  z: number;
  /** What a routine adds this frame, or null. */
  bit: FriendBit | null;
  /** What it looks at on the screen, or null. */
  look: { x: number; y: number } | null;
  /** Put it where it should be at once (the first frame it is drawn). */
  snap: boolean;
}

/** One frame of the body. Returns the pose to draw. */
export function stepCompanion(b: CompanionBody, input: CompanionInput): CompanionPose {
  const dt = input.dt;
  b.life += dt;
  const g = b.goal;
  g.x = input.x;
  g.y = input.y;
  g.look = input.look;
  idle(b, g);
  const bit = input.bit;
  if (bit) {
    g.pitch += bit.pitch;
    g.roll += bit.roll;
    g.yaw += bit.yaw;
    g.spin = bit.spin;
    g.squash *= bit.squash;
    g.scale *= bit.scale;
    if (bit.mood) g.face = faceOf(b.who, bit.mood);
    if (bit.gesture) act(g, bit.gesture, bit.at, bit.side, b.who, input.radius);
  }
  follow(b, input, dt, input.snap || !b.placed);
  b.placed = true;
  return b.pose;
}

/** The springs: from the goal to the pose. */
function follow(b: CompanionBody, input: CompanionInput, dt: number, snap: boolean): void {
  const g = b.goal;
  const r = Math.max(1, input.radius * COMPANION_SCALE[b.who]);
  if (snap) {
    b.x = { x: g.x, v: 0 };
    b.y = { x: g.y, v: 0 };
  } else {
    // The place itself is already smooth (the director springs it): this only adds weight.
    springTo(b.x, g.x, 14, dt);
    springTo(b.y, g.y, 14, dt);
  }
  let yaw = g.yaw;
  let pitch = g.pitch;
  let lookX = 0;
  let lookY = 0;
  if (g.look) {
    const dx = clamp((g.look.x - b.x.x) / (5 * r), -1, 1);
    const dy = clamp((g.look.y - b.y.x) / (5 * r), -1, 1);
    yaw += dx * 0.75 * g.turn;
    pitch += dy * 0.3 * g.turn;
    lookX = clamp(dx * 1.3 - Math.sin(yaw) * 1.1, -1, 1) * 0.13;
    lookY = clamp(-dy * 1.3 + Math.sin(pitch), -1, 1) * 0.075;
  }
  const vx = b.x.v / r;
  const vy = b.y.v / r;
  const speed = Math.hypot(vx, vy);
  let roll = g.roll - clamp(vx * 0.03, -0.4, 0.4);
  let squash = g.squash;
  const stretch = clamp(speed * 0.01, 0, 0.16);
  squash *= 1 + (stretch * (Math.abs(vy) - Math.abs(vx))) / (speed + 0.001);
  roll = clamp(roll, -1.2, 1.2);

  const put = (s: Sprung, target: number, spring: () => void) => {
    if (snap) {
      s.x = target;
      s.v = 0;
    } else spring();
  };
  put(b.yaw, yaw, () => springTo(b.yaw, yaw, 13, dt));
  put(b.pitch, pitch, () => springTo(b.pitch, pitch, 13, dt));
  put(b.roll, roll, () => swingTo(b.roll, roll, 15, 0.5, dt));
  put(b.scale, g.scale, () => springTo(b.scale, g.scale, 10, dt));
  put(b.squash, squash, () => swingTo(b.squash, squash, 26, 0.45, dt));
  // A spin is a whole turn: it is followed closely, so it reads, and a turn that ends on a whole
  // one is the same as none, so it is never taken the long way back.
  while (b.spin.x - g.spin > Math.PI) b.spin.x -= TAU;
  while (g.spin - b.spin.x > Math.PI) b.spin.x += TAU;
  put(b.spin, g.spin, () => springTo(b.spin, g.spin, 22, dt));
  springTo(b.lookX, lookX, 16, dt);
  springTo(b.lookY, lookY, 16, dt);

  // The ears swing after the ball: back from where it is going, and up when it drops.
  const dragX = clamp(vx * 0.045, -0.6, 0.6);
  const dragY = clamp(-vy * 0.05, -0.45, 0.7);
  const ears: Array<[Sprung, number]> = [
    [b.ears[0], g.earL.splay - dragX + dragY],
    [b.ears[1], g.earR.splay + dragX + dragY],
    [b.ears[2], g.earL.fold],
    [b.ears[3], g.earR.fold],
    [b.ears[4], g.earL.twist],
    [b.ears[5], g.earR.twist],
  ];
  for (const [s, target] of ears) put(s, target, () => swingTo(s, target, 24, 0.32, dt));

  // The gloves: turned with the ball, and left a little behind by its speed.
  const cy = Math.cos(b.yaw.x);
  const sy = Math.sin(b.yaw.x);
  const cr = Math.cos(b.roll.x);
  const sr = Math.sin(b.roll.x);
  for (const [state, goal] of [
    [b.gl, g.gl],
    [b.gr, g.gr],
  ] as const) {
    const rx1 = goal.x * cr - goal.y * sr;
    const ry1 = goal.x * sr + goal.y * cr;
    const x = rx1 * cy + goal.z * sy - clamp(vx * 0.05, -0.9, 0.9);
    const z = -rx1 * sy + goal.z * cy;
    const y = ry1 + clamp(vy * 0.05, -0.9, 0.9);
    const set: Array<[Sprung, number]> = [
      [state.x, x],
      [state.y, y],
      [state.z, z],
      [state.rx, goal.rx],
      [state.ry, goal.ry + b.yaw.x],
      [state.rz, goal.rz + b.roll.x],
      [state.size, goal.size],
    ];
    for (const [s, target] of set) {
      put(s, target, () =>
        goal.zeta >= 1
          ? springTo(s, target, goal.omega, dt)
          : swingTo(s, target, goal.omega, goal.zeta, dt),
      );
    }
  }

  // The face: a like face blends, an unlike one is changed behind a quick blink.
  if (g.face !== b.faceName) {
    copyFace(b.faceFrom, b.pose.face);
    b.faceSwap = faceDistance(b.faceFrom, FACES[g.face]) > 0.5;
    b.faceName = g.face;
    b.faceT = snap ? 1 : 0;
  }
  let lid = 0;
  if (b.faceT < 1) {
    b.faceT = Math.min(1, b.faceT + dt / (b.faceSwap ? 0.2 : 0.16));
    if (b.faceSwap) {
      lid = Math.max(lid, bump(b.faceT));
      copyFace(b.pose.face, b.faceT < 0.5 ? b.faceFrom : FACES[b.faceName]);
    } else {
      blendFace(b.pose.face, b.faceFrom, FACES[b.faceName], ease(b.faceT));
    }
  } else {
    copyFace(b.pose.face, FACES[b.faceName]);
  }
  // It blinks by itself, at uneven times, now and then twice.
  b.blinkAt -= dt;
  if (b.blinkAt <= 0) {
    b.blinkT = 0;
    b.blinkAt = random(b) < 0.18 ? 0.26 : 1.8 + random(b) * 3.8;
  }
  if (b.blinkT < 1) {
    b.blinkT = Math.min(1, b.blinkT + dt / 0.16);
    const shape = b.pose.face;
    // Arches, chevrons and spirals are not open eyes: they do not blink.
    if (shape.arc + shape.chevron + shape.spiral < 0.5) lid = Math.max(lid, bump(b.blinkT));
  }

  const p = b.pose;
  p.x = b.x.x;
  p.y = b.y.x;
  p.z = input.z;
  p.radius = r * b.scale.x;
  p.yaw = b.yaw.x;
  p.pitch = b.pitch.x;
  p.roll = b.roll.x;
  p.spin = b.spin.x;
  p.squash = clamp(b.squash.x, 0.55, 1.5);
  p.earL.splay = b.ears[0].x;
  p.earR.splay = b.ears[1].x;
  p.earL.fold = b.ears[2].x;
  p.earR.fold = b.ears[3].x;
  p.earL.twist = b.ears[4].x;
  p.earR.twist = b.ears[5].x;
  for (const [out, state] of [
    [p.gloveL, b.gl],
    [p.gloveR, b.gr],
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
  p.live.lookX = b.lookX.x;
  p.live.lookY = b.lookY.x;
  p.live.on = 1;
  p.live.spin = b.life * 5;
}
