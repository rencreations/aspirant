import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PermanentFailure, onRetries, retriesWaiting, untilItArrives } from "./retry";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("untilItArrives", () => {
  it("tries again with a wait that grows to ten seconds, for as long as it takes", async () => {
    const times: number[] = [];
    const attempt = vi.fn((n: number) => {
      times.push(Date.now());
      return n < 6 ? Promise.reject(new Error("down")) : Promise.resolve("here");
    });
    const start = Date.now();
    const result = untilItArrives(attempt);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(await result).toBe("here");
    const waits = times.slice(1).map((t, i) => t - (times[i] ?? start));
    expect(waits).toEqual([1000, 2000, 4000, 8000, 10_000, 10_000]);
  });

  it("stops at a file that is gone, because no retry can fix it", async () => {
    const attempt = vi.fn(() => Promise.reject(new PermanentFailure("HTTP 404", 404)));
    await expect(untilItArrives(attempt)).rejects.toBeInstanceOf(PermanentFailure);
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it("counts the downloads that are waiting to try again", async () => {
    const seen: number[] = [];
    const stop = onRetries(() => seen.push(retriesWaiting()));
    const result = untilItArrives((n) =>
      n === 0 ? Promise.reject(new Error("x")) : Promise.resolve(1),
    );
    await vi.advanceTimersByTimeAsync(1100);
    await result;
    stop();
    expect(seen).toEqual([1, 0]);
  });
});
