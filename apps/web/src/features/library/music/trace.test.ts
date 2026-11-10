import { describe, expect, it } from "vitest";

import { DISC, hubRingProfile, hubRings, rimProfile } from "./disc-shape";
import { TRACE, levelAt, parseWave, swingAt, traceSamples, tracePoint } from "./trace";

describe("the shape of a track's sound", () => {
  it("reads base 36 digits as loudness", () => {
    const w = parseWave("0z");
    expect(w[0]).toBe(0);
    expect(w[1]).toBe(1);
    expect(parseWave("")).toEqual(new Float32Array([0.5, 0.5]));
    expect(parseWave(null)).toHaveLength(2);
    expect(parseWave("!")[0]).toBe(0.5);
    expect(parseWave("i")).toHaveLength(2);
  });

  it("interpolates between steps and keeps to the ends", () => {
    const w = parseWave("0z");
    expect(levelAt(w, 0)).toBe(0);
    expect(levelAt(w, 1)).toBe(1);
    expect(levelAt(w, 0.5)).toBeCloseTo(0.5);
    expect(levelAt(w, -1)).toBe(0);
    expect(levelAt(w, 2)).toBe(1);
  });

  it("closes the loop at the top and stays within its swing", () => {
    const w = parseWave("zzzzzzzzzz");
    expect(swingAt(w, 0)).toBeCloseTo(0, 6);
    expect(swingAt(w, 1)).toBeCloseTo(0, 6);
    for (let u = 0; u <= 1; u += 0.001) expect(Math.abs(swingAt(w, u))).toBeLessThanOrEqual(1);
  });

  it("swings wider where the track is loud", () => {
    const quietLoud = parseWave(`${"0".repeat(50)}${"z".repeat(50)}`);
    const span = (from: number, to: number) => {
      let m = 0;
      for (let u = from; u < to; u += 0.0005) m = Math.max(m, Math.abs(swingAt(quietLoud, u)));
      return m;
    };
    expect(span(0.6, 0.95)).toBeGreaterThan(span(0.05, 0.4) * 4);
  });

  it("samples every point of the loop with its slope", () => {
    const { u, swing, slope } = traceSamples(parseWave("abc"), 100);
    expect(u).toHaveLength(101);
    expect(swing).toHaveLength(101);
    expect(slope).toHaveLength(101);
    expect(u[100]).toBe(1);
  });

  it("starts the pen at the top of the disc and goes clockwise", () => {
    const w = parseWave("k");
    const start = tracePoint(w, 0);
    expect(start.x).toBeCloseTo(0, 6);
    expect(start.y).toBeCloseTo(TRACE.radius, 6);
    const quarter = tracePoint(w, 0.25);
    expect(quarter.x).toBeGreaterThan(1);
    expect(Math.abs(quarter.y)).toBeLessThan(0.1);
  });

  it("keeps the line outside the rim", () => {
    expect(TRACE.radius - TRACE.amplitude).toBeGreaterThan(1);
  });
});

describe("the shape of a disc", () => {
  it("bevels the rim between the face and the edge", () => {
    const rim = rimProfile();
    for (const [r, y] of rim) {
      expect(r).toBeGreaterThanOrEqual(DISC.faceOut);
      expect(r).toBeLessThanOrEqual(1);
      expect(Math.abs(y)).toBeLessThanOrEqual(DISC.thickness / 2 + 1e-9);
    }
    expect(rim[0]![0]).toBe(rim[rim.length - 1]![0]);
  });

  it("fills the hub from the hole to the face, ring after ring", () => {
    const { frost, metal, clear } = hubRings();
    expect(frost[0]).toBe(DISC.hole);
    expect(frost[1]).toBeCloseTo(metal[0]);
    expect(metal[1]).toBeCloseTo(clear[0]);
    expect(clear[1]).toBe(DISC.hub);
    const ring = hubRingProfile(metal[0], metal[1], DISC.thickness, 0.2);
    for (const [r, y] of ring) {
      expect(r).toBeGreaterThanOrEqual(metal[0] - 1e-9);
      expect(r).toBeLessThanOrEqual(metal[1] + 1e-9);
      expect(Math.abs(y)).toBeLessThanOrEqual(DISC.thickness / 2 + 1e-9);
    }
  });
});
