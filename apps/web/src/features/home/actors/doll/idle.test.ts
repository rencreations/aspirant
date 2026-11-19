import { describe, expect, it } from "vitest";

import { FORCE_AFTER, IDLE_NAMES, LENGTH, RideBehaviour, type IdleName } from "./idle";

const calm = { shake: 0, lostGrip: false };

/** Run a life and return the names of the states in order (one entry per change). */
function life(seed: number, seconds: number, dt = 1 / 60): IdleName[] {
  const b = new RideBehaviour(seed);
  const seen: IdleName[] = [];
  for (let t = 0; t < seconds; t += dt) {
    const cue = b.step(dt, calm);
    if (seen[seen.length - 1] !== cue.name) seen.push(cue.name);
  }
  return seen;
}

describe("the ride behaviour", () => {
  it("is the same life for the same seed and another for another", () => {
    expect(life(5, 120)).toEqual(life(5, 120));
    expect(life(5, 120)).not.toEqual(life(6, 120));
  });

  it("reaches every calm state within a fixed time, whatever the seed", () => {
    const limit = FORCE_AFTER * 2 + 12;
    for (const seed of [1, 2, 3, 7, 99, 1234]) {
      const seen = new Set(life(seed, limit));
      for (const name of ["sit", "look", "fidget", "adjust", "slip", "recover"] as const) {
        expect(seen.has(name), `seed ${seed}: ${name}`).toBe(true);
      }
    }
  });

  it("always follows a slip with a recover and then an adjust", () => {
    for (const seed of [1, 4, 8, 21]) {
      const names = life(seed, 200);
      names.forEach((n, i) => {
        if (n === "slip") {
          expect(names[i + 1]).toBe("recover");
          expect(names[i + 2]).toBe("adjust");
        }
      });
    }
  });

  it("gives every calm state a finite length and finite numbers", () => {
    for (const name of ["sit", "look", "fidget", "adjust", "slip", "recover"] as const) {
      expect(Number.isFinite(LENGTH[name][1])).toBe(true);
    }
    const b = new RideBehaviour(3);
    for (let i = 0; i < 6000; i += 1) {
      const c = b.step(1 / 60, calm);
      for (const v of [
        c.grip,
        c.shiftX,
        c.shiftY,
        c.slide,
        c.flail,
        c.legs,
        c.tilt,
        c.sweep,
        c.u,
      ]) {
        expect(Number.isFinite(v)).toBe(true);
      }
    }
  });

  it("strains when the dragon shakes and recovers after it", () => {
    const b = new RideBehaviour(2);
    for (let i = 0; i < 30; i += 1) b.step(1 / 60, calm);
    expect(b.step(1 / 60, { shake: 0.8, lostGrip: false }).name).toBe("strain");
    for (let i = 0; i < 120; i += 1) b.step(1 / 60, { shake: 0.9, lostGrip: false });
    expect(b.state).toBe("strain");
    let c = b.step(1 / 60, calm);
    expect(c.name).toBe("recover");
    for (let i = 0; i < 400; i += 1) c = b.step(1 / 60, calm);
    expect(c.name).not.toBe("strain");
    expect(c.name).not.toBe("gone");
  });

  it("loses the grip for good: the grip goes to nothing and stays", () => {
    const b = new RideBehaviour(2);
    b.step(1 / 60, calm);
    let c = b.step(1 / 60, { shake: 1, lostGrip: true });
    expect(c.name).toBe("gone");
    for (let i = 0; i < 60; i += 1) c = b.step(1 / 60, calm);
    expect(c.name).toBe("gone");
    expect(c.grip).toBeLessThan(0.01);
  });

  it("does not skip a state on a long frame and ignores a frame of no time", () => {
    const a = new RideBehaviour(9);
    const before = a.step(0, calm).t;
    expect(before).toBe(0);
    const c = a.step(5, calm);
    expect(c.t).toBeLessThanOrEqual(0.25 + 1e-9);
  });

  it("names every state it can be in", () => {
    expect(IDLE_NAMES).toHaveLength(8);
  });
});
