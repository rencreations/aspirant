import { describe, expect, it } from "vitest";

import { qaxis, qrotate } from "./quat";
import { POSE_STRIDE } from "./sampler";
import { PoseWork, type Hierarchy } from "./skeleton";

/** Three bones in a chain, each one metre up its parent. */
function chain(): { h: Hierarchy; pose: Float32Array } {
  const h: Hierarchy = { count: 3, parent: Int32Array.of(-1, 0, 1) };
  const pose = new Float32Array(3 * POSE_STRIDE);
  for (let i = 0; i < 3; i += 1) {
    const o = i * POSE_STRIDE;
    pose[o + 1] = i === 0 ? 0 : 1;
    pose[o + 6] = 1;
    pose[o + 7] = pose[o + 8] = pose[o + 9] = 1;
  }
  return { h, pose };
}

const pos = (w: PoseWork, i: number): number[] => [
  w.mp[i * 3]!,
  w.mp[i * 3 + 1]!,
  w.mp[i * 3 + 2]!,
];

describe("PoseWork.compose", () => {
  it("stacks the bones up the chain", () => {
    const { h, pose } = chain();
    const w = new PoseWork(3);
    w.compose(h, pose);
    expect(pos(w, 2)).toEqual([0, 2, 0]);
    expect(w.fq[11]).toBe(1);
  });

  it("a clip rotation on the root swings the whole chain", () => {
    const { h, pose } = chain();
    const q = [0, 0, 0, 1];
    qaxis(0, 0, 1, Math.PI / 2, q, 0);
    pose.set(q, 3);
    const w = new PoseWork(3);
    w.compose(h, pose);
    const p = pos(w, 2);
    expect(p[0]).toBeCloseTo(-2, 6);
    expect(p[1]).toBeCloseTo(0, 6);
  });

  it("a local turn after the clip rotation moves what is below, not the bone's head", () => {
    const { h, pose } = chain();
    const w = new PoseWork(3);
    w.turnLocal(1, 0, 0, 1, Math.PI / 2);
    w.compose(h, pose);
    expect(pos(w, 1)).toEqual([0, 1, 0]);
    const p = pos(w, 2);
    expect(p[0]).toBeCloseTo(-1, 6);
    expect(p[1]).toBeCloseTo(1, 6);
  });

  it("a model turn is about the model's axis even under a rotated parent", () => {
    const { h, pose } = chain();
    // The root lies on its side: a quarter turn about z. A turn of bone 1 about the model's y
    // axis must not move bone 2 (bone 2 is now along -x, not on the y axis): it swings about y.
    const q = [0, 0, 0, 1];
    qaxis(0, 0, 1, Math.PI / 2, q, 0);
    pose.set(q, 3);
    const plain = new PoseWork(3);
    plain.compose(h, pose);
    const turned = new PoseWork(3);
    turned.turnModel(1, 0, 1, 0, Math.PI / 2);
    turned.compose(h, pose);
    const out = [0, 0, 0];
    // Bone 1 is at (-1, 0, 0). Bone 2 was 1 m further along -x; a quarter turn about y sends
    // that offset (-1, 0, 0) to (0, 0, 1).
    expect(pos(plain, 1)[0]).toBeCloseTo(-1, 6);
    expect(pos(turned, 1)[0]).toBeCloseTo(-1, 6);
    const p = pos(turned, 2);
    expect(p[0]).toBeCloseTo(-1, 6);
    expect(p[2]).toBeCloseTo(1, 6);
    // The local rotation that was written reproduces the model rotation.
    qrotate(turned.mq, 4, 0, 1, 0, out, 0);
    expect(Math.hypot(out[0]!, out[1]!, out[2]!)).toBeCloseTo(1, 6);
  });

  it("clearTurns forgets the turns and a new frame starts clean", () => {
    const { h, pose } = chain();
    const w = new PoseWork(3);
    w.turnLocal(0, 0, 0, 1, 1);
    w.clearTurns();
    w.compose(h, pose);
    expect(pos(w, 2)).toEqual([0, 2, 0]);
  });

  it("two turns on one bone add up", () => {
    const { h, pose } = chain();
    const w = new PoseWork(3);
    w.turnLocal(0, 0, 0, 1, Math.PI / 4);
    w.turnLocal(0, 0, 0, 1, Math.PI / 4);
    w.compose(h, pose);
    const p = pos(w, 1);
    expect(p[0]).toBeCloseTo(-1, 6);
    expect(p[1]).toBeCloseTo(0, 6);
  });
});
