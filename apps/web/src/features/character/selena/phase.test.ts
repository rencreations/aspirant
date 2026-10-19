import { describe, expect, it } from "vitest";

import {
  crossed,
  frameAt,
  framesUntil,
  LEAD_FRAMES,
  triggerFrames,
  waitFrames,
  wrapFrame,
} from "./phase";
import { SELENA_LOOP_FRAMES, SELENA_PAGES, SELENA_SHORTS } from "./timeline.generated";

describe("loop frame maths", () => {
  it("wraps into the loop", () => {
    expect(wrapFrame(-1)).toBe(SELENA_LOOP_FRAMES - 1);
    expect(wrapFrame(SELENA_LOOP_FRAMES)).toBe(0);
    expect(frameAt(1)).toBe(60);
    expect(frameAt(8.1)).toBe(0);
  });

  it("works for loops of another length", () => {
    expect(wrapFrame(245, 240)).toBe(5);
    expect(frameAt(4.05, 240)).toBe(3);
    expect(framesUntil(236, 4, 240)).toBe(8);
    expect(crossed(238, 1, [0], 240)).toBe(true);
    expect(triggerFrames([1], 240)).toEqual([240 - 2]);
  });

  it("counts frames forward round the loop", () => {
    expect(framesUntil(10, 15)).toBe(5);
    expect(framesUntil(480, 4)).toBe(10);
    expect(framesUntil(7, 7)).toBe(0);
  });

  it("starts videos a few frames early", () => {
    expect(triggerFrames([100, 2])).toEqual([100 - LEAD_FRAMES, SELENA_LOOP_FRAMES - 1]);
  });

  it("sees a trigger even when frames were skipped, and across the wrap", () => {
    const t = [100];
    expect(crossed(98, 99, t)).toBe(false);
    expect(crossed(99, 100, t)).toBe(true);
    expect(crossed(97, 102, t)).toBe(true);
    expect(crossed(100, 101, t)).toBe(false);
    expect(crossed(SELENA_LOOP_FRAMES - 3, 2, [0])).toBe(true);
    // A jump back (a seek) is not a crossing.
    expect(crossed(300, 10, [200])).toBe(false);
  });

  it("reports the wait until the next start", () => {
    expect(waitFrames(110, [100, 262])).toBe(152);
    expect(waitFrames(100, [100])).toBe(0);
  });
});

describe("timeline data", () => {
  it("has idle start phases inside the loop and 162 frames apart for every page and short", () => {
    const starts = [
      ...Object.values(SELENA_PAGES).map((p) => p.in.startPhases),
      ...Object.values(SELENA_SHORTS).map((s) => s.startPhases),
    ];
    for (const phases of starts) {
      expect(phases).toHaveLength(3);
      for (const p of phases) {
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThan(SELENA_LOOP_FRAMES);
      }
      expect(framesUntil(phases[0], phases[1])).toBe(162);
      expect(framesUntil(phases[1], phases[2])).toBe(162);
    }
  });

  it("gives each exit and short a dissolve point inside the video, a panel point before it and a matching idle phase", () => {
    const backs = [
      ...Object.values(SELENA_PAGES).map((p) => ({ ...p.out, frames: p.out.frames })),
      ...Object.values(SELENA_SHORTS).map((s) => ({ ...s.back, frames: s.frames })),
    ];
    for (const b of backs) {
      expect(b.syncPhase).toBeGreaterThanOrEqual(0);
      expect(b.syncPhase).toBeLessThan(SELENA_LOOP_FRAMES);
      // The panel is back before the dissolve starts, and the dissolve fits in the video.
      expect(b.uiFrame).toBeGreaterThan(60);
      expect(b.uiFrame).toBeLessThan(b.syncFrame);
      const dissolveFrames = (b.blendMs / 1000) * 60;
      expect(b.syncFrame + dissolveFrames).toBeLessThan(b.frames);
      expect(b.align).toBeGreaterThan(0.98);
      expect(b.align).toBeLessThanOrEqual(1);
    }
  });

  it("gives each page a loop and an exit that starts inside it", () => {
    for (const page of Object.values(SELENA_PAGES)) {
      expect([240, 486]).toContain(page.loop.frames);
      expect(page.out.startPhase).toBeGreaterThanOrEqual(0);
      expect(page.out.startPhase).toBeLessThan(page.loop.frames);
      expect(page.in.frames).toBeGreaterThan(120);
      expect(page.out.frames).toBeGreaterThan(300);
      expect(page.in.align).toBeLessThanOrEqual(1);
    }
    for (const short of Object.values(SELENA_SHORTS)) expect(short.frames).toBeGreaterThan(300);
  });
});
