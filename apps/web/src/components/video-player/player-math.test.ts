import { describe, expect, it } from "vitest";

import { clamp01, cursorShape, formatTime, fractionAt, inLeaveZone } from "./player-math";

describe("formatTime", () => {
  it("formats minutes and seconds", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(65.9)).toBe("1:05");
    expect(formatTime(600)).toBe("10:00");
  });
  it("adds hours", () => {
    expect(formatTime(3725)).toBe("1:02:05");
  });
  it("survives bad input", () => {
    expect(formatTime(Number.NaN)).toBe("0:00");
    expect(formatTime(-4)).toBe("0:00");
    expect(formatTime(Number.POSITIVE_INFINITY)).toBe("0:00");
  });
});

describe("inLeaveZone", () => {
  it("marks the sides and the top, not the middle or the bottom", () => {
    expect(inLeaveZone(10, 500, 1440, 900)).toBe(true);
    expect(inLeaveZone(1430, 500, 1440, 900)).toBe(true);
    expect(inLeaveZone(700, 20, 1440, 900)).toBe(true);
    expect(inLeaveZone(700, 450, 1440, 900)).toBe(false);
    expect(inLeaveZone(700, 880, 1440, 900)).toBe(false);
  });
});

describe("cursorShape", () => {
  const base = { zone: "stage", leave: false, playing: false, busy: false } as const;
  it("shows the action the click will do", () => {
    expect(cursorShape(base)).toBe("play");
    expect(cursorShape({ ...base, playing: true })).toBe("pause");
  });
  it("leave wins over play and pause, busy over both", () => {
    expect(cursorShape({ ...base, leave: true, playing: true })).toBe("leave");
    expect(cursorShape({ ...base, busy: true })).toBe("busy");
  });
  it("follows the control under it", () => {
    expect(cursorShape({ ...base, zone: "timeline" })).toBe("scrub");
    expect(cursorShape({ ...base, zone: "button", leave: true })).toBe("dot");
  });
});

describe("fractionAt", () => {
  it("clamps to the track", () => {
    expect(fractionAt(50, 100, 200)).toBe(0);
    expect(fractionAt(200, 100, 200)).toBe(0.5);
    expect(fractionAt(900, 100, 200)).toBe(1);
    expect(fractionAt(5, 0, 0)).toBe(0);
    expect(clamp01(2)).toBe(1);
  });
});
