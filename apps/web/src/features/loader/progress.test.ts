import { describe, expect, it } from "vitest";

import { formAmount, statusIndex, stepProgress, targetProgress } from "./progress";

const base = { done: 0, total: 3, elapsedMs: 0, sinceLastMs: 0, minDurationMs: 2400 };

describe("targetProgress", () => {
  it("is held back by the minimum duration even when everything has loaded", () => {
    expect(targetProgress({ ...base, done: 3, elapsedMs: 1200 })).toBeCloseTo(0.5);
    expect(targetProgress({ ...base, done: 3, elapsedMs: 5000 })).toBe(1);
  });

  it("is held back by real loading when the time has passed", () => {
    expect(targetProgress({ ...base, done: 1, elapsedMs: 9000 })).toBeCloseTo(1 / 3);
  });

  it("creeps toward the next task but never reaches it", () => {
    const stalled = targetProgress({ ...base, done: 1, elapsedMs: 9000, sinceLastMs: 60_000 });
    expect(stalled).toBeGreaterThan(1 / 3 + 0.2);
    expect(stalled).toBeLessThan(2 / 3);
  });

  it("treats no tasks as loaded and stays within 0 to 1", () => {
    expect(targetProgress({ ...base, total: 0, elapsedMs: 600 })).toBeCloseTo(0.25);
    expect(targetProgress({ ...base, done: 9, elapsedMs: 99_999 })).toBe(1);
  });
});

describe("stepProgress", () => {
  it("never moves backwards", () => {
    expect(stepProgress(0.6, 0.4, 16)).toBe(0.6);
    expect(stepProgress(0.6, 0.6, 16)).toBe(0.6);
  });

  it("eases toward the target and lands exactly on it", () => {
    let p = 0;
    let previous = 0;
    for (let i = 0; i < 200; i++) {
      p = stepProgress(p, 1, 16);
      expect(p).toBeGreaterThanOrEqual(previous);
      previous = p;
    }
    expect(p).toBe(1);
  });

  it("does not move without elapsed time", () => {
    expect(stepProgress(0.2, 1, 0)).toBe(0.2);
  });

  it("reaches 100 after the minimum duration when assets are instant", () => {
    let display = 0;
    let t = 0;
    while (display < 1 && t < 10_000) {
      t += 16;
      display = stepProgress(display, targetProgress({ ...base, done: 3, elapsedMs: t }), 16);
    }
    expect(t).toBeGreaterThanOrEqual(2400);
    expect(t).toBeLessThan(4000);
  });
});

describe("statusIndex", () => {
  it("maps progress onto the status lines", () => {
    expect(statusIndex(0, 5)).toBe(0);
    expect(statusIndex(0.39, 5)).toBe(1);
    expect(statusIndex(0.99, 5)).toBe(4);
    expect(statusIndex(1, 5)).toBe(4);
    expect(statusIndex(0.5, 0)).toBe(0);
  });
});

describe("formAmount", () => {
  it("stays at zero for the first half and rises smoothly to one", () => {
    expect(formAmount(0.2)).toBe(0);
    expect(formAmount(0.5)).toBe(0);
    expect(formAmount(0.75)).toBeCloseTo(0.5);
    expect(formAmount(1)).toBe(1);
    expect(formAmount(0.9)).toBeGreaterThan(formAmount(0.8));
  });
});
