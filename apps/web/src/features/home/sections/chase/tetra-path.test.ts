import { describe, expect, it } from "vitest";

import { TetraPath, softMin } from "./tetra-path";

const DT = 1 / 60;
const CORNER = 100;

interface Ask {
  forwardX: number;
  behindX: number;
  backward: boolean;
}

function run(path: TetraPath, frames: number, at: (i: number) => Ask): number[] {
  const xs: number[] = [];
  for (let i = 0; i < frames; i++) {
    xs.push(path.step({ ...at(i), corner: CORNER, dt: DT, jumped: false }));
  }
  return xs;
}

/** She runs right for half a second, to x = 580. */
function runningRight(): TetraPath {
  const path = new TetraPath();
  run(path, 30, (i) => ({ forwardX: i * 20, behindX: 900, backward: false }));
  return path;
}

describe("softMin", () => {
  it("is the lower number, far from the other, and a little below both where they meet", () => {
    expect(softMin(10, 1000, 1)).toBeCloseTo(10, 1);
    expect(softMin(1000, 10, 1)).toBeCloseTo(10, 1);
    expect(softMin(5, 5, 2)).toBeCloseTo(4, 9);
  });
});

describe("Tetra's path", () => {
  it("runs where the scroll puts her while it goes down", () => {
    const path = runningRight();
    expect(path.x).toBeCloseTo(580, 6);
  });

  it("stops where she is, a little further on, when the scroll turns back, and waits there", () => {
    const path = runningRight();
    const xs = run(path, 60, (i) => ({ forwardX: 580 - i * 20, behindX: 900, backward: true }));
    // She never goes back toward where she came from, and she stops (no bounce).
    for (let i = 1; i < xs.length; i++) expect(xs[i]!).toBeGreaterThanOrEqual(xs[i - 1]! - 1e-6);
    expect(xs[59]! - 580).toBeLessThan(CORNER + 1);
    expect(Math.abs(path.speed)).toBeLessThan(5);
    expect(path.waiting).toBe(true);
  });

  it("runs after the pair once the tail has gone by, at their pace, with no step bigger than theirs", () => {
    const path = runningRight();
    run(path, 40, (i) => ({ forwardX: 580 - i * 20, behindX: 900, backward: true }));
    const pace = 14;
    const xs = run(path, 100, (i) => ({ forwardX: 0, behindX: 900 - i * pace, backward: true }));
    let biggest = 0;
    for (let i = 1; i < xs.length; i++) biggest = Math.max(biggest, Math.abs(xs[i]! - xs[i - 1]!));
    expect(biggest).toBeLessThanOrEqual(pace + 0.5);
    // The rounded corner of the minimum keeps her a pixel or two behind the place she runs to.
    expect(Math.abs(xs[99]! - (900 - 99 * pace))).toBeLessThan(5);
    expect(path.waiting).toBe(false);
  });

  it("waits again when the scroll turns down, until her old place has come round", () => {
    const path = runningRight();
    run(path, 40, (i) => ({ forwardX: 580 - i * 20, behindX: 900, backward: true }));
    run(path, 100, (i) => ({ forwardX: 0, behindX: 900 - i * 14, backward: true }));
    const stoppedAt = path.x;
    const xs = run(path, 80, (i) => ({
      forwardX: stoppedAt - 600 + i * 12,
      behindX: 0,
      backward: false,
    }));
    // She stands (a little further on, as she brakes) while her old place is still behind her.
    expect(xs[10]!).toBeLessThanOrEqual(stoppedAt + 1e-6);
    expect(xs[79]!).toBeCloseTo(stoppedAt - 600 + 79 * 12, 0);
    expect(path.waiting).toBe(false);
  });

  it("lands on her place at once after a jump", () => {
    const path = runningRight();
    const x = path.step({
      forwardX: 333,
      behindX: 900,
      backward: false,
      corner: CORNER,
      dt: DT,
      jumped: true,
    });
    expect(x).toBe(333);
    expect(path.speed).toBe(0);
  });
});
