import { describe, expect, it } from "vitest";

import { BONE_COUNT } from "./math";
import { BONE, addBreath, addDangle, addFlail, addHead, addRunLean } from "./layers";

const DEG = Math.PI / 180;
const fresh = (): Float32Array => new Float32Array(BONE_COUNT * 3);
const peak = (t: Float32Array): number => t.reduce((m, v) => Math.max(m, Math.abs(v)), 0);

describe("the layers add nothing at zero", () => {
  it("flail, dangle and run lean", () => {
    const t = fresh();
    addFlail(t, 3.2, 0);
    addDangle(t, 3.2, 0);
    addRunLean(t, 0);
    expect(peak(t)).toBe(0);
  });

  it("the breath is small and always on", () => {
    const t = fresh();
    addBreath(t, 1.3);
    expect(peak(t)).toBeGreaterThan(0);
    expect(peak(t)).toBeLessThan(2 * DEG);
  });
});

describe("addFlail", () => {
  it("never leaves a sane range, at any time and rate", () => {
    for (let time = 0; time < 40; time += 0.37) {
      const t = fresh();
      addFlail(t, time, 1, 2);
      expect(peak(t)).toBeLessThan(60 * DEG);
      for (const v of t) expect(Number.isFinite(v)).toBe(true);
    }
  });

  it("is continuous: a frame later the limbs have moved by a little", () => {
    for (let time = 0; time < 10; time += 0.5) {
      const a = fresh();
      const b = fresh();
      addFlail(a, time, 1, 1);
      addFlail(b, time + 1 / 60, 1, 1);
      let worst = 0;
      for (let i = 0; i < a.length; i++)
        worst = Math.max(worst, Math.abs((a[i] ?? 0) - (b[i] ?? 0)));
      expect(worst).toBeLessThan(10 * DEG);
    }
  });

  it("scales with the amount and moves every limb", () => {
    const half = fresh();
    const full = fresh();
    addFlail(half, 1.7, 0.5);
    addFlail(full, 1.7, 1);
    expect(peak(half)).toBeCloseTo(peak(full) / 2, 6);
    for (const bone of [BONE.armL, BONE.armR, BONE.upLegL, BONE.upLegR, BONE.legL, BONE.legR]) {
      expect(Math.abs(full[bone * 3] ?? 0) + Math.abs(full[bone * 3 + 2] ?? 0)).toBeGreaterThan(0);
    }
  });

  it("the two arms are not mirrors of each other", () => {
    const t = fresh();
    addFlail(t, 2.9, 1);
    expect(t[BONE.armL * 3]).not.toBeCloseTo(t[BONE.armR * 3] ?? 0, 3);
  });

  it("knees only bend one way", () => {
    for (let time = 0; time < 20; time += 0.21) {
      const t = fresh();
      addFlail(t, time, 1);
      expect(t[BONE.legL * 3] ?? 0).toBeGreaterThanOrEqual(0);
      expect(t[BONE.legR * 3] ?? 0).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("the other layers", () => {
  it("the run lean leans the trunk forward and bends both elbows", () => {
    const t = fresh();
    addRunLean(t, 1);
    expect(t[BONE.spine02 * 3] ?? 0).toBeGreaterThan(0);
    expect(t[BONE.foreL * 3] ?? 0).toBeLessThan(0);
    expect(t[BONE.foreR * 3] ?? 0).toBeLessThan(0);
  });

  it("the dangle swings the shins and nothing else", () => {
    const t = fresh();
    addDangle(t, 0.3, 1);
    expect(Math.abs(t[BONE.legL * 3] ?? 0)).toBeGreaterThan(0);
    expect(t[BONE.armL * 3] ?? 0).toBe(0);
  });

  it("the head layer writes nod, turn and roll into the head's three turns", () => {
    const t = fresh();
    addHead(t, 0.1, 0.2, 0.3);
    expect(t[BONE.head * 3]).toBeCloseTo(0.2, 6);
    expect(t[BONE.head * 3 + 1]).toBeCloseTo(0.3, 6);
    expect(t[BONE.head * 3 + 2]).toBeCloseTo(0.1, 6);
  });

  it("layers add up on one bone", () => {
    const t = fresh();
    addBreath(t, 0);
    const before = t[BONE.head * 3 + 2] ?? 0;
    addHead(t, 0.5, 0, 0);
    expect(t[BONE.head * 3 + 2]).toBeCloseTo(before + 0.5, 6);
  });
});
