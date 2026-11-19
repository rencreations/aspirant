/**
 * What the doll does while she rides: a small seeded state machine, pure (no three.js, no clock of
 * its own, nothing allocated per step). It says WHAT she does; `ride.ts` turns it into bones and
 * `ride-physics.ts` into springs.
 *
 *   sit      still, breathing, a slight sway (the rest state, most of the time)
 *   look     her head sweeps round to look about
 *   fidget   a small kick of the legs and a tilt of the head
 *   adjust   shifts her seat a little and takes a new grip (the grip eases open and closed)
 *   slip     close to falling: slides to one side, the arms flail, scared
 *   recover  pulls herself back, relieved. Always follows `slip` and a `strain`
 *   strain   the dragon shakes hard: she holds on with effort (the grip tightens and trembles)
 *   gone     the grip is lost: the arms fly up (the fall takes over from here)
 *
 * Every state has a finite length. A rare state that the dice have not picked for a long time is
 * forced, so a probe sees every one of them within a fixed time. The same seed gives the same life.
 */
import type { FaceName } from "./face/presets";

export type IdleName =
  "sit" | "look" | "fidget" | "adjust" | "slip" | "recover" | "strain" | "gone";

export const IDLE_NAMES: readonly IdleName[] = [
  "sit",
  "look",
  "fidget",
  "adjust",
  "slip",
  "recover",
  "strain",
  "gone",
];

/** The most one step may advance the machine: a long frame (a hidden tab) must not skip a whole state. */
export const MAX_STEP = 0.25;

/** The length of each state, in seconds: [min, max]. `sit` is the pause between the others. */
export const LENGTH: Readonly<Record<IdleName, readonly [number, number]>> = {
  sit: [1.6, 3.8],
  look: [1.5, 2.3],
  fidget: [0.9, 1.4],
  adjust: [1.2, 1.7],
  slip: [1.1, 1.3],
  recover: [0.8, 1.0],
  strain: [0.5, 1e9],
  gone: [1e9, 1e9],
};

/** A state that has not come up for this many seconds is chosen next (the dice may pick it earlier). */
export const FORCE_AFTER = 13;
/** The least time between two slips, seconds. */
export const SLIP_GAP = 8;
/** The envelope of the dragon's shake at which she starts to strain, and below which she stops. */
export const STRAIN_ON = 0.28;
export const STRAIN_OFF = 0.12;

/** What the machine asks of her body, in units that do not depend on her size. */
export interface Cue {
  name: IdleName;
  /** Seconds in this state, and its length. */
  t: number;
  len: number;
  /** 0 to 1 through the state. */
  u: number;
  /** The grip: 1 holds tight, 0 lets go. */
  grip: number;
  /** A shift of her seat in her heights: x to the right of the screen, y up. */
  shiftX: number;
  shiftY: number;
  /** A slide off the seat to the side, -1 to 1 (toward her left is positive): the body tips and drops. */
  slide: number;
  /** The arms flail, 0 to 1. */
  flail: number;
  /** A kick of the legs, 0 to 1. */
  legs: number;
  /** The head tilts (radians, positive to her left) and turns about (-1 to 1, a sweep to look round). */
  tilt: number;
  sweep: number;
  /** How hard she trembles holding on, 0 to 1. */
  tremble: number;
  /** The face for this moment. */
  face: FaceName;
}

export interface StepInput {
  /** The dragon's shake envelope, 0 to 1. */
  shake: number;
  /** The section called `loseGrip`. */
  lostGrip: boolean;
}

/** A small deterministic generator (mulberry32). */
export class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0;
  }
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(lo: number, hi: number): number {
    return lo + (hi - lo) * this.next();
  }
}

const smooth = (x: number): number => {
  const t = x < 0 ? 0 : x > 1 ? 1 : x;
  return t * t * (3 - 2 * t);
};
/** A bump: 0 at both ends, 1 in the middle, eased. */
const bump = (u: number): number => Math.sin(Math.PI * (u < 0 ? 0 : u > 1 ? 1 : u)) ** 2;

const SIT_FACES: readonly FaceName[] = ["smile", "neutral", "smile", "smug"];

export class RideBehaviour {
  private readonly rng: Rng;
  private name: IdleName = "sit";
  private t = 0;
  private len: number;
  /** Seconds since each state last ran (for the forcing), the side of the last slip, the choices made. */
  private readonly since: Record<IdleName, number> = {
    sit: 0,
    look: 0,
    fidget: 0,
    adjust: 0,
    slip: 0,
    recover: 0,
    strain: 0,
    gone: 0,
  };
  private side = 1;
  private sideSwap = 1;
  private sitFace: FaceName = "smile";
  private lastKind: IdleName = "sit";
  private strained = false;
  readonly cue: Cue = {
    name: "sit",
    t: 0,
    len: 1,
    u: 0,
    grip: 1,
    shiftX: 0,
    shiftY: 0,
    slide: 0,
    flail: 0,
    legs: 0,
    tilt: 0,
    sweep: 0,
    tremble: 0,
    face: "smile",
  };

  constructor(seed = 1) {
    this.rng = new Rng(seed);
    // A first moment of calm: the first state is a short pause.
    this.len = 1.2;
    this.sitFace = this.pickSitFace();
  }

  /** The state now. */
  get state(): IdleName {
    return this.name;
  }

  /** Start over from the beginning of the same life (a seat taken again). */
  restart(): void {
    this.name = "sit";
    this.t = 0;
    this.len = 1.2;
    this.strained = false;
    for (const k of IDLE_NAMES) this.since[k] = 0;
  }

  /** Move to a state and draw its length. */
  private enter(name: IdleName): void {
    this.name = name;
    this.t = 0;
    const [lo, hi] = LENGTH[name];
    this.len = name === "strain" || name === "gone" ? lo : this.rng.range(lo, hi);
    this.since[name] = 0;
    if (name === "slip") {
      this.side = this.sideSwap;
      this.sideSwap = -this.sideSwap;
    }
    if (name === "sit") this.sitFace = this.pickSitFace();
  }

  private pickSitFace(): FaceName {
    return SIT_FACES[Math.floor(this.rng.next() * SIT_FACES.length) % SIT_FACES.length] ?? "smile";
  }

  /** What comes after a rest. */
  private choose(): IdleName {
    const s = this.since;
    // A state that has not run for a long time goes first (the rare one, the oldest).
    const due: IdleName[] = (["slip", "adjust", "look", "fidget"] as const).filter(
      (k) => s[k] > FORCE_AFTER && k !== this.lastKind && (k !== "slip" || s.slip > SLIP_GAP),
    );
    if (due.length > 0) {
      let oldest = due[0] ?? "look";
      for (const k of due) if (s[k] > s[oldest]) oldest = k;
      return oldest;
    }
    const r = this.rng.next();
    const slipOk = s.slip > SLIP_GAP && this.lastKind !== "slip";
    const wSlip = slipOk ? 0.1 : 0;
    const pick = r * (0.9 + wSlip);
    if (pick < 0.32 && this.lastKind !== "look") return "look";
    if (pick < 0.6 && this.lastKind !== "fidget") return "fidget";
    if (pick < 0.9 && this.lastKind !== "adjust") return "adjust";
    return slipOk ? "slip" : this.lastKind === "look" ? "fidget" : "look";
  }

  /** Advance by `dt` seconds and return the cue (the same object every time: read it, do not keep it). */
  step(dt: number, input: StepInput): Cue {
    const d = dt > 0 ? Math.min(dt, MAX_STEP) : 0;
    for (const k of IDLE_NAMES) this.since[k] += d;
    this.since[this.name] = 0;
    this.t += d;

    if (this.name !== "gone") {
      if (input.lostGrip) {
        this.enter("gone");
      } else if (this.name !== "strain" && input.shake > STRAIN_ON) {
        this.enter("strain");
        this.strained = true;
      } else if (this.name === "strain" && input.shake < STRAIN_OFF && this.t >= this.len) {
        this.enter("recover");
      } else if (this.name !== "strain" && this.t >= this.len) {
        this.advance();
      }
    }
    return this.fill();
  }

  /** The state ran out: pick the next one. */
  private advance(): void {
    const from = this.name;
    switch (from) {
      case "sit":
        this.enter(this.choose());
        break;
      case "slip":
        this.lastKind = "slip";
        this.enter("recover");
        break;
      case "recover":
        // Always settles into a re-grip.
        this.enter("adjust");
        break;
      default:
        this.lastKind = from;
        this.enter("sit");
        break;
    }
  }

  private fill(): Cue {
    const c = this.cue;
    const u = this.len < 1e8 ? Math.min(1, this.t / this.len) : 0;
    c.name = this.name;
    c.t = this.t;
    c.len = this.len;
    c.u = u;
    c.grip = 1;
    c.shiftX = 0;
    c.shiftY = 0;
    c.slide = 0;
    c.flail = 0;
    c.legs = 0;
    c.tilt = 0;
    c.sweep = 0;
    c.tremble = 0;
    c.face = this.sitFace;
    switch (this.name) {
      case "sit":
        c.tilt = 0.03 * Math.sin(this.t * 0.9);
        break;
      case "look": {
        // Left, right, back to the front: a sweep of the head with a slow turn of the eyes.
        c.sweep = Math.sin(u * Math.PI * 2) * (0.5 + 0.5 * bump(u)) * this.sideSwap;
        c.tilt = 0.08 * Math.sin(u * Math.PI);
        c.face = u > 0.3 && u < 0.75 ? "neutral" : this.sitFace;
        break;
      }
      case "fidget": {
        // Two small kicks and a head tilt.
        const k = bump(u * 2 > 1 ? u * 2 - 1 : u * 2);
        c.legs = k;
        c.tilt = 0.14 * bump(u);
        c.face = "smug";
        break;
      }
      case "adjust": {
        // Slides a little up and toward the front, and the grip eases open and takes hold again.
        const b = bump(u);
        c.shiftX = 0.05 * b * this.sideSwap;
        c.shiftY = 0.035 * b;
        c.grip = 1 - 0.7 * smooth(u * 3) * (1 - smooth((u - 0.45) * 3));
        c.face = "determined";
        break;
      }
      case "slip": {
        // Slides off to one side (fast), hangs at the edge, the arms windmill.
        const k = smooth(u / 0.4) * (1 - 0.35 * smooth((u - 0.7) / 0.3));
        c.slide = this.side * k;
        c.flail = 0.9 * smooth(u / 0.25) * (1 - smooth((u - 0.75) / 0.25));
        c.grip = 1 - 0.85 * smooth(u / 0.3) * (1 - smooth((u - 0.8) / 0.2));
        c.legs = 0.6 * bump(u);
        c.face = "scared";
        break;
      }
      case "recover": {
        // Hauls herself back: the slide goes to nothing, the grip comes back, a long breath out.
        const k = 1 - smooth(u / 0.7);
        c.slide = this.side * 0.65 * k;
        c.grip = 0.3 + 0.7 * smooth(u / 0.6);
        c.flail = 0.35 * k;
        c.face = u < 0.35 ? "shocked" : "smile";
        break;
      }
      case "strain": {
        c.grip = 1;
        c.tremble = Math.min(1, 0.3 + this.t * 2);
        c.legs = 0.7;
        c.flail = 0.3;
        c.face = "scared";
        break;
      }
      case "gone": {
        const k = smooth(this.t / 0.12);
        c.grip = 1 - k;
        c.flail = 0.5 + 0.5 * k;
        c.legs = 1;
        c.slide = 0.4 * k * this.side;
        c.face = "scream";
        break;
      }
    }
    return c;
  }

  /** Whether the machine was ever pushed into `strain` (a probe reads it). */
  get wasStrained(): boolean {
    return this.strained;
  }
}
