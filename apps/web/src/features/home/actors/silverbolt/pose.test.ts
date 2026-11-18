import { describe, expect, it } from "vitest";

import { Pose, beat, dancePose, flightPose, hoverPose, poseExtent } from "./pose";

function same(a: Pose, b: Pose): void {
  expect(a.wingRoot).toBeCloseTo(b.wingRoot, 9);
  expect(a.headPitch).toBeCloseTo(b.headPitch, 9);
  expect(a.headYaw).toBeCloseTo(b.headYaw, 9);
  expect(a.bob).toBeCloseTo(b.bob, 9);
  for (let i = 0; i < 6; i++) {
    expect(a.blade[i]).toBeCloseTo(b.blade[i]!, 9);
    expect(a.bladeSpread[i]).toBeCloseTo(b.bladeSpread[i]!, 9);
  }
  for (let i = 0; i < 7; i++) {
    expect(a.tailYaw[i]).toBeCloseTo(b.tailYaw[i]!, 9);
    expect(a.tailPitch[i]).toBeCloseTo(b.tailPitch[i]!, 9);
  }
}

describe("the poses are loops", () => {
  it("the wings repeat every beat and the whole flight every two (the tail weaves at half rate)", () => {
    for (const phase of [0, 0.7, 2.1, 5]) {
      const now = flightPose(new Pose(), phase, 1);
      const beatLater = flightPose(new Pose(), phase + Math.PI * 2, 1);
      expect(now.wingRoot).toBeCloseTo(beatLater.wingRoot, 9);
      for (let i = 0; i < 6; i++) expect(now.blade[i]).toBeCloseTo(beatLater.blade[i]!, 9);
      same(now, flightPose(new Pose(), phase + Math.PI * 4, 1));
    }
  });

  it("the dance repeats every bar", () => {
    for (const phase of [0, 1.3, 4]) {
      same(dancePose(new Pose(), phase, 1), dancePose(new Pose(), phase + Math.PI * 2, 1));
    }
  });

  it("the beat of a wing is a slower rise and a sharper stroke, within 1.25", () => {
    let top = 0;
    for (let p = 0; p < Math.PI * 2; p += 0.01) top = Math.max(top, Math.abs(beat(p)));
    expect(top).toBeLessThanOrEqual(1.25);
    expect(top).toBeGreaterThan(1);
  });
});

describe("the poses stay inside what the rig can bear", () => {
  it("no joint is asked for a full radian at a strong amplitude", () => {
    const worst = (make: (out: Pose, phase: number, amp: number) => Pose): number => {
      let m = 0;
      for (let p = 0; p < Math.PI * 2; p += 0.05)
        m = Math.max(m, poseExtent(make(new Pose(), p, 1.2)));
      return m;
    };
    expect(worst(flightPose)).toBeLessThan(1);
    expect(worst(dancePose)).toBeLessThan(1);
  });

  it("the hover is small", () => {
    for (const t of [0, 1, 7.3, 40]) expect(poseExtent(hoverPose(new Pose(), t))).toBeLessThan(0.1);
  });

  it("an amplitude of 0 is a still pose", () => {
    expect(poseExtent(flightPose(new Pose(), 2, 0))).toBe(0);
    expect(poseExtent(dancePose(new Pose(), 2, 0))).toBe(0);
  });
});

describe("Pose", () => {
  it("adds by weight and resets", () => {
    const a = new Pose();
    const b = flightPose(new Pose(), 1, 1);
    a.addScaled(b, 0);
    expect(poseExtent(a)).toBe(0);
    a.addScaled(b, 2);
    expect(a.wingRoot).toBeCloseTo(b.wingRoot * 2);
    expect(a.tailYaw[3]).toBeCloseTo(b.tailYaw[3]! * 2);
    a.reset();
    expect(poseExtent(a)).toBe(0);
    expect(a.bob).toBe(0);
  });

  it("the two sides of the dance are half a beat apart", () => {
    const p = dancePose(new Pose(), 0.4, 1);
    expect(p.blade[0]).not.toBeCloseTo(p.blade[1]!, 3);
  });
});
