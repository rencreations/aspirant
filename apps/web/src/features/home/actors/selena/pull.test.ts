import { describe, expect, it } from "vitest";

import { fingerClose, gripAngle, newArmSolve, solveArm, type ArmTurn } from "./pull";

type V = [number, number, number];

/** Rodrigues: rotate v about the turn's axis. */
function rot(t: ArmTurn, v: V): V {
  const c = Math.cos(t.angle);
  const s = Math.sin(t.angle);
  const d = t.ax * v[0] + t.ay * v[1] + t.az * v[2];
  const cx: V = [t.ay * v[2] - t.az * v[1], t.az * v[0] - t.ax * v[2], t.ax * v[1] - t.ay * v[0]];
  return [
    v[0] * c + cx[0] * s + t.ax * d * (1 - c),
    v[1] * c + cx[1] * s + t.ay * d * (1 - c),
    v[2] * c + cx[2] * s + t.az * d * (1 - c),
  ];
}

const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const len = (a: V): number => Math.hypot(a[0], a[1], a[2]);

const S: V = [0.1, 1.4, 0];
const E: V = [0.38, 1.3, 0.12];
const W: V = [0.62, 1.38, 0.05];
const P = [...S, ...E, ...W];

/** Apply the solve to the clip's arm the way the actor does. */
function apply(target: V): { e: V; w: V; clamped: boolean } {
  const out = solveArm(P, 0, 3, 6, target[0], target[1], target[2], newArmSolve());
  const e = add(S, rot(out.upper, sub(E, S)));
  const w = add(e, rot(out.fore, rot(out.upper, sub(W, E))));
  return { e, w, clamped: out.clamped };
}

describe("solveArm", () => {
  it("does nothing when the target is the wrist", () => {
    const r = apply(W);
    expect(len(sub(r.w, W))).toBeLessThan(1e-4);
    expect(len(sub(r.e, E))).toBeLessThan(1e-4);
  });

  it("lands the wrist on a reachable target and keeps the bone lengths", () => {
    const targets: V[] = [
      [0.3, 1.75, 0.1],
      [0.35, 1.0, 0.2],
      [0.0, 1.2, 0.45],
      [0.5, 1.5, -0.1],
    ];
    for (const t of targets) {
      const r = apply(t);
      expect(r.clamped).toBe(false);
      expect(len(sub(r.w, t))).toBeLessThan(1e-4);
      expect(Math.abs(len(sub(r.e, S)) - len(sub(E, S)))).toBeLessThan(1e-4);
      expect(Math.abs(len(sub(r.w, r.e)) - len(sub(W, E)))).toBeLessThan(1e-4);
    }
  });

  it("pulls a target beyond the reach in and says so", () => {
    const r = apply([2, 1.4, 0]);
    expect(r.clamped).toBe(true);
    const reach = len(sub(E, S)) + len(sub(W, E));
    expect(len(sub(r.w, S))).toBeLessThanOrEqual(reach);
    expect(len(sub(r.w, S))).toBeGreaterThan(reach - 0.01);
  });

  it("is continuous: a small move of the target is a small move of the elbow and the wrist", () => {
    let last = apply([0.3, 1.75, 0.1]);
    for (let i = 1; i <= 60; i += 1) {
      const t: V = [0.3, 1.75 - i * 0.01, 0.1];
      const r = apply(t);
      expect(len(sub(r.e, last.e))).toBeLessThan(0.1);
      expect(len(sub(r.w, last.w))).toBeLessThan(0.0105);
      last = r;
    }
  });

  it("keeps the elbow on the side it had", () => {
    const side = (e: V, w: V): number => {
      // The elbow's offset from the line shoulder to wrist, along the clip's own offset direction.
      const u = sub(w, S);
      const l = len(u);
      const k = ((e[0] - S[0]) * u[0] + (e[1] - S[1]) * u[1] + (e[2] - S[2]) * u[2]) / (l * l);
      return len(sub(sub(e, S), [u[0] * k, u[1] * k, u[2] * k]));
    };
    const r = apply([0.3, 1.75, 0.1]);
    expect(side(r.e, r.w)).toBeGreaterThan(0.01);
    // The pole of the clip and of the solve point the same way (positive dot).
    const clipPole = sub(
      sub(E, S),
      (() => {
        const u = sub(W, S);
        const k =
          ((E[0] - S[0]) * u[0] + (E[1] - S[1]) * u[1] + (E[2] - S[2]) * u[2]) / len(u) ** 2;
        return [u[0] * k, u[1] * k, u[2] * k] as V;
      })(),
    );
    const w2: V = apply([0.3, 1.75, 0.1]).w;
    const u2 = sub(w2, S);
    const k2 =
      ((r.e[0] - S[0]) * u2[0] + (r.e[1] - S[1]) * u2[1] + (r.e[2] - S[2]) * u2[2]) / len(u2) ** 2;
    const newPole = sub(sub(r.e, S), [u2[0] * k2, u2[1] * k2, u2[2] * k2]);
    expect(
      clipPole[0] * newPole[0] + clipPole[1] * newPole[1] + clipPole[2] * newPole[2],
    ).toBeGreaterThan(0);
  });
});

describe("the grip", () => {
  it("is open at 0 and every joint stays within the limit at 1", () => {
    for (const f of ["thumb", "index", "middle", "ring", "pinky"] as const) {
      for (const j of [0, 1, 2] as const) {
        expect(gripAngle(f, j, 0)).toBe(0);
        expect(gripAngle(f, j, 1)).toBeGreaterThan(0);
        expect(gripAngle(f, j, 1)).toBeLessThanOrEqual(1.35);
      }
    }
  });

  it("closes the little finger before the thumb and ends all closed", () => {
    expect(fingerClose("pinky", 0.2)).toBeGreaterThan(fingerClose("thumb", 0.2));
    for (const f of ["thumb", "index", "middle", "ring", "pinky"] as const) {
      expect(fingerClose(f, 1)).toBe(1);
      expect(fingerClose(f, 0)).toBe(0);
    }
  });
});
