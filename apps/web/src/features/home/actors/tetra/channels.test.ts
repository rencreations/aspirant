import { describe, expect, it } from "vitest";

import { clearChannels, copyChannels, mixChannels, restChannels } from "./channels";

describe("channels", () => {
  it("starts at the plain stand and clears back to it", () => {
    const c = restChannels();
    expect(c.squash).toBe(1);
    expect(c.armL).toEqual({ x: 0, y: 0, z: 0 });
    c.armL.z = 1;
    c.squash = 0.8;
    c.reachL.w = 1;
    c.clip = "walk";
    clearChannels(c);
    expect(c).toEqual(restChannels());
  });

  it("copies by value, not by reference", () => {
    const a = restChannels();
    a.head.y = 0.5;
    const b = restChannels();
    copyChannels(b, a);
    a.head.y = 0;
    expect(b.head.y).toBe(0.5);
  });

  it("mixes every number and turn between two poses", () => {
    const a = restChannels();
    const b = restChannels();
    b.y = 0.2;
    b.armR.z = -1;
    b.squash = 0.8;
    const out = restChannels();
    mixChannels(out, a, b, 0.25);
    expect(out.y).toBeCloseTo(0.05, 9);
    expect(out.armR.z).toBeCloseTo(-0.25, 9);
    expect(out.squash).toBeCloseTo(0.95, 9);
    mixChannels(out, a, b, 1);
    expect(out.armR.z).toBe(-1);
  });

  it("may mix into the first operand", () => {
    const a = restChannels();
    const b = restChannels();
    b.armL.z = 1;
    mixChannels(a, a, b, 0.5);
    expect(a.armL.z).toBe(0.5);
  });

  it("blends a hand target by its weight, so a hand that is not reached for leaves the point alone", () => {
    const a = restChannels();
    const b = restChannels();
    b.reachL = { x: 0.2, y: 0.3, z: 0.1, w: 1 };
    const out = restChannels();
    mixChannels(out, a, b, 0.5);
    // Half the weight, and the point where the reaching pose put it, not half way to the origin.
    expect(out.reachL.w).toBeCloseTo(0.5, 9);
    expect(out.reachL.x).toBeCloseTo(0.2, 9);
    expect(out.reachL.y).toBeCloseTo(0.3, 9);
    // Two poses that both reach: the point is between theirs.
    a.reachL = { x: 0, y: 0.1, z: 0, w: 1 };
    mixChannels(out, a, b, 0.5);
    expect(out.reachL.x).toBeCloseTo(0.1, 9);
    expect(out.reachL.w).toBeCloseTo(1, 9);
  });

  it("takes the clip of the pose that has more of it", () => {
    const a = restChannels();
    const b = restChannels();
    b.clip = "walk";
    b.clipWeight = 1;
    b.clipTime = 0.7;
    const out = restChannels();
    mixChannels(out, a, b, 0.3);
    expect(out.clip).toBe("walk");
    expect(out.clipWeight).toBeCloseTo(0.3, 9);
    expect(out.clipTime).toBe(0.7);
  });
});
