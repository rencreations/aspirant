import { describe, expect, it } from "vitest";

import { KiteSim } from "./kite-sim";
import {
  chainLength,
  createChain,
  createForces,
  cutChain,
  layChain,
  smoothChain,
  stepChain,
} from "./rope";

function fly(sim: KiteSim, seconds: number, dt = 1 / 60) {
  for (let t = 0; t < seconds; t += dt) sim.step(dt);
}

function setup(seed = 7) {
  const sim = new KiteSim(seed);
  sim.setHand(-420, -250);
  sim.setSpot(-120, 250, 200);
  sim.reset();
  return sim;
}

const finite = (sim: KiteSim) =>
  [sim.look.x, sim.look.y, sim.look.roll, sim.look.footX, sim.look.footY].every(Number.isFinite);

describe("the chain", () => {
  it("holds its pin and keeps its links near their length when pulled taut", () => {
    const c = createChain(20);
    layChain(c, 20, 0, 0, 0, 300);
    c.pin = { x: 0, y: 0 };
    const f = createForces();
    f.tipPull = 40;
    f.tipX = 40;
    f.tipY = 300;
    for (let i = 0; i < 600; i += 1) stepChain(c, 1 / 120, f);
    expect(c.x[0]).toBe(0);
    expect(c.y[0]).toBe(0);
    const stretch = chainLength(c) / (c.link * (c.n - 1));
    expect(stretch).toBeGreaterThan(0.99);
    expect(stretch).toBeLessThan(1.04);
  });

  it("falls under gravity when its pin is let go", () => {
    const c = createChain(10);
    layChain(c, 10, 0, 100, 90, 100);
    const f = createForces();
    for (let i = 0; i < 240; i += 1) stepChain(c, 1 / 120, f);
    expect(c.y[9]).toBeLessThan(-100);
  });

  it("stops on a floor", () => {
    const c = createChain(10);
    layChain(c, 10, 0, 100, 90, 100);
    const f = createForces();
    f.floor = -50;
    for (let i = 0; i < 1200; i += 1) stepChain(c, 1 / 120, f);
    for (let i = 0; i < c.n; i += 1) expect(c.y[i]).toBeGreaterThanOrEqual(-50 - 1e-6);
  });

  it("cuts into two parts that keep their points and their pins", () => {
    const c = createChain(12);
    layChain(c, 12, 0, 0, 110, 0);
    c.pin = { x: 0, y: 0 };
    const lo = createChain(12);
    const up = createChain(12);
    cutChain(c, 4, lo, up);
    expect(lo.n).toBe(5);
    expect(up.n).toBe(7);
    expect(lo.pin).not.toBeNull();
    expect(up.pin).toBeNull();
    expect(up.x[0]).toBeCloseTo(50, 6);
  });

  it("smooths a line through the points and passes through each of them", () => {
    const c = createChain(6);
    layChain(c, 6, 0, 0, 50, 0);
    c.y[2] = 20;
    const out = new Float32Array(200);
    const n = smoothChain(c, 4, out);
    expect(n).toBe((6 - 1) * 4 + 1);
    expect(out[0]).toBeCloseTo(0, 4);
    expect(out[(n - 1) * 2]).toBeCloseTo(50, 4);
    // A point of the chain lies on the line.
    expect(out[8 * 2 + 1]).toBeCloseTo(20, 4);
  });
});

describe("the kite", () => {
  it("flies near its spot on a taut rope and keeps its tail on its foot", () => {
    const sim = setup();
    fly(sim, 5);
    expect(finite(sim)).toBe(true);
    const off = Math.hypot(sim.look.x - -120, sim.look.y - 250);
    expect(off).toBeLessThan(0.3 * 200);
    // The rope is neither slack nor stretched.
    const stretch = chainLength(sim.rope) / (sim.rope.link * (sim.rope.n - 1));
    expect(stretch).toBeGreaterThan(0.98);
    expect(stretch).toBeLessThan(1.05);
    expect(sim.rope.x[0]).toBe(-420);
    expect(sim.tail.x[0]).toBeCloseTo(sim.look.footX, 0);
  });

  it("is the same line at 60 and 144 Hz", () => {
    const a = setup();
    const b = setup();
    fly(a, 4, 1 / 60);
    fly(b, 4, 1 / 144);
    expect(Math.abs(a.look.x - b.look.x)).toBeLessThan(0.12 * 200);
    expect(Math.abs(a.look.y - b.look.y)).toBeLessThan(0.12 * 200);
  });

  it("follows a hand that runs, and a spot that moves", () => {
    const sim = setup();
    fly(sim, 1);
    for (let i = 0; i < 180; i += 1) {
      sim.setHand(-420 + i * 5, -250);
      sim.setSpot(-120 + i * 5, 250, 200);
      sim.step(1 / 60);
    }
    expect(sim.rope.x[0]).toBe(-420 + 179 * 5);
    expect(Math.abs(sim.look.x - (-120 + 179 * 5))).toBeLessThan(120);
    expect(finite(sim)).toBe(true);
  });

  it("falls when cut: the lower part drops from her hand, the kite comes down to the floor", () => {
    const sim = setup();
    sim.setFloor(-300);
    fly(sim, 2);
    sim.cut(0.45, "fall");
    expect(sim.state).toBe("cut");
    const y0 = sim.look.y;
    fly(sim, 0.8);
    expect(sim.look.y).toBeLessThan(y0 - 40);
    fly(sim, 8);
    expect(sim.look.y).toBeLessThan(-250);
    expect(sim.look.y).toBeGreaterThan(-340);
    // The lower part hangs from the hand.
    expect(sim.lower.x[0]).toBe(-420);
    const n = sim.lower.n;
    expect(sim.lower.y[n - 1]).toBeLessThan(-250);
    expect(finite(sim)).toBe(true);
  });

  it("flies off when cut with `fly`: far away and rising within a few seconds", () => {
    const sim = setup();
    fly(sim, 2);
    sim.cut(0.5, "fly");
    fly(sim, 4);
    const away = Math.hypot(sim.look.x - -120, sim.look.y - 250);
    expect(away).toBeGreaterThan(900);
    expect(sim.look.y).toBeGreaterThan(250);
    expect(finite(sim)).toBe(true);
  });

  it("cuts once and ignores a second cut", () => {
    const sim = setup();
    fly(sim, 1);
    sim.cut(0.3, "fall");
    const n = sim.lower.n;
    sim.cut(0.8, "fly");
    expect(sim.lower.n).toBe(n);
    expect(sim.outcome).toBe("fall");
  });

  it("still cuts when it is cut before its first step, and stays cut", () => {
    const sim = new KiteSim();
    sim.setHand(-420, -250);
    sim.setSpot(-120, 250, 200);
    sim.cut(0.5, "fall");
    expect(sim.state).toBe("cut");
    fly(sim, 1);
    expect(sim.state).toBe("cut");
    expect(sim.lower.n).toBeGreaterThan(1);
    expect(sim.upper.n).toBeGreaterThan(1);
  });

  it("says where on the rope a point is nearest, and nothing once it is cut", () => {
    const sim = setup();
    fly(sim, 2);
    const out = { at: 0, dist: 0 };
    // The middle of the line from the hand to the kite.
    const mx = (sim.rope.x[0] ?? 0) / 2 + (sim.rope.x[sim.rope.n - 1] ?? 0) / 2;
    const my = (sim.rope.y[0] ?? 0) / 2 + (sim.rope.y[sim.rope.n - 1] ?? 0) / 2;
    expect(sim.nearest(mx, my, out)).toBe(true);
    expect(out.at).toBeGreaterThan(0.35);
    expect(out.at).toBeLessThan(0.65);
    // The rope hangs in a curve, so the straight line is a little off it.
    expect(out.dist).toBeLessThan(150);
    sim.nearest(-420, -250, out);
    expect(out.at).toBeLessThan(0.05);
    expect(out.dist).toBeLessThan(1);
    sim.cut(0.5, "fall");
    expect(sim.nearest(mx, my, out)).toBe(false);
  });

  it("is whole again after a reset", () => {
    const sim = setup();
    fly(sim, 1);
    sim.cut(0.4, "fall");
    fly(sim, 1);
    sim.reset();
    expect(sim.state).toBe("tethered");
    fly(sim, 3);
    expect(Math.hypot(sim.look.x - -120, sim.look.y - 250)).toBeLessThan(60);
  });

  it("a jump of the settle is as good as the same time played", () => {
    const a = setup();
    const b = setup();
    fly(a, 1);
    a.cut(0.5, "fall");
    b.settle(1);
    b.cut(0.5, "fall");
    a.settle(3);
    b.settle(3);
    expect(Math.abs(a.look.y - b.look.y)).toBeLessThan(80);
  });
});
