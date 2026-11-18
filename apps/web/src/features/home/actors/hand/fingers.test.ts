import { describe, expect, it } from "vitest";

import {
  FINGERS,
  FINGER_COUNT,
  FIST,
  FingerBank,
  MAX_JOINT,
  REACH_GAIN,
  SPREAD_GAP,
  fingerBones,
  flexAxis,
  idleAngle,
  jointAngle,
  makeReach,
  reachFor,
  resolveSpread,
  rippleEnvelope,
  spreadAxis,
  totalCurl,
  waveCurl,
  type ReachInput,
} from "./fingers";

describe("the bones of a finger", () => {
  it("are named the way the model names them", () => {
    expect(fingerBones("thumb")).toEqual([
      "Bip001_L_Finger0",
      "Bip001_L_Finger01",
      "Bip001_L_Finger02",
    ]);
    expect(fingerBones("index")).toEqual([
      "Bip001_L_Finger1",
      "Bip001_L_Finger11",
      "Bip001_L_Finger12",
    ]);
    expect(fingerBones("pinky")[2]).toBe("Bip001_L_Finger42");
  });

  it("have the axes of the notes: the thumb about Y, the rest about Z, the fan about Y (X for the thumb)", () => {
    expect(flexAxis("thumb")).toEqual([0, 1, 0]);
    for (const f of FINGERS.slice(1)) {
      expect(flexAxis(f)).toEqual([0, 0, 1]);
      expect(spreadAxis(f)).toEqual([0, 1, 0]);
    }
    expect(spreadAxis("thumb")).toEqual([1, 0, 0]);
  });
});

describe("jointAngle", () => {
  it("follows the notes at a curl of 1: [0.18, 0.28, 0.20] a joint, scaled by the finger", () => {
    expect(jointAngle("middle", 0, 1)).toBeCloseTo(0.18, 6);
    expect(jointAngle("middle", 1, 1)).toBeCloseTo(0.28, 6);
    expect(jointAngle("middle", 2, 1)).toBeCloseTo(0.2, 6);
    expect(jointAngle("index", 1, 1)).toBeCloseTo(0.28 * 0.8, 6);
    expect(jointAngle("pinky", 1, 1)).toBeCloseTo(0.28 * 1.25, 6);
    // The thumb is about 0.35 radians over the chain.
    expect(totalCurl("thumb", 1)).toBeCloseTo(0.66 * 0.55, 6);
  });

  it("is zero when open, negative (a reach) below zero, and never below the reach limit", () => {
    expect(jointAngle("ring", 0, 0)).toBe(0);
    expect(jointAngle("ring", 0, -0.1)).toBeLessThan(0);
    expect(jointAngle("ring", 0, -50)).toBeCloseTo(-0.35 * 0.18 * 1.1, 6);
  });

  it("grows with the curl, is continuous at 1 and stops at the grip", () => {
    for (const f of FINGERS) {
      for (const j of [0, 1, 2] as const) {
        let last = -Infinity;
        for (let c = -0.2; c <= FIST; c += 0.1) {
          const a = jointAngle(f, j, c);
          expect(a).toBeGreaterThanOrEqual(last - 1e-9);
          last = a;
        }
        expect(jointAngle(f, j, 1 + 1e-9)).toBeCloseTo(jointAngle(f, j, 1), 6);
        expect(jointAngle(f, j, FIST + 5)).toBeCloseTo(jointAngle(f, j, FIST), 9);
        expect(jointAngle(f, j, FIST)).toBeLessThanOrEqual(MAX_JOINT);
      }
    }
  });

  it("the grip is a cupped claw, not a fist: no finger turns more than about 175 degrees", () => {
    for (const f of FINGERS) expect(totalCurl(f, FIST)).toBeLessThan((175 * Math.PI) / 180);
  });
});

// A hand about 260 px long: the palm at (0, -150), the tips along y = 100, the thumb out to the left.
function input(px: number, py: number, live = true): ReachInput {
  const tips = [-300, -20, -90, 100, 0, 110, 90, 100, 170, 60];
  const knuckles = [-120, -120, -70, -50, 0, -40, 60, -50, 110, -70];
  return { px, py, live, tips, knuckles, palmX: 0, palmY: -150, length: 260 };
}

describe("reachFor", () => {
  it("asks nothing when the pointer is far away or not live", () => {
    const out = makeReach();
    reachFor(input(2000, 2000), out);
    expect(out.gate).toBe(0);
    reachFor(input(-1000, 300), out);
    expect(out.gate).toBe(0);
    expect(Array.from(out.curl).every((c) => c === 0)).toBe(true);
    expect(Array.from(out.spread).every((c) => c === 0)).toBe(true);
    reachFor(input(0, -150, false), out);
    expect(out.gate).toBe(0);
    expect(Array.from(out.curl).every((c) => c === 0)).toBe(true);
  });

  it("the closer the pointer to a finger, the more that finger curls", () => {
    const palmSide = makeReach();
    const lower = makeReach();
    const onFinger = makeReach();
    reachFor(input(0, -100), palmSide);
    reachFor(input(0, -250), lower);
    reachFor(input(0, 60), onFinger);
    expect(palmSide.nearest).toBe(2);
    expect(palmSide.curl[2]!).toBeGreaterThan(lower.curl[2]!);
    expect(lower.curl[2]!).toBeGreaterThan(0);
    expect(onFinger.curl[2]!).toBeGreaterThan(1);
  });

  it("a pointer on the palm bends all four fingers, not only the nearest", () => {
    const out = makeReach();
    reachFor(input(0, -150), out);
    for (let f = 1; f < FINGER_COUNT; f += 1) expect(out.curl[f]!).toBeGreaterThan(0.3);
  });

  it("a pointer anywhere on the hand asks for a visible bend (at least 0.3 on some finger)", () => {
    const out = makeReach();
    for (const [x, y] of [
      [-90, 100],
      [0, 20],
      [0, -150],
      [0, -250],
      [-200, -60],
    ] as const) {
      reachFor(input(x, y), out);
      expect(Math.max(...Array.from(out.curl))).toBeGreaterThan(0.3);
    }
  });

  it("a pointer beyond a tip makes that finger reach back a little", () => {
    const out = makeReach();
    reachFor(input(0, 230), out);
    expect(out.curl[2]!).toBeLessThan(0);
    expect(out.curl[2]!).toBeGreaterThan(-0.6);
    expect(out.gate).toBeGreaterThan(0.5);
  });

  it("the neighbours of the nearest finger curl less than it does", () => {
    const out = makeReach();
    reachFor(input(0, 60), out);
    expect(out.curl[2]!).toBeGreaterThan(Math.abs(out.curl[4]!));
  });

  it("the thumb closes toward the palm when the pointer is on the palm", () => {
    const out = makeReach();
    reachFor(input(0, -150), out);
    expect(out.curl[0]!).toBeGreaterThan(0.9);
  });

  it("no finger asks for more than the reach gain over a full curl", () => {
    const out = makeReach();
    for (let x = -300; x <= 300; x += 25) {
      for (let y = -300; y <= 300; y += 25) {
        reachFor(input(x, y), out);
        for (let f = 0; f < FINGER_COUNT; f += 1) {
          expect(out.curl[f]!).toBeLessThanOrEqual(REACH_GAIN + 1e-9);
        }
      }
    }
  });

  it("fans the fingers toward the pointer (positive spread is toward the thumb, the thumb is on the left)", () => {
    const right = makeReach();
    const left = makeReach();
    reachFor(input(160, 40), right);
    reachFor(input(-160, 40), left);
    for (let f = 1; f < FINGER_COUNT; f += 1) {
      expect(right.spread[f]!).toBeLessThan(0);
      expect(left.spread[f]!).toBeGreaterThan(0);
    }
    expect(right.roll).toBeGreaterThan(0);
    expect(left.roll).toBeLessThan(0);
  });

  it("leans the wrist up toward a pointer above the palm and down toward one below", () => {
    const up = makeReach();
    const down = makeReach();
    reachFor(input(0, 20), up);
    reachFor(input(0, -250), down);
    expect(up.nod).toBeGreaterThan(0);
    expect(down.nod).toBeLessThan(0);
  });
});

describe("resolveSpread", () => {
  it("never lets a neighbour close in by more than the gap", () => {
    const s = new Float32Array([0, -0.1, 0.2, -0.2, 0.15]);
    resolveSpread(s);
    for (let i = 1; i < 4; i += 1) {
      expect(s[i + 1]! - s[i]!).toBeLessThanOrEqual(SPREAD_GAP + 1e-4);
    }
  });

  it("leaves a fan that is already clear alone, and a fan that opens", () => {
    const clear = new Float32Array([0, 0.05, 0.04, 0.03, 0.02]);
    const copy = Float32Array.from(clear);
    resolveSpread(clear);
    expect(Array.from(clear)).toEqual(Array.from(copy));
    const opening = new Float32Array([0, 0.2, 0.1, 0, -0.1]);
    const same = Float32Array.from(opening);
    resolveSpread(opening);
    expect(Array.from(opening)).toEqual(Array.from(same));
  });
});

describe("ripples and idle", () => {
  it("the envelope starts at 1, ends at 0 and never goes below", () => {
    expect(rippleEnvelope(0, 1)).toBe(1);
    expect(rippleEnvelope(1, 1)).toBe(0);
    expect(rippleEnvelope(-1, 1)).toBe(0);
    expect(rippleEnvelope(0.5, 1)).toBeGreaterThan(0);
    expect(rippleEnvelope(0.5, 1)).toBeLessThan(1);
  });

  it("a wave is nothing without an envelope and stays within it", () => {
    expect(waveCurl(1, 2, 0.3, 0)).toBe(0);
    for (let t = 0; t < 2; t += 0.05) {
      const v = waveCurl(3, 1, t, 1);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(0.76);
    }
  });

  it("the idle move is small and different for every joint", () => {
    let peak = 0;
    for (let f = 0; f < 5; f += 1) {
      for (let j = 0; j < 3; j += 1) {
        for (let t = 0; t < 30; t += 0.5) peak = Math.max(peak, Math.abs(idleAngle(f, j, t)));
      }
    }
    expect(peak).toBeLessThanOrEqual(0.03);
    expect(peak).toBeGreaterThan(0.015);
    expect(idleAngle(0, 0, 1)).not.toBe(idleAngle(1, 0, 1));
  });
});

describe("FingerBank", () => {
  it("follows a target and settles", () => {
    const bank = new FingerBank();
    const want = [0, 1, 0.5, 0, 0];
    const spread = [0, 0.05, 0, 0, 0];
    for (let i = 0; i < 240; i += 1) bank.step(want, spread, 1, 1 / 60);
    expect(bank.curl[1]!).toBeCloseTo(1, 2);
    expect(bank.curl[2]!).toBeCloseTo(0.5, 2);
    expect(bank.spread[1]!).toBeCloseTo(0.05, 3);
  });

  it("the fingers far from the nearest one follow a little later (a sweep ripples)", () => {
    const bank = new FingerBank();
    const want = [1, 1, 1, 1, 1];
    for (let i = 0; i < 3; i += 1) bank.step(want, [0, 0, 0, 0, 0], 0, 1 / 60);
    expect(bank.curl[0]!).toBeGreaterThan(bank.curl[4]!);
  });

  it("a frame with no time changes nothing, and snap puts every finger at rest", () => {
    const bank = new FingerBank();
    for (let i = 0; i < 20; i += 1) {
      bank.step([1, 1, 1, 1, 1], [0.1, 0.1, 0.1, 0.1, 0.1], 2, 1 / 60);
    }
    const before = Array.from(bank.curl);
    bank.step([0, 0, 0, 0, 0], [0, 0, 0, 0, 0], 2, 0);
    expect(Array.from(bank.curl)).toEqual(before);
    bank.snap();
    expect(Array.from(bank.curl).every((c) => c === 0)).toBe(true);
    expect(Array.from(bank.spread).every((c) => c === 0)).toBe(true);
  });

  it("a grip let go swings a little past open and comes back", () => {
    const bank = new FingerBank();
    const open = [0, 0, 0, 0, 0];
    for (let i = 0; i < 120; i += 1) bank.step([FIST, FIST, FIST, FIST, FIST], open, 2, 1 / 60);
    let least = Infinity;
    for (let i = 0; i < 180; i += 1) {
      bank.step(open, open, 2, 1 / 60);
      least = Math.min(least, bank.curl[2]!);
    }
    expect(least).toBeLessThan(0);
    // The spring overshoots; the angle of the joint is limited separately.
    expect(least).toBeGreaterThan(-0.8);
    expect(bank.curl[2]!).toBeCloseTo(0, 2);
  });
});
