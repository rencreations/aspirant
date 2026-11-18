import { describe, expect, it } from "vitest";

import { Pulse } from "./reactions";

describe("Pulse", () => {
  it("rises, holds and falls to nothing in its length, whatever happens after", () => {
    const p = new Pulse();
    p.start(1, 0.1, 0.4);
    let peak = 0;
    for (let i = 0; i < 90; i += 1) peak = Math.max(peak, p.step(1 / 60));
    expect(peak).toBeCloseTo(1, 2);
    expect(p.active).toBe(false);
    expect(p.value).toBe(0);
  });

  it("is quiet before it starts and a step of zero changes nothing", () => {
    const p = new Pulse();
    expect(p.step(1 / 60)).toBe(0);
    p.start(1);
    p.step(0.3);
    const v = p.value;
    expect(p.step(0)).toBe(v);
  });

  it("a second touch while it runs does not make the value jump", () => {
    const p = new Pulse();
    p.start(1, 0.1, 0.5);
    for (let i = 0; i < 40; i += 1) p.step(1 / 60);
    const before = p.value;
    p.start(1, 0.1, 0.5);
    const after = p.step(1 / 60);
    expect(Math.abs(after - before)).toBeLessThan(0.25);
    for (let i = 0; i < 120; i += 1) p.step(1 / 60);
    expect(p.active).toBe(false);
  });

  it("reset stops it at once", () => {
    const p = new Pulse();
    p.start(2);
    p.step(0.5);
    p.reset();
    expect(p.value).toBe(0);
    expect(p.active).toBe(false);
  });
});
