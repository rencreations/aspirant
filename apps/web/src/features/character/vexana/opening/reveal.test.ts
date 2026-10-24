import { describe, expect, it } from "vitest";

import { createIdleDirector, envelope, SHAPES } from "./reveal";

const seeded = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

describe("envelope", () => {
  it("is closed at both ends and open in the middle", () => {
    expect(envelope(0)).toBe(0);
    expect(envelope(1)).toBe(0);
    expect(envelope(0.45)).toBeGreaterThan(0.85);
  });
});

describe("idle director", () => {
  it("waits, opens a shape, closes it, and never repeats a shape twice in a row", () => {
    const d = createIdleDirector(seeded(7));
    const shapes: number[] = [];
    let peak = 0;
    let wasOpen = false;
    for (let i = 0; i < 60 * 90; i++) {
      const f = d.step(1 / 60, false);
      peak = Math.max(peak, f.env);
      const open = f.env > 0.05;
      if (open && !wasOpen) shapes.push(f.shape);
      wasOpen = open;
    }
    expect(peak).toBeGreaterThan(0.6);
    expect(shapes.length).toBeGreaterThan(8);
    for (let i = 1; i < shapes.length; i++) expect(shapes[i]).not.toBe(shapes[i - 1]);
    expect(Math.max(...shapes)).toBeLessThan(SHAPES.length);
  });

  it("stays shut while the cursor shows the form, and closes a run that was open", () => {
    const d = createIdleDirector(seeded(3));
    for (let i = 0; i < 60 * 3; i++) d.step(1 / 60, false);
    let env = 0;
    for (let i = 0; i < 60 * 3; i++) env = d.step(1 / 60, true).env;
    expect(env).toBe(0);
    for (let i = 0; i < 60 * 10; i++) expect(d.step(1 / 60, true).env).toBe(0);
  });
});
