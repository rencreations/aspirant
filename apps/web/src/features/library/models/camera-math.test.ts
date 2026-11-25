import { describe, expect, it } from "vitest";

import {
  angleDelta,
  clampOrbit,
  fitCinematic,
  homeOrbit,
  limitsFor,
  orbitFrom,
  orbitPosition,
  sampleTrack,
  type Bounds,
} from "./camera-math";

const girl: Bounds = { cx: 0, cy: 1, cz: 0, radius: 1.1, minY: 0, maxY: 2 };
const blade: Bounds = { cx: 0, cy: 0, cz: 0, radius: 0.8, minY: -0.8, maxY: 0.8 };

describe("the camera of a character", () => {
  it("never goes under the plane of the target", () => {
    const l = limitsFor("character", girl);
    const o = clampOrbit({ yaw: 0, pitch: -1.2, radius: 3, tx: 0, ty: 1.2, tz: 0 }, l, girl);
    expect(o.pitch).toBe(0);
    const [, y] = orbitPosition(o);
    expect(y).toBeGreaterThanOrEqual(o.ty - 1e-9);
  });

  it("keeps the target at or above her hips and on her axis", () => {
    const l = limitsFor("character", girl);
    const o = clampOrbit({ yaw: 0, pitch: 0.2, radius: 2, tx: 0.5, ty: 0.1, tz: -0.4 }, l, girl);
    expect(o.ty).toBeCloseTo(1, 6);
    expect(o.tx).toBe(0);
    expect(o.tz).toBe(0);
    const high = clampOrbit({ ...o, ty: 9 }, l, girl);
    expect(high.ty).toBeLessThanOrEqual(2);
  });

  it("opens with her whole height in view, from a little above", () => {
    const o = homeOrbit("character", girl, 30, 1.6);
    expect(o.pitch).toBeGreaterThan(0);
    const tan = Math.tan((15 * Math.PI) / 180);
    // The half height seen at the target's distance covers her half height.
    expect(o.radius * tan).toBeGreaterThan(1);
  });
});

describe("the camera of an item and of a free view", () => {
  it("lets an item and a free view be seen from under", () => {
    expect(limitsFor("item", blade).minPitch).toBeLessThan(-1.5);
    expect(limitsFor("free", girl).minPitch).toBeLessThan(-1.5);
  });

  it("lets only a free view pan, and keeps its target near the model", () => {
    expect(limitsFor("item", blade).pan).toBe(false);
    const l = limitsFor("free", girl);
    expect(l.pan).toBe(true);
    const o = clampOrbit({ yaw: 0, pitch: 0, radius: 2, tx: 99, ty: -99, tz: 0 }, l, girl);
    expect(o.tx).toBeCloseTo(3.3, 6);
    expect(o.ty).toBeCloseTo(1 - 3.3, 6);
  });
});

describe("orbit arithmetic", () => {
  it("turns a position and target into the same orbit", () => {
    const o = orbitFrom([1, 2, 3], [0, 1, 0]);
    const [x, y, z] = orbitPosition(o);
    expect(x).toBeCloseTo(1, 9);
    expect(y).toBeCloseTo(2, 9);
    expect(z).toBeCloseTo(3, 9);
  });

  it("takes the shorter way round", () => {
    expect(angleDelta(3, -3)).toBeCloseTo(2 * Math.PI - 6, 9);
    expect(angleDelta(0.1, 0.3)).toBeCloseTo(0.2, 9);
  });
});

describe("the cinematic frame on a screen", () => {
  it("keeps the frame's height on a wider screen", () => {
    expect(fitCinematic(60, 2.2222, 2.4)).toEqual({ vfov: 60, spare: 0 });
  });

  it("keeps the whole width on a laptop", () => {
    const { vfov, spare } = fitCinematic(60, 2.2222, 1.6);
    const half = Math.tan((vfov * Math.PI) / 360) * 1.6;
    expect(half).toBeCloseTo(Math.tan(Math.PI / 6) * 2.2222, 6);
    expect(spare).toBe(0);
  });

  it("cuts the sides on a phone and says how far the window may slide", () => {
    const { vfov, spare } = fitCinematic(60, 2.2222, 0.46);
    expect(vfov).toBeGreaterThan(60);
    expect(Math.tan((vfov * Math.PI) / 360)).toBeCloseTo(Math.tan(Math.PI / 6) * 1.6, 6);
    expect(spare).toBeGreaterThan(0);
  });
});

describe("a camera track", () => {
  const keys = [0, 0, 0, 0, 0, 0, 1, 50, 2, 0, 0, 0, 0, 0, 1, 70];

  it("is read between its keys", () => {
    const s = sampleTrack(keys, 30, 1 / 60);
    expect(s[0]).toBeCloseTo(1, 9);
    expect(s[7]).toBeCloseTo(60, 9);
  });

  it("holds its ends", () => {
    expect(sampleTrack(keys, 30, -1)[0]).toBe(0);
    expect(sampleTrack(keys, 30, 9)[0]).toBe(2);
  });
});
