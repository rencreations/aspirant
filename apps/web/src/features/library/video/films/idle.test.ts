import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IDLE_MS, IdleWatch } from "./idle";

describe("the controls hiding in full screen", () => {
  let told: boolean[];
  let watch: IdleWatch;

  beforeEach(() => {
    vi.useFakeTimers();
    told = [];
    watch = new IdleWatch((idle) => told.push(idle));
  });

  afterEach(() => {
    watch.stop();
    vi.useRealTimers();
  });

  it("never hides while it is off (outside full screen)", () => {
    watch.wake();
    vi.advanceTimersByTime(IDLE_MS * 4);
    expect(watch.hidden).toBe(false);
    expect(told).toEqual([]);
  });

  it("hides after the idle time with nothing done", () => {
    watch.start();
    vi.advanceTimersByTime(IDLE_MS - 1);
    expect(watch.hidden).toBe(false);
    vi.advanceTimersByTime(1);
    expect(watch.hidden).toBe(true);
    expect(told).toEqual([true]);
  });

  it("shows again on any action and waits anew", () => {
    watch.start();
    vi.advanceTimersByTime(IDLE_MS);
    watch.wake();
    expect(watch.hidden).toBe(false);
    vi.advanceTimersByTime(IDLE_MS - 100);
    watch.wake();
    vi.advanceTimersByTime(IDLE_MS - 100);
    expect(watch.hidden).toBe(false);
    vi.advanceTimersByTime(100);
    expect(watch.hidden).toBe(true);
    expect(told).toEqual([true, false, true]);
  });

  it("stays shown while held, and waits from the end of the last hold", () => {
    watch.start();
    watch.hold("bar", true);
    watch.hold("sheet", true);
    vi.advanceTimersByTime(IDLE_MS * 3);
    expect(watch.hidden).toBe(false);
    watch.hold("bar", false);
    vi.advanceTimersByTime(IDLE_MS * 3);
    expect(watch.hidden).toBe(false);
    watch.hold("sheet", false);
    vi.advanceTimersByTime(IDLE_MS);
    expect(watch.hidden).toBe(true);
  });

  it("a hold shows hidden controls at once", () => {
    watch.start();
    vi.advanceTimersByTime(IDLE_MS);
    watch.hold("sheet", true);
    expect(watch.hidden).toBe(false);
  });

  it("shows the controls when it stops, and stays quiet after", () => {
    watch.start();
    vi.advanceTimersByTime(IDLE_MS);
    watch.stop();
    expect(watch.hidden).toBe(false);
    vi.advanceTimersByTime(IDLE_MS * 2);
    expect(told).toEqual([true, false]);
  });

  it("keeps a hold made while off for when it starts", () => {
    watch.hold("sheet", true);
    watch.start();
    vi.advanceTimersByTime(IDLE_MS * 2);
    expect(watch.hidden).toBe(false);
  });
});
