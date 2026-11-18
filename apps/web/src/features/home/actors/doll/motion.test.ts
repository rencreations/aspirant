import { describe, expect, it } from "vitest";

import {
  Spring,
  approach,
  at,
  clamp,
  hash,
  smoothstep,
  strideSpeed,
  walkPhaseFor,
  walkRateFor,
} from "./motion";
import { DOLL_SIZE } from "./place";
import { DOLL_HEIGHT, WALK_SECONDS, WALK_SPEED } from "./rig";

describe("clamp, at, smoothstep", () => {
  it("clamps to the range", () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
    expect(clamp(0.3, 0, 1)).toBe(0.3);
  });

  it("reads 0 past the end of an array", () => {
    expect(at([1, 2], 1)).toBe(2);
    expect(at([1, 2], 9)).toBe(0);
  });

  it("is 0 at 0, 1 at 1, 0.5 in the middle and flat outside", () => {
    expect(smoothstep(0)).toBe(0);
    expect(smoothstep(1)).toBe(1);
    expect(smoothstep(0.5)).toBeCloseTo(0.5, 12);
    expect(smoothstep(-2)).toBe(0);
    expect(smoothstep(3)).toBe(1);
  });
});

describe("Spring", () => {
  const run = (zeta: number, steps: number): Spring => {
    const s = new Spring(18, zeta, 2);
    s.v = 3;
    for (let i = 0; i < steps; i++) s.step(-1, 1 / steps);
    return s;
  };

  it("one 1 s step equals a thousand small ones, damped or not", () => {
    for (const zeta of [0.3, 0.8, 1, 1.4]) {
      const a = run(zeta, 1);
      const b = run(zeta, 1000);
      expect(a.x).toBeCloseTo(b.x, 4);
      expect(a.v).toBeCloseTo(b.v, 3);
    }
  });

  it("settles on the target", () => {
    const s = new Spring(18, 0.4, 2);
    s.v = 3;
    for (let i = 0; i < 4 * 60; i++) s.step(-1, 1 / 60);
    expect(s.x).toBeCloseTo(-1, 6);
    expect(Math.abs(s.v)).toBeLessThan(1e-6);
  });

  it("does nothing for a step of 0 and ignores a bad dt", () => {
    const s = new Spring(10, 0.5, 1);
    s.step(0, 0);
    s.step(0, Number.NaN);
    expect(s.x).toBe(1);
  });

  it("an under damped spring overshoots, a critically damped one does not", () => {
    const loose = new Spring(20, 0.2, 0);
    const tight = new Spring(20, 1, 0);
    let looseMax = 0;
    let tightMax = 0;
    for (let i = 0; i < 120; i++) {
      loose.step(1, 1 / 60);
      tight.step(1, 1 / 60);
      looseMax = Math.max(looseMax, loose.x);
      tightMax = Math.max(tightMax, tight.x);
    }
    expect(looseMax).toBeGreaterThan(1.2);
    expect(tightMax).toBeLessThanOrEqual(1 + 1e-9);
  });

  it("reset and kick", () => {
    const s = new Spring(10, 0.5, 4);
    s.kick(2);
    expect(s.v).toBe(2);
    s.reset(1);
    expect(s.x).toBe(1);
    expect(s.v).toBe(0);
  });
});

describe("approach", () => {
  it("is exact for any step", () => {
    const once = approach(0, 1, 5, 1);
    let many = 0;
    for (let i = 0; i < 100; i++) many = approach(many, 1, 5, 0.01);
    expect(once).toBeCloseTo(many, 10);
  });

  it("keeps the value for a step of 0", () => {
    expect(approach(0.4, 1, 5, 0)).toBe(0.4);
  });
});

describe("hash", () => {
  it("stays in -1 to 1 and is deterministic", () => {
    for (let i = -50; i < 500; i++) {
      const h = hash(i);
      expect(h).toBeGreaterThanOrEqual(-1);
      expect(h).toBeLessThanOrEqual(1);
      expect(hash(i)).toBe(h);
    }
    expect(hash(1)).not.toBe(hash(2));
  });
});

describe("the stride of the walk", () => {
  it("the speed is the file's speed scaled by the height she is drawn at (the asked height times DOLL_SIZE)", () => {
    expect(strideSpeed(1, DOLL_HEIGHT / DOLL_SIZE)).toBeCloseTo(WALK_SPEED, 10);
    expect(strideSpeed(2, 170 / DOLL_SIZE)).toBeCloseTo(WALK_SPEED * 100 * 2, 6);
  });

  it("a smaller doll covers less ground a step, so the same distance is more steps", () => {
    expect(strideSpeed(1, 300)).toBeCloseTo(DOLL_SIZE * ((WALK_SPEED * 300) / DOLL_HEIGHT), 10);
    expect(walkPhaseFor(500, 300)).toBeCloseTo(500 / (strideSpeed(1, 300) * WALK_SECONDS), 10);
  });

  it("a rate matches the speed it was asked for", () => {
    const rate = walkRateFor(300, 200);
    expect(strideSpeed(rate, 200)).toBeCloseTo(300, 6);
    expect(walkRateFor(300, 0)).toBe(0);
  });

  it("the phase after one cycle of distance is one cycle", () => {
    const height = 120;
    const cyclePx = strideSpeed(1, height) * WALK_SECONDS;
    expect(walkPhaseFor(cyclePx, height)).toBeCloseTo(1, 10);
    expect(walkPhaseFor(cyclePx * 2.5, height)).toBeCloseTo(2.5, 10);
    expect(walkPhaseFor(10, 0)).toBe(0);
  });
});
