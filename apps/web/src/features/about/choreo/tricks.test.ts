import { describe, expect, it } from "vitest";

import { TAU } from "./ease";
import {
  createSpin,
  createTricks,
  startTrick,
  stepSpin,
  stepTricks,
  trickPose,
  TRICK_SECONDS,
  type TrickKind,
  type Tricks,
} from "./tricks";

const DT = 1 / 60;
const FLYING = { travelling: 0.8, speed: 0.9, vx: 0.6, vy: 0.6 };
const SITTING = { travelling: 0, speed: 0, vx: 0, vy: 0 };

/** Fly for a while and write down what was started, with the time between two tricks. */
function show(seconds: number, flight = FLYING) {
  const tr = createTricks();
  const kinds: TrickKind[] = [];
  const gaps: number[] = [];
  let was: TrickKind | null = null;
  let gap = 0;
  for (let i = 0; i < Math.round(seconds / DT); i += 1) {
    stepTricks(tr, DT, flight);
    const now = tr.active?.kind ?? null;
    if (now && !was) {
      kinds.push(now);
      if (kinds.length > 1) gaps.push(gap);
    }
    gap = now ? 0 : gap + DT;
    was = now;
  }
  return { kinds, gaps };
}

/** An angle as a distance from the nearest whole turn. */
const offTurn = (a: number) => Math.abs(a - Math.round(a / TAU) * TAU);

describe("the drone's tricks", () => {
  it("start only while it is travelling", () => {
    expect(show(10, SITTING).kinds).toEqual([]);
    expect(show(10, { ...FLYING, speed: 0.05 }).kinds).toEqual([]);
    expect(show(10).kinds.length).toBeGreaterThan(4);
  });

  it("come in a varied order that is the same every time, with air between them", () => {
    const a = show(14);
    const b = show(14);
    expect(a.kinds).toEqual(b.kinds);
    expect(new Set(a.kinds.slice(0, 5)).size).toBeGreaterThanOrEqual(4);
    for (let i = 1; i < a.kinds.length; i += 1) expect(a.kinds[i]).not.toBe(a.kinds[i - 1]);
    for (const gap of a.gaps) expect(gap).toBeGreaterThanOrEqual(0.5 - DT);
  });

  it("always finish, whatever the scroll does", () => {
    const tr = createTricks();
    while (!tr.active) stepTricks(tr, DT, FLYING);
    const kind = tr.active.kind;
    // The scroll stops dead: the trick plays on to its end, and no other one starts.
    let seconds = 0;
    while (tr.active) {
      expect(tr.active.kind).toBe(kind);
      stepTricks(tr, DT, SITTING);
      seconds += DT;
    }
    expect(seconds).toBeGreaterThan(TRICK_SECONDS[kind] - 3 * DT);
    for (let i = 0; i < 120; i += 1) stepTricks(tr, DT, SITTING);
    expect(tr.active).toBeNull();
  });

  it("take their direction from the direction of travel", () => {
    const first = (flight: typeof FLYING): Tricks => {
      const tr = createTricks();
      while (!tr.active) stepTricks(tr, DT, flight);
      return tr;
    };
    expect(first({ ...FLYING, vx: 0.6 }).active?.dir).toBe(1);
    expect(first({ ...FLYING, vx: -0.6 }).active?.dir).toBe(-1);
    // The flip of the show goes forward on the way down and backward on the way up.
    const flips = (vy: number) =>
      show(14, { ...FLYING, vy }).kinds.filter((k) => k.includes("flip"));
    expect(new Set(flips(0.6))).toEqual(new Set(["frontflip"]));
    expect(new Set(flips(-0.6))).toEqual(new Set(["backflip"]));
  });

  it("begin and end with the drone as it was: nothing jumps when a trick is over", () => {
    for (const kind of Object.keys(TRICK_SECONDS) as TrickKind[]) {
      for (const dir of [1, -1]) {
        const tr = createTricks();
        expect(startTrick(tr, kind, dir)).toBe(true);
        const start = trickPose(tr);
        expect(offTurn(start.yaw) + offTurn(start.pitch) + offTurn(start.roll), kind).toBeLessThan(
          1e-6,
        );
        if (tr.active) tr.active.t = TRICK_SECONDS[kind];
        const end = trickPose(tr);
        expect(offTurn(end.yaw), kind).toBeLessThan(1e-6);
        expect(offTurn(end.pitch), kind).toBeLessThan(1e-6);
        expect(offTurn(end.roll), kind).toBeLessThan(1e-6);
        expect(Math.abs(end.dx), kind).toBeLessThan(1e-6);
        expect(Math.abs(end.dy), kind).toBeLessThan(1e-6);
        // In between it really moves, by a smooth step each frame.
        let prev = start;
        let moved = 0;
        for (let t = 0; t <= TRICK_SECONDS[kind]; t += DT) {
          if (tr.active) tr.active.t = t;
          const p = trickPose(tr);
          const step =
            Math.abs(p.yaw - prev.yaw) +
            Math.abs(p.pitch - prev.pitch) +
            Math.abs(p.roll - prev.roll);
          expect(step, `${kind} at ${t.toFixed(2)}`).toBeLessThan(0.5);
          moved += step + Math.abs(p.dy - prev.dy);
          prev = p;
        }
        expect(moved, kind).toBeGreaterThan(0.3);
      }
    }
  });

  it("refuses a second move while one plays", () => {
    const tr = createTricks();
    expect(startTrick(tr, "hop")).toBe(true);
    expect(startTrick(tr, "nod")).toBe(false);
    expect(tr.active?.kind).toBe("hop");
    expect(trickPose(tr).face).toBe("happy");
    expect(trickPose(createTricks()).face).toBeNull();
  });
});

describe("the turn in the statement", () => {
  const RATE = (1.75 * TAU) / 1200;

  it("follows the scroll, and finishes forward to face the visitor when the scroll stops", () => {
    const sp = createSpin();
    let value = 0;
    let prev = 0;
    // 500 px of scroll in half a second, then a stop.
    for (let i = 0; i < 30; i += 1) {
      value = stepSpin(sp, 500 / 30, true, RATE, DT);
      expect(value).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = value;
    }
    expect(value).toBeGreaterThan(1);
    for (let i = 0; i < 55; i += 1) {
      value = stepSpin(sp, 0, true, RATE, DT);
      // Never back: the turn is finished the way it was going.
      expect(value).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = value;
    }
    // 500 px is 0.73 of a turn: it comes to rest on the whole turn after it.
    expect(sp.goal).toBeCloseTo(TAU, 9);
    expect(value).toBeGreaterThan(0.95 * TAU);
    // Once it stands there the turn is counted as none, so the angle never grows without end.
    for (let i = 0; i < 240; i += 1) value = stepSpin(sp, 0, true, RATE, DT);
    expect(value).toBe(0);
  });

  it("picks up from there when the scroll moves again", () => {
    const sp = createSpin();
    for (let i = 0; i < 30; i += 1) stepSpin(sp, 10, true, RATE, DT);
    for (let i = 0; i < 40; i += 1) stepSpin(sp, 0, true, RATE, DT);
    const rested = sp.goal;
    expect(offTurn(rested)).toBeLessThan(1e-9);
    stepSpin(sp, 10, true, RATE, DT);
    expect(sp.goal).toBeCloseTo(rested + 10 * RATE, 9);
  });

  it("does not pay a whole turn for a last pixel of scroll", () => {
    const sp = createSpin();
    for (let i = 0; i < 30; i += 1) stepSpin(sp, 10, true, RATE, DT);
    for (let i = 0; i < 40; i += 1) stepSpin(sp, 0, true, RATE, DT);
    const rested = sp.goal;
    stepSpin(sp, 2, true, RATE, DT);
    for (let i = 0; i < 40; i += 1) stepSpin(sp, 0, true, RATE, DT);
    expect(sp.goal).toBeCloseTo(rested, 9);
  });

  it("turns the other way on a scroll up, and still ends on a whole turn", () => {
    const sp = createSpin();
    let value = 0;
    for (let i = 0; i < 30; i += 1) value = stepSpin(sp, -12, true, RATE, DT);
    expect(value).toBeLessThan(-0.5);
    for (let i = 0; i < 240; i += 1) value = stepSpin(sp, 0, true, RATE, DT);
    expect(offTurn(value)).toBeLessThan(0.01);
  });

  it("is not turned by a scroll outside the statement", () => {
    const sp = createSpin();
    for (let i = 0; i < 60; i += 1) expect(stepSpin(sp, 20, false, RATE, DT)).toBe(0);
  });
});
