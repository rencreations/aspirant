import { describe, expect, it } from "vitest";

import { FACES, mixFaces } from "./mix";
import { DEFAULT_BLEND, moodAt, moodDuration, moodWeights, type MoodStep } from "./sequence";

const STEPS: readonly MoodStep[] = [
  { face: "scared", hold: 1 },
  { face: "scream", hold: 2, blend: 0.4 },
  { face: "dizzy", hold: 1.5, blend: 0 },
];

describe("moodAt", () => {
  it("an empty list is the neutral face", () => {
    expect(moodAt([], 3)).toEqual({ a: "neutral", b: "neutral", w: 0 });
  });

  it("holds the first face before 0 and from 0 until its hold is over", () => {
    expect(moodAt(STEPS, -5)).toEqual({ a: "scared", b: "scared", w: 0 });
    expect(moodAt(STEPS, 0)).toEqual({ a: "scared", b: "scared", w: 0 });
    expect(moodAt(STEPS, 0.99)).toEqual({ a: "scared", b: "scared", w: 0 });
  });

  it("blends from the step before for the step's blend time, then holds", () => {
    expect(moodAt(STEPS, 1)).toEqual({ a: "scared", b: "scream", w: 0 });
    const mid = moodAt(STEPS, 1.2);
    expect(mid.a).toBe("scared");
    expect(mid.b).toBe("scream");
    expect(mid.w).toBeCloseTo(0.5, 10);
    expect(moodAt(STEPS, 1.4)).toEqual({ a: "scream", b: "scream", w: 0 });
    expect(moodAt(STEPS, 3)).toEqual({ a: "scream", b: "scream", w: 0 });
  });

  it("a blend of 0 is a cut", () => {
    expect(moodAt(STEPS, 3.39)).toEqual({ a: "scream", b: "scream", w: 0 });
    expect(moodAt(STEPS, 3.4)).toEqual({ a: "dizzy", b: "dizzy", w: 0 });
  });

  it("holds the last face for ever after the end", () => {
    expect(moodAt(STEPS, 100)).toEqual({ a: "dizzy", b: "dizzy", w: 0 });
  });

  it("uses the default blend when a step names none", () => {
    const steps: MoodStep[] = [
      { face: "neutral", hold: 1 },
      { face: "angry", hold: 1 },
    ];
    expect(moodAt(steps, 1 + DEFAULT_BLEND / 2).w).toBeCloseTo(0.5, 10);
    expect(moodAt(steps, 1 + DEFAULT_BLEND + 0.01).w).toBe(0);
  });

  it("the weight is monotone through a blend and always in 0 to 1", () => {
    let last = -1;
    for (let t = 1; t <= 1.4; t += 0.01) {
      const w = moodAt(STEPS, t).w;
      expect(w).toBeGreaterThanOrEqual(0);
      expect(w).toBeLessThanOrEqual(1);
      expect(w).toBeGreaterThanOrEqual(last - 1e-12);
      last = w;
    }
  });

  it("a step with a negative hold or blend does not break it", () => {
    const steps: MoodStep[] = [
      { face: "neutral", hold: -3 },
      { face: "smile", hold: -1, blend: -2 },
      { face: "angry", hold: 1 },
    ];
    expect(() => moodAt(steps, 0.5)).not.toThrow();
    expect(moodAt(steps, 0.5).b).toBe("angry");
  });
});

describe("moodDuration and moodWeights", () => {
  it("the length is the holds plus the blends of every step but the first", () => {
    expect(moodDuration(STEPS)).toBeCloseTo(1 + 2 + 0.4 + 1.5 + 0, 10);
    expect(moodDuration([])).toBe(0);
  });

  it("the weights over the presets sum to 1", () => {
    expect(moodWeights({ a: "scared", b: "scared", w: 0 })).toEqual({ scared: 1 });
    const w = moodWeights({ a: "scared", b: "scream", w: 0.25 });
    expect(w.scared).toBeCloseTo(0.75, 10);
    expect(w.scream).toBeCloseTo(0.25, 10);
  });

  it("the sequence drives the actor's blend: at a step's end the floats are the preset's own", () => {
    const m = moodAt(STEPS, 2);
    const out = new Float32Array(FACES.neutral.length);
    mixFaces(out, FACES[m.a], FACES[m.b], m.w);
    expect(Array.from(out)).toEqual(Array.from(FACES.scream));
  });
});
