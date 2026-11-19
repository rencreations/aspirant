/**
 * The choreography of the bolt and the fall sections as one pure function of beat time. `t` runs 0 to
 * 6.6 (`stations.ts` says where the scene rests): the bolt section plays 0 to 3.3 and the fall 3.3 to
 * 6.6, on a clock, each play triggered by the scroll. Silverbolt flies the tib path (`path.ts`),
 * hovers in the middle while the pair names turn, rears at 3.3 and at 3.9 the doll that rides its
 * head is thrown off. From then on a camera follows the doll and zooms (a 2D camera in the stage's
 * pixel plane: the pixel perspective camera stays, so the actors' hit shapes stay right) and the
 * dragon, still on its path, leaves the top of the picture.
 *
 * No DOM, no three: `Journey.at(t, w, h)` fills public fields (reused, nothing is allocated).
 */
import { facing } from "../../actors/silverbolt/math";

import { keyFraction, KEY_CENTRE, KEY_FALL, newPathPoint, pathAt } from "./path";
import { BEAT, WHEEL_FROM, WHEEL_ITEMS, WHEEL_STEP } from "./stations";

const TAU = Math.PI * 2;
const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const smooth = (v: number): number => {
  const x = clamp01(v);
  return x * x * (3 - 2 * x);
};
const smoother = (v: number): number => {
  const x = clamp01(v);
  return x * x * x * (x * (x * 6 - 15) + 10);
};
/** 0 before `a`, 1 between `b` and `c`, 0 after `d`. */
function bump(t: number, a: number, b: number, c: number, d: number): number {
  return smooth((t - a) / (b - a)) * (1 - smooth((t - c) / (d - c)));
}

/** The size the dragon's body block has at the start of the path, as a share of `ref`. */
const BASE_HEIGHT = 0.24;
/** The height of the doll on the head, as a share of the dragon's body block. */
const RIDE_SHARE = 0.46;
/**
 * Joint J6, the doll at the end of the fall. The hand section starts from these two numbers
 * (`airHeight` and `airY` of `handGeometry` in `sections/hand/timeline.ts`): her height as a share of
 * the viewport height, and where her feet are, as a share of the viewport height above the middle.
 */
export const END_HEIGHT = 0.26;
export const END_FEET_Y = 0.1;
/** Her hips (the pivot of the fall) are this share of her height above her feet (0.396 of 1.7 file units). */
export const HIPS_ABOVE_FEET = 0.396 / 1.7;

/** Terminal fall speed (heights of the screen per screen of scroll) and how fast it is reached. */
const FALL_SPEED = 1.35;
const FALL_DRAG = 2.2;
/** The kick upward as the doll is thrown, in screen heights per screen of scroll. */
const THROW_UP = 0.55;
/** The camera arrives at the doll over this many screens, and the doll tumbles for this long. */
const CAMERA_SETTLE = 0.9;
const TUMBLE = 1.9;
const TUMBLE_TURNS = 1;

/** Which pair is in focus: 0 to 4 (clamped), and the continuous position of the wheel. */
export function wheelPosition(t: number): number {
  return (t - WHEEL_FROM) / WHEEL_STEP;
}

/** The faces of the doll while the pairs turn, one for each pair. */
export const PAIR_FACES = ["grin", "smug", "sparkle", "determined", "heartEyes"] as const;

/** The path parameter (0 to 1 along `path.ts`, beyond 1 after the end) at `t`. */
export function pathParam(t: number): number {
  const c = keyFraction(KEY_CENTRE);
  const f = keyFraction(KEY_FALL);
  if (t <= BEAT.enter) return 0;
  if (t < BEAT.arrive) {
    // It comes in fast from beyond the corner and brakes to a hover at the middle.
    const x = 1 - (t - BEAT.enter) / (BEAT.arrive - BEAT.enter);
    return c * (1 - x * x);
  }
  if (t <= BEAT.leave) return c;
  const x = (t - BEAT.leave) / (BEAT.at75 - BEAT.leave);
  return c + (f - c) * Math.pow(x, 1.5);
}

export class Journey {
  /** The size unit: the viewport height, or 1.5 widths on a tall narrow screen. */
  ref = 1;
  w = 1;
  h = 1;

  // The dragon, in screen pixels after the camera.
  dragonVisible = false;
  dragonX = 0;
  dragonY = 0;
  dragonHeight = 1;
  yaw = 0;
  pitch = 0;
  roll = 0;
  flyAmp = 1;
  /** 0 to 1: how much the dragon hovers (the wheel is turning). */
  hover = 0;
  /** The direction the dragon travels on the screen, radians (0 right, pi/2 up). */
  heading = 0;
  /** Screen pixels per screen of scroll along the path, 0 at rest. */
  speed = 0;

  // The doll.
  /** "ride": attached to the head. "fall": free, placed in the screen. "hidden". */
  dollMode: "hidden" | "ride" | "fall" = "hidden";
  dollX = 0;
  dollY = 0;
  dollHeight = 1;
  dollRoll = 0;
  dollPitch = 0;
  dollYaw = 0;
  /** The pose blend: `poseA` at 0, `poseB` at 1. */
  poseA: "stand" | "ride" | "scream" | "fall" = "ride";
  poseB: "stand" | "ride" | "scream" | "fall" = "ride";
  poseW = 0;
  flail = 0;
  flailRate = 1;
  talk = 0;
  /** Seconds into the fall's mood sequence (two a beat). */
  moodT = 0;
  /** True from the throw on: the fall's own mood sequence plays. */
  falling = false;
  /** 0 to 1: the doll has found her last pose (upright, still falling slowly). */
  settle = 0;
  /** The face of the dwell (one of `PAIR_FACES`), or "" outside it. */
  dwellFace: (typeof PAIR_FACES)[number] | "" = "";
  /** 0 to 1: the doll's air streaks. */
  air = 0;
  /** 0 to 1, how scared the ride is (the dragon rears before it leaves). */
  fright = 0;

  // The camera of the fall (a 2D camera on the pixel plane).
  zoom = 1;
  camX = 0;
  camY = 0;

  private readonly pa = newPathPoint();
  private readonly pb = newPathPoint();

  /** Where the doll is thrown from: above the dragon's head at the throw, in the world of the bolt section. */
  private launchX = 0;
  private launchY = 0;
  private launchVx = 0;
  private launchRideH = 1;

  private launchPoint(): void {
    const { w, h } = this;
    this.dragonWorld(BEAT.launch, w, h);
    this.launchX = this.wx;
    this.launchY = this.wy + 0.62 * this.wheight;
    this.launchRideH = RIDE_SHARE * this.wheight;
    // The dragon's own speed: a part of it carries over to the doll.
    this.dragonWorld(BEAT.launch + 0.02, w, h);
    this.launchVx = (this.wx - this.launchX) / 0.02;
  }

  /** Where the doll is in the world of the bolt section (before the camera), `u` screens after the throw. */
  private dollWorld(u: number, out: { x: number; y: number }): void {
    const k = (1 - Math.exp(-FALL_DRAG * u)) / FALL_DRAG;
    const up = THROW_UP * this.h;
    const term = FALL_SPEED * this.h;
    out.x = this.launchX + this.launchVx * 0.3 * k;
    out.y = this.launchY + (up + term) * k - term * u;
  }

  // Scratch for the world position of the dragon (before the camera).
  private wx = 0;
  private wy = 0;
  private wheight = 0;
  private wyaw = 0;
  private wpitch = 0;
  private wroll = 0;
  private whead = 0;
  private readonly dw = { x: 0, y: 0 };
  private readonly dc = { x: 0, y: 0 };

  /** The dragon in the world of the bolt section at `t` (no camera): fills the `w*` scratch fields. */
  private dragonWorld(t: number, w: number, h: number): void {
    const p = pathParam(t);
    const a = pathAt(p, this.pa);
    this.wx = a.x * w;
    this.wy = a.y * h;
    this.wheight = BASE_HEIGHT * this.ref * a.size;
    // The heading on the screen: the tangent of the path in pixels. The head is turned by it, and a
    // tall narrow screen would make every heading vertical: the head would face the lens straight on,
    // the doll would sit behind it (she hid behind the mane on a phone). So the width counts for at
    // least 1.6 heights in the turn of the head (a screen as wide as 16 to 10 is not changed by it).
    const hx = (a.tx / 1.6) * w;
    const hy = a.ty * h;
    const turnX = (a.tx / 1.6) * Math.max(w, 1.6 * h);
    const dwell = bump(t, BEAT.arrive - 0.35, BEAT.arrive, BEAT.leave, BEAT.leave + 0.35);
    const f = facing(turnX, hy, 0.3 + 0.3 * dwell);
    this.wyaw = f.yaw;
    // The head rears as the dragon is frightened, and comes down again for the sneeze.
    const rear = bump(t, BEAT.leave, BEAT.leave + 0.25, BEAT.launch - 0.15, BEAT.launch + 0.1);
    this.wpitch = f.pitch + 0.32 * rear;
    const turn = (t - BEAT.rollFrom) / (BEAT.arrive - 0.15 - BEAT.rollFrom);
    // One barrel roll on the way in. After it the angle is a whole turn, which is the same as none.
    this.wroll = (turn >= 1 ? 0 : smoother(turn) * TAU) - 0.1 * a.tx;
    this.whead = Math.atan2(hy, hx);
  }

  /** Fill every field for `t` and a viewport of `w` by `h`. */
  at(t: number, w: number, h: number): this {
    this.w = w;
    this.h = h;
    this.ref = Math.min(h, 1.5 * w);

    if (t > BEAT.launch) this.launchPoint();
    this.dragonWorld(t, w, h);
    const dwell = bump(t, BEAT.arrive - 0.35, BEAT.arrive, BEAT.leave, BEAT.leave + 0.35);
    this.hover = dwell;
    this.fright = bump(t, BEAT.leave, BEAT.leave + 0.35, BEAT.launch - 0.05, BEAT.launch + 0.05);
    this.flyAmp = 1.25 - 0.85 * dwell;
    this.yaw = this.wyaw;
    this.pitch = this.wpitch;
    this.roll = this.wroll;
    this.heading = this.whead;
    // How fast the dragon moves along the path, in pixels per screen of scroll.
    const before = pathParam(t - 0.02);
    const after = pathParam(t + 0.02);
    const pa = pathAt(before, this.pa);
    const pb = pathAt(after, this.pb);
    this.speed = Math.hypot((pb.x - pa.x) * w, (pb.y - pa.y) * h) / 0.04;

    // The camera: identity until the dragon is at 75 percent of its path (the end of the bolt section),
    // so that the joint with the fall shows the dragon at its own size. The doll is thrown a little before.
    const launch = BEAT.launch;
    const u = Math.max(0, t - launch);
    const uEnd = BEAT.end - launch;
    this.zoom = 1;
    this.camX = 0;
    this.camY = 0;
    if (t > launch) {
      this.dollWorld(u, this.dw);
      this.dollX = this.dw.x;
      this.dollY = this.dw.y;
    }
    if (t > BEAT.at75) {
      const camU = t - BEAT.at75;
      const camEnd = BEAT.end - BEAT.at75;
      const zEnd = (END_HEIGHT * h) / this.launchRideH;
      this.zoom = 1 + (zEnd - 1) * (1 - Math.pow(1 - clamp01(camU / camEnd), 3));
      // The doll's place on the screen: from where she is when the camera starts to the end state.
      this.dollWorld(BEAT.at75 - launch, this.dc);
      const endY = (END_FEET_Y + HIPS_ABOVE_FEET * END_HEIGHT) * h;
      const s = smooth(camU / CAMERA_SETTLE);
      const sx = this.dc.x + (0 - this.dc.x) * s;
      const sy = this.dc.y + (endY - this.dc.y) * s;
      this.camX = this.dw.x - sx / this.zoom;
      this.camY = this.dw.y - sy / this.zoom;
      this.dollX = sx;
      this.dollY = sy;
    }

    // The dragon on the screen.
    const z = this.zoom;
    this.dragonX = (this.wx - this.camX) * z;
    this.dragonY = (this.wy - this.camY) * z;
    this.dragonHeight = this.wheight * z;
    const margin = this.dragonHeight * 2.4;
    this.dragonVisible =
      t > BEAT.enter - 0.04 &&
      this.dragonX > -w / 2 - margin &&
      this.dragonX < w / 2 + margin &&
      this.dragonY > -h / 2 - margin &&
      this.dragonY < h / 2 + margin;

    this.doll(t, u, uEnd);
    return this;
  }

  private doll(t: number, u: number, uEnd: number): void {
    const rideH = RIDE_SHARE * this.wheight;
    this.air = 0;
    this.talk = 0;
    this.flail = 0;
    this.flailRate = 1;
    this.moodT = 0;
    this.falling = false;
    this.settle = 0;
    this.dwellFace = "";
    this.dollRoll = 0;
    this.dollPitch = 0;
    this.dollYaw = 0;
    if (t < BEAT.enter - 0.04) {
      this.dollMode = "hidden";
      return;
    }
    if (t <= BEAT.launch) {
      this.dollMode = "ride";
      this.dollHeight = rideH;
      // Riding: arms up while the dragon flies, a firm seat while it hovers, clinging when it rears.
      this.poseA = "ride";
      this.poseB = "scream";
      this.poseW = 0.25 * (1 - this.hover) + 0.55 * this.fright;
      this.talk = 0.5 * (1 - this.hover);
      this.flail = 0;
      if (t >= WHEEL_FROM - 0.05 && t <= BEAT.leave + 1e-6) {
        const i = Math.round(Math.min(WHEEL_ITEMS - 1, Math.max(0, wheelPosition(t))));
        this.dwellFace = PAIR_FACES[i]!;
      }
      return;
    }
    // Thrown, then falling.
    this.dollMode = "fall";
    this.falling = true;
    this.moodT = u * 2;
    this.dollHeight = this.launchRideH * this.zoom;
    const tumble = 1 - Math.pow(1 - clamp01(u / TUMBLE), 3);
    this.dollRoll = TAU * TUMBLE_TURNS * (1 - tumble);
    // The fall pose lies face up: tip her toward the camera while she falls, upright again at the end.
    this.dollPitch = 0.8 * smooth(u / 0.5) * (1 - smooth((u - 1.2) / (uEnd - 1.2)));
    this.dollYaw = 0.5 * Math.sin(u * 3.1) * (1 - smooth(u / (uEnd * 0.8)));
    const toFall = smooth(u / 0.5);
    const settle = smooth((u - 1.4) / (uEnd - 1.4));
    this.settle = settle;
    if (u < 1.4) {
      this.poseA = "scream";
      this.poseB = "fall";
      this.poseW = toFall;
    } else {
      this.poseA = "fall";
      this.poseB = "stand";
      this.poseW = 0.7 * settle;
    }
    // A quarter of the way to standing, a little flail, slow: what the hand section goes on from (J6).
    this.flail = smooth(u / 0.35) * (1 - 0.8 * settle);
    this.flailRate = 1.4 - 0.8 * settle;
    this.talk = smooth((u - 0.4) / 0.3) * (1 - smooth((u - 1.7) / 0.5)) * 0.85;
    // The streaks thin out as the fall ends and are gone at the rest (half a beat before the end).
    this.air = smooth(u / 0.4) * (1 - 0.75 * settle) * (1 - smooth((t - (BEAT.end - 0.5)) / 0.5));
  }
}

/**
 * The moods of the fall, in seconds of `Journey.moodT`: shocked, scared, a scream, worry, then resigned.
 * The last one is held, so she is resigned at the end (the hand section's first face, joint J6; it
 * turns to scared when the palm comes close).
 */
export const FALL_MOODS = [
  { face: "shocked", hold: 0.4 },
  { face: "scared", hold: 0.9, blend: 0.1 },
  { face: "scream", hold: 1.9, blend: 0.1 },
  { face: "worried", hold: 1.2, blend: 0.4 },
  { face: "gloom", hold: 9, blend: 0.5 },
] as const;
