import { describe, expect, it } from "vitest";

import { qrotate } from "./quat";
import { POSE_STRIDE } from "./sampler";
import { PoseWork, type Hierarchy } from "./skeleton";
import {
  DEFAULT_PARAMS,
  MAX_SHIFT,
  SpringBones,
  emptyEnv,
  type SpringDef,
  type SpringEnv,
} from "./physics";

/** An anchor (a head) with a ponytail of three spring bones, 0.2 m each, hanging along -y. */
function rig(): { h: Hierarchy; pose: Float32Array; defs: SpringDef[] } {
  const h: Hierarchy = { count: 4, parent: Int32Array.of(-1, 0, 1, 2) };
  const pose = new Float32Array(4 * POSE_STRIDE);
  for (let i = 0; i < 4; i += 1) {
    const o = i * POSE_STRIDE;
    pose[o + 1] = i === 0 ? 0 : -0.2;
    pose[o + 6] = 1;
    pose[o + 7] = pose[o + 8] = pose[o + 9] = 1;
  }
  const defs: SpringDef[] = [1, 2, 3].map((node) => ({
    node,
    parent: node - 1,
    tail: [0, -0.2, 0],
    group: "ponytail",
  }));
  return { h, pose, defs };
}

function frame(
  solver: SpringBones,
  h: Hierarchy,
  pose: Float32Array,
  work: PoseWork,
  dt: number,
  env: SpringEnv = emptyEnv(),
): void {
  work.compose(h, pose);
  solver.step(dt, pose, work, env);
}

/** The model-space point of the tip of the last bone's tail. */
function tip(work: PoseWork): [number, number, number] {
  const out = [0, 0, 0];
  qrotate(work.mq, 3 * 4, 0, -0.2, 0, out, 0);
  return [work.mp[9]! + out[0]!, work.mp[10]! + out[1]!, work.mp[11]! + out[2]!];
}

describe("SpringBones", () => {
  it("the first step is the clip's pose exactly", () => {
    const { h, pose, defs } = rig();
    const work = new PoseWork(4);
    const solver = new SpringBones(defs);
    frame(solver, h, pose, work, 1 / 60);
    expect(tip(work)[1]).toBeCloseTo(-0.8, 5);
    expect(tip(work)[0]).toBeCloseTo(0, 5);
    expect(work.fq[3 * 4 + 3]).toBeCloseTo(1, 5);
  });

  it("settles on the clip's pose after a kick and stays there", () => {
    const { h, pose, defs } = rig();
    const work = new PoseWork(4);
    const solver = new SpringBones(defs);
    frame(solver, h, pose, work, 1 / 60);
    solver.kick("ponytail", 3, 0, 1);
    let farthest = 0;
    for (let i = 0; i < 60 * 6; i += 1) {
      frame(solver, h, pose, work, 1 / 60);
      farthest = Math.max(farthest, Math.abs(tip(work)[0]));
    }
    expect(farthest).toBeGreaterThan(0.05);
    const t = tip(work);
    expect(t[0]).toBeCloseTo(0, 3);
    expect(t[1]).toBeCloseTo(-0.8, 3);
    expect(t[2]).toBeCloseTo(0, 3);
  });

  it("does nothing for a step of zero", () => {
    const { h, pose, defs } = rig();
    const work = new PoseWork(4);
    const solver = new SpringBones(defs);
    frame(solver, h, pose, work, 1 / 60);
    solver.kick(null, 2, 0, 0);
    for (let i = 0; i < 10; i += 1) frame(solver, h, pose, work, 1 / 60);
    const before = tip(work);
    const q = Array.from(work.fq);
    frame(solver, h, pose, work, 0);
    const after = tip(work);
    for (let k = 0; k < 3; k += 1) expect(after[k]).toBeCloseTo(before[k]!, 5);
    Array.from(work.fq).forEach((value, i) => {
      expect(value).toBeCloseTo(q[i]!, 5);
    });
  });

  it("60 and 144 Hz agree after the same time", () => {
    const run = (hz: number): number[] => {
      const { h, pose, defs } = rig();
      const work = new PoseWork(4);
      const solver = new SpringBones(defs);
      frame(solver, h, pose, work, 1 / hz);
      solver.kick("ponytail", 2, 0, 0);
      const steps = Math.round(hz * 0.5);
      for (let i = 0; i < steps; i += 1) frame(solver, h, pose, work, 1 / hz);
      return tip(work);
    };
    const a = run(60);
    const b = run(144);
    expect(Math.abs(a[0]! - b[0]!)).toBeLessThan(0.02);
    expect(Math.abs(a[1]! - b[1]!)).toBeLessThan(0.02);
  });

  it("keeps every tail at its length and inside the swing limit under hard pushes", () => {
    const { h, pose, defs } = rig();
    const work = new PoseWork(4);
    const solver = new SpringBones(defs);
    frame(solver, h, pose, work, 1 / 60);
    for (let i = 0; i < 200; i += 1) {
      if (i % 25 === 0) solver.kick(null, (i % 2 ? 1 : -1) * 40, 10, -30);
      frame(solver, h, pose, work, i % 7 === 0 ? 0.2 : 1 / 60, {
        ...emptyEnv(),
        windX: 30,
        windY: -20,
      });
      for (let k = 0; k < 3; k += 1) {
        const p = new Float32Array(3);
        solver.particle(k, p, 0);
        const head = [work.mp[(k + 1) * 3]!, work.mp[(k + 1) * 3 + 1]!, work.mp[(k + 1) * 3 + 2]!];
        const d = Math.hypot(p[0]! - head[0]!, p[1]! - head[1]!, p[2]! - head[2]!);
        expect(d).toBeCloseTo(0.2, 4);
        expect(Number.isFinite(p[0]!)).toBe(true);
        // The first bone hangs from a fixed anchor: its angle to straight down is at most the limit.
        if (k === 0) {
          const cos = -(p[1]! - head[1]!) / d;
          expect(Math.acos(Math.min(1, cos))).toBeLessThanOrEqual(
            DEFAULT_PARAMS.ponytail.maxAngle + 1e-3,
          );
        }
      }
    }
  });

  it("lags behind a moving anchor and catches up when it stops", () => {
    const { h, pose, defs } = rig();
    const work = new PoseWork(4);
    const solver = new SpringBones(defs);
    frame(solver, h, pose, work, 1 / 60);
    let lag = 0;
    for (let i = 0; i < 30; i += 1) {
      pose[0] = pose[0]! + 0.02;
      frame(solver, h, pose, work, 1 / 60);
      lag = Math.max(lag, pose[0] - tip(work)[0]);
    }
    expect(lag).toBeGreaterThan(0.02);
    for (let i = 0; i < 60 * 5; i += 1) frame(solver, h, pose, work, 1 / 60);
    expect(tip(work)[0]).toBeCloseTo(pose[0]!, 3);
  });

  it("a figure that moved shows as a lag, capped so a jump is not a whip", () => {
    const { h, pose, defs } = rig();
    const work = new PoseWork(4);
    const solver = new SpringBones(defs);
    frame(solver, h, pose, work, 1 / 60);
    frame(solver, h, pose, work, 1 / 60, { ...emptyEnv(), shiftX: 5 });
    // Pulled by at most MAX_SHIFT times the share, not by five metres.
    expect(Math.abs(tip(work)[0])).toBeLessThan(MAX_SHIFT * 1.2);
  });

  it("snap takes the next step from the clip's pose with no swing", () => {
    const { h, pose, defs } = rig();
    const work = new PoseWork(4);
    const solver = new SpringBones(defs);
    frame(solver, h, pose, work, 1 / 60);
    solver.kick(null, 20, 0, 0);
    for (let i = 0; i < 5; i += 1) frame(solver, h, pose, work, 1 / 60);
    expect(Math.abs(tip(work)[0])).toBeGreaterThan(0.01);
    solver.snap();
    frame(solver, h, pose, work, 1 / 60);
    expect(tip(work)[0]).toBeCloseTo(0, 5);
    expect(tip(work)[1]).toBeCloseTo(-0.8, 5);
  });

  it("a long frame is taken in pieces and stays finite", () => {
    const { h, pose, defs } = rig();
    const work = new PoseWork(4);
    const solver = new SpringBones(defs);
    frame(solver, h, pose, work, 1 / 60);
    solver.kick(null, 5, 0, 0);
    frame(solver, h, pose, work, 10);
    expect(Number.isFinite(tip(work)[0])).toBe(true);
  });
});
