import { describe, expect, it } from "vitest";

import { HANG_POSE, hangSway, rollToHang, wrapPi } from "./hang";
import { boneIndex, buildBind, compilePose } from "./pose/math";

describe("rollToHang", () => {
  it("is 0 when the body is already straight below the hand", () => {
    expect(rollToHang(0, -1, 0, 0, 0)).toBeCloseTo(0, 10);
    expect(rollToHang(0, -0.6, 0.3, 0, 0)).toBeCloseTo(0, 10);
  });

  it("swings a body that is to the side back under the hand, whichever side", () => {
    for (const [vx, vy] of [
      [0.4, -0.5],
      [-0.4, -0.5],
      [0.9, -0.1],
      [-0.2, 0.3],
    ] as const) {
      const r = rollToHang(vx, vy, 0, 0, 0);
      const x = vx * Math.cos(r) - vy * Math.sin(r);
      const y = vx * Math.sin(r) + vy * Math.cos(r);
      expect(x).toBeCloseTo(0, 9);
      expect(y).toBeLessThan(0);
    }
  });

  it("accounts for a yaw and a pitch of the doll", () => {
    const yaw = 0.7;
    const pitch = 0.2;
    const v = [0.3, -0.5, 0.2] as const;
    const r = rollToHang(v[0], v[1], v[2], yaw, pitch);
    // The vector the screen sees: yaw about Y, pitch about X, then the roll about Z.
    const x1 = v[0] * Math.cos(yaw) + v[2] * Math.sin(yaw);
    const z1 = -v[0] * Math.sin(yaw) + v[2] * Math.cos(yaw);
    const y2 = v[1] * Math.cos(pitch) - z1 * Math.sin(pitch);
    expect(x1 * Math.cos(r) - y2 * Math.sin(r)).toBeCloseTo(0, 9);
  });
});

describe("wrapPi", () => {
  it("brings any angle into -pi to pi without changing where it points", () => {
    for (const a of [-10, -Math.PI * 1.5, -0.5, 0, 0.5, 3, 4, 7, 20]) {
      const w = wrapPi(a);
      expect(w).toBeGreaterThanOrEqual(-Math.PI - 1e-12);
      expect(w).toBeLessThanOrEqual(Math.PI + 1e-12);
      expect(Math.cos(w)).toBeCloseTo(Math.cos(a), 10);
      expect(Math.sin(w)).toBeCloseTo(Math.sin(a), 10);
    }
    expect(wrapPi(0.4)).toBeCloseTo(0.4, 12);
  });
});

describe("hangSway", () => {
  it("is zero with no amount and no push", () => {
    expect(hangSway(3.3, 0)).toBe(0);
  });

  it("stays small, and a push dies away", () => {
    for (let t = 0; t < 20; t += 0.1) expect(Math.abs(hangSway(t, 1))).toBeLessThan(0.13);
    expect(Math.abs(hangSway(0, 0, 0.1, 0.3))).toBeGreaterThan(0.05);
    expect(hangSway(0, 0, 7, 0.3)).toBe(0);
    expect(Math.abs(hangSway(0, 0, 5.9, 0.3))).toBeLessThan(0.01);
  });
});

describe("HANG_POSE", () => {
  it("stretches the arm bone only, never the forearm, and keeps the hand the same size", () => {
    const scales = HANG_POSE.scales ?? {};
    expect(Object.keys(scales).sort()).toEqual(["LeftArm", "LeftHand"]);
    const arm = scales.LeftArm?.[1] ?? 0;
    const hand = scales.LeftHand?.[1] ?? 0;
    expect(arm).toBeGreaterThan(2);
    expect(arm * hand).toBeCloseTo(1, 10);
  });

  it("compiles on the rig and carries the stretch", () => {
    const bind = buildBind();
    const data = compilePose(bind, HANG_POSE);
    expect(data.q.length).toBe(bind.count * 4);
    expect(data.scale[boneIndex("LeftArm") * 3 + 1]).toBeCloseTo(3, 10);
  });
});
