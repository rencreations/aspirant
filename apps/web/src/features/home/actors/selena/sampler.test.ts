import { describe, expect, it } from "vitest";

import {
  POSE_STRIDE,
  blendPoses,
  clipTime,
  findSegment,
  makeTrack,
  sampleClip,
  slerpInto,
  type ClipData,
} from "./sampler";

const rest = (bones: number): Float32Array => {
  const p = new Float32Array(bones * POSE_STRIDE);
  for (let i = 0; i < bones; i += 1) {
    p[i * POSE_STRIDE + 6] = 1;
    p[i * POSE_STRIDE + 7] = 1;
    p[i * POSE_STRIDE + 8] = 1;
    p[i * POSE_STRIDE + 9] = 1;
  }
  return p;
};

describe("findSegment", () => {
  const times = [0, 1, 2, 4, 8];
  it("finds the segment from any hint", () => {
    for (const hint of [0, 1, 2, 3, 9, -4]) {
      expect(findSegment(times, 0.5, hint)).toBe(0);
      expect(findSegment(times, 1, hint)).toBe(1);
      expect(findSegment(times, 3, hint)).toBe(2);
      expect(findSegment(times, 7.9, hint)).toBe(3);
      expect(findSegment(times, 8, hint)).toBe(3);
      expect(findSegment(times, 99, hint)).toBe(3);
    }
  });
});

describe("clipTime", () => {
  it("wraps a loop and holds a one shot", () => {
    expect(clipTime(2.5, 2, true)).toBeCloseTo(0.5, 6);
    expect(clipTime(-0.5, 2, true)).toBeCloseTo(1.5, 6);
    expect(clipTime(4, 2, true)).toBe(0);
    expect(clipTime(2.5, 2, false)).toBe(2);
    expect(clipTime(-1, 2, false)).toBe(0);
    expect(clipTime(1, 0, true)).toBe(0);
  });
});

describe("slerpInto", () => {
  it("goes half way and takes the short path", () => {
    const out = new Float32Array(4);
    const a = [0, 0, 0, 1];
    const s = Math.sin(Math.PI / 4);
    const c = Math.cos(Math.PI / 4);
    slerpInto(a, 0, [0, 0, s, c], 0, 0.5, out, 0);
    expect(out[2]).toBeCloseTo(Math.sin(Math.PI / 8), 5);
    expect(out[3]).toBeCloseTo(Math.cos(Math.PI / 8), 5);
    // The same rotation written with the opposite sign does not spin the long way.
    slerpInto(a, 0, [0, 0, -s, -c], 0, 0.5, out, 0);
    expect(out[2]).toBeCloseTo(Math.sin(Math.PI / 8), 5);
    expect(Math.hypot(out[0]!, out[1]!, out[2]!, out[3]!)).toBeCloseTo(1, 6);
  });
});

describe("sampleClip", () => {
  const clip: ClipData = {
    name: "test",
    duration: 2,
    loop: false,
    tracks: [
      makeTrack(1, "p", [0, 1, 2], [0, 0, 0, 2, 4, 6, 2, 4, 6]),
      makeTrack(1, "q", [0, 2], [0, 0, 0, 1, 0, 0, Math.sin(Math.PI / 4), Math.cos(Math.PI / 4)]),
    ],
  };

  it("interpolates keys and leaves unkeyed bones at rest", () => {
    const pose = rest(3);
    sampleClip(clip, 0.5, pose);
    expect(Array.from(pose.slice(10, 13))).toEqual([1, 2, 3]);
    const angle = 2 * Math.atan2(pose[10 + 5]!, pose[10 + 6]!);
    expect(angle).toBeCloseTo(Math.PI / 8, 4);
    expect(Array.from(pose.slice(0, 3))).toEqual([0, 0, 0]);
    expect(pose[6]).toBe(1);
    expect(pose[20 + 6]).toBe(1);
  });

  it("is a pure function of the time, in any order", () => {
    const a = rest(3);
    const b = rest(3);
    sampleClip(clip, 1.7, a);
    sampleClip(clip, 0.2, b);
    sampleClip(clip, 1.7, b);
    expect(Array.from(b)).toEqual(Array.from(a));
  });

  it("collapses a constant track to one key", () => {
    const t = makeTrack(0, "p", [0, 1, 2], [1, 2, 3, 1, 2, 3, 1, 2, 3]);
    expect(t.times.length).toBe(1);
    expect(Array.from(t.values)).toEqual([1, 2, 3]);
  });
});

describe("blendPoses", () => {
  it("is the first at 0, the second at 1, and in between half way", () => {
    const a = rest(2);
    const b = rest(2);
    b[0] = 2;
    b[3 + 2] = Math.sin(Math.PI / 4);
    b[3 + 3] = Math.cos(Math.PI / 4);
    const out = new Float32Array(a.length);
    blendPoses(a, b, 0, out);
    expect(out[0]).toBe(0);
    blendPoses(a, b, 1, out);
    expect(out[0]).toBe(2);
    blendPoses(a, b, 0.5, out);
    expect(out[0]).toBe(1);
    expect(Math.hypot(out[3]!, out[4]!, out[5]!, out[6]!)).toBeCloseTo(1, 5);
  });
});
