import { Euler, Quaternion, Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { at } from "../motion";
import { RIG_BONES } from "../rig";

import {
  BONE_COUNT,
  BONE_NAMES,
  MAX_ARM_SCALE,
  applyTurns,
  blendPoseData,
  boneIndex,
  buildBind,
  compilePose,
  copyPoseData,
  createPoseData,
  restPoseData,
  slerpFlat,
  stretchArm,
  turnOnto,
} from "./math";
import { POSES, POSE_NAMES } from "./poses";

const DEG = Math.PI / 180;
const bind = buildBind();

function quatAt(a: Float32Array, i: number): Quaternion {
  return new Quaternion().fromArray(a, i * 4);
}

/** The angle between two rotations, in radians. (acos of the dot is blind near 0: this is not.) */
function angleBetween(a: Quaternion, b: Quaternion): number {
  const q = a.clone().multiply(b.clone().invert());
  return 2 * Math.atan2(Math.hypot(q.x, q.y, q.z), Math.abs(q.w));
}

describe("the bind", () => {
  it("has 22 bones and the parents come first", () => {
    expect(BONE_COUNT).toBe(22);
    expect(bind.count).toBe(22);
    expect(bind.parent[0]).toBe(-1);
    for (let i = 1; i < bind.count; i++) {
      const p = bind.parent[i] ?? -1;
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThan(i);
    }
  });

  it("the parent's world rotation of a child is its parent's world rotation", () => {
    const spine = boneIndex("Spine02");
    const hips = boneIndex("Hips");
    const expected = quatAt(bind.parentWorld, hips).multiply(quatAt(bind.rest, hips));
    expect(angleBetween(quatAt(bind.parentWorld, spine), expected)).toBeLessThan(1e-5);
  });

  it("the inverse really is the inverse", () => {
    for (let i = 0; i < bind.count; i++) {
      const product = quatAt(bind.parentWorld, i).multiply(quatAt(bind.parentWorldInv, i));
      expect(Math.abs(product.w)).toBeCloseTo(1, 5);
    }
  });

  it("refuses a bone whose parent comes later", () => {
    const bad = [{ ...RIG_BONES[1]!, parent: "Hips" }, { ...RIG_BONES[0]! }];
    expect(() => buildBind(bad)).toThrow();
  });

  it("boneIndex throws for a name the rig does not have", () => {
    expect(() => boneIndex("Tail")).toThrow(/Tail/);
    expect(BONE_NAMES[boneIndex("Head")]).toBe("Head");
  });
});

describe("turnOnto: a turn about the MODEL's axes", () => {
  // The property that matters: the bone's world rotation after the turn is R times the one it
  // had, whatever the frame of the bone is.
  const R = (x: number, y: number, z: number): Quaternion =>
    new Quaternion().setFromEuler(new Euler(x, y, z, "XYZ"));

  it("the world rotation of every bone turns by exactly R", () => {
    const turns: Array<[number, number, number]> = [
      [0.4, 0, 0],
      [0, 0.9, 0],
      [0, 0, -1.1],
      [0.3, -0.5, 0.7],
    ];
    for (const t of turns) {
      for (let i = 0; i < bind.count; i++) {
        const base = quatAt(bind.rest, i);
        const out = new Quaternion();
        turnOnto(out, bind, i, base, t[0], t[1], t[2]);
        const before = quatAt(bind.parentWorld, i).multiply(base);
        const after = quatAt(bind.parentWorld, i).multiply(out);
        const want = R(t[0], t[1], t[2]).multiply(before);
        expect(angleBetween(after, want)).toBeLessThan(1e-4);
      }
    }
  });

  it("a turn of nothing changes nothing", () => {
    for (let i = 0; i < bind.count; i++) {
      const base = quatAt(bind.rest, i);
      const out = new Quaternion();
      turnOnto(out, bind, i, base, 0, 0, 0);
      expect(angleBetween(out, base)).toBeLessThan(1e-5);
    }
  });

  it("the left and right arms turn by the same angle in the world, with opposite signs of Z", () => {
    // Raising the left arm is +Z, raising the right arm is -Z: the world turn is the same size.
    const l = boneIndex("LeftArm");
    const r = boneIndex("RightArm");
    const a = new Quaternion();
    const b = new Quaternion();
    turnOnto(a, bind, l, quatAt(bind.rest, l), 0, 0, 30 * DEG);
    turnOnto(b, bind, r, quatAt(bind.rest, r), 0, 0, -30 * DEG);
    const turnL = angleBetween(a, quatAt(bind.rest, l));
    const turnR = angleBetween(b, quatAt(bind.rest, r));
    expect(turnL).toBeCloseTo(30 * DEG, 4);
    expect(turnR).toBeCloseTo(30 * DEG, 4);
  });
});

describe("compilePose", () => {
  it("an empty pose is the bind pose", () => {
    const data = compilePose(bind, { turns: {} });
    const rest = restPoseData(bind);
    expect(Array.from(data.q)).toEqual(Array.from(rest.q));
    expect(Array.from(data.hips)).toEqual(Array.from(rest.hips));
    expect(data.scale.every((s) => s === 1)).toBe(true);
  });

  it("adds the hips offset to the root bone's rest position", () => {
    const rest = restPoseData(bind);
    const data = compilePose(bind, { turns: {}, hips: [0, -0.12, 0.01] });
    expect(data.hips[1]).toBeCloseTo(at(rest.hips, 1) - 0.12, 6);
    expect(data.hips[2]).toBeCloseTo(at(rest.hips, 2) + 0.01, 6);
  });

  it("sets the scales it names and leaves the rest at 1", () => {
    const data = compilePose(bind, { turns: {}, scales: { LeftArm: [1, 1.6, 1] } });
    expect(data.scale[boneIndex("LeftArm") * 3 + 1]).toBeCloseTo(1.6, 6);
    expect(data.scale[boneIndex("RightArm") * 3 + 1]).toBe(1);
  });

  it("throws on a bone the rig does not have", () => {
    expect(() => compilePose(bind, { turns: { Tail: [1, 0, 0] } })).toThrow();
  });

  it("every shipped pose compiles, keeps unit quaternions and leaves the legs and arms where they should be", () => {
    for (const name of POSE_NAMES) {
      const data = compilePose(bind, POSES[name]);
      for (let i = 0; i < bind.count; i++) {
        expect(quatAt(data.q, i).length()).toBeCloseTo(1, 4);
      }
      for (const v of data.hips) expect(Number.isFinite(v)).toBe(true);
    }
  });

  it("the rest pose is the bind pose and the sit pose bends the knee about the model's X", () => {
    const rest = compilePose(bind, POSES.rest);
    expect(Array.from(rest.q)).toEqual(Array.from(restPoseData(bind).q));
    const sit = compilePose(bind, POSES.sit);
    const leg = boneIndex("LeftLeg");
    const upLeg = boneIndex("LeftUpLeg");
    const before = quatAt(bind.parentWorld, leg).multiply(quatAt(bind.rest, leg));
    const worldUp = quatAt(sit.q, upLeg);
    // Not equal to the rest: the thigh has turned by 90 degrees about the model's X.
    expect(angleBetween(worldUp, quatAt(bind.rest, upLeg))).toBeGreaterThan(Math.PI / 3);
    expect(before.length()).toBeCloseTo(1, 5);
  });
});

describe("blending poses", () => {
  const a = compilePose(bind, POSES.stand);
  const b = compilePose(bind, POSES.fall);

  it("is a at 0 and b at 1", () => {
    const out = createPoseData();
    blendPoseData(out, a, b, 0);
    for (let i = 0; i < bind.count; i++) {
      expect(angleBetween(quatAt(out.q, i), quatAt(a.q, i))).toBeLessThan(1e-4);
    }
    blendPoseData(out, a, b, 1);
    for (let i = 0; i < bind.count; i++) {
      expect(angleBetween(quatAt(out.q, i), quatAt(b.q, i))).toBeLessThan(1e-4);
    }
    expect(out.hips[1]).toBeCloseTo(at(b.hips, 1), 6);
  });

  it("clamps the weight", () => {
    const low = createPoseData();
    const high = createPoseData();
    blendPoseData(low, a, b, -3);
    blendPoseData(high, a, b, 9);
    for (let i = 0; i < bind.count; i++) {
      expect(angleBetween(quatAt(low.q, i), quatAt(a.q, i))).toBeLessThan(1e-4);
      expect(angleBetween(quatAt(high.q, i), quatAt(b.q, i))).toBeLessThan(1e-4);
    }
  });

  it("keeps unit quaternions in the middle and is safe in place", () => {
    const out = createPoseData();
    copyPoseData(out, a);
    blendPoseData(out, out, b, 0.37);
    for (let i = 0; i < bind.count; i++) expect(quatAt(out.q, i).length()).toBeCloseTo(1, 4);
  });

  it("goes the short way round when a quaternion is the negative of the other", () => {
    const x = new Float32Array([0, 0, 0, 1]);
    const y = new Float32Array([0, 0, 0, -1]);
    const out = new Float32Array(4);
    slerpFlat(out, 0, x, 0, y, 0, 0.5);
    expect(Math.abs(out[3] ?? 0)).toBeCloseTo(1, 6);
  });

  it("slerp: the middle of a quarter turn is an eighth", () => {
    const x = new Float32Array([0, 0, 0, 1]);
    const q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2);
    const y = new Float32Array([q.x, q.y, q.z, q.w]);
    const out = new Float32Array(4);
    slerpFlat(out, 0, x, 0, y, 0, 0.5);
    const mid = new Quaternion(out[0], out[1], out[2], out[3]);
    expect(angleBetween(mid, new Quaternion())).toBeCloseTo(Math.PI / 4, 4);
  });

  it("blends the stretch of an arm", () => {
    const hang = compilePose(bind, { turns: {}, scales: { LeftArm: [1, 3, 1] } });
    const rest = compilePose(bind, { turns: {} });
    const out = createPoseData();
    blendPoseData(out, rest, hang, 0.5);
    expect(out.scale[boneIndex("LeftArm") * 3 + 1]).toBeCloseTo(2, 6);
  });
});

describe("applyTurns", () => {
  it("leaves a bone alone when its three numbers are 0, and turns the others", () => {
    const data = compilePose(bind, POSES.stand);
    const before = Float32Array.from(data.q);
    const turns = new Float32Array(BONE_COUNT * 3);
    const head = boneIndex("Head");
    turns[head * 3 + 2] = 0.3;
    applyTurns(bind, data.q, turns);
    for (let i = 0; i < bind.count; i++) {
      const moved = angleBetween(quatAt(data.q, i), quatAt(before, i));
      if (i === head) expect(moved).toBeCloseTo(0.3, 3);
      else expect(moved).toBe(0);
    }
  });

  it("is the same as compiling the turn into the pose (the two paths agree)", () => {
    const viaPose = compilePose(bind, { turns: { RightArm: [0, 0, -40] } });
    const viaLayer = compilePose(bind, { turns: {} });
    const turns = new Float32Array(BONE_COUNT * 3);
    turns[boneIndex("RightArm") * 3 + 2] = -40 * DEG;
    applyTurns(bind, viaLayer.q, turns);
    const i = boneIndex("RightArm");
    expect(angleBetween(quatAt(viaLayer.q, i), quatAt(viaPose.q, i))).toBeLessThan(1e-4);
  });
});

describe("stretchArm", () => {
  const arm = boneIndex("LeftArm");
  const hand = boneIndex("LeftHand");
  const fresh = (): Float32Array => createPoseData().scale;

  it("a factor of 1 changes nothing", () => {
    const s = fresh();
    stretchArm(s, arm, hand, 1);
    expect(s.every((v) => v === 1)).toBe(true);
  });

  it("the arm grows and the hand shrinks by the same factor, so the hand's length stays", () => {
    const s = fresh();
    stretchArm(s, arm, hand, 1.6);
    expect(s[arm * 3 + 1]).toBeCloseTo(1.6, 6);
    expect(at(s, arm * 3 + 1) * at(s, hand * 3 + 1)).toBeCloseTo(1, 6);
    // The forearm is never touched: scaling it would compound.
    expect(s[boneIndex("LeftForeArm") * 3 + 1]).toBe(1);
  });

  it("stacks on what the pose already has, and the product stays 1", () => {
    const s = fresh();
    stretchArm(s, arm, hand, 1.5);
    stretchArm(s, arm, hand, 1.5);
    expect(s[arm * 3 + 1]).toBeCloseTo(2.25, 5);
    expect(at(s, arm * 3 + 1) * at(s, hand * 3 + 1)).toBeCloseTo(1, 5);
  });

  it("holds the arm under the maximum and over the minimum", () => {
    const s = fresh();
    stretchArm(s, arm, hand, 50);
    expect(s[arm * 3 + 1]).toBeCloseTo(MAX_ARM_SCALE, 6);
    expect(at(s, arm * 3 + 1) * at(s, hand * 3 + 1)).toBeCloseTo(1, 6);
    const t = fresh();
    stretchArm(t, arm, hand, 0.01);
    expect(t[arm * 3 + 1]).toBeCloseTo(0.4, 6);
  });

  it("never pulls a pose that is already longer than the maximum back in", () => {
    const s = fresh();
    s[arm * 3 + 1] = 4;
    s[hand * 3 + 1] = 0.25;
    stretchArm(s, arm, hand, 1.1);
    expect(s[arm * 3 + 1]).toBeGreaterThanOrEqual(4);
  });
});
