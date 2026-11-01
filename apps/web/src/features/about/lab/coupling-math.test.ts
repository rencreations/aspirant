import { describe, expect, it } from "vitest";

import { closenessFor, scoreOf, stageOf } from "./coupling-math";

describe("coupling math", () => {
  it("is zero apart and the dial top when touching", () => {
    expect(scoreOf(0)).toBe(0);
    expect(scoreOf(1)).toBeCloseTo(2.5);
  });

  it("inverts for the story's own scores", () => {
    for (const score of [1.62, 2.1]) {
      expect(scoreOf(closenessFor(score))).toBeCloseTo(score, 6);
    }
  });

  it("raises the stars at the thresholds", () => {
    expect(stageOf(0.3)).toBe(0);
    expect(stageOf(0.9)).toBe(1);
    expect(stageOf(scoreOf(closenessFor(1.62)))).toBe(2);
    expect(stageOf(scoreOf(closenessFor(2.1)))).toBe(3);
  });
});
