import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { whenCalm } from "./calm";

let pending: ((t: number) => void) | null = null;
let now = 0;

/** Runs the frame that is waiting, `dt` ms after the last one. */
function frame(dt: number) {
  now += dt;
  const cb = pending;
  pending = null;
  cb?.(now);
}

beforeEach(() => {
  now = 0;
  pending = null;
  vi.useFakeTimers();
  vi.spyOn(performance, "now").mockImplementation(() => now);
  vi.stubGlobal("requestAnimationFrame", (cb: (t: number) => void) => {
    pending = cb;
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {
    pending = null;
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("whenCalm", () => {
  it("waits for three smooth frames after the first two", () => {
    const done = vi.fn();
    whenCalm(done);
    frame(16); // 1
    frame(16); // 2
    frame(16); // calm 1
    frame(16); // calm 2
    expect(done).not.toHaveBeenCalled();
    frame(16); // calm 3
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("starts counting again after a long frame", () => {
    const done = vi.fn();
    whenCalm(done);
    frame(16);
    frame(16);
    frame(16); // calm 1
    frame(120); // a stall: back to zero
    frame(16); // calm 1
    frame(16); // calm 2
    expect(done).not.toHaveBeenCalled();
    frame(16); // calm 3
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("gives up after maxMs when the frames never calm down", () => {
    const done = vi.fn();
    whenCalm(done, { maxMs: 300 });
    for (let i = 0; i < 6; i++) frame(80);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("is stopped by the function it returns", () => {
    const done = vi.fn();
    const stop = whenCalm(done);
    frame(16);
    stop();
    vi.advanceTimersByTime(5000);
    frame(16);
    expect(done).not.toHaveBeenCalled();
  });

  it("still finishes when no frames are drawn (a hidden tab)", () => {
    const done = vi.fn();
    whenCalm(done, { maxMs: 400 });
    vi.advanceTimersByTime(649);
    expect(done).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("calls done once only", () => {
    const done = vi.fn();
    whenCalm(done, { maxMs: 100 });
    for (let i = 0; i < 5; i++) frame(60);
    vi.advanceTimersByTime(5000);
    expect(done).toHaveBeenCalledTimes(1);
  });
});
