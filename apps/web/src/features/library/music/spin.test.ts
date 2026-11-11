import { describe, expect, it } from "vitest";

import { isUpright, nearestTurn, planRest, restAt, restEasing, TURN } from "./spin";

/** The record turns clockwise on screen: its angle falls. */
const PLAY = -(TURN * 20) / 60;

/** Walk a plan in small steps and return what it did. */
function walk(plan: ReturnType<typeof planRest>) {
  const steps = 400;
  const angles: number[] = [];
  const speeds: number[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const at = restAt(plan, (plan.dur * i) / steps);
    angles.push(at.angle);
    speeds.push(at.velocity);
  }
  return { angles, speeds };
}

describe("a record coming to rest", () => {
  it("ends upright, on a whole turn, wherever it stopped", () => {
    for (const start of [0.001, -0.3, -Math.PI, -TURN + 0.01, -TURN - 0.4, 2.5, -17.2, 40.1]) {
      for (const v of [PLAY, -PLAY, 0, 0.1, -0.2]) {
        const plan = planRest(start, v);
        expect(isUpright(plan.to), `${start} ${v}`).toBe(true);
        const end = restAt(plan, plan.dur + 0.01);
        expect(end.done).toBe(true);
        expect(end.angle).toBe(plan.to);
        expect(end.velocity).toBe(0);
      }
    }
  });

  it("goes on the way it turned and never turns back", () => {
    for (const start of [-0.05, -1, -Math.PI, -TURN + 0.05, -TURN - 0.05, -12.3]) {
      const plan = planRest(start, PLAY);
      expect(plan.to).toBeLessThan(start);
      const { angles, speeds } = walk(plan);
      for (let i = 1; i < angles.length; i += 1) {
        expect(angles[i]!).toBeLessThanOrEqual(angles[i - 1]! + 1e-9);
        expect(speeds[i]!).toBeLessThanOrEqual(1e-9);
      }
    }
  });

  it("starts at the speed it had, so the change does not jolt", () => {
    const plan = planRest(-2, PLAY);
    expect(restAt(plan, 0).velocity).toBeCloseTo(PLAY, 9);
    expect(restAt(plan, 0).angle).toBeCloseTo(-2, 9);
    // Just after the start the speed is still close to the record's.
    expect(Math.abs(restAt(plan, 0.05).velocity - PLAY)).toBeLessThan(0.2);
  });

  it("takes a short, bounded time, and runs only a little quicker on the longest way", () => {
    for (let k = 0; k < 200; k += 1) {
      const start = -(k / 200) * TURN * 1.5;
      const plan = planRest(start, PLAY);
      expect(plan.dur).toBeGreaterThanOrEqual(0.8);
      expect(plan.dur).toBeLessThanOrEqual(3.6);
      const { speeds } = walk(plan);
      const top = Math.max(...speeds.map((s) => Math.abs(s)));
      expect(top).toBeLessThan(Math.abs(PLAY) * 1.4);
    }
  });

  it("handles the edges of a turn: just before, at and past a whole turn", () => {
    // Just before upright, a record cannot stop in time: it makes one more turn.
    expect(planRest(-TURN + 0.01, PLAY).to).toBeCloseTo(-2 * TURN, 9);
    // At half a turn it goes on to the next whole turn ahead.
    expect(planRest(-Math.PI, PLAY).to).toBeCloseTo(-TURN, 9);
    // Just past upright it goes round to the next one.
    expect(planRest(-0.001, PLAY).to).toBeCloseTo(-TURN, 9);
    // The other way round, the same.
    expect(planRest(TURN - 0.01, -PLAY).to).toBeCloseTo(2 * TURN, 9);
  });

  it("brings a disc that hardly turns to the nearest whole turn", () => {
    expect(planRest(0.4, 0).to).toBe(0);
    expect(planRest(-0.4, 0).to).toBe(0);
    expect(planRest(-TURN + 0.4, 0.1).to).toBeCloseTo(-TURN, 9);
    expect(planRest(Math.PI + 0.1, 0).to).toBeCloseTo(TURN, 9);
    const still = planRest(0, 0);
    expect(still.dur).toBe(0);
    expect(restAt(still, 0)).toEqual({ angle: 0, velocity: 0, done: true });
  });

  it("knows the nearest whole turn and an upright face", () => {
    expect(nearestTurn(0.2)).toBe(0);
    expect(Object.is(nearestTurn(-0.2), -0)).toBe(false);
    expect(nearestTurn(-3.3)).toBeCloseTo(-TURN, 9);
    expect(nearestTurn(9.5)).toBeCloseTo(2 * TURN, 9);
    expect(isUpright(TURN * 3)).toBe(true);
    expect(isUpright(TURN * 3 + 0.01)).toBe(false);
  });

  it("writes the same curve as a CSS easing", () => {
    const plan = planRest(-1.2, PLAY);
    const css = restEasing(plan);
    const m = /^cubic-bezier\(0\.3333, (-?[\d.]+), 0\.6667, 1\)$/u.exec(css);
    expect(m).not.toBeNull();
    // The easing's first height is the start speed as a share of the way (a third of the slope).
    const y1 = Number(m?.[1]);
    expect(y1).toBeCloseTo((plan.v0 * plan.dur) / (3 * (plan.to - plan.from)), 3);
    // A Bezier with time controls at a third and two thirds is the Hermite curve of `restAt`.
    const s = 0.4;
    const bez = 3 * (1 - s) * (1 - s) * s * y1 + 3 * (1 - s) * s * s + s * s * s;
    const at = restAt(plan, plan.dur * s).angle;
    expect(plan.from + bez * (plan.to - plan.from)).toBeCloseTo(at, 3);
    expect(restEasing(planRest(0, 0))).toBe("linear");
  });
});
