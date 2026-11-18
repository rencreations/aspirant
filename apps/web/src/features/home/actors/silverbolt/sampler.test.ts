import { AnimationClip, Bone, QuaternionKeyframeTrack, VectorKeyframeTrack } from "three";
import { describe, expect, it } from "vitest";

import { ClipSampler, clipTime } from "./sampler";

describe("clipTime", () => {
  it("wraps a loop and holds the ends of anything else", () => {
    expect(clipTime(2.5, 2, true)).toBeCloseTo(0.5);
    expect(clipTime(-0.5, 2, true)).toBeCloseTo(1.5);
    expect(clipTime(2.5, 2, false)).toBe(2);
    expect(clipTime(-1, 2, false)).toBe(0);
    expect(clipTime(1, 0, true)).toBe(0);
  });
});

function setup(): { bone: Bone; sampler: ClipSampler } {
  const bone = new Bone();
  bone.name = "arm";
  const half = Math.SQRT1_2;
  const a = new AnimationClip("a", 1, [
    new VectorKeyframeTrack("arm.position", [0, 1], [0, 0, 0, 2, 0, 0]),
    new VectorKeyframeTrack("arm.scale", [0, 1], [1, 1, 1, 3, 3, 3]),
    new QuaternionKeyframeTrack("arm.quaternion", [0, 1], [0, 0, 0, 1, 0, 0, half, half]),
    // A bone the model does not have is left out.
    new VectorKeyframeTrack("ghost.position", [0, 1], [0, 0, 0, 9, 9, 9]),
  ]);
  const b = new AnimationClip("b", 1, [
    new VectorKeyframeTrack("arm.position", [0, 1], [10, 0, 0, 10, 0, 0]),
  ]);
  return { bone, sampler: new ClipSampler([a, b], new Map([["arm", bone]])) };
}

describe("ClipSampler", () => {
  it("writes the pose of a clip at a time, every time it is asked", () => {
    const { bone, sampler } = setup();
    expect(sampler.has("a")).toBe(true);
    expect(sampler.has("nope")).toBe(false);
    sampler.pose("a", 0.5);
    expect(bone.position.x).toBeCloseTo(1);
    expect(bone.scale.x).toBeCloseTo(2);
    expect(bone.quaternion.z).toBeGreaterThan(0.1);
    // The bone is put back by the caller, then asked for the same time again: it must be written again.
    bone.position.set(0, 0, 0);
    sampler.pose("a", 0.5);
    expect(bone.position.x).toBeCloseTo(1);
  });

  it("holds the ends and does not fail on a clip it does not have", () => {
    const { bone, sampler } = setup();
    sampler.pose("a", 5);
    expect(bone.position.x).toBeCloseTo(2);
    bone.position.set(7, 7, 7);
    sampler.pose("nope", 0);
    expect(bone.position.x).toBe(7);
  });

  it("blends a second clip in by weight", () => {
    const { bone, sampler } = setup();
    sampler.pose("a", 1);
    sampler.mix("b", 0, 0);
    expect(bone.position.x).toBeCloseTo(2);
    sampler.mix("b", 0, 0.5);
    expect(bone.position.x).toBeCloseTo(6);
    sampler.pose("a", 1);
    sampler.mix("b", 0, 1);
    expect(bone.position.x).toBeCloseTo(10);
  });
});
