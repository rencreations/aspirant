import { describe, expect, it } from "vitest";

import { dollOffset, frameCamera, sampleBakedCamera, type CameraData } from "./camera";

const s = Math.sin(Math.PI / 4);
const c = Math.cos(Math.PI / 4);

const DATA: CameraData = {
  fps: 30,
  vfovDeg: 61.9275,
  clips: {
    moving: {
      frames: 3,
      duration: 0.0667,
      static: false,
      stride: 7,
      keys: [0, 0, 0, 0, 0, 0, 1, 2, 4, 6, 0, 0, s, c, 4, 8, 12, 0, 0, 1, 0],
    },
    still: { frames: 90, duration: 3, static: true, stride: 7, keys: [1, 2, 3, 0, 0, 0, 1] },
  },
};

describe("sampleBakedCamera", () => {
  it("lerps the position and slerps the quaternion between 30 fps keys", () => {
    const out = [0, 0, 0, 0, 0, 0, 0];
    sampleBakedCamera(DATA, "moving", 0.5 / 30, out);
    expect(out.slice(0, 3)).toEqual([1, 2, 3]);
    expect(2 * Math.atan2(out[5]!, out[6]!)).toBeCloseTo(Math.PI / 4, 5);
    expect(Math.hypot(out[3]!, out[4]!, out[5]!, out[6]!)).toBeCloseTo(1, 6);
  });

  it("holds the first and last key outside the clip and on a key", () => {
    const out = [0, 0, 0, 0, 0, 0, 0];
    sampleBakedCamera(DATA, "moving", -3, out);
    expect(out.slice(0, 3)).toEqual([0, 0, 0]);
    sampleBakedCamera(DATA, "moving", 99, out);
    expect(out.slice(0, 3)).toEqual([4, 8, 12]);
    sampleBakedCamera(DATA, "moving", 1 / 30, out);
    expect(out.slice(0, 3)).toEqual([2, 4, 6]);
  });

  it("a static clip is its one key, and a missing clip throws", () => {
    const out = [0, 0, 0, 0, 0, 0, 0];
    sampleBakedCamera(DATA, "still", 2, out);
    expect(out.slice(0, 3)).toEqual([1, 2, 3]);
    expect(() => sampleBakedCamera(DATA, "nope", 0, out)).toThrow();
  });
});

describe("frameCamera", () => {
  it("is the notes' formula at the recording's own shape", () => {
    const w = 2000;
    const h = 900;
    const f = frameCamera(w, h);
    expect(f.fov).toBeCloseTo(61.9275, 3);
    expect(f.aspect).toBeCloseTo(w / (1.25 * h), 6);
    expect(f.view).toEqual({
      fullWidth: w,
      fullHeight: 1.25 * h,
      x: 0,
      y: 0.25 * h,
      width: w,
      height: h,
    });
  });

  it("keeps the baked field of view by default and with fit height", () => {
    expect(frameCamera(390, 844).fov).toBeCloseTo(61.9275, 3);
    expect(frameCamera(390, 844, { fit: "height" }).fov).toBeCloseTo(61.9275, 3);
  });

  it("widens the lens on a narrow screen, up to the cap, and never below the baked one", () => {
    const desktop = frameCamera(1440, 900, { fit: "width" });
    expect(desktop.fov).toBeGreaterThan(61.9275);
    expect(desktop.fov).toBeLessThanOrEqual(80);
    expect(frameCamera(390, 844, { fit: "width" }).fov).toBe(80);
    expect(frameCamera(390, 844, { fit: "width", maxFov: 95 }).fov).toBe(95);
    expect(frameCamera(3440, 1000, { fit: "width" }).fov).toBeCloseTo(61.9275, 3);
  });

  it("the view window always ends at the bottom of the whole frame", () => {
    for (const [w, h] of [
      [1440, 900],
      [390, 844],
      [2560, 1080],
    ] as const) {
      const v = frameCamera(w, h).view;
      expect(v.y + v.height).toBeCloseTo(v.fullHeight, 6);
    }
  });
});

describe("dollOffset", () => {
  const anchor = { hover: [-0.06, 0.27, 0], drift: [-0.38, 0.28, 0], hold: 2.8, driftTo: 3.2 };
  it("hovers, then drifts smoothly and stays", () => {
    const o = [0, 0, 0];
    dollOffset(0, anchor, o);
    expect(o).toEqual([-0.06, 0.27, 0]);
    dollOffset(2.8, anchor, o);
    expect(o[0]).toBeCloseTo(-0.06, 6);
    dollOffset(3.0, anchor, o);
    expect(o[0]).toBeCloseTo(-0.22, 6);
    dollOffset(9, anchor, o);
    expect(o[0]).toBeCloseTo(-0.38, 6);
  });
});
