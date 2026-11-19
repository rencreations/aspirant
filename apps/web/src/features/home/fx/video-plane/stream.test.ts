import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { STALL_MS } from "@/lib/media-store";

import { TRAILER_FILM } from "./data";
import {
  RESUME_SECONDS,
  TrailerStream,
  bufferedEnd,
  releaseTrailer,
  trailerStream,
} from "./stream";

/** A TimeRanges with one stretch. */
function ranges(...spans: Array<[number, number]>): TimeRanges {
  return {
    length: spans.length,
    start: (i: number) => spans[i]![0],
    end: (i: number) => spans[i]![1],
  };
}

/** A stream whose element is a plain jsdom video with the few members the stream reads stubbed. */
function fake() {
  const stream = new TrailerStream();
  const el = stream.el;
  const state = {
    time: TRAILER_FILM.start as number,
    ready: 4,
    paused: true,
    buffered: ranges([TRAILER_FILM.start, TRAILER_FILM.start + 8]),
    duration: TRAILER_FILM.dur,
  };
  const define = (name: string, get: () => unknown, set?: (v: never) => void) =>
    Object.defineProperty(el, name, { get, set, configurable: true });
  define(
    "currentTime",
    () => state.time,
    (v: number) => (state.time = v) as never,
  );
  define("readyState", () => state.ready);
  define("paused", () => state.paused);
  define("buffered", () => state.buffered);
  define("duration", () => state.duration);
  define("seeking", () => false);
  define("ended", () => false);
  const play = vi.fn(() => {
    state.paused = false;
    return Promise.resolve();
  });
  const pause = vi.fn(() => {
    state.paused = true;
  });
  el.play = play;
  el.pause = pause;
  el.load = vi.fn();
  // A file that is already in: no download starts in these tests.
  el.setAttribute("src", "https://example.test/film.mp4");
  stream.status.state = "ready";
  return { stream, el, state, play, pause };
}

beforeEach(() => {
  // jsdom does not play media: a released stream calls these on the real element.
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => undefined);
});

afterEach(() => {
  releaseTrailer();
  vi.restoreAllMocks();
});

describe("bufferedEnd", () => {
  it("is the end of the stretch that holds the time", () => {
    expect(bufferedEnd(ranges([10, 20]), 15)).toBe(20);
    expect(bufferedEnd(ranges([0, 5], [10, 20]), 12)).toBe(20);
  });

  it("allows the small gap before a stretch, and is the time itself when nothing is buffered", () => {
    expect(bufferedEnd(ranges([10, 20]), 9.8)).toBe(20);
    expect(bufferedEnd(ranges([10, 20]), 4)).toBe(4);
    expect(bufferedEnd(ranges(), 7)).toBe(7);
  });
});

describe("the trailer's stream", () => {
  it("is made with the cross origin switch set before any byte, muted and not looping by itself", () => {
    const { el } = fake();
    expect(el.crossOrigin).toBe("anonymous");
    expect(el.muted).toBe(true);
    expect(el.loop).toBe(false);
    expect(el.playsInline).toBe(true);
  });

  it("gives one shared stream until it is released, then a new one", () => {
    const a = trailerStream();
    expect(trailerStream()).toBe(a);
    releaseTrailer();
    expect(a.isReleased).toBe(true);
    expect(trailerStream()).not.toBe(a);
  });

  it("holds the last frame when the picture runs out, and plays again only with enough in hand", () => {
    const { stream, el, state, play } = fake();
    stream.play();
    expect(play).toHaveBeenCalledTimes(1);
    state.time = 20;
    state.buffered = ranges([11.7, 20.1]);
    el.dispatchEvent(new Event("waiting"));
    expect(stream.status.stalled).toBe(true);
    expect(state.paused).toBe(true);
    // 0.1 s ahead: still holding. The line's progress is the share of the seconds it needs.
    stream.update(1000);
    expect(stream.status.stalled).toBe(true);
    expect(stream.status.progress).toBeCloseTo(0.1 / RESUME_SECONDS, 1);
    expect(play).toHaveBeenCalledTimes(1);
    // 3 s in hand: it plays on.
    state.buffered = ranges([11.7, 23.2]);
    stream.update(1300);
    expect(stream.status.stalled).toBe(false);
    expect(play).toHaveBeenCalledTimes(2);
  });

  it("goes back to its rest moment at the end of the film", () => {
    const { stream, state } = fake();
    stream.play();
    state.time = TRAILER_FILM.dur - 0.05;
    stream.update(1000);
    expect(state.time).toBe(TRAILER_FILM.start);
    expect(stream.events.some((e) => e.endsWith("loop"))).toBe(true);
  });

  it("starts a download again from where it stood when nothing arrives for as long as a stall is allowed", () => {
    const { stream, state } = fake();
    stream.play();
    state.time = 40;
    state.buffered = ranges([39, 40.2]);
    stream.el.dispatchEvent(new Event("waiting"));
    stream.update(1000);
    // Nothing grows for STALL_MS: the stream starts again at 40 s (and holds the last frame meanwhile).
    stream.update(1000 + STALL_MS + 500);
    expect(stream.events.some((e) => e.includes("recover at 40.00"))).toBe(true);
    expect(stream.status.stalled).toBe(true);
    stream.release();
  });

  it("lets go of its file when released, and ignores calls after", () => {
    const { stream, el } = fake();
    stream.release();
    expect(stream.isReleased).toBe(true);
    expect(el.getAttribute("src")).toBeNull();
    stream.play();
    stream.update(5000);
    expect(stream.status.state).toBe("idle");
  });

  it("holds the browser's fetching to what it has once the first seconds are in and nothing plays", () => {
    const { stream, el } = fake();
    el.preload = "auto";
    stream.play();
    expect(el.preload).toBe("auto");
    stream.pause();
    expect(el.preload).toBe("metadata");
    stream.play();
    expect(el.preload).toBe("auto");
  });
});
