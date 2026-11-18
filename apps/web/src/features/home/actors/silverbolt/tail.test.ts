import { describe, expect, it } from "vitest";

import { TAIL_LENGTHS } from "./facts";
import { TailBody, chainLength, dragPose, dragWeights, fabrik } from "./tail";

const LENGTHS = [1, 1, 1];

/** A straight chain of joints along -z, one metre apart. */
function straight(n = 4): Float64Array {
  const p = new Float64Array(3 * n);
  for (let i = 0; i < n; i++) p[3 * i + 2] = -i;
  return p;
}

function segment(p: Float64Array, i: number): number {
  return Math.hypot(
    p[3 * i + 3]! - p[3 * i]!,
    p[3 * i + 4]! - p[3 * i + 1]!,
    p[3 * i + 5]! - p[3 * i + 2]!,
  );
}

describe("chainLength", () => {
  it("adds the segments", () => {
    expect(chainLength(LENGTHS)).toBe(3);
    expect(chainLength(TAIL_LENGTHS)).toBeCloseTo(2.5222, 3);
  });
});

describe("fabrik", () => {
  it("keeps the root, keeps every length and reaches a target in range", () => {
    const p = straight();
    const left = fabrik(p, LENGTHS, 1, 1.2, -1.5);
    expect(left).toBeLessThan(0.01);
    expect(p[0]).toBeCloseTo(0, 12);
    expect(p[1]).toBeCloseTo(0, 12);
    expect(p[2]).toBeCloseTo(0, 12);
    for (let i = 0; i < 3; i++) expect(segment(p, i)).toBeCloseTo(1, 6);
    expect(Math.hypot(p[9]! - 1, p[10]! - 1.2, p[11]! + 1.5)).toBeLessThan(0.01);
  });

  it("lays the chain straight toward a target out of reach and says how far it falls short", () => {
    const p = straight();
    const left = fabrik(p, LENGTHS, 10, 0, 0);
    expect(left).toBeCloseTo(7, 6);
    expect(p[9]).toBeCloseTo(3, 6);
    expect(p[10]).toBeCloseTo(0, 6);
    for (let i = 0; i < 3; i++) expect(segment(p, i)).toBeCloseTo(1, 6);
  });

  it("does not collapse a chain whose joints sit on each other", () => {
    const p = new Float64Array(12);
    fabrik(p, LENGTHS, 0, 2, -1);
    for (let i = 0; i < 3; i++) expect(segment(p, i)).toBeCloseTo(1, 6);
    expect(p.every((v) => Number.isFinite(v))).toBe(true);
  });
});

describe("dragPose", () => {
  it("takes nothing at the root and everything at the tip", () => {
    const w = dragWeights(7);
    expect(w[0]).toBe(0);
    expect(w[6]).toBeCloseTo(1);
    for (let i = 1; i < 7; i++) expect(w[i]!).toBeGreaterThan(w[i - 1]!);
  });

  it("never pulls the tip further than maxPull of the tail's length", () => {
    const base = straight();
    const out = new Float64Array(12);
    const pull = dragPose(base, LENGTHS, dragWeights(4), 0, 50, -3, { maxPull: 0.4 }, out);
    expect(pull).toBeCloseTo(1.2, 6);
    const moved = Math.hypot(out[9]! - base[9]!, out[10]! - base[10]!, out[11]! - base[11]!);
    expect(moved).toBeLessThanOrEqual(1.2 + 0.02);
    for (let i = 0; i < 3; i++) expect(segment(out, i)).toBeCloseTo(1, 6);
    expect(out[2]).toBeCloseTo(0, 9);
  });

  it("a small drag lands the tip on the pointer", () => {
    const base = straight();
    const out = new Float64Array(12);
    dragPose(base, LENGTHS, dragWeights(4), 0.5, 0.5, -3, { maxPull: 0.4 }, out);
    expect(out[9]).toBeCloseTo(0.5, 1);
    expect(out[10]).toBeCloseTo(0.5, 1);
  });
});

describe("TailBody", () => {
  const follow = { omega: [0, 9, 7, 5], zeta: 0.55 };

  it("snaps to the animated pose with no speed", () => {
    const body = new TailBody(4);
    const base = straight();
    body.snap(base);
    expect(Array.from(body.q)).toEqual(Array.from(base));
    expect(body.deviation(base)).toBe(0);
  });

  it("trails a move of its root, keeps its lengths, then catches up", () => {
    const body = new TailBody(4);
    const base = straight();
    body.snap(base);
    // The whole animated tail jumps 2 m to the right.
    for (let i = 0; i < 4; i++) base[3 * i] = 2;
    body.step(1 / 60, base, LENGTHS, follow);
    expect(body.deviation(base)).toBeGreaterThan(0.1);
    for (let k = 0; k < 60 * 4; k++) {
      body.step(1 / 60, base, LENGTHS, follow);
      for (let i = 0; i < 3; i++) expect(segment(body.q, i)).toBeCloseTo(1, 6);
    }
    expect(body.deviation(base)).toBeLessThan(0.02);
  });

  it("does nothing for a zero step and stays finite for a long one", () => {
    const body = new TailBody(4);
    const base = straight();
    body.snap(base);
    base[3] = 1;
    const before = Array.from(body.q);
    body.step(0, base, LENGTHS, follow);
    expect(Array.from(body.q)).toEqual(before);
    body.step(0.5, base, LENGTHS, follow);
    expect(body.q.every((v) => Number.isFinite(v))).toBe(true);
  });

  it("chases a drag solution instead of the animation, and lets go of the speed", () => {
    const body = new TailBody(4);
    const base = straight();
    body.snap(base);
    const solved = new Float64Array(12);
    dragPose(base, LENGTHS, dragWeights(4), 0.6, 0.8, -3, { maxPull: 0.4 }, solved);
    for (let k = 0; k < 90; k++) {
      body.step(1 / 60, base, LENGTHS, follow, { target: solved, omega: 20 });
    }
    expect(Math.hypot(body.q[9]! - solved[9]!, body.q[10]! - solved[10]!)).toBeLessThan(0.05);
    body.still();
    const held = Array.from(body.q);
    body.step(1 / 600, base, LENGTHS, follow, { target: solved, omega: 20 });
    expect(Math.hypot(body.q[9]! - held[9]!, body.q[10]! - held[10]!)).toBeLessThan(0.02);
  });
});
