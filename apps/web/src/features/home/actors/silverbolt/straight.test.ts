import { Euler, Matrix4, Quaternion, Vector3 } from "three";
import { describe, expect, it } from "vitest";

import {
  elevation,
  measureStraight,
  meanStraightAngle,
  straightAngle,
  straightTurn,
  uprightFix,
} from "./straight";

/** The file's root bone: its own X is the model's Z, its Y is up, its Z is the model's -X. */
function rootRotation(): Quaternion {
  const m = new Matrix4().makeBasis(
    new Vector3(0, 0, 1),
    new Vector3(0, 1, 0),
    new Vector3(-1, 0, 0),
  );
  return new Quaternion().setFromRotationMatrix(m);
}

/** The head bone at rest, in the root's frame: its Y leans 35 degrees forward of up, Z is -X. */
function headRotation(root: Quaternion): Quaternion {
  const y = new Vector3(0, Math.cos(0.61), Math.sin(0.61));
  const z = new Vector3(-1, 0, 0);
  const x = new Vector3().crossVectors(y, z);
  const world = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x, y, z));
  return root.clone().invert().multiply(world);
}

const DROP = 0.92;

describe("measureStraight", () => {
  it("finds the body's axes in the root's own frame", () => {
    const root = rootRotation();
    const rest = measureStraight(root, headRotation(root), DROP);
    // The model's forward (+Z) is the root's own +X, up is +Y, the dragon's left (+X) is -Z.
    expect(rest.forward.toArray()).toEqual([
      expect.closeTo(1, 6),
      expect.closeTo(0, 6),
      expect.closeTo(0, 6),
    ]);
    expect(rest.up.y).toBeCloseTo(1, 6);
    expect(rest.lateral.z).toBeCloseTo(-1, 6);
  });

  it("puts the rest snout `drop` below the body's level", () => {
    const root = rootRotation();
    const head = headRotation(root);
    const rest = measureStraight(root, head, DROP);
    const snout = rest.snout.clone().applyQuaternion(head);
    expect(elevation(rest, snout.x, snout.y, snout.z)).toBeCloseTo(-DROP, 6);
  });
});

describe("straightAngle", () => {
  const root = rootRotation();
  const head = headRotation(root);
  const rest = measureStraight(root, head, DROP);
  // The spine at rest: from the first tail joint to the head's joint, level and a little rising.
  const spine = new Vector3(0.328, 0.017, 0);

  it("is `drop` plus the spine's own slope at rest", () => {
    const angle = straightAngle(rest, head, spine);
    expect(angle).toBeCloseTo(DROP + Math.atan2(0.017, 0.328), 6);
  });

  it("lifts the snout to the spine's slope", () => {
    const turn = straightTurn(new Quaternion(), rest, straightAngle(rest, head, spine));
    const straight = turn.clone().multiply(head);
    const snout = rest.snout.clone().applyQuaternion(straight);
    expect(elevation(rest, snout.x, snout.y, snout.z)).toBeCloseTo(
      elevation(rest, spine.x, spine.y, spine.z),
      6,
    );
  });

  it("needs no turn when the head is already in line", () => {
    const turn = straightTurn(new Quaternion(), rest, straightAngle(rest, head, spine));
    const straight = turn.clone().multiply(head);
    expect(straightAngle(rest, straight, spine)).toBeCloseTo(0, 6);
  });

  it("corrects only the pitch of a head that looks to the side", () => {
    // Turn the head 0.4 about the body's up axis first.
    const aside = new Quaternion().setFromAxisAngle(rest.up, 0.4).multiply(head);
    const angle = straightAngle(rest, aside, spine);
    const straight = straightTurn(new Quaternion(), rest, angle).multiply(aside);
    const snout = rest.snout.clone().applyQuaternion(straight);
    // Level with the spine, and still looking to the side.
    expect(elevation(rest, snout.x, snout.y, snout.z)).toBeCloseTo(
      elevation(rest, spine.x, spine.y, spine.z),
      6,
    );
    expect(Math.abs(snout.dot(rest.lateral))).toBeGreaterThan(0.2);
  });

  it("is a turn of the angle asked about the side axis", () => {
    const turn = straightTurn(new Quaternion(), rest, 0.5);
    const e = new Euler().setFromQuaternion(turn);
    expect(Math.abs(e.x) + Math.abs(e.y) + Math.abs(e.z)).toBeGreaterThan(0);
    const w = 2 * Math.acos(Math.min(1, Math.abs(turn.w)));
    expect(w).toBeCloseTo(0.5, 6);
  });
});

describe("meanStraightAngle", () => {
  const root = rootRotation();
  const head = headRotation(root);
  const rest = measureStraight(root, head, DROP);
  const spine = new Vector3(0.328, 0.017, 0);

  it("is the angle of the head itself when every sample is the rest head", () => {
    const one = straightAngle(rest, head, spine);
    expect(meanStraightAngle(rest, [head, head, head], spine)).toBeCloseTo(one, 9);
  });

  it("keeps the motion of a head that nods: the nod stays about the mean level", () => {
    const nod = (a: number): Quaternion => straightTurn(new Quaternion(), rest, a).multiply(head);
    // A head that is 0.3 above the rest and nods 0.1 either way.
    const heads = [nod(0.2), nod(0.3), nod(0.4), nod(0.3)];
    const lift = meanStraightAngle(rest, heads, spine);
    const start = straightAngle(rest, head, spine);
    expect(lift).toBeCloseTo(start - 0.3, 3);
    // Laid on the nodding head, the snouts spread about the spine's slope, not all on it.
    const slopes = heads.map((q) => {
      const turned = straightTurn(new Quaternion(), rest, lift).multiply(q);
      const v = rest.snout.clone().applyQuaternion(turned);
      return elevation(rest, v.x, v.y, v.z) - elevation(rest, spine.x, spine.y, spine.z);
    });
    expect(Math.max(...slopes)).toBeGreaterThan(0.05);
    expect(Math.min(...slopes)).toBeLessThan(-0.05);
    expect(slopes.reduce((a, b) => a + b, 0) / slopes.length).toBeCloseTo(0, 2);
  });

  it("is zero for no samples", () => {
    expect(meanStraightAngle(rest, [], spine)).toBe(0);
  });
});

describe("uprightFix", () => {
  it("gives a socket on the straightened head the orientation it had without the turn", () => {
    const root = rootRotation();
    const head = headRotation(root);
    const rest = measureStraight(root, head, DROP);
    const turn = straightTurn(new Quaternion(), rest, 0.97);
    // The world rotation of the head bone with and without the turn (the root is the parent).
    const without = root.clone().multiply(head);
    const withTurn = root.clone().multiply(turn).multiply(head);
    const fix = uprightFix(new Quaternion(), head, turn);
    // The socket's rest rotation is the identity in the model, so it is `without^-1` in the bone.
    const socketRest = without.clone().invert();
    const socketNow = fix.clone().multiply(socketRest);
    const world = withTurn.clone().multiply(socketNow);
    expect(world.angleTo(new Quaternion())).toBeLessThan(1e-6);
  });

  it("is the identity when there is no turn", () => {
    const root = rootRotation();
    const head = headRotation(root);
    const fix = uprightFix(new Quaternion(), head, new Quaternion());
    expect(fix.angleTo(new Quaternion())).toBeLessThan(1e-6);
  });
});
