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

  it("reports the wait until the next start", () => {
    expect(waitFrames(110, [100, 262], SELENA_LOOP_FRAMES)).toBe(152);
    expect(waitFrames(100, [100], SELENA_LOOP_FRAMES)).toBe(0);
  });
});
