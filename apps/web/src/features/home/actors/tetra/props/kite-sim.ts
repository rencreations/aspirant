import { TAU, clamp, makeRandom, springTo, type Sprung } from "../ease";
import { KITE_ASPECT, KITE_KNOT_V } from "../model";

import {
  type Chain,
  type Forces,
  createChain,
  createForces,
  cutChain,
  layChain,
  nearestOnChain,
  stepChain,
} from "./rope";

/**
 * The kite and its rope, as a simulation in the stage's pixels (the origin in the middle of the
 * screen, y UP). Pure arithmetic, no three.
 *
 * Tethered: the rope is a chain from her hand to the kite's knot. The knot is pulled toward a spot
 * in the sky that a section names (with a slow bob and drift of the wind on it), and the rope is a
 * little longer than the way there, so it hangs in a calm curve and does not stretch. The sail
 * leans along the line of the rope and flutters. A tail of three bows trails from its foot.
 *
 * Cut (`cut(at, outcome)`): the rope breaks at a fraction of its length. The lower part stays in her
 * hand and drops, swinging. The upper part stays on the kite. With `outcome: "fall"` the kite comes
 * down: no more lift, a drift like a leaf with the sail swinging, a landing on the floor if one is
 * set. With `"fly"` it is let go and the wind takes it up and away.
 *
 * The solver runs at a fixed step, so a frame of any length gives the same line.
 */
export type CutOutcome = "fall" | "fly";

export interface KiteSpot {
  /** The middle of the sail's knot. */
  x: number;
  y: number;
  /** How tall the sail is, in pixels. */
  height: number;
}

export type KiteState = "tethered" | "cut";

const STEP = 1 / 120;
const MAX_STEPS = 8;
export const ROPE_POINTS = 44;
const TAIL_POINTS = 8;
/** How much longer the rope is than the way to the kite: the calm sag. */
const SLACK = 1.045;
/** How heavy the rope is, in pixels a second squared. */
const ROPE_GRAVITY = 160;
/** The tail's length, in sail heights. */
const TAIL_HEIGHTS = 1.25;
/** How hard the knot is pulled to its spot (per second squared per pixel). */
const PULL = 160;

export interface KiteLook {
  /** The sail's middle, its turn (radians, counter clockwise) and its height, in pixels. */
  x: number;
  y: number;
  roll: number;
  height: number;
  width: number;
  /** A slow swing of the sail in and out of the screen, for the flutter in the shader. */
  flutter: number;
  /** Where the tail hangs from (the sail's foot). */
  footX: number;
  footY: number;
}

export class KiteSim {
  readonly rope: Chain = createChain(ROPE_POINTS);
  /** The part of the rope that stayed in her hand after a cut. */
  readonly lower: Chain = createChain(ROPE_POINTS);
  /** The part that stayed on the kite after a cut. */
  readonly upper: Chain = createChain(ROPE_POINTS);
  readonly tail: Chain = createChain(TAIL_POINTS);
  readonly look: KiteLook = {
    x: 0,
    y: 0,
    roll: 0,
    height: 200,
    width: 200 * KITE_ASPECT,
    flutter: 0,
    footX: 0,
    footY: 0,
  };

  state: KiteState = "tethered";
  outcome: CutOutcome = "fall";
  /** Seconds since the cut. */
  sinceCut = 0;

  private readonly forces: Forces = createForces();
  private readonly tailForces: Forces = createForces();
  private readonly roll: Sprung = { x: 0, v: 0 };
  private readonly spin: Sprung = { x: 0, v: 0 };
  private readonly spot: KiteSpot = { x: 0, y: 400, height: 200 };
  private readonly hand = { x: 0, y: 0 };
  readonly contact = { index: -1, x: 0, y: 0 };
  private floor: number | null = null;
  private clock = 0;
  private pending = 0;
  private started = false;
  private readonly random: () => number;
  private linkNow = 1;
  private escape = 1;

  constructor(seed = 7) {
    this.random = makeRandom(seed);
    this.forces.iterations = 20;
  }

  /** The ground, in the stage's y (a cut kite lands on it), or null for none. */
  setFloor(y: number | null): void {
    this.floor = y;
  }

  /** Where the kite wants to be, and how big. Set it every frame it is shown. */
  setSpot(x: number, y: number, height: number): void {
    this.spot.x = x;
    this.spot.y = y;
    this.spot.height = Math.max(8, height);
  }

  /** Where the rope is held (the reel in her hand). Set it every frame. */
  setHand(x: number, y: number): void {
    this.hand.x = x;
    this.hand.y = y;
  }

  /** The kite's own bob and drift on the wind at a time, as an offset from its spot (pixels). */
  private wind(t: number, out: { x: number; y: number }): void {
    const h = this.spot.height;
    out.x = h * (0.1 * Math.sin(TAU * 0.29 * t) + 0.05 * Math.sin(TAU * 0.83 * t + 1.3));
    out.y = h * (0.07 * Math.sin(TAU * 0.23 * t + 2) + 0.035 * Math.sin(TAU * 0.71 * t));
  }
  private readonly sway = { x: 0, y: 0 };

  /** Lay the rope straight and taut from the hand to the kite's spot: the first frame, or a jump. */
  reset(): void {
    this.contact.index = -1;
    this.state = "tethered";
    this.sinceCut = 0;
    this.lower.n = 0;
    this.upper.n = 0;
    this.wind(this.clock, this.sway);
    const kx = this.spot.x + this.sway.x;
    const ky = this.spot.y + this.sway.y;
    // The rope hangs from the hand in a shallow curve: laid on the line, then it settles.
    layChain(this.rope, ROPE_POINTS, this.hand.x, this.hand.y, kx, ky);
    this.linkNow = this.rope.link * SLACK;
    this.rope.link = this.linkNow;
    this.rope.pin = { x: this.hand.x, y: this.hand.y };
    this.roll.x = 0;
    this.roll.v = 0;
    this.spin.x = 0;
    this.spin.v = 0;
    const l = this.tail;
    const th = this.spot.height * TAIL_HEIGHTS;
    layChain(l, TAIL_POINTS, kx, ky - this.spot.height * 0.5, kx, ky - this.spot.height * 0.5 - th);
    l.pin = { x: kx, y: ky - this.spot.height * 0.5 };
    this.started = true;
    this.readLook(0);
    this.settle(1.2);
  }

  /** Run the world this many seconds at once (a jump past the cut, a probe). */
  settle(seconds: number): void {
    for (let t = 0; t < seconds; t += STEP) this.step(STEP);
  }

  /** The rope breaks at `at` (0 at the hand, 1 at the kite). Does nothing when it is cut already. */
  cut(at: number, outcome: CutOutcome = "fall"): void {
    if (this.state === "cut") return;
    // A rope that was never drawn is laid first, so a cut on the first frame still cuts.
    if (!this.started) this.reset();
    const k = Math.round(clamp(at, 0.1, 0.9) * (this.rope.n - 1));
    this.state = "cut";
    this.outcome = outcome;
    this.sinceCut = 0;
    cutChain(this.rope, k, this.lower, this.upper);
    // The lower part is in her hand and hangs: no pull, a little air.
    this.escape = this.random() < 0.5 ? -1 : 1;
    if (outcome === "fly") {
      // Let go: the kite is flung along the line it was pulling on.
      const n = this.upper.n;
      const dx = (this.upper.x[n - 1] ?? 0) - (this.upper.x[Math.max(0, n - 3)] ?? 0);
      this.escape = dx < 0 ? -1 : 1;
    }
  }

  /**
   * Where on the rope a point of the screen is nearest: `at` from 0 (her hand) to 1 (the kite) and the
   * distance in pixels. False once the rope is cut. A section that has Silverbolt cross the rope asks
   * it every frame and cuts when the distance is small.
   */
  nearest(x: number, y: number, out: { at: number; dist: number }): boolean {
    if (this.state === "cut" || !this.started) return false;
    return nearestOnChain(this.rope, x, y, out);
  }

  /** One frame. The step is fixed; the rest of the frame is carried to the next. */
  step(dt: number): void {
    if (!this.started) this.reset();
    this.pending = Math.min(this.pending + dt, MAX_STEPS * STEP);
    while (this.pending >= STEP) {
      this.pending -= STEP;
      this.one(STEP);
    }
    this.readLook(dt);
  }

  private one(h: number): void {
    this.clock += h;
    const f = this.forces;
    f.floor = this.floor;
    f.windX = 0;
    f.windY = 0;
    if (this.state === "tethered") {
      this.wind(this.clock, this.sway);
      this.rope.pin = this.hand;
      // The rope's length follows the way to the kite, a little slack, smoothly.
      const way = Math.hypot(this.spot.x - this.hand.x, this.spot.y - this.hand.y);
      const want = (way * SLACK) / (ROPE_POINTS - 1);
      this.linkNow += (want - this.linkNow) * Math.min(1, 6 * h);
      this.rope.link = this.linkNow;
      f.gravity = ROPE_GRAVITY;
      f.damp = 1.6;
      f.tipPull = PULL;
      f.tipX = this.spot.x + this.sway.x;
      f.tipY = this.spot.y + this.sway.y;
      f.tipPushX = 0;
      // The sail's lift carries the weight of the rope, so the knot hangs at its spot.
      f.tipPushY = 0.5 * ROPE_POINTS * ROPE_GRAVITY;
      stepChain(this.rope, h, f, this.contact.index >= 0 ? this.contact : undefined);
    } else {
      this.sinceCut += h;
      // The lower part hangs from her hand and swings: free at the cut end.
      this.lower.pin = this.hand;
      const lf = this.tailForces;
      lf.floor = this.floor;
      lf.gravity = 1300;
      lf.damp = 0.9;
      lf.tipPull = 0;
      lf.windX = 20 * Math.sin(TAU * 0.4 * this.clock);
      lf.windY = 0;
      lf.tipPushX = 0;
      lf.tipPushY = 0;
      stepChain(this.lower, h, lf);
      // The upper part follows the kite.
      f.tipPull = 0;
      if (this.outcome === "fly") {
        // Let go: the wind takes it up and away, harder the longer it has been free.
        const ramp = Math.min(1, this.sinceCut / 0.6);
        f.gravity = 120;
        f.damp = 0.35;
        f.windX = this.escape * 380 * ramp;
        f.windY = 520 * ramp;
        f.tipPushX = this.escape * 260 * ramp;
        f.tipPushY = 700 * ramp;
      } else {
        // Down: light and drifting, the sail catching the air, never quick.
        f.gravity = 520;
        f.damp = 2.6;
        f.windX = this.escape * 90 * Math.sin(TAU * 0.5 * this.sinceCut + 0.3);
        f.windY = 0;
        f.tipPushX = 0;
        f.tipPushY = 0;
      }
      stepChain(this.upper, h, f);
    }
    // The tail hangs from the sail's foot.
    const tf = this.tailForces;
    if (this.state === "tethered") {
      tf.floor = null;
      tf.gravity = 380;
      tf.damp = 1.6;
      tf.tipPull = 0;
      tf.windX = 140 * Math.sin(TAU * 0.5 * this.clock) + 60 * Math.sin(TAU * 1.3 * this.clock + 1);
      tf.windY = 40 * Math.sin(TAU * 0.7 * this.clock + 0.6);
      tf.tipPushX = 0;
      tf.tipPushY = 0;
    } else {
      tf.floor = this.floor;
      tf.gravity = 900;
      tf.damp = 1.2;
      tf.windX = 0;
      tf.windY = 0;
    }
    const pin = this.tail.pin ?? (this.tail.pin = { x: 0, y: 0 });
    pin.x = this.look.footX;
    pin.y = this.look.footY;
    stepChain(this.tail, h, tf);
  }

  /** The kite's own end: the last point of the rope, or of the upper part after a cut. */
  private knot(out: { x: number; y: number; px: number; py: number }): void {
    const c = this.state === "tethered" ? this.rope : this.upper;
    const n = c.n;
    out.x = c.x[n - 1] ?? 0;
    out.y = c.y[n - 1] ?? 0;
    out.px = c.x[Math.max(0, n - 3)] ?? 0;
    out.py = c.y[Math.max(0, n - 3)] ?? 0;
  }
  private readonly k = { x: 0, y: 0, px: 0, py: 0 };

  /** The sail's turn and place for the frame: it leans along the line of the rope and flutters. */
  private readLook(dt: number): void {
    const k = this.k;
    this.knot(k);
    const l = this.look;
    l.height = this.spot.height;
    l.width = l.height * KITE_ASPECT;
    let target = 0;
    if (this.state === "tethered") {
      const dx = k.x - k.px;
      const dy = k.y - k.py;
      target = -Math.atan2(dx, Math.max(1e-3, dy)) * 0.85;
      target += 0.1 * Math.sin(TAU * 0.47 * this.clock) + 0.05 * Math.sin(TAU * 1.9 * this.clock);
      springTo(this.roll, target, 7, dt || STEP);
    } else if (this.outcome === "fly") {
      // Tumbling as it goes.
      this.spin.x += this.escape * 3.2 * (dt || 0);
      this.roll.x = this.spin.x;
    } else {
      // A leaf: swings side to side as it comes down, and lies flat on the ground.
      const landed = this.floor !== null && k.y <= this.floor + l.height * 0.7;
      target = landed
        ? this.escape * 1.45
        : 0.55 * Math.sin(TAU * 0.45 * this.sinceCut + 1) * this.escape;
      springTo(this.roll, target, landed ? 5 : 3.5, dt || STEP);
    }
    l.roll = this.roll.x;
    // The knot is where the string is tied, KITE_KNOT_V from the top: the middle is a little above it.
    const up = (KITE_KNOT_V - 0.5) * l.height;
    l.x = k.x - Math.sin(l.roll) * up;
    l.y = k.y + Math.cos(l.roll) * up;
    // The foot is the bottom of the sail along its own down line.
    l.footX = l.x + Math.sin(l.roll) * 0.5 * l.height;
    l.footY = l.y - Math.cos(l.roll) * 0.5 * l.height;
    l.flutter = this.clock;
  }
}
