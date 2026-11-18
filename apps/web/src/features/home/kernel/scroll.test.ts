import { describe, expect, it } from "vitest";

import {
  JUMP_SCREENS,
  LAG_KNEE,
  LAG_MAX,
  SCENE_OMEGA,
  SceneScroll,
  screensOf,
  screensToEnd,
  softLag,
  springStep,
} from "./scroll";

describe("springStep", () => {
  it("lands on the target", () => {
    let s = { x: 0, v: 0 };
    for (let i = 0; i < 120; i++) s = springStep(s.x, s.v, 3, SCENE_OMEGA, 1 / 60);
    expect(s.x).toBeCloseTo(3, 6);
    expect(s.v).toBeCloseTo(0, 5);
  });

  it("never overshoots (it is critically damped)", () => {
    let s = { x: 0, v: 0 };
    let peak = 0;
    for (let i = 0; i < 240; i++) {
      s = springStep(s.x, s.v, 1, SCENE_OMEGA, 1 / 60);
      peak = Math.max(peak, s.x);
    }
    expect(peak).toBeLessThanOrEqual(1 + 1e-9);
  });

  it("is exact: one long step equals many short ones", () => {
    let many = { x: 0, v: 2 };
    for (let i = 0; i < 60; i++) many = springStep(many.x, many.v, 5, 9, 1 / 60);
    const one = springStep(0, 2, 5, 9, 1);
    expect(one.x).toBeCloseTo(many.x, 9);
    expect(one.v).toBeCloseTo(many.v, 9);
  });
});

describe("softLag", () => {
  it("passes a small lag through unchanged", () => {
    expect(softLag(0.05)).toBe(0.05);
    expect(softLag(-LAG_KNEE)).toBe(-LAG_KNEE);
  });

  it("compresses a big lag and never exceeds the ceiling", () => {
    expect(softLag(0.15)).toBeGreaterThan(LAG_KNEE);
    expect(softLag(0.15)).toBeLessThan(0.15);
    expect(softLag(50)).toBeLessThanOrEqual(LAG_MAX);
    expect(softLag(-50)).toBeGreaterThanOrEqual(-LAG_MAX);
  });

  it("is continuous and increasing at the knee", () => {
    const a = softLag(LAG_KNEE - 1e-6);
    const b = softLag(LAG_KNEE + 1e-6);
    expect(b).toBeGreaterThan(a);
    expect(b - a).toBeLessThan(1e-5);
  });
});

describe("SceneScroll", () => {
  it("starts on the real position, as a jump", () => {
    const s = new SceneScroll();
    expect(s.step(12.5, 1 / 60)).toBe(true);
    expect(s.shown).toBe(12.5);
    expect(s.raw).toBe(12.5);
  });

  it("follows a steady scroll and trails it by a bounded lag", () => {
    const s = new SceneScroll();
    s.step(0, 1 / 60);
    let raw = 0;
    let worst = 0;
    for (let i = 0; i < 600; i++) {
      raw += 0.04; // 2.4 screens a second
      s.step(raw, 1 / 60);
      worst = Math.max(worst, raw - s.shown);
    }
    expect(worst).toBeLessThanOrEqual(LAG_MAX + 1e-9);
    expect(raw - s.shown).toBeGreaterThan(0);
    expect(s.velocity).toBeGreaterThan(1.5);
  });

  it("settles on the real position when the scroll stops", () => {
    const s = new SceneScroll();
    s.step(0, 1 / 60);
    for (let i = 0; i < 60; i++) s.step(0.9, 1 / 60);
    for (let i = 0; i < 120; i++) s.step(1, 1 / 60);
    expect(s.shown).toBeCloseTo(1, 4);
    expect(Math.abs(s.velocity)).toBeLessThan(0.01);
  });

  it("answers the same at 60 and at 144 frames a second", () => {
    const run = (hz: number) => {
      const s = new SceneScroll();
      s.step(0, 1 / hz);
      for (let i = 0; i < hz; i++) s.step((i + 1) / hz, 1 / hz); // one screen in one second
      return s.shown;
    };
    expect(Math.abs(run(60) - run(144))).toBeLessThan(0.01);
  });

  it("snaps on a jump instead of flying there", () => {
    const s = new SceneScroll();
    s.step(0, 1 / 60);
    expect(s.step(JUMP_SCREENS + 3, 1 / 60)).toBe(true);
    expect(s.shown).toBe(JUMP_SCREENS + 3);
    expect(s.velocity).toBe(0);
    expect(s.step(JUMP_SCREENS + 3.01, 1 / 60)).toBe(false);
  });

  it("holds the shown position while time is frozen (dt of 0)", () => {
    const s = new SceneScroll();
    s.step(2, 1 / 60);
    s.step(2.1, 0);
    expect(s.shown).toBe(2);
    expect(s.raw).toBe(2.1);
  });

  it("can be put on a position by hand", () => {
    const s = new SceneScroll();
    s.step(0, 1 / 60);
    s.snap(7);
    expect(s.shown).toBe(7);
    s.step(7, 1 / 60);
    expect(s.shown).toBeCloseTo(7, 9);
  });
});

describe("screensOf and screensToEnd", () => {
  it("converts pixels to screens", () => {
    expect(screensOf(1800, 900)).toBe(2);
    expect(screensOf(100, 0)).toBe(0);
  });

  it("says how far the end of the page is, in screens", () => {
    // A page of 10 screens, a viewport of one: the last scroll position is 9 screens down.
    expect(screensToEnd(0, 9000, 900)).toBeCloseTo(9);
    expect(screensToEnd(8100, 9000, 900)).toBeCloseTo(0);
    expect(screensToEnd(8200, 9000, 900)).toBe(0);
  });

  it("has no end on a page with nothing to scroll", () => {
    expect(screensToEnd(0, 900, 900)).toBe(Infinity);
    expect(screensToEnd(0, 800, 900)).toBe(Infinity);
    expect(screensToEnd(0, 900, 0)).toBe(Infinity);
  });
});
