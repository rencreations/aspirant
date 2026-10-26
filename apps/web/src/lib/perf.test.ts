import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  isBad,
  levelFor,
  lowerLevel,
  lowerPerf,
  onPerfLevel,
  raiseLevel,
  perfLevel,
  resetPerfForTests,
  startGovernor,
  type DeviceInfo,
} from "./perf";

const device = (d: Partial<DeviceInfo> = {}): DeviceInfo => ({
  hardwareDecode: true,
  cores: 8,
  memory: 8,
  saveData: false,
  ...d,
});

describe("the level a device starts at", () => {
  it("gives a device with hardware decoding the full level", () => {
    expect(levelFor(device())).toBe("full");
    expect(levelFor(device({ cores: null, memory: null }))).toBe("full");
  });

  it("holds back a device that decodes in software, by its cores", () => {
    expect(levelFor(device({ hardwareDecode: false, cores: 4 }))).toBe("lite");
    expect(levelFor(device({ hardwareDecode: false, cores: 8 }))).toBe("balanced");
    expect(levelFor(device({ hardwareDecode: false, cores: 16 }))).toBe("full");
    // Not known yet counts as hardware: the answer arrives a moment later and only lowers it.
    expect(levelFor(device({ hardwareDecode: null, cores: 4 }))).toBe("full");
  });

  it("is light for data saving and very little memory, and balanced for a weak device", () => {
    expect(levelFor(device({ saveData: true }))).toBe("lite");
    expect(levelFor(device({ memory: 2 }))).toBe("lite");
    expect(levelFor(device({ cores: 2 }))).toBe("balanced");
    expect(levelFor(device({ cores: 4, memory: 4 }))).toBe("balanced");
  });

  it("steps down one level at a time and stops at the lowest", () => {
    expect(lowerLevel("full")).toBe("balanced");
    expect(lowerLevel("balanced")).toBe("lite");
    expect(lowerLevel("lite")).toBe("lite");
  });

  it("steps up one level at a time and stops at the highest", () => {
    expect(raiseLevel("lite")).toBe("balanced");
    expect(raiseLevel("balanced")).toBe("full");
    expect(raiseLevel("full")).toBe("full");
  });
});

describe("what counts as a bad stretch of frames", () => {
  const frames = (n: number, ms: number) => Array.from({ length: n }, () => ms);

  it("passes a steady 60 and a steady 30 frames a second", () => {
    expect(isBad({ deltas: frames(120, 16.7) })).toBe(false);
    expect(isBad({ deltas: frames(60, 33) })).toBe(false);
  });

  it("fails a stretch where one frame in five is slower than 30 fps", () => {
    const d = [...frames(80, 16.7), ...frames(20, 60)];
    expect(isBad({ deltas: d })).toBe(true);
  });

  it("fails a stretch that is slow throughout", () => {
    expect(isBad({ deltas: frames(50, 60) })).toBe(true);
  });

  it("does not judge too few frames, or the gaps of a hidden tab", () => {
    expect(isBad({ deltas: frames(5, 100) })).toBe(false);
    expect(isBad({ deltas: [...frames(60, 16.7), 4000, 5000] })).toBe(false);
  });

  it("fails when the video drops more than one frame in eight", () => {
    const ok = frames(120, 16.7);
    expect(isBad({ deltas: ok, video: { dropped: 5, total: 120 } })).toBe(false);
    expect(isBad({ deltas: ok, video: { dropped: 30, total: 120 } })).toBe(true);
    // Too few video frames to say.
    expect(isBad({ deltas: ok, video: { dropped: 9, total: 10 } })).toBe(false);
  });
});

describe("the level of this visit", () => {
  beforeEach(() => {
    resetPerfForTests();
    window.localStorage.clear();
    window.history.replaceState(null, "", "/");
    delete document.documentElement.dataset.perf;
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is written on <html> for the CSS", () => {
    const level = perfLevel();
    expect(document.documentElement.dataset.perf).toBe(level);
  });

  it("is set from the address, and then nothing lowers it", () => {
    window.history.replaceState(null, "", "/?quality=lite");
    expect(perfLevel()).toBe("lite");
    window.history.replaceState(null, "", "/?quality=full");
    resetPerfForTests();
    expect(perfLevel()).toBe("full");
    expect(lowerPerf("test")).toBe("full");
  });

  it("is remembered, and the memory expires", () => {
    window.localStorage.setItem(
      "aspirants:perf",
      JSON.stringify({ level: "balanced", at: Date.now() }),
    );
    expect(perfLevel()).toBe("balanced");
    resetPerfForTests();
    window.localStorage.setItem(
      "aspirants:perf",
      JSON.stringify({ level: "lite", at: Date.now() - 6 * 24 * 60 * 60 * 1000 }),
    );
    expect(perfLevel()).not.toBe("lite");
  });

  it("trusts a level the governor chose for half an hour, and another for five days", () => {
    const minute = 60 * 1000;
    window.localStorage.setItem(
      "aspirants:perf",
      JSON.stringify({ level: "lite", by: "governor", at: Date.now() - 45 * minute }),
    );
    expect(perfLevel()).not.toBe("lite");
    resetPerfForTests();
    window.localStorage.setItem(
      "aspirants:perf",
      JSON.stringify({ level: "lite", by: "governor", at: Date.now() - 10 * minute }),
    );
    expect(perfLevel()).toBe("lite");
  });

  it("forgets what was remembered with ?quality=auto", () => {
    window.localStorage.setItem(
      "aspirants:perf",
      JSON.stringify({ level: "lite", at: Date.now() }),
    );
    window.history.replaceState(null, "", "/?quality=auto");
    perfLevel();
    expect(window.localStorage.getItem("aspirants:perf")).toBeNull();
  });

  it("steps down and tells listeners, and keeps the new level for next time", () => {
    window.history.replaceState(null, "", "/");
    window.localStorage.setItem(
      "aspirants:perf",
      JSON.stringify({ level: "full", at: Date.now() }),
    );
    const seen: string[] = [];
    perfLevel();
    onPerfLevel((l, why) => seen.push(`${l}:${why}`));
    expect(lowerPerf("frame rate")).toBe("balanced");
    expect(seen).toEqual(["balanced:frame rate"]);
    expect(document.documentElement.dataset.perf).toBe("balanced");
    const kept = JSON.parse(window.localStorage.getItem("aspirants:perf") ?? "{}") as {
      level?: string;
    };
    expect(kept.level).toBe("balanced");
  });
});

describe("the governor", () => {
  let now = 0;
  let queue: Array<(t: number) => void> = [];
  beforeEach(() => {
    resetPerfForTests();
    window.localStorage.clear();
    window.localStorage.setItem(
      "aspirants:perf",
      JSON.stringify({ level: "full", at: Date.now() }),
    );
    window.history.replaceState(null, "", "/");
    now = 1000;
    queue = [];
    vi.spyOn(performance, "now").mockImplementation(() => now);
    vi.stubGlobal("requestAnimationFrame", (fn: (t: number) => void) => {
      queue.push(fn);
      return queue.length;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {
      queue = [];
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  /** Run frames of `ms` each for `seconds`. */
  function run(seconds: number, ms: number) {
    const end = now + seconds * 1000;
    while (now < end) {
      now += ms;
      const fns = queue;
      queue = [];
      for (const fn of fns) fn(now);
    }
  }

  it("leaves a device that holds its frame rate alone", () => {
    const stop = startGovernor();
    run(20, 16.7);
    stop();
    expect(perfLevel()).toBe("full");
  });

  it("steps down after two bad stretches, not after the warm-up or one", () => {
    const stop = startGovernor();
    run(3.5, 100); // still warming up
    expect(perfLevel()).toBe("full");
    run(2.5, 16.7); // one good stretch
    run(2, 100); // one bad stretch
    expect(perfLevel()).toBe("full");
    run(8, 100); // bad again: down
    expect(perfLevel()).toBe("balanced");
    stop();
  });

  it("gives the new level time before judging it again", () => {
    const stop = startGovernor();
    run(14, 100);
    expect(perfLevel()).toBe("balanced");
    run(3, 100); // inside the cool-down
    expect(perfLevel()).toBe("balanced");
    run(10, 100);
    expect(perfLevel()).toBe("lite");
    stop();
  });

  it("never steps down in raise-only mode, and steps up when a remembered drop can recover", () => {
    window.localStorage.setItem(
      "aspirants:perf",
      JSON.stringify({ level: "full", at: Date.now() }),
    );
    resetPerfForTests();
    const busy = startGovernor({ raiseOnly: true });
    run(30, 100); // a busy page: bad frames all the time
    busy();
    expect(perfLevel()).toBe("full");

    window.localStorage.setItem(
      "aspirants:perf",
      JSON.stringify({ level: "lite", by: "governor", at: Date.now() }),
    );
    resetPerfForTests();
    expect(perfLevel()).toBe("lite");
    const calm = startGovernor({ raiseOnly: true });
    run(40, 16.7); // the page settles: smooth frames
    calm();
    expect(perfLevel()).not.toBe("lite");
  });

  it("does not count time while the page says it is busy", () => {
    const stop = startGovernor({ paused: () => true });
    run(30, 100);
    stop();
    expect(perfLevel()).toBe("full");
  });

  const stored = (level: string, extra: Record<string, unknown> = {}) =>
    window.localStorage.setItem(
      "aspirants:perf",
      JSON.stringify({ level, by: "governor", at: Date.now(), ...extra }),
    );

  it("tries one step up after half a minute of smooth playback on a device that sits low", () => {
    stored("balanced");
    resetPerfForTests();
    const seen: string[] = [];
    perfLevel();
    onPerfLevel((l, why) => seen.push(`${l}:${why}`));
    const stop = startGovernor();
    run(20, 16.7);
    expect(perfLevel()).toBe("balanced");
    run(14, 16.7);
    expect(perfLevel()).toBe("full");
    expect(seen).toEqual(["full:smooth"]);
    stop();
  });

  it("goes back down at once when the step up is bad, and does not try again", () => {
    stored("balanced");
    resetPerfForTests();
    const stop = startGovernor();
    run(34, 16.7);
    expect(perfLevel()).toBe("full");
    run(8, 100); // past the cool-down, then bad
    expect(perfLevel()).toBe("balanced");
    const kept = JSON.parse(window.localStorage.getItem("aspirants:perf") ?? "{}") as {
      failedUp?: boolean;
    };
    expect(kept.failedUp).toBe(true);
    run(60, 16.7);
    expect(perfLevel()).toBe("balanced");
    stop();
  });

  it("does not try a step up where one failed before", () => {
    stored("balanced", { failedUp: true });
    resetPerfForTests();
    const stop = startGovernor();
    run(60, 16.7);
    stop();
    expect(perfLevel()).toBe("balanced");
  });

  it("does not step up after a step down in the same visit", () => {
    const stop = startGovernor();
    run(14, 100);
    expect(perfLevel()).toBe("balanced");
    run(60, 16.7);
    stop();
    expect(perfLevel()).toBe("balanced");
  });

  it("does not step up past what the device suggests", () => {
    stored("full");
    resetPerfForTests();
    const stop = startGovernor();
    run(60, 16.7);
    stop();
    expect(perfLevel()).toBe("full");
  });

  it("does nothing when the level was asked for in the address", () => {
    window.history.replaceState(null, "", "/?quality=full");
    resetPerfForTests();
    const stop = startGovernor();
    run(30, 100);
    stop();
    expect(perfLevel()).toBe("full");
  });
});
