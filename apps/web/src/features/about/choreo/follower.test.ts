import { describe, expect, it } from "vitest";

import {
  createFollower,
  flightOf,
  floatOf,
  lookAt,
  stepFollower,
  syncFollower,
  type Follower,
} from "./follower";

const VH = 900;
const REST = { yaw: 0.4, pitch: 0 };

function fly(f: Follower, to: { x: number; y: number; size: number }, seconds: number, hz = 60) {
  for (let i = 0; i < Math.round(seconds * hz); i += 1) stepFollower(f, to, REST, VH, 1 / hz);
}

describe("the follower", () => {
  it("reaches its target and never runs past it", () => {
    const f = createFollower(100, 100, 100);
    let furthest = 100;
    for (let i = 0; i < 240; i += 1) {
      stepFollower(f, { x: 900, y: 100, size: 300 }, REST, VH, 1 / 60);
      expect(f.x.x).toBeGreaterThanOrEqual(furthest - 1e-9);
      furthest = f.x.x;
    }
    expect(f.x.x).toBeLessThanOrEqual(900 + 1e-6);
    expect(f.x.x).toBeCloseTo(900, 0);
    expect(f.size.x).toBeCloseTo(300, 0);
  });

  it("flies the same line at any frame rate", () => {
    const a = createFollower(0, 0, 100);
    const b = createFollower(0, 0, 100);
    fly(a, { x: 600, y: 400, size: 200 }, 0.5, 60);
    fly(b, { x: 600, y: 400, size: 200 }, 0.5, 144);
    expect(a.x.x).toBeCloseTo(b.x.x, 4);
    expect(a.y.x).toBeCloseTo(b.y.x, 4);
    expect(a.yaw.x).toBeCloseTo(b.yaw.x, 1);
  });

  it("points its nose where it goes: up when it flies up, down when it flies down", () => {
    const down = createFollower(700, 100, 100);
    fly(down, { x: 700, y: 800, size: 100 }, 0.25);
    expect(down.pitch.x).toBeGreaterThan(0.15);

    // The way back is a flight up, nose first, not the way down played backwards.
    const up = createFollower(700, 800, 100);
    fly(up, { x: 700, y: 100, size: 100 }, 0.25);
    expect(up.pitch.x).toBeLessThan(-0.15);
  });

  it("turns and banks toward the side it flies to", () => {
    const right = createFollower(100, 400, 100, 0);
    fly(right, { x: 1300, y: 400, size: 100 }, 0.25);
    const left = createFollower(1300, 400, 100, 0);
    fly(left, { x: 100, y: 400, size: 100 }, 0.25);
    expect(right.yaw.x).toBeGreaterThan(REST.yaw);
    expect(left.yaw.x).toBeLessThan(0);
    expect(Math.sign(right.roll.x)).toBe(-Math.sign(left.roll.x));
    expect(Math.abs(right.roll.x)).toBeGreaterThan(0.1);
  });

  it("comes upright, at the station's turn, when the target stops", () => {
    const f = createFollower(100, 800, 100);
    fly(f, { x: 1200, y: 200, size: 100 }, 0.3);
    expect(flightOf(f, VH).fast).toBeGreaterThan(0.5);
    fly(f, { x: 1200, y: 200, size: 100 }, 3);
    expect(flightOf(f, VH).speed).toBeLessThan(0.01);
    expect(f.yaw.x).toBeCloseTo(REST.yaw, 2);
    expect(f.pitch.x).toBeCloseTo(0, 2);
    expect(f.roll.x).toBeCloseTo(0, 2);
  });

  it("takes over from the opening with the speed the drone had", () => {
    const f = createFollower(0, 0, 100);
    syncFollower(f, { x: 100, y: 100, size: 200, yaw: 0, pitch: 0, roll: 0 }, 0);
    syncFollower(
      f,
      { x: 110, y: 95, size: 204, yaw: 7, pitch: 2 * Math.PI, roll: -2 * Math.PI },
      1 / 60,
    );
    expect(f.x.v).toBeCloseTo(600, 3);
    expect(f.y.v).toBeCloseTo(-300, 3);
    // A turn that is part way round is taken up by the shorter way.
    expect(f.yaw.x).toBeCloseTo(7 - 2 * Math.PI, 6);
    expect(f.pitch.x).toBeCloseTo(0, 6);
    expect(f.roll.x).toBeCloseTo(0, 6);
  });

  it("floats only when it is calm", () => {
    for (const v of Object.values(floatOf(3.1, 0, 400))) expect(Math.abs(v)).toBe(0);
    const a = floatOf(1, 1, 400);
    const b = floatOf(2, 1, 400);
    expect(a.dy).not.toBeCloseTo(b.dy, 3);
    expect(Math.abs(a.dy)).toBeLessThan(0.03 * 400);
  });

  it("looks at a point: the body and the eyes go the same way, within limits", () => {
    const pose = { x: 200, y: 600, size: 600 };
    expect(lookAt(pose, null, VH)).toEqual({ yaw: 0, pitch: 0, eyeX: 0, eyeY: 0 });
    const right = lookAt(pose, { x: 1300, y: 600 }, VH);
    const upLeft = lookAt(pose, { x: 0, y: 100 }, VH);
    expect(right.yaw).toBeGreaterThan(0.5);
    expect(right.eyeX).toBeGreaterThan(0.5);
    expect(Math.abs(right.pitch)).toBeLessThan(1e-9);
    expect(upLeft.yaw).toBeLessThan(0);
    expect(upLeft.pitch).toBeLessThan(0);
    expect(upLeft.eyeY).toBeLessThan(0);
    const far = lookAt(pose, { x: 1e6, y: 1e6 }, VH);
    expect(far.yaw).toBeLessThanOrEqual(0.72);
    expect(far.pitch).toBeLessThanOrEqual(0.5);
    expect(far.eyeX).toBe(1);
    expect(far.eyeY).toBe(1);
  });
});
