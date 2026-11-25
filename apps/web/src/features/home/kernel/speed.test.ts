import { describe, expect, it } from "vitest";

import { layoutSections } from "./layout";
import { SECTIONS } from "./sections";
import {
  FREE_SPEED,
  SceneGovernor,
  leadAt,
  limitSpeed,
  normalizeRanges,
  speedAt,
  type GovernFrame,
  type SpeedRange,
} from "./speed";

const RANGES: readonly SpeedRange[] = [{ start: 20, end: 22, speed: 1 }];

describe("limitSpeed", () => {
  it("lets the scene go where it is asked when the frame has no time or nothing is asked", () => {
    expect(limitSpeed(10, 12, 0, RANGES)).toBe(12);
    expect(limitSpeed(10, 10, 0.016, RANGES)).toBe(10);
  });

  it("holds free ground to the free speed, and lets a free speed of Infinity through", () => {
    expect(limitSpeed(10, 12, 0.1, [], 3)).toBeCloseTo(10.3, 9);
    expect(limitSpeed(10, 10.5, 0.016, RANGES, Infinity)).toBe(10.5);
    expect(limitSpeed(25, 24, 0.016, RANGES, Infinity)).toBe(24);
  });

  it("holds a move inside a range to the range's speed, both ways", () => {
    expect(limitSpeed(20.5, 25, 0.1, RANGES)).toBeCloseTo(20.6, 9);
    expect(limitSpeed(21.5, 10, 0.1, RANGES)).toBeCloseTo(21.4, 9);
  });

  it("crosses free ground at the free speed, then slows down at the edge of a range", () => {
    // 0.1 screens of free ground at 2 take 0.05 s; the other 0.05 s go at 1 inside the range.
    expect(limitSpeed(19.9, 25, 0.1, RANGES, 2)).toBeCloseTo(20.05, 9);
    expect(limitSpeed(22.1, 15, 0.1, RANGES, 2)).toBeCloseTo(21.95, 9);
  });

  it("lets a move that ends inside the range through", () => {
    expect(limitSpeed(20.5, 20.55, 0.1, RANGES)).toBeCloseTo(20.55, 9);
  });

  it("never moves the scene past where it was asked, or against the way it was asked", () => {
    for (const [scene, ask] of [
      [19, 30],
      [30, 19],
      [20.7, 21.9],
      [21.9, 20.7],
      [22.5, 22.4],
    ] as const) {
      const out = limitSpeed(scene, ask, 0.05, RANGES);
      if (ask > scene) {
        expect(out).toBeGreaterThanOrEqual(scene);
        expect(out).toBeLessThanOrEqual(ask);
      } else {
        expect(out).toBeLessThanOrEqual(scene);
        expect(out).toBeGreaterThanOrEqual(ask);
      }
    }
  });

  it("never steps further in a frame than the fastest stretch allows", () => {
    let s = 0;
    for (let i = 0; i < 2000; i++) {
      const next = limitSpeed(s, 40, 1 / 60, RANGES);
      expect(next - s).toBeLessThanOrEqual(FREE_SPEED / 60 + 1e-9);
      s = next;
    }
    expect(s).toBe(40);
  });
});

describe("speedAt and leadAt", () => {
  it("read the range or the free ground, the lower one on an edge", () => {
    expect(speedAt(10, RANGES)).toBe(FREE_SPEED);
    expect(speedAt(21, RANGES)).toBe(1);
    expect(speedAt(20, RANGES)).toBe(1);
    expect(speedAt(22, RANGES)).toBe(1);
  });

  it("give a slower stretch a shorter lead, within its limits", () => {
    expect(leadAt(21, RANGES)).toBeLessThan(leadAt(10, RANGES));
    expect(leadAt(21, RANGES)).toBeGreaterThan(0);
    expect(leadAt(10, RANGES)).toBeLessThanOrEqual(1.2);
  });
});

describe("SceneGovernor", () => {
  const frame = (real: number, over: Partial<GovernFrame> = {}): GovernFrame => ({
    real,
    dt: 1 / 60,
    forced: false,
    holding: false,
    visitor: true,
    ...over,
  });

  it("starts on the page and takes a forced position as it is", () => {
    const g = new SceneGovernor(RANGES);
    expect(g.step(frame(5))).toBe(5);
    expect(g.step(frame(9, { forced: true }))).toBe(9);
  });

  it("follows a hard wheel at the top speed and puts the page back to the lead", () => {
    const g = new SceneGovernor(RANGES);
    g.step(frame(5));
    const seen = g.step(frame(8));
    expect(seen).toBeCloseTo(5 + FREE_SPEED / 60, 9);
    expect(g.pull).toBeCloseTo(seen + g.lead(), 9);
  });

  it("does not put back a move that is not the visitor's scroll, and jumps a long one", () => {
    const g = new SceneGovernor(RANGES);
    g.step(frame(5));
    g.step(frame(6, { visitor: false }));
    expect(g.pull).toBeNaN();
    expect(g.step(frame(30, { visitor: false }))).toBe(30);
  });

  it("stands still while a play holds the page", () => {
    const g = new SceneGovernor(RANGES);
    g.step(frame(5));
    expect(g.step(frame(5.4, { holding: true }))).toBe(5);
  });

  it("never steps more than a frame of the top speed, whatever the page does", () => {
    const g = new SceneGovernor(RANGES);
    let last = g.step(frame(0));
    for (let i = 0; i < 600; i++) {
      const real = Number.isNaN(g.pull) ? last + 3 : g.pull + 3;
      const s = g.step(frame(real));
      expect(Math.abs(s - last)).toBeLessThanOrEqual(FREE_SPEED / 60 + 1e-9);
      last = s;
    }
  });
});

describe("normalizeRanges", () => {
  it("keeps apart ranges and sorts them", () => {
    const out = normalizeRanges([
      { start: 30, end: 31, speed: 2 },
      { start: 10, end: 12, speed: 1 },
    ]);
    expect(out).toEqual([
      { start: 10, end: 12, speed: 1 },
      { start: 30, end: 31, speed: 2 },
    ]);
  });

  it("takes the lowest speed where two ranges meet and joins what has the same speed", () => {
    const out = normalizeRanges([
      { start: 10, end: 14, speed: 1.5 },
      { start: 12, end: 16, speed: 0.9 },
      { start: 16, end: 18, speed: 0.9 },
    ]);
    expect(out).toEqual([
      { start: 10, end: 12, speed: 1.5 },
      { start: 12, end: 18, speed: 0.9 },
    ]);
  });
});

describe("the sections' top speeds", () => {
  const layout = layoutSections(SECTIONS);

  it("are positive stretches of the section that names them", () => {
    let named = 0;
    for (const placed of layout.placed) {
      for (const stretch of placed.def.topSpeed ?? []) {
        named++;
        expect(stretch.speed).toBeGreaterThan(0);
        expect(stretch.to).toBeGreaterThan(stretch.from);
        // A stretch may begin in the section's lead and end in its tail.
        expect(stretch.from).toBeGreaterThanOrEqual(-placed.def.lead);
        expect(stretch.to).toBeLessThanOrEqual(placed.def.screens + placed.def.tail);
      }
    }
    expect(named).toBeGreaterThan(0);
    for (const id of ["funny", "chase", "bend", "archive"]) {
      expect(layout.placed.find((p) => p.id === id)?.def.topSpeed?.length, id).toBeGreaterThan(0);
    }
  });
});
