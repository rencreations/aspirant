import { describe, expect, it } from "vitest";

import { beatFor, beatOf, playsOf } from "./beat";
import { validatePlays } from "./plays";

describe("beatOf", () => {
  it("runs in beats inside the section and in real screens outside it", () => {
    expect(beatOf(0, 3, 2)).toBe(0);
    expect(beatOf(0.5, 3, 2)).toBeCloseTo(1.5, 9);
    expect(beatOf(1, 3, 2)).toBeCloseTo(3, 9);
    // The lead and the tail do not depend on the beat length: they are screens of the scroll.
    expect(beatOf(-0.25, 3, 2)).toBeCloseTo(-0.5, 9);
    expect(beatOf(1.25, 3, 2)).toBeCloseTo(3.5, 9);
  });

  it("is continuous at both ends", () => {
    for (const edge of [0, 1]) {
      expect(beatOf(edge - 1e-9, 3.3, 2.7)).toBeCloseTo(beatOf(edge + 1e-9, 3.3, 2.7), 6);
    }
  });
});

describe("beatFor", () => {
  it("adds the first beat of the section", () => {
    expect(beatFor(0, 3.3, 6.6, 1.2)).toBeCloseTo(3.3, 9);
    expect(beatFor(1, 3.3, 6.6, 1.2)).toBeCloseTo(6.6, 9);
    expect(beatFor(-0.5, 3.3, 6.6, 1.2)).toBeCloseTo(2.7, 9);
    expect(beatFor(1.5, 3.3, 6.6, 1.2)).toBeCloseTo(7.2, 9);
  });
});

describe("playsOf", () => {
  const steps = [
    { atScreens: 0.25, to: 1.3, seconds: 1.8, ease: "linear" },
    { atScreens: 0.75, to: 1.8, seconds: 0.55 },
    { atScreens: 1.2, to: 3.3, seconds: 1.5, back: 0.5 },
  ] as const;

  it("writes a table that the kernel accepts", () => {
    const plays = playsOf(0, 3.3, 2.7, steps);
    expect(() => {
      validatePlays("test", plays);
    }).not.toThrow();
    expect(plays).toHaveLength(3);
  });

  it("says the thresholds as shares of the section and the values as shares of its beats", () => {
    const plays = playsOf(0, 3.3, 2.7, steps);
    expect(plays[0]!.at).toBeCloseTo(0.25 / 2.7, 9);
    expect(plays[0]!.from).toBe(0);
    expect(plays[0]!.to).toBeCloseTo(1.3 / 3.3, 9);
    expect(plays[1]!.from).toBe(plays[0]!.to);
    expect(plays[2]!.to).toBeCloseTo(1, 9);
    expect(plays[2]!.back).toBe(0.5);
    expect(plays[1]!.ease).toBe("inOut");
  });

  it("starts at the section's first beat when it is not zero", () => {
    const plays = playsOf(3.3, 6.6, 1.2, [{ atScreens: 0.2, to: 6.6, seconds: 3 }]);
    expect(plays[0]!.from).toBe(0);
    expect(plays[0]!.to).toBe(1);
  });
});
