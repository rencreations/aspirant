import { describe, expect, it } from "vitest";

import {
  crossed,
  frameAt,
  framesUntil,
  LEAD_FRAMES,
  skipRate,
  skipWallMs,
  tooFar,
  triggerFrames,
  waitFrames,
  wrapFrame,
} from "./phase";

const SELENA_LOOP_FRAMES = 486;
const FPS = 60;

describe("loop frame maths", () => {
  it("wraps into the loop", () => {
    expect(wrapFrame(-1, SELENA_LOOP_FRAMES)).toBe(SELENA_LOOP_FRAMES - 1);
    expect(wrapFrame(SELENA_LOOP_FRAMES, SELENA_LOOP_FRAMES)).toBe(0);
    expect(frameAt(1, SELENA_LOOP_FRAMES, FPS)).toBe(60);
    expect(frameAt(8.1, SELENA_LOOP_FRAMES, FPS)).toBe(0);
  });

  it("works for loops of another length", () => {
    expect(wrapFrame(245, 240)).toBe(5);
    expect(frameAt(4.05, 240, FPS)).toBe(3);
    expect(framesUntil(236, 4, 240)).toBe(8);
    expect(crossed(238, 1, [0], 240)).toBe(true);
    expect(triggerFrames([1], 240)).toEqual([240 - 2]);
  });

  it("counts frames forward round the loop", () => {
    expect(framesUntil(10, 15, SELENA_LOOP_FRAMES)).toBe(5);
    expect(framesUntil(480, 4, SELENA_LOOP_FRAMES)).toBe(10);
    expect(framesUntil(7, 7, SELENA_LOOP_FRAMES)).toBe(0);
  });

  it("starts videos a few frames early", () => {
    expect(triggerFrames([100, 2], SELENA_LOOP_FRAMES)).toEqual([
      100 - LEAD_FRAMES,
      SELENA_LOOP_FRAMES - 1,
    ]);
  });

  it("sees a trigger even when frames were skipped, and across the wrap", () => {
    const t = [100];
    expect(crossed(98, 99, t, SELENA_LOOP_FRAMES)).toBe(false);
    expect(crossed(99, 100, t, SELENA_LOOP_FRAMES)).toBe(true);
    expect(crossed(97, 102, t, SELENA_LOOP_FRAMES)).toBe(true);
    expect(crossed(100, 101, t, SELENA_LOOP_FRAMES)).toBe(false);
    expect(crossed(SELENA_LOOP_FRAMES - 3, 2, [0], SELENA_LOOP_FRAMES)).toBe(true);
    // A jump back (a seek) is not a crossing.
    expect(crossed(300, 10, [200], SELENA_LOOP_FRAMES)).toBe(false);
  });

  it("starts a video at once when the loop is too far from its frame", () => {
    const n = 610;
    const t = triggerFrames([200], n);
    // 20 frames before the trigger frame, with a limit of 24: it waits for the frame.
    expect(tooFar(t[0]! - 20, t, 24, n)).toBe(false);
    expect(tooFar(t[0]!, t, 24, n)).toBe(false);
    expect(tooFar(t[0]! - 25, t, 24, n)).toBe(true);
    // Just after the frame it has to come all the way round: start now.
    expect(tooFar(t[0]! + 1, t, 24, n)).toBe(true);
    // No limit: it always waits.
    expect(tooFar(t[0]! + 1, t, undefined, n)).toBe(false);
  });

  it("reports the wait until the next start", () => {
    expect(waitFrames(110, [100, 262], SELENA_LOOP_FRAMES)).toBe(152);
    expect(waitFrames(100, [100], SELENA_LOOP_FRAMES)).toBe(0);
  });
});

describe("time skip", () => {
  const skip = { maxRate: 2.25, minFrames: 70 };

  it("runs at normal speed for a short wait and when the frame is near", () => {
    expect(skipWallMs(60, 60, skip)).toBe(1000);
    expect(skipRate(10, 5000, 2.25)).toBeCloseTo(1, 1);
    expect(skipRate(400, 0, 2.25)).toBe(1);
  });

  it("eases up to the top speed and back down to normal", () => {
    expect(skipRate(400, 450, 2.25)).toBeCloseTo(2.25, 5);
    const mid = skipRate(45, 5000, 2.25);
    expect(mid).toBeGreaterThan(1.3);
    expect(mid).toBeLessThan(2.25);
    expect(skipRate(0, 5000, 2.25)).toBe(1);
  });

  it("makes a long wait much shorter, and never longer than the wait at normal speed", () => {
    const full = (480 / 60) * 1000;
    const wait = skipWallMs(480, 60, skip);
    expect(wait).toBeLessThan(full * 0.65);
    expect(wait).toBeGreaterThan(full * 0.3);
    for (const frames of [90, 150, 241, 482]) {
      expect(skipWallMs(frames, 60, skip)).toBeLessThanOrEqual((frames / 60) * 1000 + 20);
    }
    expect(skipWallMs(480, 60, null)).toBe(full);
  });
});
