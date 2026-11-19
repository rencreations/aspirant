import { describe, expect, it } from "vitest";

import {
  CROSS,
  letterValue,
  shuffled,
  slotStep,
  STEP_MAX,
  STEP_MIN,
  SWAP_FADE,
  swapPlan,
} from "./swap-plan";

describe("shuffled", () => {
  it("is a permutation of 0 to n-1", () => {
    for (const n of [1, 2, 3, 7, 11, 12]) {
      for (const seed of [0, 1, 5, 13]) {
        const order = shuffled(n, seed);
        expect([...order].sort((a, b) => a - b)).toEqual(Array.from({ length: n }, (_, i) => i));
      }
    }
  });

  it("is the same every time and differs with the seed", () => {
    expect(shuffled(7, 3)).toEqual(shuffled(7, 3));
    const seen = new Set<string>();
    for (let seed = 0; seed < 8; seed++) seen.add(shuffled(7, seed).join(","));
    expect(seen.size).toBeGreaterThan(4);
  });
});

describe("slotStep", () => {
  it("is 50 ms for a word of seven and never leaves 30 to 60 ms", () => {
    expect(slotStep(7)).toBeCloseTo(0.05, 6);
    expect(slotStep(11)).toBeGreaterThanOrEqual(STEP_MIN);
    expect(slotStep(12)).toBeGreaterThanOrEqual(STEP_MIN);
    expect(slotStep(2)).toBeLessThanOrEqual(STEP_MAX);
    expect(slotStep(0)).toBeLessThanOrEqual(STEP_MAX);
  });
});

describe("swapPlan", () => {
  it("gives every letter of both words its own moment and none the same as a neighbour", () => {
    const plan = swapPlan("Trailer", "Collections", 4);
    expect(plan.out).toHaveLength(7);
    expect(plan.in).toHaveLength(11);
    expect(new Set(plan.in).size).toBe(11);
    expect(new Set(plan.out).size).toBe(7);
    for (const t of [...plan.out, ...plan.in]) expect(t).toBeGreaterThanOrEqual(0);
  });

  it("adds one letter at a time, at equal steps, so the word is never all at once", () => {
    const plan = swapPlan("Aspirant 5.0", "Our", 2);
    const slots = 11; // 12 places, one of them a space in both words
    const step = slotStep(slots);
    const times = plan.out
      .map((t, i) => (i === 8 ? -1 : t))
      .filter((t) => t >= 0)
      .sort((a, b) => a - b);
    // Each slot is one step after the last (the letters of "Our" share three of them).
    for (let i = 1; i < times.length; i++) {
      const gap = (times[i]! - times[i - 1]!) / step;
      expect(Math.abs(gap - Math.round(gap))).toBeLessThan(1e-6);
      expect(gap).toBeGreaterThan(0.5);
    }
  });

  it("builds the new word in no left to right order", () => {
    let leftToRight = 0;
    const seeds = 12;
    for (let seed = 0; seed < seeds; seed++) {
      const { in: inn } = swapPlan("Trailer", "Collections", seed);
      const sorted = inn.every((t, i) => i === 0 || t > inn[i - 1]!);
      if (sorted) leftToRight += 1;
    }
    expect(leftToRight).toBe(0);
  });

  it("takes about a third of a second for seven letters", () => {
    const plan = swapPlan("Trailer", "Trailer", 1);
    expect(plan.duration).toBeGreaterThan(0.3);
    expect(plan.duration).toBeLessThan(0.55);
    const long = swapPlan("Trailer", "Collections", 1);
    expect(long.duration).toBeLessThan(0.55);
  });

  it("starts the new letter a short while after the old one in the same place", () => {
    const plan = swapPlan("Trailer", "Collections", 6);
    for (let i = 0; i < 7; i++) {
      expect(plan.in[i]! - plan.out[i]!).toBeCloseTo(SWAP_FADE * CROSS, 9);
    }
  });

  it("leaves spaces alone and costs them no time", () => {
    const plan = swapPlan("Aspirant 5.0", "Our", 3);
    expect(plan.out[8]).toBe(-1);
    const noSpace = swapPlan("Aspirant5.0", "Our", 3);
    expect(plan.duration).toBeLessThanOrEqual(noSpace.duration + 1e-9);
  });

  it("is the same for the same words and seed", () => {
    expect(swapPlan("Trailer", "Collections", 9)).toEqual(swapPlan("Trailer", "Collections", 9));
  });

  it("is a no-op for empty words", () => {
    const plan = swapPlan("", "", 1);
    expect(plan.duration).toBe(0);
    expect(plan.out).toEqual([]);
  });
});

describe("letterValue", () => {
  it("holds the start value until the letter's moment and the target after its fade", () => {
    expect(letterValue(1, 0, 0.2, 0.1)).toBe(1);
    expect(letterValue(1, 0, 0.2, 0.2)).toBe(1);
    expect(letterValue(1, 0, 0.2, 0.2 + SWAP_FADE)).toBeCloseTo(0, 9);
    expect(letterValue(1, 0, 0.2, 5)).toBe(0);
  });

  it("moves smoothly and never overshoots, in both directions", () => {
    let last = 0;
    for (let i = 0; i <= 20; i++) {
      const v = letterValue(0, 1, 0, (i / 20) * SWAP_FADE);
      expect(v).toBeGreaterThanOrEqual(last - 1e-9);
      expect(v).toBeLessThanOrEqual(1);
      last = v;
    }
    const mid = letterValue(0.3, 1, 0, SWAP_FADE / 2);
    expect(mid).toBeGreaterThan(0.3);
    expect(mid).toBeLessThan(1);
  });

  it("goes straight to the target for a letter with no moment of its own", () => {
    expect(letterValue(1, 0, -1, 0)).toBe(0);
  });
});
