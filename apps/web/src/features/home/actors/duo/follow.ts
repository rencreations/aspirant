import { bump, clamp, springTo, swingTo, type Sprung } from "@/features/about/choreo/ease";

import { EASE, seeded } from "./curves";
import {
  blendFace,
  copyFace,
  eyesAreSymbols,
  faceDistance,
  FACES,
  type FaceName,
  type FaceShape,
} from "./face";
import { OWN } from "./goals";
import {
  earGoal,
  gloveOffset,
  glovePose,
  type DroneGoal,
  type DronePose,
  type GloveGoal,
} from "./pose";

/**
 * The springs of one drone. A goal says where each part wants to be; this keeps the position of
 * everything and moves it there: the ball on a critically damped spring, its attitude from its own
 * speed (it leans into a flight, it stretches along it), the ears and the gloves loose so they trail
 * behind a stop, the face blended or changed behind a blink. Plain arithmetic: no three.
 *
 * A step that is too big to be a flight is a jump (a scrollbar drag): `snap` puts everything at the
 * goal at once, so no spring is left flying across the screen.
 */

interface GloveState {
  x: Sprung;
  y: Sprung;
  z: Sprung;
  rx: Sprung;
  ry: Sprung;
  rz: Sprung;
  size: Sprung;
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

/** A step of a place bigger than this part of the screen in one frame is a jump, not a flight. */
export const JUMP = 0.4;

/** Whether a place that moved (`dx`, `dy`) in one frame on a `w` by `h` screen was a jump (a scrollbar drag). */
export function isJump(dx: number, dy: number, w: number, h: number): boolean {
  return Math.hypot(dx, dy) > JUMP * Math.max(w, h);
}

export interface DroneState {
  who: 0 | 1;
  x: Sprung;
  y: Sprung;
  z: Sprung;
  radius: Sprung;
  yaw: Sprung;
  pitch: Sprung;
  roll: Sprung;
  squash: Sprung;
  /** splay L, splay R, fold L, fold R, twist L, twist R */
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
  pose: DronePose;
}

export function newDroneState(who: 0 | 1): DroneState {
  return {
    who,
    x: sprung(),
    y: sprung(),
    z: sprung(),
    radius: sprung(50),
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
    pose: {
      x: 0,
      y: 0,
      z: 0,
      radius: 50,
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

/** A face held over the one the pose wants, blended in by `blend` (0 to 1). */
export interface Held {
  name: FaceName | null;
  blend: number;
}

const settle = (s: Sprung, target: number): void => {
  s.x = target;
  s.v = 0;
};

/** The wanted position of a glove in radii of the ball (the ball's own frame, turned with it). */
function gloveTarget(
  out: { x: number; y: number; z: number; ry: number; rz: number },
  goal: GloveGoal,
  s: DroneState,
  vx: number,
  vy: number,
): void {
  const R = Math.max(1, s.radius.x);
  if (goal.free) {
    // A point of the stage: from the ball's middle, in radii. No turn, no lag.
    out.x = (goal.fx - s.x.x) / R;
    out.y = (goal.fy - s.y.x) / R;
    out.z = goal.z;
    out.ry = goal.ry;
    out.rz = goal.rz;
    return;
  }
  gloveOffset(turned, goal.x, goal.y, goal.z, s.yaw.x, s.roll.x);
  out.x = turned.x - clamp(vx * 0.05, -0.9, 0.9);
  out.z = turned.z;
  out.y = turned.y + clamp(vy * 0.05, -0.9, 0.9);
  out.ry = goal.ry + s.yaw.x;
  out.rz = goal.rz + s.roll.x;
}

const target = { x: 0, y: 0, z: 0, ry: 0, rz: 0 };
const turned = { x: 0, y: 0, z: 0 };

function moveEar(spring: Sprung, to: number, dt: number, snap: boolean): void {
  if (snap) settle(spring, to);
  else swingTo(spring, to, 24, 0.32, dt);
}

function stepGlove(
  state: GloveState,
  goal: GloveGoal,
  s: DroneState,
  vx: number,
  vy: number,
  dt: number,
  snap: boolean,
): void {
  gloveTarget(target, goal, s, vx, vy);
  moveGlove(state.x, target.x, goal, dt, snap);
  moveGlove(state.y, target.y, goal, dt, snap);
  moveGlove(state.z, target.z, goal, dt, snap);
  moveGlove(state.rx, goal.rx, goal, dt, snap);
  moveGlove(state.ry, target.ry, goal, dt, snap);
  moveGlove(state.rz, target.rz, goal, dt, snap);
  moveGlove(state.size, goal.size, goal, dt, snap);
}

function moveGlove(spring: Sprung, to: number, goal: GloveGoal, dt: number, snap: boolean): void {
  if (snap || goal.hard) settle(spring, to);
  else if (goal.zeta >= 1) springTo(spring, to, goal.omega, dt);
  else swingTo(spring, to, goal.omega, goal.zeta, dt);
}

function writeGlove(out: ReturnType<typeof glovePose>, state: GloveState, free: boolean): void {
  out.x = state.x.x;
  out.y = state.y.x;
  out.z = state.z.x;
  out.rx = state.rx.x;
  out.ry = state.ry.x;
  out.rz = state.rz.x;
  out.size = Math.max(0.2, state.size.x);
  out.free = free;
}

/**
 * Move one drone toward its goal by `dt` seconds. `time` is the duo's clock (it turns the spirals),
 * `held` a face over the wanted one.
 */
export function stepDrone(
  s: DroneState,
  g: DroneGoal,
  dt: number,
  snap: boolean,
  time: number,
  held: Held,
): void {
  if (snap) {
    settle(s.x, g.x);
    settle(s.y, g.y);
  } else {
    springTo(s.x, g.x, g.omega, dt);
    springTo(s.y, g.y, g.omega, dt);
  }
  const r = Math.max(1, s.radius.x);

  // What it looks at turns the ball a little, and the eyes all the way.
  let yaw = g.yaw;
  let pitch = g.pitch;
  let lookX = 0;
  let lookY = 0;
  if (g.look) {
    const dx = clamp((g.look.x - s.x.x) / (5 * r), -1, 1);
    // The screen is y up: a thing above it is a look up (a negative pitch lifts the face).
    const dy = clamp((g.look.y - s.y.x) / (5 * r), -1, 1);
    yaw += dx * 0.75 * g.turn;
    pitch += -dy * 0.3 * g.turn;
    lookX = clamp(dx * 1.3 - Math.sin(yaw) * 1.1, -1, 1) * 0.13;
    lookY = clamp(dy * 1.3 + Math.sin(pitch), -1, 1) * 0.075;
  }

  // It leans into its own speed, and stretches along it.
  const vx = s.x.v / r;
  const vy = s.y.v / r;
  const speed = Math.hypot(vx, vy);
  let roll = g.roll;
  let squash = g.squash;
  if (g.lean) roll -= clamp(vx * 0.03, -0.4, 0.4);
  const stretch = clamp(speed * 0.01, 0, 0.16);
  squash *= 1 + (stretch * (Math.abs(vy) - Math.abs(vx))) / (speed + 0.001);

  if (snap) {
    settle(s.yaw, yaw);
    settle(s.pitch, pitch);
    settle(s.roll, roll);
    settle(s.radius, g.radius);
    settle(s.squash, squash);
    settle(s.z, g.z);
  } else {
    springTo(s.yaw, yaw, 13, dt);
    springTo(s.pitch, pitch, 13, dt);
    swingTo(s.roll, roll, 15, 0.5, dt);
    springTo(s.radius, g.radius, 10, dt);
    swingTo(s.squash, squash, 26, 0.45, dt);
    springTo(s.z, g.z, 30, dt);
  }
  springTo(s.lookX, lookX, 16, dt);
  springTo(s.lookY, lookY, 16, dt);

  // The ears swing after the ball: back from where it is going, and up when it drops.
  const dragX = clamp(vx * 0.045, -0.6, 0.6);
  const dragY = clamp(vy * 0.05, -0.7, 0.45);
  const e = s.ears;
  moveEar(e[0], g.earL.splay - dragX + dragY, dt, snap);
  moveEar(e[1], g.earR.splay + dragX + dragY, dt, snap);
  moveEar(e[2], g.earL.fold, dt, snap);
  moveEar(e[3], g.earR.fold, dt, snap);
  moveEar(e[4], g.earL.twist, dt, snap);
  moveEar(e[5], g.earR.twist, dt, snap);

  stepGlove(s.gl, g.gl, s, vx, vy, dt, snap);
  stepGlove(s.gr, g.gr, s, vx, vy, dt, snap);

  stepFace(s, g, dt, snap, held);

  const p = s.pose;
  p.x = s.x.x;
  p.y = s.y.x;
  p.z = s.z.x;
  p.radius = Math.max(1, s.radius.x);
  p.yaw = s.yaw.x;
  p.pitch = s.pitch.x;
  p.roll = s.roll.x;
  p.spin = g.spin;
  p.squash = clamp(s.squash.x, 0.55, 1.5);
  p.earL.splay = e[0].x;
  p.earR.splay = e[1].x;
  p.earL.fold = e[2].x;
  p.earR.fold = e[3].x;
  p.earL.twist = e[4].x;
  p.earR.twist = e[5].x;
  writeGlove(p.gloveL, s.gl, g.gl.free);
  writeGlove(p.gloveR, s.gr, g.gr.free);
  p.live.lookX = s.lookX.x;
  p.live.lookY = s.lookY.x;
  p.live.on = g.on;
  p.live.spin = time * 5;
}

/** The face: a like face blends, an unlike one is changed behind a quick blink. Blinks and winks. */
function stepFace(s: DroneState, g: DroneGoal, dt: number, snap: boolean, held: Held): void {
  const p = s.pose;
  if (g.face !== s.faceName) {
    copyFace(s.faceFrom, p.face);
    s.faceSwap = faceDistance(s.faceFrom, FACES[g.face]) > 0.5;
    s.faceName = g.face;
    s.faceT = snap ? 1 : 0;
  }
  let lid = g.lid;
  if (s.faceT < 1) {
    s.faceT = Math.min(1, s.faceT + dt / (s.faceSwap ? 0.2 : 0.16));
    if (s.faceSwap) {
      lid = Math.max(lid, bump(s.faceT));
      copyFace(p.face, s.faceT < 0.5 ? s.faceFrom : FACES[s.faceName]);
    } else {
      blendFace(p.face, s.faceFrom, FACES[s.faceName], EASE.io(s.faceT));
    }
  } else {
    copyFace(p.face, FACES[s.faceName]);
  }
  // It blinks by itself, at uneven times, now and then twice.
  s.blinkAt -= dt;
  if (s.blinkAt <= 0) {
    s.blinkT = 0;
    s.blinkAt = s.random() < 0.18 ? 0.26 : 1.8 + s.random() * 3.8;
  }
  if (s.blinkT < 1) {
    s.blinkT = Math.min(1, s.blinkT + dt / 0.16);
    // Arches, chevrons, spirals and sparkles are not open eyes: they do not blink.
    if (!eyesAreSymbols(p.face)) lid = Math.max(lid, bump(s.blinkT));
  }
  // A face held by a section goes over whatever the pose wants.
  if (held.name && held.blend > 0.001) {
    blendFace(p.face, p.face, FACES[held.name], clamp(held.blend, 0, 1));
  }
  p.live.blinkL = Math.max(lid, g.winkL);
  p.live.blinkR = Math.max(lid, g.winkR);
}
