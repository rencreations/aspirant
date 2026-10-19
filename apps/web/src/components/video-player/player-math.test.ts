import { describe, expect, it } from "vitest";

import {
  autoQuality,
  clamp01,
  cursorShape,
  formatTime,
  fractionAt,
  inLeaveZone,
  snapToTrack,
} from "./player-math";

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
  it("is the outer quarter on each side and plays or pauses in the middle half", () => {
    expect(inLeaveZone(10, 1440)).toBe(true);
    expect(inLeaveZone(359, 1440)).toBe(true);
    expect(inLeaveZone(361, 1440)).toBe(false);
    expect(inLeaveZone(720, 1440)).toBe(false);
    expect(inLeaveZone(1079, 1440)).toBe(false);
    expect(inLeaveZone(1081, 1440)).toBe(true);
    expect(inLeaveZone(1430, 1440)).toBe(true);
  });
});

describe("cursorShape", () => {
  const base = {
    snapped: false,
    zone: "stage",
    leave: false,
    playing: false,
    busy: false,
  } as const;
  it("shows the action the click will do", () => {
    expect(cursorShape(base)).toBe("play");
    expect(cursorShape({ ...base, playing: true })).toBe("pause");
  });
  it("leave wins over play and pause, busy over both", () => {
    expect(cursorShape({ ...base, leave: true, playing: true })).toBe("leave");
    expect(cursorShape({ ...base, busy: true })).toBe("busy");
  });
  it("follows the control under it, and snapping beats everything", () => {
    expect(cursorShape({ ...base, zone: "button", leave: true })).toBe("dot");
    expect(cursorShape({ ...base, snapped: true, zone: "controls", leave: true })).toBe("scrub");
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

describe("snapToTrack", () => {
  const track = { left: 100, right: 900, top: 800, bottom: 828, width: 800 };
  it("snaps to the middle of the track when the pointer is close", () => {
    expect(snapToTrack(300, 780, track)).toEqual({ x: 300, y: 814, fraction: 0.25 });
    expect(snapToTrack(300, 850, track)?.y).toBe(814);
  });
  it("does not snap when the pointer is far away", () => {
    expect(snapToTrack(300, 600, track)).toBeNull();
    expect(snapToTrack(20, 814, track)).toBeNull();
  });
  it("keeps the cursor on the track at its ends", () => {
    expect(snapToTrack(90, 814, track)).toEqual({ x: 100, y: 814, fraction: 0 });
    expect(snapToTrack(905, 814, track)).toEqual({ x: 900, y: 814, fraction: 1 });
  });
});

describe("autoQuality", () => {
  const options = [
    { label: "1080p", height: 1080, src: "a" },
    { label: "720p", height: 720, src: "b" },
    { label: "480p", height: 480, src: "c" },
  ];
  it("picks the size that fits the screen", () => {
    expect(autoQuality(options, { width: 1920, height: 1080, dpr: 1 }).label).toBe("1080p");
    expect(autoQuality(options, { width: 1280, height: 720, dpr: 1 }).label).toBe("720p");
    expect(autoQuality(options, { width: 800, height: 600, dpr: 1 }).label).toBe("480p");
    expect(autoQuality(options, { width: 3840, height: 2160, dpr: 1 }).label).toBe("1080p");
  });
  it("matches the width, not the height, of a wide window", () => {
    // A short window limits the picture to its height times 16:9, so it needs no more than that.
    expect(autoQuality(options, { width: 2600, height: 700, dpr: 1 }).label).toBe("720p");
  });
  it("goes one size down on a slow connection", () => {
    expect(autoQuality(options, { width: 1920, height: 1080, dpr: 1, downlinkMbps: 1 }).label).toBe(
      "720p",
    );
  });
});
