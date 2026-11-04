import { describe, expect, it } from "vitest";

import { PULL, PullMeter } from "./pull";

/** Wheel steps of `delta` every `every` ms from `t0`, `n` times. Returns the time after. */
function spin(meter: PullMeter, t0: number, n: number, delta = 100, every = 40): number {
  let t = t0;
  for (let i = 0; i < n; i += 1) {
    meter.wheel(delta, t, true);
    t += every;
  }
  return t;
}

describe("the pull at the end of a chapter", () => {
  it("counts the wheel once the page has rested at the edge, shows, and fills", () => {
    const meter = new PullMeter();
    // Momentum that brought the page down, then goes on at the edge: events close together.
    meter.wheel(120, -40, false);
    meter.wheel(80, 0, true);
    meter.wheel(60, 50, true);
    expect(meter.progress).toBe(0);
    // Rested for 250 ms: the wheel counts.
    expect(meter.wheel(100, 300, true)).toBe(false);
    expect(meter.progress).toBeCloseTo(100 / PULL.threshold);
    expect(meter.shown).toBe(true);
    let filled = false;
    let t = 340;
    while (!filled && t < 2000) {
      filled = meter.wheel(100, t, true);
      t += 40;
    }
    expect(filled).toBe(true);
    expect(meter.progress).toBe(1);
  });

  it("does not count the momentum tail, but a new gesture counts at once", () => {
    const meter = new PullMeter();
    meter.wheel(100, -30, false);
    // A long run of close events from the moment the page arrives: none of the first 250 ms count.
    spin(meter, 0, 6, 100, 40);
    expect(meter.progress).toBe(0);
    // A pause, then a new flick: counts from its first event.
    const fresh = new PullMeter();
    fresh.wheel(80, 60, false);
    fresh.wheel(50, 100, true);
    expect(fresh.progress).toBe(0);
    fresh.wheel(100, 100 + PULL.gapMs + 1, true);
    expect(fresh.progress).toBeCloseTo(100 / PULL.threshold);
  });

  it("only shows the indicator from about twelve percent", () => {
    const meter = new PullMeter();
    meter.edge(true, 0);
    meter.wheel(50, 400, true);
    expect(meter.shown).toBe(false);
    meter.wheel(40, 420, true);
    expect(meter.shown).toBe(true);
  });

  it("drains when the input stops, after a short quiet time", () => {
    const meter = new PullMeter();
    meter.edge(true, 0);
    meter.wheel(300, 400, true);
    expect(meter.tick(400 + PULL.idleMs)).toBeCloseTo(300 / PULL.threshold);
    // Half a second of draining at 600 px a second takes 300 px.
    expect(meter.tick(400 + PULL.idleMs + 250)).toBeCloseTo(150 / PULL.threshold);
    expect(meter.tick(400 + PULL.idleMs + 600)).toBe(0);
  });

  it("goes down with a wheel away from the edge, and empties when the page leaves it", () => {
    const meter = new PullMeter();
    meter.edge(true, 0);
    meter.wheel(300, 400, true);
    meter.wheel(-100, 420, true);
    expect(meter.progress).toBeCloseTo(200 / PULL.threshold);
    meter.edge(false, 450);
    expect(meter.progress).toBe(0);
    // Back at the edge it must rest again before the wheel counts.
    meter.edge(true, 500);
    meter.wheel(100, 520, true);
    expect(meter.progress).toBe(0);
  });

  it("ignores everything when the page is not at the edge", () => {
    const meter = new PullMeter();
    expect(meter.wheel(100, 1000, false)).toBe(false);
    expect(meter.key(1000, false)).toBe(false);
    expect(meter.touch(500, 1000, false)).toBe(false);
    expect(meter.progress).toBe(0);
  });

  it("locks once full, so the momentum after it cannot start a second morph", () => {
    const meter = new PullMeter();
    meter.edge(true, 0);
    let t = 400;
    while (!meter.wheel(200, t, true)) t += 40;
    expect(meter.isLocked).toBe(true);
    expect(meter.shown).toBe(false);
    expect(meter.wheel(200, t + 40, true)).toBe(false);
    expect(meter.key(t + 80, true)).toBe(false);
    // It does not drain while locked, and opens again only on reset.
    expect(meter.tick(t + 5000)).toBe(1);
    meter.reset();
    expect(meter.isLocked).toBe(false);
    expect(meter.progress).toBe(0);
  });

  it("fills with three key presses, which hold longer than the wheel", () => {
    const meter = new PullMeter();
    meter.edge(true, 0);
    expect(meter.key(0, true)).toBe(false);
    expect(meter.key(500, true)).toBe(false);
    expect(meter.key(1000, true)).toBe(true);
  });

  it("follows the finger past the end, and drains after it lifts", () => {
    const meter = new PullMeter();
    meter.edge(true, 0);
    expect(meter.touch(70, 100, true)).toBe(false);
    expect(meter.progress).toBeCloseTo(0.5);
    // No drain while the finger is down.
    expect(meter.tick(2000)).toBeCloseTo(0.5);
    meter.release(2000);
    expect(meter.tick(2000 + PULL.idleMs + 1000)).toBe(0);
    expect(meter.touch(PULL.touchThreshold, 4000, true)).toBe(true);
    expect(meter.isLocked).toBe(true);
  });
});
