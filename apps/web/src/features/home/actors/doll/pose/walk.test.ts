import { AnimationClip, QuaternionKeyframeTrack, VectorKeyframeTrack } from "three";
import { describe, expect, it } from "vitest";

import { createPoseData, boneIndex } from "./math";
import { WalkSampler } from "./walk";

/** A clip of one second: the spine turns 0 to 90 degrees about Y and back, the hips move 0 to 1 and back. */
function clip(): AnimationClip {
  const h = Math.SQRT1_2;
  const spine = new QuaternionKeyframeTrack(
    "Spine02.quaternion",
    [0, 0.5, 1],
    [0, 0, 0, 1, 0, h, 0, h, 0, 0, 0, 1],
  );
  const hips = new VectorKeyframeTrack("Hips.position", [0, 0.5, 1], [0, 0, 0, 1, 2, 3, 0, 0, 0]);
  const stray = new QuaternionKeyframeTrack("Tail.quaternion", [0, 1], [0, 0, 0, 1, 0, 0, 0, 1]);
  const armPos = new VectorKeyframeTrack("LeftArm.position", [0, 1], [0, 0, 0, 5, 5, 5]);
  return new AnimationClip("walk", 1, [spine, hips, stray, armPos]);
}

describe("WalkSampler", () => {
  const sampler = new WalkSampler(clip());
  const spine = boneIndex("Spine02");

  it("keeps the rotation tracks of known bones and the hips' position, and ignores the rest", () => {
    expect(sampler.tracks).toBe(2);
    expect(sampler.duration).toBe(1);
  });

  it("reads the clip at a phase", () => {
    const out = createPoseData();
    sampler.sample(0.5, out);
    expect(out.q[spine * 4 + 1]).toBeCloseTo(Math.SQRT1_2, 5);
    expect(out.q[spine * 4 + 3]).toBeCloseTo(Math.SQRT1_2, 5);
    expect(out.hips[0]).toBeCloseTo(1, 5);
    expect(out.hips[1]).toBeCloseTo(2, 5);
    expect(out.hips[2]).toBeCloseTo(3, 5);
  });

  it("wraps: any number of cycles gives the same pose, negative included", () => {
    const a = createPoseData();
    const b = createPoseData();
    const c = createPoseData();
    sampler.sample(0.3, a);
    sampler.sample(4.3, b);
    sampler.sample(-2.7, c);
    for (let i = 0; i < a.q.length; i++) {
      expect(b.q[i] ?? 0).toBeCloseTo(a.q[i] ?? 0, 4);
      expect(c.q[i] ?? 0).toBeCloseTo(a.q[i] ?? 0, 4);
    }
    expect(b.hips[0]).toBeCloseTo(a.hips[0] ?? 0, 4);
  });

  it("loops: the end of the cycle meets the start", () => {
    const a = createPoseData();
    const b = createPoseData();
    sampler.sample(0, a);
    sampler.sample(0.9999, b);
    expect(b.q[spine * 4 + 3]).toBeCloseTo(a.q[spine * 4 + 3] ?? 0, 2);
  });

  it("leaves a bone with no track as it was", () => {
    const out = createPoseData();
    out.q[boneIndex("Head") * 4] = 0.25;
    sampler.sample(0.5, out);
    expect(out.q[boneIndex("Head") * 4]).toBe(0.25);
  });
});
