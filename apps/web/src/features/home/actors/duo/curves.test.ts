import { describe, expect, it } from "vitest";

import { crossed, EASE, hump, key, rand01, seeded, span, type Key } from "./curves";

describe("easing", () => {
  it("every curve runs from 0 to 1", () => {
    for (const ease of Object.values(EASE)) {
      expect(ease(0)).toBeCloseTo(0, 9);
      expect(ease(1)).toBeCloseTo(1, 9);
    }
  });

  it("the ease in out is symmetric and the back curve overshoots", () => {
    expect(EASE.io(0.5)).toBeCloseTo(0.5, 9);
    expect(EASE.io(0.25) + EASE.io(0.75)).toBeCloseTo(1, 9);
    expect(Math.max(...Array.from({ length: 101 }, (_, i) => EASE.back(i / 100)))).toBeGreaterThan(
      1,
    );
  });
});

describe("span and hump", () => {
  it("span is 0 before, 1 after and linear between", () => {
    expect(span(0, 1, 3)).toBe(0);
    expect(span(4, 1, 3)).toBe(1);
    expect(span(2, 1, 3)).toBeCloseTo(0.5, 9);
  });

  it("hump is 0 outside and at the ends, 1 in the middle", () => {
    expect(hump(0.5, 1, 3)).toBe(0);
    expect(hump(1, 1, 3)).toBe(0);
    expect(hump(3, 1, 3)).toBe(0);
    expect(hump(2, 1, 3)).toBeCloseTo(1, 9);
  });
});

describe("random numbers", () => {
  it("rand01 is the same for the same number and stays in [0, 1)", () => {
    for (let n = 0; n < 200; n += 1) {
      const v = rand01(n);
      expect(v).toBe(rand01(n));
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("a seeded generator repeats and differs by seed", () => {
    const a = seeded(7);
    const b = seeded(7);
    const c = seeded(8);
    const run = (f: () => number) => Array.from({ length: 5 }, f);
    expect(run(a)).toEqual(run(b));
    expect(run(seeded(7))).not.toEqual(run(c));
  });
});

describe("crossed", () => {
  it("fires in exactly one frame of each period", () => {
    let hits = 0;
    const dt = 1 / 60;
    for (let i = 1; i <= 600; i += 1) {
      if (crossed(i * dt, dt, 1.3, 0.2)) hits += 1;
    }
    // 10 seconds, a beat every 1.3 s from 0.2: 0.2, 1.5, 2.8 ... 9.3 is the 8th
    expect(hits).toBe(8);
  });

  it("does not fire before the offset or with no time passing", () => {
    expect(crossed(0.1, 0.05, 1, 0.5)).toBe(false);
    expect(crossed(2, 0, 1)).toBe(false);
  });
});

describe("key", () => {
  const keys: readonly Key[] = [
    [0, 0],
    [1, 10, "lin"],
    [2, 10],
    [3, 0, "lin"],
  ];

  it("holds the ends and goes through the keys", () => {
    expect(key(-1, keys)).toBe(0);
    expect(key(0.5, keys)).toBeCloseTo(5, 9);
    expect(key(1.5, keys)).toBe(10);
    expect(key(2.5, keys)).toBeCloseTo(5, 9);
    expect(key(9, keys)).toBe(0);
  });

  it("an empty list is 0", () => {
    expect(key(1, [])).toBe(0);
  });
});
