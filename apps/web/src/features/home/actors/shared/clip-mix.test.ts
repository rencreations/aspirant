import { describe, expect, it } from "vitest";

import { mixJumped, type ClipMix } from "./clip-mix";

const DUR = { a: 3, b: 2.7, c: 6 };
const LOOP = { a: false, b: true, c: false };
const mix = (a: string, ta: number, b: string | null = null, tb = 0, w = 0): ClipMix => ({
  a,
  ta,
  b,
  tb,
  w,
});

describe("mixJumped", () => {
  it("is not a jump when a clip plays on by a frame", () => {
    expect(mixJumped(mix("a", 1), mix("a", 1.016), DUR, LOOP)).toBe(false);
  });

  it("is a jump when another clip comes in whole", () => {
    expect(mixJumped(mix("a", 3), mix("b", 0.01), DUR, LOOP)).toBe(true);
  });

  it("is not a jump when a blend's weight moves a little", () => {
    expect(mixJumped(mix("c", 0.1, "b", 1, 0.95), mix("c", 0.11, "b", 1.01, 0.9), DUR, LOOP)).toBe(
      false,
    );
  });

  it("is not a jump when a clip blended in whole becomes the main clip at the same time", () => {
    // The room's idle at its phase, then the film's first notch with the idle at that phase on top.
    expect(mixJumped(mix("b", 1.2), mix("c", 0, "b", 1.21, 1), DUR, LOOP)).toBe(false);
  });

  it("is a jump when a clip that shows moves far in time, and a loop wraps the short way", () => {
    expect(mixJumped(mix("b", 0.12), mix("b", 9.01), DUR, LOOP)).toBe(true);
    expect(mixJumped(mix("b", 2.69), mix("b", 2.7 + 0.01), DUR, LOOP)).toBe(false);
  });

  it("does not count a clip that is all but gone", () => {
    expect(mixJumped(mix("c", 2, "b", 0.1, 0.02), mix("c", 2.01, "b", 1.9, 0.02), DUR, LOOP)).toBe(
      false,
    );
  });
});
