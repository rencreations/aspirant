import { describe, expect, it } from "vitest";

import {
  clock,
  drifted,
  elapsed,
  lengthOf,
  progressOf,
  RING_FRAMES,
  ringAngles,
} from "./music-time";

describe("the length of a track", () => {
  it("is written as minutes and two figures of seconds", () => {
    expect(clock(308.48)).toBe("5:08");
    expect(clock(78.34)).toBe("1:18");
    expect(clock(64.23)).toBe("1:04");
    expect(clock(0)).toBe("0:00");
    expect(clock(600)).toBe("10:00");
  });

  it("is zero for a length that is not a number", () => {
    expect(clock(Number.NaN)).toBe("0:00");
    expect(clock(-4)).toBe("0:00");
    expect(clock(Infinity)).toBe("0:00");
  });

  it("never shows a second that has not been heard", () => {
    expect(elapsed(59.9)).toBe("0:59");
    expect(elapsed(60)).toBe("1:00");
    expect(elapsed(-1)).toBe("0:00");
  });

  it("is the length the file reports once it is known, the recorded one until then", () => {
    expect(lengthOf(78.338, 78.34)).toBe(78.338);
    expect(lengthOf(Number.NaN, 78.34)).toBe(78.34);
    expect(lengthOf(Infinity, 78.34)).toBe(78.34);
    expect(lengthOf(0, 78.34)).toBe(78.34);
  });
});

describe("how far a track has played", () => {
  it("is a share between 0 and 1", () => {
    expect(progressOf(0, 100)).toBe(0);
    expect(progressOf(25, 100)).toBe(0.25);
    expect(progressOf(140, 100)).toBe(1);
    expect(progressOf(-3, 100)).toBe(0);
  });

  it("is 0 while the length is not known", () => {
    expect(progressOf(12, Number.NaN)).toBe(0);
    expect(progressOf(12, 0)).toBe(0);
    expect(progressOf(Number.NaN, 100)).toBe(0);
  });
});

describe("the ring round a disc", () => {
  it("fills the right half first, then the left", () => {
    expect(ringAngles(0)).toEqual({ first: 0, second: 0 });
    expect(ringAngles(0.25)).toEqual({ first: 90, second: 0 });
    expect(ringAngles(0.5)).toEqual({ first: 180, second: 0 });
    expect(ringAngles(0.75)).toEqual({ first: 180, second: 90 });
    expect(ringAngles(1)).toEqual({ first: 180, second: 180 });
  });

  it("never turns past its half", () => {
    expect(ringAngles(3)).toEqual({ first: 180, second: 180 });
    expect(ringAngles(-1)).toEqual({ first: 0, second: 0 });
  });

  it("has keyframes that agree with the angles", () => {
    expect(RING_FRAMES.first.map((f) => f.transform)).toEqual([
      "rotate(0deg)",
      "rotate(180deg)",
      "rotate(180deg)",
    ]);
    expect(RING_FRAMES.second.map((f) => f.transform)).toEqual([
      "rotate(0deg)",
      "rotate(0deg)",
      "rotate(180deg)",
    ]);
    expect(RING_FRAMES.head.map((f) => f.offset)).toEqual([0, 1]);
  });

  it("is set again only when it has come apart from the track", () => {
    expect(drifted(1000, 1100)).toBe(false);
    expect(drifted(1000, 1300)).toBe(true);
    expect(drifted(5000, 0)).toBe(true);
  });
});
