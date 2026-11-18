import { describe, expect, it } from "vitest";

import { FACES } from "./face";
import { isJump, JUMP, newDroneState, stepDrone, type Held } from "./follow";
import { newGoal, type DroneGoal } from "./pose";

const none: Held = { name: null, blend: 0 };

function goalAt(x: number, y: number): DroneGoal {
  const g = newGoal();
  g.x = x;
  g.y = y;
  g.radius = 60;
  g.look = null;
  return g;
}

/** Run a drone toward a goal for `seconds` at `hz`. */
function run(hz: number, seconds: number, goal: DroneGoal, who: 0 | 1 = 0) {
  const s = newDroneState(who);
  const dt = 1 / hz;
  let time = 0;
  for (let i = 0; i < Math.round(seconds * hz); i += 1) {
    time += dt;
    stepDrone(s, goal, dt, false, time, none);
  }
  return s;
}

describe("the ball", () => {
  it("a snap puts everything at the goal at once and leaves no speed", () => {
    const s = newDroneState(0);
    const g = goalAt(400, -250);
    g.radius = 90;
    g.roll = 0.3;
    stepDrone(s, g, 1 / 60, true, 0, none);
    expect(s.pose.x).toBe(400);
    expect(s.pose.y).toBe(-250);
    expect(s.pose.radius).toBe(90);
    expect(s.x.v).toBe(0);
    expect(s.y.v).toBe(0);
  });

  it("settles on the goal and does not run past it", () => {
    const g = goalAt(300, 0);
    const s = newDroneState(0);
    let farthest = 0;
    for (let i = 0; i < 360; i += 1) {
      stepDrone(s, g, 1 / 60, false, i / 60, none);
      farthest = Math.max(farthest, s.pose.x);
    }
    expect(s.pose.x).toBeCloseTo(300, 0);
    // A critically damped spring never overshoots.
    expect(farthest).toBeLessThanOrEqual(300.01);
  });

  it("ends in the same place at 60 and at 144 frames a second", () => {
    const g = goalAt(300, 120);
    const a = run(60, 0.6, g);
    const b = run(144, 0.6, g);
    expect(Math.abs(a.pose.x - b.pose.x)).toBeLessThan(3);
    expect(Math.abs(a.pose.y - b.pose.y)).toBeLessThan(3);
  });

  it("leans into a flight and straightens at rest", () => {
    const g = goalAt(600, 0);
    g.lean = true;
    const s = newDroneState(0);
    let lean = 0;
    for (let i = 0; i < 20; i += 1) {
      stepDrone(s, g, 1 / 60, false, i / 60, none);
      lean = Math.max(lean, Math.abs(s.pose.roll));
    }
    expect(lean).toBeGreaterThan(0.05);
    for (let i = 0; i < 400; i += 1) stepDrone(s, g, 1 / 60, false, i / 60, none);
    expect(Math.abs(s.pose.roll)).toBeLessThan(0.01);
  });

  it("a look turns the eyes toward the point and the ball a little", () => {
    const g = goalAt(0, 0);
    g.look = { x: 500, y: 0 };
    g.turn = 0.5;
    const s = run(60, 1, g);
    expect(s.pose.yaw).toBeGreaterThan(0.1);
    expect(s.pose.live.lookX).toBeGreaterThan(0.02);
  });

  it("the squash stays inside the range the scene takes", () => {
    const g = goalAt(900, 900);
    g.squash = 3;
    const s = newDroneState(0);
    for (let i = 0; i < 120; i += 1) {
      stepDrone(s, g, 1 / 60, false, i / 60, none);
      expect(s.pose.squash).toBeGreaterThanOrEqual(0.55);
      expect(s.pose.squash).toBeLessThanOrEqual(1.5);
    }
  });
});

describe("the gloves", () => {
  it("a glove pinned to a point of the screen lands on it, whatever the ball does", () => {
    const g = goalAt(0, 0);
    g.gl.free = true;
    g.gl.fx = 200;
    g.gl.fy = 80;
    g.gl.hard = true;
    const s = newDroneState(0);
    stepDrone(s, g, 1 / 60, false, 0, none);
    // From the ball's middle, in radii of the ball: the point is 200 px right, 80 up, ball 60 px.
    expect(s.pose.gloveL.free).toBe(true);
    expect(s.pose.gloveL.x * s.pose.radius).toBeCloseTo(200 - s.pose.x, 6);
    expect(s.pose.gloveL.y * s.pose.radius).toBeCloseTo(80 - s.pose.y, 6);
  });

  it("a loose glove trails behind a stop and comes back", () => {
    const g = goalAt(0, 0);
    const s = newDroneState(0);
    for (let i = 0; i < 120; i += 1) stepDrone(s, g, 1 / 60, false, i / 60, none);
    const rest = s.pose.gloveL.x;
    g.x = 500;
    for (let i = 0; i < 10; i += 1) stepDrone(s, g, 1 / 60, false, i / 60, none);
    expect(s.pose.gloveL.x).not.toBeCloseTo(rest, 2);
    g.x = 500;
    for (let i = 0; i < 600; i += 1) stepDrone(s, g, 1 / 60, false, i / 60, none);
    expect(s.pose.gloveL.x).toBeCloseTo(rest, 1);
  });
});

describe("the face", () => {
  it("a like face blends over a fraction of a second with no blink of the lid", () => {
    const g = goalAt(0, 0);
    g.face = "bold";
    const s = newDroneState(0);
    s.blinkAt = 99;
    stepDrone(s, g, 1 / 60, true, 0, none);
    g.face = "angry";
    let lid = 0;
    for (let i = 0; i < 30; i += 1) {
      stepDrone(s, g, 1 / 60, false, i / 60, none);
      lid = Math.max(lid, s.pose.live.blinkL);
    }
    expect(lid).toBe(0);
    expect(s.pose.face).toEqual(FACES.angry);
  });

  it("an unlike face is changed behind a blink", () => {
    const g = goalAt(0, 0);
    g.face = "soft";
    const s = newDroneState(0);
    s.blinkAt = 99;
    stepDrone(s, g, 1 / 60, true, 0, none);
    g.face = "surprise";
    let lid = 0;
    for (let i = 0; i < 30; i += 1) {
      stepDrone(s, g, 1 / 60, false, i / 60, none);
      lid = Math.max(lid, s.pose.live.blinkL);
    }
    expect(lid).toBeGreaterThan(0.9);
    expect(s.pose.face).toEqual(FACES.surprise);
  });

  it("blinks on its own, never with symbol eyes", () => {
    const open = goalAt(0, 0);
    open.face = "soft";
    const s = newDroneState(0);
    let most = 0;
    for (let i = 0; i < 60 * 12; i += 1) {
      stepDrone(s, open, 1 / 60, false, i / 60, none);
      most = Math.max(most, s.pose.live.blinkL);
    }
    expect(most).toBeGreaterThan(0.9);

    const happy = goalAt(0, 0);
    happy.face = "happy";
    const h = newDroneState(0);
    stepDrone(h, happy, 1 / 60, true, 0, none);
    most = 0;
    for (let i = 0; i < 60 * 12; i += 1) {
      stepDrone(h, happy, 1 / 60, false, i / 60, none);
      most = Math.max(most, h.pose.live.blinkL);
    }
    expect(most).toBe(0);
  });

  it("a held face goes over the wanted one by its blend", () => {
    const g = goalAt(0, 0);
    g.face = "soft";
    const s = newDroneState(0);
    s.blinkAt = 99;
    stepDrone(s, g, 1 / 60, true, 0, { name: "dizzy", blend: 1 });
    expect(s.pose.face.spiral).toBeCloseTo(1, 6);
    stepDrone(s, g, 1 / 60, true, 0, { name: "dizzy", blend: 0.5 });
    expect(s.pose.face.spiral).toBeCloseTo(0.5, 6);
  });

  it("a wink shuts one eye only", () => {
    const g = goalAt(0, 0);
    g.winkR = 1;
    const s = newDroneState(0);
    s.blinkAt = 99;
    stepDrone(s, g, 1 / 60, true, 0, none);
    expect(s.pose.live.blinkR).toBe(1);
    expect(s.pose.live.blinkL).toBe(0);
  });
});

describe("the pose is always finite", () => {
  it("after a long run through wild goals", () => {
    const s = newDroneState(1);
    const g = goalAt(0, 0);
    for (let i = 0; i < 2000; i += 1) {
      g.x = Math.sin(i * 0.37) * 900;
      g.y = Math.cos(i * 0.21) * 500;
      g.roll = Math.sin(i * 0.1) * 3;
      g.look = i % 3 === 0 ? { x: Math.sin(i) * 800, y: 0 } : null;
      stepDrone(s, g, 1 / 60, i % 500 === 0, i / 60, none);
      for (const v of [s.pose.x, s.pose.y, s.pose.z, s.pose.yaw, s.pose.pitch, s.pose.roll]) {
        expect(Number.isFinite(v)).toBe(true);
      }
    }
  });
});

describe("a jump", () => {
  it("is a step of more than 40 percent of the screen in one frame", () => {
    expect(JUMP).toBe(0.4);
    expect(isJump(10, 5, 1440, 900)).toBe(false);
    expect(isJump(500, 0, 1440, 900)).toBe(false);
    expect(isJump(600, 0, 1440, 900)).toBe(true);
    expect(isJump(0, 600, 1440, 900)).toBe(true);
    // The same step on a phone is a jump already.
    expect(isJump(200, 0, 390, 844)).toBe(false);
    expect(isJump(0, 400, 390, 844)).toBe(true);
  });
});
