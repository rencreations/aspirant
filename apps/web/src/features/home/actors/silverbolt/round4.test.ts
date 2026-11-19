import { describe, expect, it } from "vitest";

import { LEAN_PITCH, LEAN_ROLL, LEAN_SHIFT_M, leanFor, newLean } from "./lean";
import {
  SHAKE_LENGTH_MAX,
  SHAKE_LENGTH_MIN,
  newShakeValues,
  shakeAt,
  shakeEnvelope,
  shakeLength,
} from "./shake";

describe("shake", () => {
  it("lasts 0.8 to 1.2 seconds by strength and ends at exactly zero", () => {
    expect(shakeLength(0)).toBeCloseTo(SHAKE_LENGTH_MIN, 9);
    expect(shakeLength(1)).toBeCloseTo(SHAKE_LENGTH_MAX, 9);
    for (const s of [0.2, 0.6, 1]) {
      const len = shakeLength(s);
      expect(shakeEnvelope(len - 1e-4, s)).toBeLessThan(1e-3);
      expect(shakeEnvelope(len, s)).toBe(0);
      expect(shakeEnvelope(-0.1, s)).toBe(0);
    }
  });

  it("attacks fast and only ever falls after that", () => {
    expect(shakeEnvelope(0.05, 1)).toBeGreaterThan(0.8);
    let last = shakeEnvelope(0.05, 1);
    for (let t = 0.06; t < shakeLength(1); t += 0.02) {
      const v = shakeEnvelope(t, 1);
      expect(v).toBeLessThanOrEqual(last + 1e-9);
      last = v;
    }
  });

  it("rattles along the body with a signed oscillation, small and finite", () => {
    const out = newShakeValues();
    let max = 0;
    let signs = 0;
    let prev = 0;
    for (let t = 0; t < 1.2; t += 1 / 120) {
      shakeAt(out, t, 1);
      expect(Number.isFinite(out.along + out.up + out.roll + out.nod + out.whip)).toBe(true);
      max = Math.max(max, Math.abs(out.along));
      if (prev * out.osc < 0) signs += 1;
      prev = out.osc;
    }
    expect(max).toBeLessThanOrEqual(0.12 + 1e-9);
    expect(max).toBeGreaterThan(0.03);
    expect(signs).toBeGreaterThan(3);
  });

  it("is nothing at strength 0 and in the past", () => {
    const out = newShakeValues();
    shakeAt(out, 0.1, 0);
    expect(Math.abs(out.along)).toBe(0);
    expect(Math.abs(out.roll)).toBe(0);
    shakeAt(out, -1, 1);
    expect(out.amount).toBe(0);
  });
});

describe("lean", () => {
  it("is zero with no weight and on the dragon itself", () => {
    const out = newLean();
    leanFor(out, 2, 1, 0);
    expect(out.pitch).toBe(0);
    expect(out.shift).toBe(0);
    leanFor(out, 0.05, 0.05, 1);
    expect(out.pitch).toBe(0);
  });

  it("never passes its small limits", () => {
    const out = newLean();
    for (const [f, u] of [
      [50, 50],
      [-50, 50],
      [50, -50],
      [-3, 0],
    ] as const) {
      leanFor(out, f, u, 1);
      expect(Math.abs(out.pitch)).toBeLessThanOrEqual(LEAN_PITCH);
      expect(Math.abs(out.roll)).toBeLessThanOrEqual(LEAN_ROLL);
      expect(Math.abs(out.shift)).toBeLessThanOrEqual(LEAN_SHIFT_M);
      expect(out.tail).toBeLessThanOrEqual(1);
    }
  });

  it("lifts the nose for a pointer above and shifts toward the nose for a pointer in front", () => {
    const out = newLean();
    leanFor(out, 0, 2, 1);
    expect(out.pitch).toBeGreaterThan(0);
    leanFor(out, 2, 0, 1);
    expect(out.shift).toBeGreaterThan(0);
    leanFor(out, -2, 0, 1);
    expect(out.shift).toBeLessThan(0);
  });
});
