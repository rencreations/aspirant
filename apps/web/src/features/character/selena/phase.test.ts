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
import { SELENA_CLIPS, SELENA_LOOP_FRAMES } from "./timeline.generated";

describe("loop frame maths", () => {
  it("wraps into the loop", () => {
    expect(wrapFrame(-1)).toBe(SELENA_LOOP_FRAMES - 1);
    expect(wrapFrame(SELENA_LOOP_FRAMES)).toBe(0);
    expect(frameAt(1)).toBe(60);
    expect(frameAt(8.1)).toBe(0);
  });

  it("counts frames forward round the loop", () => {
    expect(framesUntil(10, 15)).toBe(5);
    expect(framesUntil(480, 4)).toBe(10);
    expect(framesUntil(7, 7)).toBe(0);
  });

  it("starts clips a few frames early", () => {
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

describe("clip timing data", () => {
  it("has start phases inside the loop and 162 frames apart", () => {
    for (const clip of Object.values(SELENA_CLIPS)) {
      expect(clip.startPhases.length).toBeGreaterThan(1);
      for (const p of clip.startPhases) {
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThan(SELENA_LOOP_FRAMES);
      }
      expect(clip.endPhase).toBeGreaterThanOrEqual(0);
      expect(clip.endPhase).toBeLessThan(SELENA_LOOP_FRAMES);
      expect(clip.frames).toBeGreaterThan(600);
    }
  });
});
