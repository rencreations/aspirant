import {
  bump,
  clamp,
  clamp01,
  easeInOutCubic,
  easeOutQuad,
  mix,
  ramp,
  springTo,
  TAU,
  type Sprung,
} from "../choreo/ease";

import type { ClipName } from "./model";
import { clearPose, restPose, type TetraMarks, type TetraPose } from "./pose";

/**
 * What Tetra does. Plain arithmetic, no three and no DOM: each frame it is told the time that has
 * passed, where the pointer and the drone are, and where she came out on the canvas last frame,
 * and it writes one pose.
 *
 * She plays an entrance once (a clock: she scurries in from the left, trips, lies there a beat,
 * gets up, shakes it off, sees the visitor and greets them), then she lives: she breathes, shifts
 * her weight, blinks, looks at the pointer, and answers a hover, a press and the drone with a
 * move of its own clock that always finishes. The marks of the comic overlay are asked for at
 * fixed moments of those clocks (`cue`).
 */

/** The marks the overlay can draw. */
export type MarkKind =
  "bang" | "spark" | "heart" | "note" | "lines" | "drop" | "puff" | "swirl" | "ha";

/** Where a mark is laid: a place on her, then an offset in parts of her height. */
type MarkAt = "head" | "crown" | "chest" | "ground" | "handL" | "handR";

interface Cue {
  kind: MarkKind;
  at: MarkAt;
  /** Across and up from the place, in parts of her height on the screen. */
  dx: number;
  dy: number;
  tone?: "ink" | "pink" | "cyan";
  /** The size, 1 as drawn. */
  size?: number;
}

/** A move with its own clock. */
type MoveKind =
  | "greet"
  | "wave"
  | "notice"
  | "jump"
  | "dance"
  | "sway"
  | "spin"
  | "dizzy"
  | "meet"
  | "reach"
  | "follow"
  | "laugh"
  | "tilt"
  | "bounce";

interface Move {
  kind: MoveKind;
  t: number;
  /** The time before this step, for the cues. */
  was: number;
  seconds: number;
  /** -1 her right arm (the left of the screen), 1 her left. */
  side: number;
}

const SECONDS: Record<MoveKind, number> = {
  greet: 2.5,
  wave: 1.5,
  notice: 1.25,
  jump: 1.1,
  dance: 3.2,
  sway: 2.6,
  spin: 1.7,
  dizzy: 2.4,
  meet: 2.3,
  reach: 1.5,
  follow: 2.6,
  laugh: 1.4,
  tilt: 1.6,
  bounce: 0.9,
};

/** The answers to a press, in order. Many quick presses make her dizzy. */
const ANSWERS: readonly MoveKind[] = ["jump", "dance", "spin", "sway"];
const DIZZY_PRESSES = 4;
const DIZZY_WINDOW = 2.4;
/** The drone is greeted again only after it has been gone, or at her side, this long (seconds). */
const MEET_AGAIN = 14;

/** The entrance. She comes in turned this far to the right of the screen, on that line. */
const ENTER_YAW = (62 * Math.PI) / 180;
/** Lying on her front: tipped this far, and lifted this much so she lies on the ground. */
const PRONE = 1.42;
const PRONE_LIFT = 0.05;
/** How far her head lies from her feet across the screen when she is down, in metres. */
const LYING_REACH = 0.64;
/** How far short of her mark she falls, at least, in metres. */
const FALL_SHORT = 0.3;
/** The parts of the entrance after the run, in seconds. */
const TRIP = 0.3;
const DOWN = 0.9;
const RISE = 0.62;
const SHAKE = 0.55;
const SEE = 0.45;

interface StageInput {
  dt: number;
  /** The pointer on the canvas, in CSS pixels, or null when there is none to look at. */
  pointer: { x: number; y: number } | null;
  /** The drone on the canvas, and whether it has come to rest at her side. */
  drone: { x: number; y: number; here: boolean } | null;
  /** Where she came out last frame. */
  marks: TetraMarks;
  /** How tall she stands, how far her mark is from the left edge, and the stage's width, in CSS pixels. */
  tall: number;
  markX: number;
  width: number;
}

interface Env {
  /** How fast the walk clip travels, in metres a second. */
  walkSpeed: () => number;
  clipSeconds: (name: ClipName) => number;
  /** How tall she is, in the model's metres. */
  height: number;
  cue: (cue: Cue) => void;
  /** Ask the drone for one of its moves. */
  askDrone: (move: "hop" | "nod" | "roll" | "dizzy") => void;
}

export interface Performance {
  step: (input: StageInput) => TetraPose;
  /** The stage is well on the screen: the entrance may start (once). */
  begin: (input: Pick<StageInput, "tall" | "markX" | "width">) => void;
  /** The stage has come back on the screen after a while away. */
  comeBack: () => void;
  press: () => void;
  hover: (over: boolean) => void;
  /** The visitor pressed the drone while it rests beside her. */
  dronePressed: () => void;
  /** Straight to the living idle, with no entrance. */
  skip: () => void;
  /** Play the entrance again from its start (the probes). */
  replay: (input: Pick<StageInput, "tall" | "markX" | "width">) => void;
  /** Start one of her moves now, by name (the probes). */
  play: (kind: string) => void;
  /** True while she wants the drone to look at her. */
  wantsEyes: () => boolean;
  state: () => {
    mode: string;
    clock: number;
    move: string | null;
    runSeconds: number;
    /** She is on her feet: the entrance has got as far as the end of the get-up, or is over. */
    stood: boolean;
  };
}

/** A small repeatable source of numbers from 0 to 1. */
function makeRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** A squash that rings out: 0 at rest, `-depth` at the moment of the hit. */
function ring(since: number, depth: number, rate = 17, fade = 7): number {
  if (since < 0) return 0;
  return -depth * Math.exp(-fade * since) * Math.cos(rate * since);
}

export function createPerformance(env: Env): Performance {
  const pose = restPose();
  const random = makeRandom(11);

  let mode: "off" | "intro" | "live" = "off";
  let clock = 0;
  let was = 0;
  let time = 0;
  /** The run: how long it is, how fast, and how many times faster than the clip it is played. */
  let run = { seconds: 1.6, speed: 0.5, rate: 2.7, length: 0.8, short: 0 };

  let move: Move | null = null;
  let next: MoveKind | null = null;
  let presses: number[] = [];
  let answer = 0;
  let hovered = false;
  let hoverAgain = 0;
  let droneHere = false;
  let sinceDrone = 0;
  let sinceMeet = 1e3;
  let playAt = 5;
  let plays = 0;
  let idleAt = 4;
  let eyesOnMe = 0;

  // The look: the head and the eyes go to a point, the eyes first.
  const headYaw: Sprung = { x: 0, v: 0 };
  const headNod: Sprung = { x: 0, v: 0 };
  const bodyYaw: Sprung = { x: 0, v: 0 };
  const eyeX: Sprung = { x: 0, v: 0 };
  const eyeY: Sprung = { x: 0, v: 0 };
  /** How much of the look the pose takes (a move can ask for less). */
  const looking: Sprung = { x: 1, v: 0 };

  // The blinks: uneven, sometimes two.
  let blinkIn = 1.2;
  let blink = -1;
  let blinkTwice = false;

  const plan = (input: Pick<StageInput, "tall" | "markX" | "width">) => {
    const perMetre = Math.max(40, input.tall) / env.height;
    // Lying down she reaches this far to the right of her feet. She falls short of her mark and
    // hops up to it as she rises: so her head does not sweep through the drone's place beside
    // her, and, where the stage is narrow (a phone), so she lies wholly on the screen.
    const room = (input.width - input.markX) / perMetre - 0.04;
    const short = clamp(LYING_REACH - room, FALL_SHORT, 0.42);
    // From just off the left edge to the place she trips, along the line she faces.
    const across = Math.max(0.3, input.markX / perMetre + 0.26 - short);
    const length = clamp(across / Math.sin(ENTER_YAW), 0.5, 1.5);
    const rate = clamp(length / 1.7 / env.walkSpeed(), 2.3, 3.2);
    const speed = env.walkSpeed() * rate;
    run = { seconds: length / speed, speed, rate, length, short };
  };

  const start = (kind: MoveKind, side = -1) => {
    move = { kind, t: 0, was: -1, seconds: SECONDS[kind], side };
  };

  /** A move now if she is free, or next if she is in the middle of one. */
  const ask = (kind: MoveKind, side = -1) => {
    if (mode !== "live") return;
    if (!move) start(kind, side);
    else if (move.kind === "tilt" || move.kind === "bounce") start(kind, side);
    else next = kind;
  };

  const cueAt = (m: { t: number; was: number }, at: number, cue: Cue) => {
    if (m.was < at && m.t >= at) env.cue(cue);
  };

  // The entrance -------------------------------------------------------------------------------

  const intro = (t: number) => {
    const sin = Math.sin(ENTER_YAW);
    const cos = Math.cos(ENTER_YAW);
    const slide = 0.5 * run.speed * TRIP;
    const tRun = run.seconds;
    const tDown = tRun + TRIP;
    const tRise = tDown + DOWN;
    const tShake = tRise + RISE;
    const tSee = tShake + SHAKE;
    const tEnd = tSee + SEE;
    const clockNow = { t, was };

    // Along the line: 0 is where she ends, standing.
    let along = -slide;
    pose.yaw = ENTER_YAW;
    pose.mouth = "mouth_a";
    pose.mouthSize = 0.7;

    if (t < tRun) {
      // The scurry: the walk played fast, leaning into it, arms out like a small child's.
      along = -slide - (tRun - t) * run.speed;
      pose.clip = "walk";
      pose.clipTime = t * run.rate;
      pose.clipWeight = 1;
      pose.pitch = 0.2;
      pose.armL.z = 0.55;
      pose.armR.z = -0.55;
      pose.armL.y = 0.25;
      pose.armR.y = -0.25;
      pose.head.y = -0.5;
      pose.head.x = -0.12;
      pose.lookX = -0.5;
    } else if (t < tDown) {
      // The trip: over she goes, quicker and quicker, arms thrown out in front.
      const u = (t - tRun) / TRIP;
      along = -slide + run.speed * TRIP * (u - 0.5 * u * u);
      pose.clip = "walk";
      pose.clipTime = t * run.rate;
      pose.clipWeight = 1 - ramp(0, 0.5, u);
      pose.pitch = mix(0.2, PRONE, u * u);
      const fling = easeOutQuad(u / 0.7);
      pose.armL.x = pose.armR.x = -2.5 * fling;
      pose.armL.z = mix(0.55, 0.35, fling);
      pose.armR.z = -pose.armL.z;
      pose.legL.x = 0.5 * u;
      pose.legR.x = 0.25 * u;
      pose.head.x = -0.5 * fling;
      pose.head.y = -0.5 * (1 - u);
      pose.wide = 1;
      pose.mouth = "mouth_o";
      pose.mouthSize = 1;
      cueAt(clockNow, tRun + 0.03, { kind: "bang", at: "crown", dx: 0.12, dy: 0.2, tone: "pink" });
    } else if (t < tRise) {
      // Down. A beat, a few kicks, and the head comes up.
      const d = t - tDown;
      along = 0;
      pose.pitch = PRONE + ring(d, -0.1, 20, 9);
      pose.squash = 1 + ring(d, 0.16);
      pose.armL.x = pose.armR.x = -2.5 + 0.25 * ramp(0.5, 0.9, d);
      pose.armL.z = 0.35;
      pose.armR.z = -0.35;
      const kick = ramp(0.28, 0.4, d) * (1 - ramp(0.68, 0.84, d));
      pose.legL.x = 0.5 * Math.exp(-6 * d) + kick * 0.75 * Math.max(0, Math.sin(TAU * 4.4 * d));
      pose.legR.x =
        0.25 * Math.exp(-6 * d) + kick * 0.75 * Math.max(0, Math.sin(TAU * 4.4 * d + Math.PI));
      const lift = ramp(0.36, 0.7, d);
      pose.head.x = -0.2 - 0.6 * lift;
      pose.head.y = -0.55 * lift;
      pose.squeeze = 1;
      pose.mouth = "mouth_i";
      pose.mouthSize = 0.9;
      cueAt(clockNow, tDown + 0.01, { kind: "lines", at: "head", dx: 0.2, dy: 0.12 });
      cueAt(clockNow, tDown + 0.02, { kind: "puff", at: "ground", dx: 0.34, dy: 0.02 });
      cueAt(clockNow, tDown + 0.1, { kind: "puff", at: "ground", dx: -0.1, dy: 0.04, size: 0.7 });
      cueAt(clockNow, tDown + 0.14, {
        kind: "swirl",
        at: "head",
        dx: 0.02,
        dy: 0.3,
        tone: "cyan",
      });
    } else if (t < tShake) {
      // Up again in one push, a little too far, and round to face the visitor.
      const u = (t - tRise) / RISE;
      along = 0;
      // A slow start (she pushes), then quickly up, a little past upright, and back.
      const up = easeInOutCubic(clamp01(u / 0.8));
      pose.pitch = PRONE * (1 - up) - 0.16 * bump((u - 0.5) / 0.5) * (u > 0.5 ? 1 : 0);
      pose.yaw = ENTER_YAW * (1 - easeInOutCubic(clamp01((u - 0.3) / 0.7)));
      pose.squash = 1 + 0.1 * bump(u / 0.5) + ring(u * RISE - 0.5 * RISE, 0.07);
      const down = 1 - ramp(0.05, 0.6, u);
      pose.armL.x = pose.armR.x = -2.25 * down;
      pose.armL.z = 0.35 * down + 0.5 * bump(u);
      pose.armR.z = -pose.armL.z;
      pose.head.x = -0.8 * down;
      pose.head.y = -0.55 * down;
      pose.squeeze = 1;
      pose.mouth = "mouth_u";
      pose.mouthSize = 0.8;
    } else if (t < tSee) {
      // She shakes it off.
      const u = (t - tShake) / SHAKE;
      along = 0;
      pose.yaw = 0;
      const fade = 1 - u;
      pose.head.y = 0.5 * Math.sin(TAU * 2.6 * u) * fade;
      pose.head.z = 0.1 * Math.sin(TAU * 2.6 * u + 1) * fade;
      pose.spine.y = -0.14 * Math.sin(TAU * 2.6 * u) * fade;
      pose.squeeze = u < 0.75 ? 1 : 0;
      pose.blinkL = pose.blinkR = u >= 0.75 ? 1 - ramp(0.75, 1, u) : 0;
      pose.armL.z = 0.3 * fade;
      pose.armR.z = -0.3 * fade;
      pose.mouth = "mouth_i";
      pose.mouthSize = 0.7 * fade;
      cueAt(clockNow, tShake + 0.06, { kind: "drop", at: "head", dx: 0.2, dy: 0.16, tone: "cyan" });
      cueAt(clockNow, tShake + 0.2, { kind: "lines", at: "crown", dx: 0, dy: 0.06 });
    } else {
      // And there is the visitor. Oh.
      const u = clamp01((t - tSee) / SEE);
      along = 0;
      pose.yaw = 0;
      pose.y = 0.03 * bump(u / 0.6) * (u < 0.6 ? 1 : 0);
      pose.squash = 1 + 0.07 * bump(u / 0.5) * (u < 0.5 ? 1 : 0) + ring(u * SEE - 0.6 * SEE, 0.05);
      pose.wide = 1 - 0.5 * ramp(0.6, 1, u);
      pose.armL.z = 0.35 * bump(u);
      pose.armR.z = -0.35 * bump(u);
      pose.mouth = "mouth_o";
      pose.mouthSize = 0.7;
      cueAt(clockNow, tSee + 0.05, { kind: "bang", at: "crown", dx: -0.2, dy: 0.1, tone: "pink" });
    }

    // Short of her mark while she is down; the step up to it is part of the rise.
    const stepped = easeInOutCubic(clamp01((t - tRise - 0.2 * RISE) / (0.7 * RISE)));
    pose.x = along * sin - run.short * (1 - stepped);
    pose.z = along * cos;
    pose.y += 0.05 * bump(stepped);
    pose.y += PRONE_LIFT * Math.sin(clamp(pose.pitch, 0, Math.PI / 2));
    return t >= tEnd;
  };

  // The living idle ------------------------------------------------------------------------------

  const idle = () => {
    const breath = Math.sin(TAU * 0.3 * time);
    const shift = Math.sin(TAU * 0.09 * time + 0.6);
    pose.squash = 1 + 0.011 * breath;
    pose.spine.x = 0.022 * Math.sin(TAU * 0.3 * time + 0.7);
    pose.hips.z = 0.035 * shift;
    // The legs stay under her while the hips lean.
    pose.legL.z = pose.legR.z = -0.035 * shift;
    pose.spine.z = -0.02 * shift;
    pose.armL.z = 0.06 + 0.035 * breath;
    pose.armR.z = -0.06 - 0.035 * Math.sin(TAU * 0.3 * time + 0.5);
    pose.armL.x = 0.04 * Math.sin(TAU * 0.17 * time);
    pose.armR.x = 0.04 * Math.sin(TAU * 0.17 * time + 2);
    pose.head.z = 0.025 * Math.sin(TAU * 0.13 * time + 1.3);
    pose.mouth = "smile_mouth";
    pose.mouthSize = 0.6;
  };

  const look = (input: StageInput) => {
    const m = input.marks;
    const reach = Math.max(120, 1.5 * input.tall);
    const drone = input.drone?.here || (move?.kind === "meet" && input.drone) ? input.drone : null;
    // The pointer first, then the drone beside her, then the visitor in front of her.
    // A pointer far across the page is let go of: she is not left staring off to one side.
    const far = input.pointer
      ? Math.hypot(input.pointer.x - m.head.x, input.pointer.y - m.head.y) / input.tall
      : 0;
    const pointer = far < 2.4 ? input.pointer : null;
    const point = pointer ?? drone;
    let yaw = 0;
    let nod = -0.04;
    if (point) {
      const held = point === pointer ? 1 - ramp(1.3, 2.4, far) : 1;
      yaw = clamp((point.x - m.head.x) / reach, -1, 1) * 0.52 * held;
      nod = clamp((point.y - m.head.y) / reach, -1, 1) * 0.5 * held;
    }
    springTo(headYaw, yaw, 7, input.dt);
    springTo(headNod, nod, 7, input.dt);
    springTo(bodyYaw, yaw * 0.3, 2.6, input.dt);
    // The eyes get there before the head does.
    springTo(eyeX, clamp((yaw - headYaw.x) * 3 + yaw * 0.5, -1, 1), 18, input.dt);
    springTo(eyeY, clamp(-(nod - headNod.x) * 3 - nod * 0.8, -1, 1), 18, input.dt);
  };

  const blinking = (dt: number) => {
    if (blink < 0) {
      blinkIn -= dt;
      if (blinkIn <= 0) {
        blink = 0;
        blinkTwice = random() < 0.22;
        blinkIn = 1.6 + random() * random() * 5.5;
      }
      // Between the two blinks of a double the count runs up through the pause.
      if (blink < 0 && blink > -1) blink = Math.min(0, blink + dt);
      return 0;
    }
    blink += dt;
    const p = blink / 0.15;
    const shut = p < 0.4 ? ramp(0, 0.4, p) : 1 - ramp(0.4, 1, p);
    if (p >= 1) {
      blink = blinkTwice ? -0.1 : -1;
      blinkTwice = false;
    }
    return shut;
  };

  // The moves ------------------------------------------------------------------------------------

  /**
   * The arm on `side` up and out for a wave. `up` 0 to 1; `phase` is where the wave is, in turns.
   * The forearm trails the upper arm by a quarter of a wave, as a loose sleeve would.
   */
  const waveArm = (side: number, up: number, phase: number, big: number) => {
    const flap = Math.sin(TAU * phase);
    const lag = Math.sin(TAU * phase - 1.5);
    const arm = side < 0 ? pose.armR : pose.armL;
    const fore = side < 0 ? pose.foreR : pose.foreL;
    // Raised sideways to the shoulder's height and brought a little forward, so the hand stays
    // clear of her hair: her arm is shorter than her head is tall.
    arm.z += side * up * (1.14 + 0.24 * big * flap);
    arm.y += -side * up * 0.5;
    fore.z += side * up * (0.42 + 0.46 * lag);
  };

  const happy = (amount: number) => {
    pose.blinkL = Math.max(pose.blinkL, amount);
    pose.blinkR = Math.max(pose.blinkR, amount);
    pose.mouth = "grin";
    pose.mouthSize = mix(pose.mouthSize, 1, amount);
  };

  /** A hop: off at `from`, down at `to`, `high` metres, with the squash before and after. */
  const hop = (t: number, from: number, to: number, high: number) => {
    const u = clamp01((t - from) / (to - from));
    const inAir = t > from && t < to;
    pose.y += inAir ? high * 4 * u * (1 - u) : 0;
    // Down before she goes, long in the air, down again as she lands.
    const crouch = t < from ? Math.sin((Math.PI / 2) * clamp01((t - (from - 0.16)) / 0.16)) : 0;
    const spring = inAir ? 0.1 * bump(u) - 0.13 * (1 - ramp(0, 0.14, u)) : 0;
    pose.squash += -0.13 * crouch + spring + ring(t - to, 0.13);
    return u;
  };

  const act = (m: Move, input: StageInput) => {
    const t = m.t;
    const s = m.side;
    switch (m.kind) {
      case "greet": {
        // The whole arm, a hop, and the happiest face she has.
        const u = hop(t, 0.2, 0.66, 0.11);
        const up = ramp(0.12, 0.42, t) * (1 - ramp(2.0, 2.4, t));
        const phase = 2.1 * (t - 0.3);
        const flap = Math.sin(TAU * phase);
        waveArm(s, up, phase, 1);
        // The other arm flies up with the hop and comes down again.
        const other = s < 0 ? pose.armL : pose.armR;
        other.z += -s * (0.9 * bump(u) * (t < 0.66 ? 1 : 0) + 0.18 * up);
        pose.spine.z += s * 0.07 * up + 0.03 * up * flap;
        pose.head.z += -s * 0.16 * up + 0.04 * up * flap;
        pose.hips.z += 0.03 * up * flap;
        happy(ramp(0.25, 0.4, t) * (1 - ramp(1.75, 1.95, t)));
        if (t > 1.95) {
          pose.mouth = "smile_mouth";
          pose.mouthSize = 0.9;
        }
        cueAt(m, 0.3, { kind: "spark", at: "head", dx: -0.42, dy: 0.34, tone: "pink" });
        cueAt(m, 0.44, { kind: "spark", at: "head", dx: 0.4, dy: 0.42, tone: "cyan", size: 0.8 });
        cueAt(m, 0.6, { kind: "spark", at: "head", dx: 0.5, dy: 0.08, tone: "ink", size: 0.6 });
        cueAt(m, 1.15, { kind: "heart", at: "crown", dx: s * 0.38, dy: 0.02, tone: "pink" });
        break;
      }
      case "wave": {
        // A smaller hello: mostly the forearm.
        const up = ramp(0, 0.3, t) * (1 - ramp(1.1, 1.45, t));
        waveArm(s, up * 0.85, 2.4 * (t - 0.2), 0.5);
        pose.head.z += -s * 0.1 * up;
        pose.mouthSize = mix(pose.mouthSize, 0.95, up);
        pose.squash += 0.03 * bump(t / 0.4) * (t < 0.4 ? 1 : 0);
        break;
      }
      case "notice": {
        // The pointer is on her: a start, a lean toward it, a small wave.
        const up = ramp(0.25, 0.5, t) * (1 - ramp(0.95, 1.2, t));
        waveArm(s, up * 0.8, 2.6 * (t - 0.3), 0.4);
        pose.y += 0.02 * bump(t / 0.3) * (t < 0.3 ? 1 : 0);
        pose.squash += 0.05 * bump(t / 0.25) * (t < 0.25 ? 1 : 0) + ring(t - 0.3, 0.05);
        pose.wide = Math.max(pose.wide, 1 - ramp(0.3, 0.7, t));
        pose.pitch += 0.09 * ramp(0.2, 0.5, t) * (1 - ramp(0.9, 1.2, t));
        pose.mouthSize = mix(pose.mouthSize, 1, up);
        cueAt(m, 0.04, {
          kind: "bang",
          at: "crown",
          dx: s * 0.2,
          dy: 0.08,
          tone: "pink",
          size: 0.8,
        });
        break;
      }
      case "jump": {
        // Both arms up and a real jump.
        const u = hop(t, 0.22, 0.74, 0.17);
        const up = ramp(0.14, 0.34, t) * (1 - ramp(0.7, 1.0, t));
        pose.armL.z += 1.75 * up;
        pose.armR.z += -1.75 * up;
        pose.armL.y += -0.3 * up;
        pose.armR.y += 0.3 * up;
        pose.legL.z += 0.3 * bump(u) * (t < 0.74 ? 1 : 0);
        pose.legR.z += -0.3 * bump(u) * (t < 0.74 ? 1 : 0);
        happy(ramp(0.2, 0.32, t) * (1 - ramp(0.82, 1.0, t)));
        cueAt(m, 0.3, { kind: "spark", at: "handL", dx: 0.1, dy: 0.12, tone: "pink" });
        cueAt(m, 0.34, { kind: "spark", at: "handR", dx: -0.1, dy: 0.12, tone: "cyan" });
        cueAt(m, 0.46, { kind: "spark", at: "crown", dx: 0, dy: 0.2, tone: "ink", size: 0.7 });
        cueAt(m, 0.75, { kind: "puff", at: "ground", dx: -0.16, dy: 0.02, size: 0.6 });
        cueAt(m, 0.75, { kind: "puff", at: "ground", dx: 0.16, dy: 0.02, size: 0.6 });
        break;
      }
      case "dance":
      case "sway": {
        // A few bars of a dance, with her arms held a little open so the sleeves stay clear.
        const name: ClipName = m.kind === "dance" ? "hiphop" : "rumba";
        const blend = ramp(0, 0.28, t) * (1 - ramp(m.seconds - 0.35, m.seconds, t));
        // The slower dance keeps its hands at the chest: it needs the arms further apart.
        const open = m.kind === "dance" ? 0.32 : 0.6;
        pose.clip = name;
        pose.clipTime = (m.kind === "dance" ? 0.45 : 0) + t;
        pose.clipWeight = blend;
        pose.armL.z += open * blend;
        pose.armR.z += -open * blend;
        pose.hips.z *= 1 - blend;
        pose.legL.z *= 1 - blend;
        pose.legR.z *= 1 - blend;
        pose.spine.z *= 1 - blend;
        const beat = 0.5 + 0.5 * Math.sin(TAU * 2 * t);
        pose.squash += 0.025 * blend * (beat - 0.5);
        pose.mouth = "grin";
        pose.mouthSize = mix(pose.mouthSize, 0.95, blend);
        pose.blinkL = pose.blinkR = Math.max(pose.blinkL, blend * ramp(0.6, 0.9, beat));
        for (let k = 0; k < 6; k += 1) {
          const left = k % 2 === 0;
          cueAt(m, 0.3 + k * 0.46, {
            kind: "note",
            at: "head",
            dx: left ? -0.46 : 0.46,
            dy: 0.2 + 0.1 * (k % 3),
            tone: k % 3 === 0 ? "pink" : k % 3 === 1 ? "cyan" : "ink",
            size: 0.8 + 0.2 * (k % 2),
          });
        }
        break;
      }
      case "spin": {
        // Once round, small and shy, and a look down at the end of it.
        const u = clamp01(t / 0.95);
        pose.yaw += TAU * easeInOutCubic(u);
        pose.y += 0.035 * bump(u) * (t < 0.95 ? 1 : 0);
        pose.squash += 0.05 * bump(u) * (t < 0.95 ? 1 : 0) + ring(t - 0.95, 0.06);
        const tucked = ramp(0, 0.2, t) * (1 - ramp(1.35, 1.65, t));
        pose.armL.x += -0.5 * tucked;
        pose.armR.x += -0.5 * tucked;
        pose.armL.z += -0.25 * tucked;
        pose.armR.z += 0.25 * tucked;
        pose.foreL.y += -0.9 * tucked;
        pose.foreR.y += 0.9 * tucked;
        const shy = ramp(0.9, 1.1, t) * (1 - ramp(1.4, 1.65, t));
        pose.head.x += 0.22 * shy;
        pose.head.z += 0.14 * shy;
        pose.hips.y += 0.2 * Math.sin(TAU * 1.6 * (t - 0.95)) * shy;
        pose.blinkL = pose.blinkR = Math.max(pose.blinkL, shy);
        pose.mouth = "smile_mouth";
        pose.mouthSize = mix(pose.mouthSize, 1, shy);
        cueAt(m, 1.0, { kind: "heart", at: "crown", dx: 0.22, dy: 0.06, tone: "pink", size: 0.8 });
        cueAt(m, 0.3, { kind: "lines", at: "chest", dx: -0.3, dy: 0.1 });
        break;
      }
      case "dizzy": {
        // Too many presses: the world goes round.
        const fade = 1 - ramp(1.5, 2.3, t);
        const on = ramp(0, 0.25, t) * fade;
        pose.roll += 0.2 * Math.sin(TAU * 1.25 * t) * on;
        pose.x += 0.025 * Math.sin(TAU * 1.25 * t + 1.2) * on;
        pose.head.z += 0.2 * Math.sin(TAU * 1.25 * t + 0.8) * on;
        pose.head.y += 0.3 * Math.sin(TAU * 0.9 * t) * on;
        pose.armL.z += (0.5 + 0.2 * Math.sin(TAU * 1.25 * t)) * on;
        pose.armR.z += (-0.5 + 0.2 * Math.sin(TAU * 1.25 * t)) * on;
        pose.squeeze = t < 1.7 ? 1 : 0;
        pose.blinkL = pose.blinkR = t >= 1.7 ? 1 - ramp(1.7, 1.9, t) : 0;
        pose.mouth = "mouth_o";
        pose.mouthSize = mix(0.6, 0.8, on);
        // A shake of the head to clear it.
        const clear = ramp(1.75, 1.85, t) * (1 - ramp(2.2, 2.4, t));
        pose.head.y += 0.4 * Math.sin(TAU * 3 * (t - 1.8)) * clear;
        cueAt(m, 0.1, { kind: "swirl", at: "crown", dx: -0.16, dy: 0.16, tone: "cyan" });
        cueAt(m, 0.45, { kind: "swirl", at: "crown", dx: 0.2, dy: 0.2, tone: "pink", size: 0.8 });
        cueAt(m, 0.9, { kind: "drop", at: "head", dx: 0.26, dy: 0.12, tone: "cyan" });
        break;
      }
      case "meet": {
        // The drone has come: a start, then a wave and a hop for it.
        const u = hop(t, 0.62, 1.04, 0.09);
        const up = ramp(0.5, 0.8, t) * (1 - ramp(1.8, 2.2, t));
        waveArm(s, up, 2.2 * (t - 0.6), 0.9);
        pose.wide = Math.max(pose.wide, (1 - ramp(0.35, 0.6, t)) * ramp(0, 0.08, t));
        pose.squash += 0.05 * bump(t / 0.3) * (t < 0.3 ? 1 : 0);
        pose.head.z += -s * 0.12 * up;
        happy(ramp(0.7, 0.85, t) * (1 - ramp(1.6, 1.8, t)) * (0.6 + 0.4 * bump(u)));
        cueAt(m, 0.05, { kind: "bang", at: "crown", dx: -s * 0.18, dy: 0.08, tone: "cyan" });
        cueAt(m, 0.9, { kind: "spark", at: s < 0 ? "handR" : "handL", dx: s * 0.1, dy: 0.14 });
        cueAt(m, 1.3, { kind: "heart", at: "crown", dx: s * 0.26, dy: 0.12, tone: "pink" });
        if (m.was < 0.55 && t >= 0.55) env.askDrone("hop");
        break;
      }
      case "reach": {
        // A jump to touch the drone, the near arm as high as it goes.
        const u = hop(t, 0.3, 0.86, 0.2);
        const up = ramp(0.18, 0.4, t) * (1 - ramp(0.8, 1.15, t));
        const arm = s < 0 ? pose.armR : pose.armL;
        const far = s < 0 ? pose.armL : pose.armR;
        // Out and up toward it, the whole body leaning the same way.
        arm.z += s * 1.75 * up;
        arm.y += -s * 0.25 * up;
        far.z += -s * 0.55 * up;
        pose.spine.z += -s * 0.12 * up;
        pose.roll += -s * 0.14 * bump(u) * (t < 0.86 ? 1 : 0);
        pose.x += s * 0.03 * bump(u) * (t < 0.86 ? 1 : 0);
        pose.wide = Math.max(pose.wide, 0.6 * up);
        pose.mouth = "mouth_a";
        pose.mouthSize = mix(pose.mouthSize, 1, up);
        happy(ramp(0.9, 1.0, t) * (1 - ramp(1.25, 1.45, t)));
        cueAt(m, 0.58, {
          kind: "spark",
          at: s < 0 ? "handR" : "handL",
          dx: s * 0.06,
          dy: 0.1,
          tone: "cyan",
        });
        cueAt(m, 0.6, { kind: "lines", at: s < 0 ? "handR" : "handL", dx: s * 0.04, dy: 0.16 });
        if (m.was < 0.52 && t >= 0.52) env.askDrone("nod");
        break;
      }
      case "follow": {
        // The drone shows off; she watches it go round and comes over all dizzy.
        if (m.was < 0.15 && t >= 0.15) env.askDrone("roll");
        const round = ramp(0.2, 0.4, t) * (1 - ramp(1.2, 1.4, t));
        pose.head.z += 0.3 * Math.sin(TAU * 1.1 * (t - 0.2)) * round;
        pose.head.x += -0.16 * round;
        pose.wide = Math.max(pose.wide, 0.8 * round);
        pose.mouth = "mouth_o";
        pose.mouthSize = mix(pose.mouthSize, 0.7, round);
        const giddy = ramp(1.3, 1.5, t) * (1 - ramp(2.1, 2.5, t));
        pose.roll += 0.13 * Math.sin(TAU * 1.3 * t) * giddy;
        pose.head.z += 0.16 * Math.sin(TAU * 1.3 * t + 1) * giddy;
        pose.squeeze = giddy > 0.5 ? 1 : 0;
        pose.armL.z += 0.4 * giddy;
        pose.armR.z += -0.4 * giddy;
        cueAt(m, 1.4, { kind: "swirl", at: "crown", dx: 0, dy: 0.18, tone: "cyan" });
        break;
      }
      case "laugh": {
        // The visitor poked the drone. That is the funniest thing.
        const on = ramp(0, 0.15, t) * (1 - ramp(1.05, 1.35, t));
        pose.squash += 0.045 * Math.sin(TAU * 5.5 * t) * on;
        pose.spine.x += (-0.1 + 0.05 * Math.sin(TAU * 5.5 * t)) * on;
        pose.head.x += -0.14 * on;
        pose.armL.z += 0.25 * on;
        pose.armR.z += -0.25 * on;
        pose.armL.x += -0.5 * on;
        pose.armR.x += -0.5 * on;
        pose.foreL.y += -0.8 * on;
        pose.foreR.y += 0.8 * on;
        happy(on);
        cueAt(m, 0.1, { kind: "ha", at: "head", dx: -0.44, dy: 0.26, tone: "ink" });
        cueAt(m, 0.32, { kind: "ha", at: "head", dx: 0.46, dy: 0.34, tone: "pink", size: 0.85 });
        cueAt(m, 0.55, { kind: "ha", at: "head", dx: -0.5, dy: 0.02, tone: "ink", size: 0.7 });
        break;
      }
      case "tilt": {
        // A thought: the head to one side and back.
        const on = ramp(0, 0.35, t) * (1 - ramp(1.15, 1.6, t));
        pose.head.z += s * 0.24 * on;
        pose.spine.z += -s * 0.03 * on;
        pose.lookY = clamp(pose.lookY + 0.5 * on, -1, 1);
        break;
      }
      case "bounce": {
        // Two little bounces on the spot.
        const a = bump(t / 0.4) * (t < 0.4 ? 1 : 0);
        const b = bump((t - 0.4) / 0.4) * (t >= 0.4 && t < 0.8 ? 1 : 0);
        pose.y += 0.022 * (a + b);
        pose.squash += 0.04 * (a + b) + ring(t - 0.8, 0.04);
        pose.armL.z += 0.2 * (a + b);
        pose.armR.z += -0.2 * (a + b);
        break;
      }
    }
    void input;
  };

  /** How much of the look a move leaves her. */
  const LOOKS: Partial<Record<MoveKind, number>> = {
    spin: 0,
    dizzy: 0.15,
    dance: 0.25,
    sway: 0.4,
    follow: 0.5,
    laugh: 0.4,
  };

  const live = (input: StageInput) => {
    const dt = input.dt;
    idle();
    look(input);

    // The drone: its coming, and a game with it now and then while it stays.
    const here = input.drone?.here ?? false;
    const side = input.drone && input.drone.x < input.marks.head.x ? -1 : 1;
    sinceMeet += dt;
    if (here && !droneHere) {
      sinceDrone = 0;
      playAt = 5 + random() * 2;
      // A drone that only drifted off and came back is not met all over again.
      if (sinceMeet > MEET_AGAIN) {
        ask("meet", side);
        sinceMeet = 0;
      }
      eyesOnMe = 4;
    }
    droneHere = here;
    if (here) {
      sinceDrone += dt;
      if (sinceDrone > playAt && !move && !hovered) {
        start(plays % 2 === 0 ? "reach" : "follow", side);
        plays += 1;
        eyesOnMe = 3;
        playAt = sinceDrone + 8 + random() * 5;
      }
    }
    eyesOnMe = Math.max(0, eyesOnMe - dt);

    // A small thing of her own when nothing else is going on.
    idleAt -= dt;
    if (idleAt <= 0) {
      idleAt = 5 + random() * 5;
      if (!move && !hovered) start(random() < 0.6 ? "tilt" : "bounce", random() < 0.5 ? -1 : 1);
    }
    hoverAgain = Math.max(0, hoverAgain - dt);

    springTo(looking, move ? (LOOKS[move.kind] ?? 1) : 1, 9, dt);
    const k = looking.x;
    pose.head.y += headYaw.x * k;
    pose.head.x += headNod.x * k;
    pose.yaw += bodyYaw.x * k;
    pose.lookX = eyeX.x * k;
    pose.lookY = eyeY.x * k;
    pose.blinkL = pose.blinkR = blinking(dt);

    if (move) {
      move.was = move.t;
      move.t += dt;
      act(move, input);
      if (move.t >= move.seconds) {
        move = null;
        // What was kept for after it. A greeting kept for a drone that has gone is dropped.
        if (next && (next !== "meet" || here)) start(next, side);
        next = null;
      }
    }
  };

  const toLive = () => {
    mode = "live";
    move = null;
    next = null;
    headYaw.x = headNod.x = bodyYaw.x = eyeX.x = eyeY.x = 0;
    looking.x = 0;
  };

  return {
    step: (input) => {
      const dt = input.dt;
      time += dt;
      clearPose(pose);
      if (mode === "off") {
        // Not on the stage yet: far off its left edge.
        pose.x = -50;
        return pose;
      }
      if (mode === "intro") {
        was = clock;
        clock += dt;
        if (intro(clock)) {
          toLive();
          start("greet", input.drone && input.drone.x < input.marks.head.x ? 1 : -1);
        }
        return pose;
      }
      presses = presses.map((age) => age + dt).filter((age) => age < DIZZY_WINDOW);
      live(input);
      return pose;
    },
    begin: (input) => {
      if (mode !== "off") return;
      plan(input);
      mode = "intro";
      clock = 0;
      was = -1;
    },
    comeBack: () => {
      if (mode === "live" && !move) start("wave", -1);
    },
    press: () => {
      // While the world goes round she has no answer to give.
      if (mode !== "live" || move?.kind === "dizzy") return;
      presses.push(0);
      if (presses.length >= DIZZY_PRESSES) {
        presses = [];
        next = null;
        start("dizzy");
        return;
      }
      const kind = ANSWERS[answer % ANSWERS.length] ?? "jump";
      // A press in the middle of an answer is kept for after it; one is enough.
      if (move && move.kind !== "tilt" && move.kind !== "bounce" && move.kind !== "wave") {
        if (!next) {
          next = kind;
          answer += 1;
        }
        return;
      }
      start(kind);
      answer += 1;
    },
    hover: (over) => {
      if (over && !hovered && mode === "live" && hoverAgain <= 0) {
        if (!move || move.kind === "tilt" || move.kind === "bounce") {
          start("notice", -1);
          hoverAgain = 3;
        }
      }
      hovered = over;
    },
    dronePressed: () => {
      if (mode !== "live") return;
      if (!move || move.kind === "tilt" || move.kind === "bounce" || move.kind === "wave") {
        start("laugh");
      }
    },
    skip: () => {
      if (mode !== "live") toLive();
    },
    replay: (input) => {
      plan(input);
      mode = "intro";
      move = null;
      next = null;
      clock = 0;
      was = -1;
    },
    play: (kind) => {
      if (mode === "live" && kind in SECONDS) start(kind as MoveKind, droneHere ? 1 : -1);
    },
    wantsEyes: () => mode === "live" && eyesOnMe > 0,
    state: () => ({
      mode,
      clock,
      move: move?.kind ?? null,
      runSeconds: run.seconds,
      stood: mode === "live" || (mode === "intro" && clock >= run.seconds + TRIP + DOWN + RISE),
    }),
  };
}
