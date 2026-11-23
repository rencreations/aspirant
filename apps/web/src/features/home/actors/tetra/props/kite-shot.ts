import type { KiteLook, KiteSim, KiteSpot } from "./kite-sim";
import type { Chain } from "./rope";

interface Point {
  x: number;
  y: number;
}

export interface KiteShot {
  offsetY: number;
  along: number;
  pressure: number;
  broken: boolean;
  fall: number;
  releaseHand: Point;
  /** Project the posed snout into the same plane as the reel. */
  nose(out: Point): void;
}

const FPS = 30;
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

function captureChain(chain: Chain): Float32Array {
  const points = new Float32Array(chain.n * 2);
  for (let i = 0; i < chain.n; i++) {
    points[2 * i] = chain.x[i]!;
    points[2 * i + 1] = chain.y[i]!;
  }
  return points;
}

function drawChain(
  chain: Chain,
  a: Float32Array,
  b: Float32Array,
  t: number,
  dx = 0,
  dy = 0,
): void {
  for (let i = 0; i < chain.n; i++) {
    chain.x[i] = mix(a[2 * i]!, b[2 * i]!, t) + dx;
    chain.y[i] = mix(a[2 * i + 1]!, b[2 * i + 1]!, t) + dy;
  }
}

function capture(sim: KiteSim) {
  return {
    lower: captureChain(sim.lower),
    upper: captureChain(sim.upper),
    tail: captureChain(sim.tail),
    look: { ...sim.look },
  };
}
type Sample = ReturnType<typeof capture>;
const lookKeys: ReadonlyArray<keyof KiteLook> = [
  "x",
  "y",
  "roll",
  "height",
  "width",
  "flutter",
  "footX",
  "footY",
];

function drawSample(sim: KiteSim, a: Sample, b: Sample, t: number, dx = 0, dy = 0): void {
  drawChain(sim.lower, a.lower, b.lower, t, dx, dy);
  drawChain(sim.upper, a.upper, b.upper, t);
  drawChain(sim.tail, a.tail, b.tail, t);
  for (const key of lookKeys) sim.look[key] = mix(a.look[key], b.look[key], t);
}

/** Simulate the flying kite live. Keep the loose strands' trajectory so scrolling can reverse the cut. */
export class KiteShotPlayer {
  private height = 0;
  private readonly frames: Sample[] = [];
  private readonly nose = { x: 0, y: 0 };
  private readonly anchor = { x: 0, y: 0 };
  private duration = 0;

  reset(): void {
    this.frames.length = 0;
    this.height = 0;
  }

  update(sim: KiteSim, hand: Point, spot: KiteSpot, shot: KiteShot, dt: number): void {
    const hy = hand.y - shot.offsetY;
    const rebuild = this.height !== spot.height || (!shot.broken && sim.state === "cut");
    if (rebuild) {
      this.reset();
      this.height = spot.height;
    }
    if (!this.frames.length) {
      if (!shot.broken) {
        this.anchor.x = hand.x;
        this.anchor.y = hy;
      } else if (rebuild) {
        Object.assign(this.anchor, shot.releaseHand);
      }
      sim.setHand(this.anchor.x, this.anchor.y);
      sim.setSpot(spot.x, spot.y, spot.height);
      if (rebuild) sim.reset();
      if (shot.pressure > 0) {
        const node = Math.round(shot.along * (sim.rope.n - 1));
        shot.nose(this.nose);
        sim.contact.index = node;
        sim.contact.x = mix(sim.rope.x[node]!, this.nose.x, shot.pressure);
        sim.contact.y = mix(sim.rope.y[node]!, this.nose.y, shot.pressure);
      } else sim.contact.index = -1;
      sim.step(shot.broken ? 1 / FPS : dt);
      if (!shot.broken) return;
      sim.cut(shot.along);
      this.frames.push(capture(sim));
      this.duration = Math.max(2.5, (spot.y - this.anchor.y + spot.height * 4) / 180 + 1);
    }
    const position = shot.fall * this.duration * FPS;
    const end = Math.ceil(position);
    if (end >= this.frames.length) {
      const latest = this.frames[this.frames.length - 1]!;
      drawSample(sim, latest, latest, 0);
      while (end >= this.frames.length) {
        sim.step(1 / FPS);
        this.frames.push(capture(sim));
      }
    }
    const start = Math.floor(position);
    drawSample(
      sim,
      this.frames[start]!,
      this.frames[end]!,
      position - start,
      hand.x - this.anchor.x,
      hy - this.anchor.y,
    );
  }
}
