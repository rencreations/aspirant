import { describe, expect, it } from "vitest";

import { qangle, qaxis, qconj, qfromTo, qidentity, qmul, qrotate, qscale } from "./quat";

const near = (a: ArrayLike<number>, b: ArrayLike<number>, digits = 6): void => {
  for (let i = 0; i < b.length; i += 1) expect(a[i]).toBeCloseTo(b[i]!, digits);
};

describe("quaternion helpers", () => {
  it("rotates a vector a quarter turn about y", () => {
    const q = [0, 0, 0, 1];
    qaxis(0, 1, 0, Math.PI / 2, q, 0);
    const out = [0, 0, 0];
    qrotate(q, 0, 0, 0, 1, out, 0);
    near(out, [1, 0, 0]);
  });

  it("multiplies in the order: b first, then a", () => {
    const a = [0, 0, 0, 1];
    const b = [0, 0, 0, 1];
    qaxis(0, 1, 0, Math.PI / 2, a, 0);
    qaxis(1, 0, 0, Math.PI / 2, b, 0);
    const ab = [0, 0, 0, 1];
    qmul(a, 0, b, 0, ab, 0);
    const out = [0, 0, 0];
    // b turns +z to -y, then a (about y) leaves -y where it is.
    qrotate(ab, 0, 0, 0, 1, out, 0);
    near(out, [0, -1, 0]);
  });

  it("the conjugate undoes a turn", () => {
    const q = [0, 0, 0, 1];
    qaxis(0.6, 0, 0.8, 1.1, q, 0);
    const inv = [0, 0, 0, 1];
    qconj(q, 0, inv, 0);
    const id = [0, 0, 0, 1];
    qmul(q, 0, inv, 0, id, 0);
    near(id, [0, 0, 0, 1]);
  });

  it("qfromTo takes one direction to another, also when they are opposite", () => {
    const q = [0, 0, 0, 1];
    const out = [0, 0, 0];
    qfromTo(0, 0, 1, 1, 0, 0, q, 0);
    qrotate(q, 0, 0, 0, 1, out, 0);
    near(out, [1, 0, 0]);
    qfromTo(0, 1, 0, 0, -1, 0, q, 0);
    qrotate(q, 0, 0, 1, 0, out, 0);
    near(out, [0, -1, 0]);
    qfromTo(1, 0, 0, 1, 0, 0, q, 0);
    near(q, [0, 0, 0, 1]);
    expect(Math.hypot(q[0]!, q[1]!, q[2]!, q[3]!)).toBeCloseTo(1, 6);
  });

  it("qscale keeps the axis and scales the angle", () => {
    const q = [0, 0, 0, 1];
    qaxis(0, 0, 1, 1.2, q, 0);
    const half = [0, 0, 0, 1];
    qscale(q, 0, 0.5, half, 0);
    expect(qangle(half, 0)).toBeCloseTo(0.6, 6);
    qscale(q, 0, 0, half, 0);
    near(half, [0, 0, 0, 1]);
    // The same turn written with a negative w.
    const neg = [-q[0]!, -q[1]!, -q[2]!, -q[3]!];
    qscale(neg, 0, 0.5, half, 0);
    expect(qangle(half, 0)).toBeCloseTo(0.6, 6);
  });

  it("an identity is the identity", () => {
    const q = [1, 2, 3, 4];
    qidentity(q, 0);
    expect(q).toEqual([0, 0, 0, 1]);
  });
});
