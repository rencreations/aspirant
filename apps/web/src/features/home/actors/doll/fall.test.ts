import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  CATCH_LOW,
  CATCH_WIDE,
  FALL_BLEND_SECONDS,
  FALL_SPEED,
  FallClip,
  FallPlayer,
  landPose,
  landSquash,
  standPose,
} from "./fall";
import { BONE_COUNT, buildBind, compilePose, createPoseData, type PoseData } from "./pose/math";

const PUBLIC = path.resolve(import.meta.dirname, "../../../../../public");
const raw: unknown = JSON.parse(
  readFileSync(path.join(PUBLIC, "models/home/doll-fall.json"), "utf8"),
);

/** The largest difference of two poses, a quaternion and its negative being the same rotation. */
function maxDiff(a: PoseData, b: PoseData): number {
  let m = 0;
  for (let i = 0; i < a.q.length / 4; i++) {
    const k = i * 4;
    const dot =
      (a.q[k] ?? 0) * (b.q[k] ?? 0) +
      (a.q[k + 1] ?? 0) * (b.q[k + 1] ?? 0) +
      (a.q[k + 2] ?? 0) * (b.q[k + 2] ?? 0) +
      (a.q[k + 3] ?? 0) * (b.q[k + 3] ?? 0);
    const s = dot < 0 ? -1 : 1;
    for (let c = 0; c < 4; c++)
      m = Math.max(m, Math.abs((a.q[k + c] ?? 0) - s * (b.q[k + c] ?? 0)));
  }
  return m;
}

describe("the fitted clip", () => {
  const clip = FallClip.parse(raw);

  it("fits the rig and is 135 keys at 30 fps", () => {
    expect(clip).not.toBeNull();
    expect(clip?.keys).toBe(135);
    expect(clip?.fps).toBe(30);
    expect(clip?.seconds).toBeCloseTo(4.5, 6);
  });

  it("refuses a file that does not fit", () => {
    expect(FallClip.parse(null)).toBeNull();
    expect(FallClip.parse({ ...(raw as object), bones: ["Hips"] })).toBeNull();
    expect(FallClip.parse({ ...(raw as object), keys: 3 })).toBeNull();
  });

  it("loops: the end of the clip is the start, and any time wraps", () => {
    if (!clip) throw new Error("no clip");
    const a = createPoseData();
    const b = createPoseData();
    const c = createPoseData();
    clip.sample(0, a);
    clip.sample(clip.seconds, b);
    clip.sample(clip.seconds * 7, c);
    expect(maxDiff(a, b)).toBeLessThan(1e-5);
    expect(maxDiff(a, c)).toBeLessThan(1e-4);
    // The step from the last key to the first is no bigger than a step inside the clip.
    const last = createPoseData();
    clip.sample(clip.seconds - 1e-4, last);
    expect(maxDiff(last, a)).toBeLessThan(0.002);
  });

  it("moves smoothly: no key jumps more than a few hundredths", () => {
    if (!clip) throw new Error("no clip");
    const prev = createPoseData();
    const next = createPoseData();
    clip.sample(0, prev);
    let worst = 0;
    for (let k = 1; k <= clip.keys; k++) {
      clip.sample(k / clip.fps, next);
      worst = Math.max(worst, maxDiff(prev, next));
      prev.q.set(next.q);
    }
    expect(worst).toBeLessThan(0.12);
  });

  it("keeps every rotation a unit quaternion", () => {
    if (!clip) throw new Error("no clip");
    const out = createPoseData();
    for (const t of [0, 0.33, 1.7, 2.9, 4.4]) {
      clip.sample(t, out);
      for (let i = 0; i < BONE_COUNT; i++) {
        const n = Math.hypot(
          out.q[i * 4] ?? 0,
          out.q[i * 4 + 1] ?? 0,
          out.q[i * 4 + 2] ?? 0,
          out.q[i * 4 + 3] ?? 0,
        );
        expect(n).toBeCloseTo(1, 4);
      }
    }
  });
});

describe("the player", () => {
  it("runs at the frame's own pace and no other", () => {
    const p = new FallPlayer();
    p.target = 1;
    // 600 frames of 1/60 s are ten seconds whatever else happens.
    for (let i = 0; i < 600; i++) p.step(1 / 60);
    expect(p.time).toBeCloseTo(10 * FALL_SPEED, 6);
    expect(p.weight).toBe(1);
  });

  it("is the same clock in long and short frames", () => {
    const a = new FallPlayer();
    const b = new FallPlayer();
    a.target = 1;
    b.target = 1;
    for (let i = 0; i < 120; i++) a.step(1 / 60);
    for (let i = 0; i < 60; i++) b.step(1 / 30);
    expect(a.time).toBeCloseTo(b.time, 6);
  });

  it("blends in and out over a quarter of a second, and a frozen frame changes nothing", () => {
    const p = new FallPlayer();
    p.target = 1;
    p.step(0);
    expect(p.weight).toBe(0);
    expect(p.time).toBe(0);
    p.step(FALL_BLEND_SECONDS / 2);
    expect(p.weight).toBeCloseTo(0.5, 6);
    p.step(FALL_BLEND_SECONDS);
    expect(p.weight).toBe(1);
    p.target = 0;
    p.step(FALL_BLEND_SECONDS / 2);
    expect(p.weight).toBeCloseTo(0.5, 6);
    expect(p.running).toBe(true);
    p.step(FALL_BLEND_SECONDS);
    expect(p.weight).toBe(0);
    expect(p.running).toBe(false);
  });

  it("does not run while it is off", () => {
    const p = new FallPlayer();
    p.step(1);
    expect(p.time).toBe(0);
  });
});

describe("the landing", () => {
  const bind = buildBind();
  const wide = compilePose(bind, CATCH_WIDE);
  const low = compilePose(bind, CATCH_LOW);
  const from = createPoseData();
  const clip = FallClip.parse(raw);
  if (!clip) throw new Error("no clip");
  clip.sample(1.234, from);

  it("starts at the pose she has and ends at the low catch", () => {
    const out = createPoseData();
    landPose(out, from, wide, low, 0);
    expect(maxDiff(out, from)).toBeLessThan(1e-6);
    landPose(out, from, wide, low, 1);
    expect(maxDiff(out, low)).toBeLessThan(1e-6);
  });

  it("has no jump: the steps of a 60 fps landing are small and the ends are still", () => {
    const prev = createPoseData();
    const next = createPoseData();
    landPose(prev, from, wide, low, 0);
    const steps: number[] = [];
    for (let k = 1; k <= 30; k++) {
      landPose(next, from, wide, low, k / 30);
      steps.push(maxDiff(prev, next));
      prev.q.set(next.q);
    }
    expect(Math.max(...steps)).toBeLessThan(0.2);
    // Eased: the first and the last steps are smaller than the middle.
    expect(steps[0] ?? 1).toBeLessThan(Math.max(...steps) * 0.5);
    expect(steps[steps.length - 1] ?? 1).toBeLessThan(Math.max(...steps) * 0.5);
  });

  it("stands up from the low pose to the pose the section asks for", () => {
    const target = compilePose(bind, { turns: { LeftArm: [0, 0, 25], RightArm: [0, 0, -25] } });
    const out = createPoseData();
    standPose(out, low, target, 0);
    expect(maxDiff(out, low)).toBeLessThan(1e-6);
    standPose(out, low, target, 1);
    expect(maxDiff(out, target)).toBeLessThan(1e-6);
  });

  it("squashes on the palm and lets go while she stands up", () => {
    expect(landSquash(0, 0)).toBeCloseTo(0, 9);
    expect(landSquash(1, 0)).toBeCloseTo(-0.2, 6);
    expect(landSquash(1, 0.2)).toBeLessThan(0);
    expect(landSquash(1, 1)).toBeCloseTo(0, 6);
    expect(landSquash(0.8, 0)).toBeLessThan(0);
  });
});
