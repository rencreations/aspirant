import { describe, expect, it } from "vitest";

import { coverPoint, dock, pathAt, SPOTS } from "./hotspots";
import { HOTSPOT_PATHS, HOTSPOT_STEP } from "./hotspots.generated";
import { SELENA_LOOP_FRAMES } from "./timeline.generated";

describe("touch point paths", () => {
  it("has a point for every spot, covering the whole idle loop", () => {
    for (const spot of SPOTS) {
      const path = HOTSPOT_PATHS[spot.id];
      expect(path.length * HOTSPOT_STEP).toBe(SELENA_LOOP_FRAMES);
      for (const [x, y] of path) {
        expect(x).toBeGreaterThan(0);
        expect(x).toBeLessThan(1);
        expect(y).toBeGreaterThan(0);
        expect(y).toBeLessThan(1);
      }
    }
  });

  it("moves between samples and wraps with the loop", () => {
    const path: Array<readonly [number, number]> = [
      [0.2, 0.4],
      [0.4, 0.6],
    ];
    expect(pathAt(path, 0)).toEqual([0.2, 0.4]);
    const mid = pathAt(path, HOTSPOT_STEP / 2);
    expect(mid[0]).toBeCloseTo(0.3);
    expect(mid[1]).toBeCloseTo(0.5);
    // After the last sample it runs back towards the first one.
    const end = pathAt(path, HOTSPOT_STEP * 1.5);
    expect(end[0]).toBeCloseTo(0.3);
    expect(pathAt(path, HOTSPOT_STEP * 2)).toEqual([0.2, 0.4]);
    expect(pathAt(path, -HOTSPOT_STEP)).toEqual([0.4, 0.6]);
  });

  it("stays on the same spot of a wide picture however the box is cropped", () => {
    // A box with the picture's own shape: no crop.
    const [x, y] = coverPoint(0.5, 0.5, 1920, 864, [0.5, 0.5]);
    expect(x).toBeCloseTo(960);
    expect(y).toBeCloseTo(432);
    // A tall box crops the sides. A point at the left of the picture falls outside to the left
    // when the focus is on the right.
    const [left] = coverPoint(0.1, 0.5, 390, 844, [0.63, 0.5]);
    expect(left).toBeLessThan(0);
    // The focus decides which part of the picture is kept.
    const a = coverPoint(0.5, 0.5, 390, 844, [0.2, 0.5])[0];
    const b = coverPoint(0.5, 0.5, 390, 844, [0.8, 0.5])[0];
    expect(a).toBeGreaterThan(b);
  });

  it("keeps a point that is off screen at the edge, with the direction of the real one", () => {
    // On screen: left alone.
    expect(dock(200, 300, 390, 844)).toEqual({ x: 200, y: 300, angle: null });
    // Off to the left: held at the left edge, the arrow points left (180 degrees).
    const left = dock(-300, 400, 390, 844);
    expect(left.x).toBe(34);
    expect(left.y).toBe(400);
    expect(Math.abs(left.angle ?? 0)).toBeCloseTo(180);
    // Off to the right and above: held in the corner, the arrow points up and right.
    const corner = dock(900, -200, 390, 844, 90);
    expect(corner.x).toBe(390 - 34);
    expect(corner.y).toBe(90);
    expect(corner.angle ?? 0).toBeLessThan(0);
    expect(corner.angle ?? 0).toBeGreaterThan(-90);
  });
});
