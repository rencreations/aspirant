import { describe, expect, it } from "vitest";

import { makeCarousel, RESUME_DELAY, stepCarousel } from "./carousel";
import {
  bendOf,
  edgeStrength,
  flutterOf,
  hoverEase,
  idleMotion,
  parallaxOffset,
  pointerForce,
  pushRadius,
  quadPad,
  STREAK_MAX_SHARE,
  streakOf,
  type Idle,
} from "./live";
import { clipSoftEdges } from "./math";
import { lowpassGain, makeSpring, softClamp, springSnap, springStep } from "./spring";
import {
  smoothVelocity,
  stirForce,
  stirRadius,
  STIR_CAP,
  wakeIsLive,
  wakeSize,
  WAKE_LIVE_S,
  WAKE_LONG,
} from "./wake-math";

describe("springs", () => {
  it("settle on the target and do not blow up on a long frame", () => {
    const s = makeSpring(0);
    for (let i = 0; i < 240; i++) springStep(s, 100, 5.46, 0.56, 1 / 60);
    expect(s.x).toBeCloseTo(100, 1);
    expect(Math.abs(s.v)).toBeLessThan(0.1);
    const big = makeSpring(0);
    springStep(big, 50, 5.46, 0.56, 0.1);
    springStep(big, 50, 5.46, 0.56, 10);
    expect(Number.isFinite(big.x)).toBe(true);
    expect(Math.abs(big.x)).toBeLessThan(500);
  });

  it("overshoots when under damped and not when critically damped", () => {
    const under = makeSpring(0);
    const crit = makeSpring(0);
    let maxUnder = 0;
    let maxCrit = 0;
    for (let i = 0; i < 300; i++) {
      springStep(under, 1, 6, 0.3, 1 / 60);
      springStep(crit, 1, 6, 1, 1 / 60);
      maxUnder = Math.max(maxUnder, under.x);
      maxCrit = Math.max(maxCrit, crit.x);
    }
    expect(maxUnder).toBeGreaterThan(1.1);
    expect(maxCrit).toBeLessThan(1.001);
  });

  it("gives the same motion at 60 and 144 Hz", () => {
    const a = makeSpring(0);
    const b = makeSpring(0);
    for (let i = 0; i < 60; i++) springStep(a, 10, 5.46, 0.56, 1 / 60);
    for (let i = 0; i < 144; i++) springStep(b, 10, 5.46, 0.56, 1 / 144);
    expect(a.x).toBeCloseTo(b.x, 0);
  });

  it("does nothing for no time, and snaps to rest", () => {
    const s = makeSpring(3);
    springStep(s, 9, 5, 0.5, 0);
    expect(s.x).toBe(3);
    springSnap(s, 7);
    expect(s).toEqual({ x: 7, v: 0 });
    expect(lowpassGain(8, 0)).toBe(0);
    expect(lowpassGain(8, 1)).toBeGreaterThan(0.99);
    expect(softClamp(0.01, 0.6)).toBeCloseTo(0.01, 4);
    expect(softClamp(100, 0.6)).toBeLessThanOrEqual(0.6);
  });
});

describe("the pointer's push", () => {
  const out: [number, number] = [0, 0];

  it("pushes away from the pointer, hardest at the middle, and not at all past the radius", () => {
    const r = pushRadius(1440, 900);
    expect(r).toBeCloseTo(378, 6);
    pointerForce(0, 0, 100, 0, r, 0, 0, 0, out);
    expect(out[0]).toBeGreaterThan(0);
    expect(out[1]).toBeCloseTo(0, 9);
    const near = out[0];
    pointerForce(0, 0, 300, 0, r, 0, 0, 0, out);
    expect(out[0]).toBeLessThan(near);
    pointerForce(0, 0, r + 1, 0, r, 500, 100, 0, out);
    expect(out).toEqual([0, 0]);
  });

  it("carries the pointer's own stroke when it moves fast", () => {
    pointerForce(0, 0, 0, 80, 378, 0, 0, 0, out);
    const still = out[0];
    pointerForce(0, 0, 0, 80, 378, 1200, 1200, 0, out);
    expect(out[0]).toBeGreaterThan(still);
  });

  it("makes the radius larger on a tall screen only by the shorter side", () => {
    expect(pushRadius(390, 844)).toBe(190);
    expect(pushRadius(2560, 1440)).toBeCloseTo(604.8, 6);
  });
});

describe("idle, parallax, streak and bend", () => {
  it("floats a few pixels and a few hundredths of a radian, out of phase per card", () => {
    const a: Idle = { x: 0, y: 0, rx: 0, ry: 0, rz: 0 };
    const b: Idle = { x: 0, y: 0, rx: 0, ry: 0, rz: 0 };
    let maxX = 0;
    for (let t = 0; t < 30; t += 0.1) {
      idleMotion(t, 3, a);
      maxX = Math.max(maxX, Math.abs(a.x));
      expect(Math.abs(a.rx)).toBeLessThanOrEqual(0.0501);
    }
    expect(maxX).toBeLessThanOrEqual(9.001);
    idleMotion(5, 1, a);
    idleMotion(5, 2, b);
    expect(a.x).not.toBeCloseTo(b.x, 3);
  });

  it("follows the pointer for a near card and goes the other way for a far one", () => {
    expect(parallaxOffset(1, 170)).toBeGreaterThan(15);
    expect(parallaxOffset(1, -430)).toBeLessThan(-40);
    expect(parallaxOffset(0, 170)).toBe(0);
  });

  it("smears along the motion, never past the cap, and not at all at rest", () => {
    const out: [number, number] = [0, 0];
    streakOf(0, 0, 900, out);
    expect(out).toEqual([0, 0]);
    streakOf(1000, 0, 900, out);
    expect(out[0]).toBeCloseTo(22, 6);
    expect(out[1]).toBeCloseTo(0, 9);
    streakOf(0, -50000, 900, out);
    expect(Math.hypot(out[0], out[1])).toBeCloseTo(STREAK_MAX_SHARE * 900, 6);
    expect(out[1]).toBeLessThan(0);
  });

  it("bends and flutters with speed and stays inside its range", () => {
    expect(bendOf(0, 0, 0)).toBe(0);
    expect(bendOf(2400, 0, 0)).toBeGreaterThan(0.5);
    expect(bendOf(1e6, 0, 0)).toBeLessThanOrEqual(0.9);
    expect(bendOf(2400, 0, Math.PI)).toBeLessThan(-0.5);
    expect(flutterOf(0)).toBe(0);
    expect(flutterOf(1e6)).toBeLessThanOrEqual(0.05);
  });

  it("leaves a slow slide crisp and keeps the edge smear full in the hero, 35 percent on the wall", () => {
    const out: [number, number] = [0, 0];
    streakOf(40, 0, 900, out);
    expect(out).toEqual([0, 0]);
    expect(edgeStrength(0)).toBe(1);
    expect(edgeStrength(0.3)).toBe(1);
    expect(edgeStrength(1)).toBeCloseTo(0.35, 9);
  });

  it("pads the quad for the shadow and the streak", () => {
    expect(quadPad(20, 0, 1)).toBe(22);
    expect(quadPad(20, 40, 1)).toBeGreaterThan(quadPad(20, 0, 1) + 30);
    expect(quadPad(20, 40, 0.5)).toBeGreaterThan(quadPad(20, 40, 1));
  });

  it("eases a hover toward its target and stays in 0 to 1", () => {
    let h = 0;
    for (let i = 0; i < 30; i++) h = hoverEase(h, 1, 1 / 60);
    expect(h).toBeGreaterThan(0.6);
    expect(h).toBeLessThan(1);
    expect(hoverEase(0.5, 2, 1)).toBe(1);
  });
});

describe("the carousel", () => {
  const run = (
    c: ReturnType<typeof makeCarousel>,
    seconds: number,
    rate: number,
    hold: boolean,
  ) => {
    for (let t = 0; t < seconds; t += 1 / 60) stepCarousel(c, 1 / 60, rate, hold);
  };

  it("glides at the rate once it has started, and does not move for no time", () => {
    const c = makeCarousel();
    expect(stepCarousel(c, 0, 40, false)).toBe(0);
    run(c, 3, 40, false);
    expect(c.speed).toBeGreaterThan(39);
    expect(c.pos).toBeGreaterThan(80);
  });

  it("stops within half a second on a hold and waits before it resumes", () => {
    const c = makeCarousel();
    run(c, 3, 40, false);
    run(c, 0.5, 40, true);
    expect(c.speed).toBeLessThan(0.5);
    const held = c.pos;
    run(c, 1, 40, true);
    expect(c.pos - held).toBeLessThan(0.5);
    run(c, RESUME_DELAY - 0.1, 40, false);
    expect(c.speed).toBe(0);
    run(c, 2, 40, false);
    expect(c.speed).toBeGreaterThan(30);
  });

  it("goes the other way for a negative rate", () => {
    const c = makeCarousel();
    run(c, 3, -40, false);
    expect(c.pos).toBeLessThan(-80);
  });
});

describe("the wake", () => {
  it("keeps the aspect with 160 texels on the long side", () => {
    expect(wakeSize(1440, 900)).toEqual({ w: WAKE_LONG, h: 100 });
    expect(wakeSize(390, 844)).toEqual({ w: 74, h: WAKE_LONG });
  });

  it("caps the force at the stir speed and keeps the direction", () => {
    const out: [number, number] = [0, 0];
    expect(stirForce(300, 400, out)).toBe(500);
    expect(out).toEqual([300, 400]);
    expect(stirForce(0, -6800, out)).toBe(6800);
    expect(out[1]).toBeCloseTo(-STIR_CAP, 6);
  });

  it("smooths the velocity toward the raw one and lives 2.45 s after a stir", () => {
    let v = 0;
    for (let i = 0; i < 20; i++) v = smoothVelocity(v, 1000, 1 / 60);
    expect(v).toBeGreaterThan(990);
    expect(smoothVelocity(0, 1000, 1 / 60)).toBeCloseTo(350, -1);
    expect(wakeIsLive(WAKE_LIVE_S - 0.01)).toBe(true);
    expect(wakeIsLive(WAKE_LIVE_S + 0.01)).toBe(false);
    expect(stirRadius(1440, 900)).toBe(45);
  });
});

describe("clipSoftEdges", () => {
  const box = [0, 0, 0, 0];
  const widths = [0, 0, 0, 0];

  it("gives the wall's cut edge the soft width and the screen's own edges none", () => {
    // The wall: the left 58 percent of a 1440 by 900 screen, at a device pixel ratio of 2.
    clipSoftEdges({ x: 0, y: 0, w: 835, h: 900 }, 1440, 900, 100, 2, box, widths);
    expect(box).toEqual([0, 0, 1670, 1800]);
    expect(widths).toEqual([0, 0, 200, 0]);
  });

  it("puts the soft edge at the foot on a tall screen", () => {
    clipSoftEdges({ x: 0, y: 0, w: 390, h: 470 }, 390, 844, 27, 1, box, widths);
    expect(widths).toEqual([0, 27, 0, 0]);
    expect(box[1]).toBe(844 - 470);
  });

  it("shrinks the soft width with the gap to the screen's edge, so an opening clip loses it smoothly", () => {
    clipSoftEdges({ x: 0, y: 0, w: 1400, h: 900 }, 1440, 900, 100, 1, box, widths);
    expect(widths[2]).toBe(40);
    clipSoftEdges({ x: 0, y: 0, w: 1440, h: 900 }, 1440, 900, 100, 1, box, widths);
    expect(widths).toEqual([0, 0, 0, 0]);
  });

  it("never gives a negative width for a clip that is wider than the screen", () => {
    clipSoftEdges({ x: -10, y: -5, w: 1500, h: 950 }, 1440, 900, 100, 1, box, widths);
    expect(widths.every((w) => w >= 0)).toBe(true);
  });
});
