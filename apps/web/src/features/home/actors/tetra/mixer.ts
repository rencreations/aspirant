import { clamp01, springTo, type Sprung } from "./ease";
import { type Channels, copyChannels, mixChannels, restChannels } from "./channels";
import { composePose, createPoseInput, type PoseInput, type PoseName } from "./poses";

/**
 * Which pose she wears and how fast she changes into another. A section names one pose and how
 * strongly it is worn (0 is the plain standing rest, 1 the whole pose) every frame it shows her:
 * the mixer keeps a weight for every pose, springs each toward what is asked, and blends the poses
 * that still have weight, so a cut from one pose to another is a quick turn of the body and never
 * a pop, and a blend that a scroll drives is followed closely.
 */
const NAMES: readonly PoseName[] = [
  "idle",
  "kite",
  "run",
  "pant",
  "wave",
  "sit",
  "read",
  "close",
  "stand",
  "bend",
  "pat",
  "hug",
];

/** How quick a pose comes on or goes off (radians a second): about a quarter of a second. */
const OMEGA = 13;
/** Below this a pose has no say and is not computed. */
const GONE = 0.002;

export class PoseMixer {
  readonly input: PoseInput = createPoseInput();
  private readonly weights = new Map<PoseName, Sprung>();
  private readonly goal = new Map<PoseName, number>();
  private readonly scratch = restChannels();
  private name: PoseName = "idle";
  private blend = 1;

  constructor() {
    for (const n of NAMES) {
      this.weights.set(n, { x: n === "idle" ? 1 : 0, v: 0 });
      this.goal.set(n, n === "idle" ? 1 : 0);
    }
  }

  /** The pose asked for and its strength. */
  set(name: PoseName, blend = 1): void {
    this.name = name;
    this.blend = clamp01(blend);
  }

  /** The pose asked for. */
  get current(): PoseName {
    return this.name;
  }

  get strength(): number {
    return this.blend;
  }

  /** The weight each pose has now, for a probe. */
  weightOf(name: PoseName): number {
    return this.weights.get(name)?.x ?? 0;
  }

  /** Put every weight on what is asked at once (a jump, the first frame). */
  snap(): void {
    this.updateGoals();
    for (const n of NAMES) {
      const w = this.weights.get(n);
      if (w) {
        w.x = this.goal.get(n) ?? 0;
        w.v = 0;
      }
    }
  }

  private updateGoals(): void {
    for (const n of NAMES) this.goal.set(n, 0);
    if (this.name === "idle") {
      this.goal.set("idle", 1);
    } else {
      this.goal.set(this.name, this.blend);
      this.goal.set("idle", 1 - this.blend);
    }
  }

  /** Step the weights, then blend the poses that have weight into `out`. */
  step(dt: number, out: Channels): void {
    this.updateGoals();
    for (const n of NAMES) {
      const w = this.weights.get(n);
      if (w) springTo(w, this.goal.get(n) ?? 0, OMEGA, dt);
    }
    this.compose(out);
  }

  /** Blend without stepping (a probe, a frozen frame). */
  compose(out: Channels): void {
    let total = 0;
    let first = true;
    for (const n of NAMES) {
      const w = Math.max(0, this.weights.get(n)?.x ?? 0);
      if (w < GONE) continue;
      composePose(n, this.input, this.scratch);
      if (first) {
        copyChannels(out, this.scratch);
        first = false;
        total = w;
      } else {
        mixChannels(out, out, this.scratch, w / (total + w));
        total += w;
      }
    }
    if (first) composePose("idle", this.input, out);
  }
}
