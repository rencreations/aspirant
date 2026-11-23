import { describe, expect, it } from "vitest";

import { geometry, tetraStand } from "../chase/timeline";

import { beatAt, isCompact, newBeat, spotsOf } from "./beats";
import { droneAt, newDroneWant, restOf } from "./meet";

const SIZES = [
  { w: 1440, h: 900 },
  { w: 1706, h: 950 },
  { w: 1920, h: 1080 },
  { w: 390, h: 844 },
  { w: 820, h: 1180 },
  { w: 700, h: 700 },
] as const;

describe("J13: the chase to the bend", () => {
  it.each(SIZES)("starts where the chase leaves Tetra, at $w by $h", ({ w, h }) => {
    const vp = { w, h };
    const end = { x: 0, y: 0, height: 0 };
    tetraStand(1, geometry(w, h), end);
    const start = beatAt(0, newBeat(), vp).spot;
    expect(start.tx * w).toBeCloseTo(end.x, 6);
    expect(start.ty * h).toBeCloseTo(end.y, 6);
    expect(start.th * h).toBeCloseTo(end.height, 6);
    // And the lead (the scroll before the section) is the same place.
    expect(beatAt(-0.06, newBeat(), vp).spot).toEqual(start);
  });

  it("uses the chase's rule for a compact screen", () => {
    for (const { w, h } of SIZES) {
      expect(isCompact(w, h)).toBe(geometry(w, h).compact);
    }
  });
});

describe("J14: the bend to the archive", () => {
  it.each(SIZES)("ends with the two at rest side by side, at $w by $h", ({ w, h }) => {
    const vp = { w, h };
    const end = beatAt(1, newBeat(), vp);
    const rest = spotsOf(vp).rest;
    expect(end.spot).toEqual(rest);
    expect(end.pose).toBe("idle");
    const drone = droneAt(end, vp, 0, newDroneWant());
    const place = restOf(vp);
    expect(drone.visible).toBe(true);
    expect(drone.x).toBeCloseTo(place.x, 6);
    expect(drone.y).toBeCloseTo(place.y, 6);
    expect(drone.height).toBeCloseTo(place.height, 6);
    // They do not stand on each other: the drone is clear of her width.
    const herHalf = 0.28 * rest.th * h;
    expect(Math.abs(place.x - rest.tx * w)).toBeGreaterThan(herHalf * 0.9);
    // The drone hovers alongside her upper body.
    expect(place.y).toBeGreaterThan(rest.ty * h);
    expect(rest.ty * h).toBeLessThan(0);
    expect(Math.abs(place.x) + place.height / 2).toBeLessThan(w / 2);
    expect(Math.abs(rest.tx * w) + rest.th * h * 0.3).toBeLessThan(w / 2);
  });

  it("holds the end after the section (the tail)", () => {
    const vp = { w: 1440, h: 900 };
    expect(beatAt(1.06, newBeat(), vp).spot).toEqual(beatAt(1, newBeat(), vp).spot);
  });
});
