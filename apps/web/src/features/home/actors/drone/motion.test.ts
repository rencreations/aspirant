import { describe, expect, it } from "vitest";

import type { Target } from "./coords";
import { createFace, createFaceFrame, lid, setFaceNow, stepFace, SWAP } from "./face-state";
import {
  createFlight,
  createFollower,
  flightOf,
  floatOf,
  lookAt,
  snapFollower,
  stepFollower,
} from "./follow";
import { createRig, createRigInput, createRigPose, stepRig } from "./rig";

const target = (x: number, y: number, size = 200): Target => ({
  x,
  y,
  size,
  yaw: 0,
  pitch: 0,
  roll: 0,
});

/** Run the follower toward a target for `seconds` at `hz`; returns what it ended at. */
function fly(hz: number, seconds: number, to: Target) {
  const f = createFollower();
  snapFollower(f, target(0, 0));
  const flight = createFlight();
  const dt = 1 / hz;
  const peak = { yaw: 0, pitch: 0, roll: 0, speed: 0 };
  for (let i = 0; i < seconds * hz; i += 1) {
    stepFollower(f, to, { yaw: 0, pitch: 0 }, 900, dt, flight);
    peak.yaw = Math.max(peak.yaw, Math.abs(f.yaw.x));
    peak.pitch = Math.max(peak.pitch, Math.abs(f.pitch.x));
    peak.roll = Math.max(peak.roll, Math.abs(f.roll.x));
    peak.speed = Math.max(peak.speed, flight.speed);
  }
  return { f, peak };
}

describe("the follower", () => {
  it("reaches its target without passing it", () => {
    const f = createFollower();
    snapFollower(f, target(0, 0));
    const flight = createFlight();
    let over = 0;
    for (let i = 0; i < 600; i += 1) {
      stepFollower(f, target(400, 0), { yaw: 0, pitch: 0 }, 900, 1 / 60, flight);
      over = Math.max(over, f.x.x - 400);
    }
    expect(f.x.x).toBeCloseTo(400, 1);
    expect(over).toBeLessThan(0.5);
  });

  it("makes the same line at 60 and at 144 Hz", () => {
    const a = fly(60, 0.5, target(500, -300));
    const b = fly(144, 0.5, target(500, -300));
    expect(a.f.x.x).toBeCloseTo(b.f.x.x, 0);
    expect(a.f.y.x).toBeCloseTo(b.f.y.x, 0);
  });

  it("points its nose where it goes: a climb pitches it up, a dive down, and not the same way", () => {
    // y is down, so a climb is a negative y: the nose goes up, which is a negative pitch.
    const climb = createFollower();
    const dive = createFollower();
    snapFollower(climb, target(0, 0));
    snapFollower(dive, target(0, 0));
    const flight = createFlight();
    let climbPitch = 0;
    let divePitch = 0;
    for (let i = 0; i < 18; i += 1) {
      stepFollower(climb, target(0, -900), { yaw: 0, pitch: 0 }, 900, 1 / 60, flight);
      stepFollower(dive, target(0, 900), { yaw: 0, pitch: 0 }, 900, 1 / 60, flight);
      climbPitch = Math.min(climbPitch, climb.pitch.x);
      divePitch = Math.max(divePitch, dive.pitch.x);
    }
    expect(climbPitch).toBeLessThan(-0.1);
    expect(divePitch).toBeGreaterThan(0.1);
  });

  it("banks into a turn, to the right for a flight to the right", () => {
    const { f } = fly(60, 0.12, target(900, 0));
    expect(f.roll.x).toBeLessThan(-0.01);
  });

  it("comes upright and hovers when the target stops", () => {
    const f = createFollower();
    snapFollower(f, target(0, 0));
    const flight = createFlight();
    for (let i = 0; i < 40; i += 1) {
      stepFollower(f, target(900, -400), { yaw: 0.3, pitch: 0.03 }, 900, 1 / 60, flight);
    }
    for (let i = 0; i < 600; i += 1) {
      stepFollower(f, target(900, -400), { yaw: 0.3, pitch: 0.03 }, 900, 1 / 60, flight);
    }
    expect(f.yaw.x).toBeCloseTo(0.3, 2);
    expect(f.pitch.x).toBeCloseTo(0.03, 2);
    expect(Math.abs(f.roll.x)).toBeLessThan(0.01);
  });

  it("adds the roll a place asks for", () => {
    const f = createFollower();
    snapFollower(f, target(0, 0));
    const flight = createFlight();
    const t = { ...target(0, 0), roll: 0.3 };
    for (let i = 0; i < 300; i += 1) stepFollower(f, t, { yaw: 0, pitch: 0 }, 900, 1 / 60, flight);
    expect(f.roll.x).toBeCloseTo(0.3, 2);
  });

  it("snaps with no speed left, so a jump does not leave a spring flying", () => {
    const f = createFollower();
    snapFollower(f, target(0, 0));
    const flight = createFlight();
    for (let i = 0; i < 10; i += 1)
      stepFollower(f, target(800, 0), { yaw: 0, pitch: 0 }, 900, 1 / 60, flight);
    expect(flightOf(f, 900, flight).speed).toBeGreaterThan(0.1);
    snapFollower(f, target(-300, 200));
    expect(f.x.x).toBe(-300);
    expect(flightOf(f, 900, flight).speed).toBe(0);
    stepFollower(f, target(-300, 200), { yaw: 0, pitch: 0 }, 900, 1 / 60, flight);
    expect(f.x.x).toBeCloseTo(-300, 6);
  });

  it("does nothing when time stands still", () => {
    const f = createFollower();
    snapFollower(f, target(10, 20));
    stepFollower(f, target(500, 500), { yaw: 0, pitch: 0 }, 900, 0, createFlight());
    expect(f.x.x).toBe(10);
  });
});

describe("float and look", () => {
  it("floats less the more it flies", () => {
    const calm = { dx: 0, dy: 0, roll: 0, pitch: 0 };
    const busy = { dx: 0, dy: 0, roll: 0, pitch: 0 };
    floatOf(1.3, 1, 200, calm);
    floatOf(1.3, 0, 200, busy);
    expect(Math.abs(calm.dy)).toBeGreaterThan(0.1);
    expect(busy).toEqual({ dx: 0, dy: 0, roll: 0, pitch: 0 });
    expect(Math.abs(calm.dy)).toBeLessThanOrEqual(0.026 * 200);
  });

  it("turns toward a point on its right and looks down at a point below it", () => {
    const out = { yaw: 0, pitch: 0, eyeX: 0, eyeY: 0 };
    lookAt({ x: 0, y: 0, size: 200 }, 400, 0, 900, out);
    expect(out.yaw).toBeGreaterThan(0.2);
    expect(out.eyeX).toBeGreaterThan(0.2);
    lookAt({ x: 0, y: 0, size: 200 }, 0, 400, 900, out);
    expect(out.pitch).toBeGreaterThan(0.1);
    expect(out.eyeY).toBeGreaterThan(0.1);
    lookAt({ x: 0, y: 0, size: 200 }, -5000, -5000, 900, out);
    expect(Math.abs(out.yaw)).toBeLessThanOrEqual(0.72);
    expect(Math.abs(out.eyeX)).toBeLessThanOrEqual(1);
  });
});

describe("the rig", () => {
  it("beats faster the faster it flies and stays inside the angles the model can take", () => {
    const rig = createRig();
    const input = createRigInput();
    const pose = createRigPose();
    let lo = Infinity;
    let hi = -Infinity;
    input.fast = 1;
    for (let i = 0; i < 300; i += 1) {
      input.time = i / 60;
      stepRig(rig, input, 1 / 60, pose);
      lo = Math.min(lo, pose.wingRaiseL);
      hi = Math.max(hi, pose.wingRaiseL);
      expect(pose.wingSpreadL).toBeLessThanOrEqual((96 * Math.PI) / 180 + 1e-9);
      expect(pose.finStandL).toBeLessThanOrEqual((40 * Math.PI) / 180 + 1e-9);
      expect(pose.finStandL).toBeGreaterThanOrEqual((-30 * Math.PI) / 180 - 1e-9);
    }
    expect(hi - lo).toBeGreaterThan(0.5);
    expect(rig.drive).toBeGreaterThan(0.9);
  });

  it("holds its fins up for joy and lets them fall for sorrow", () => {
    const run = (happy: number, droop: number) => {
      const rig = createRig();
      const input = createRigInput();
      const pose = createRigPose();
      input.happy = happy;
      input.droop = droop;
      for (let i = 0; i < 120; i += 1) stepRig(rig, input, 1 / 60, pose);
      return pose.finStandL;
    };
    expect(run(1, 0)).toBeGreaterThan(run(0, 0));
    expect(run(0, 1)).toBeLessThan(run(0, 0));
  });

  it("flares the wings wide to brake", () => {
    const rig = createRig();
    const input = createRigInput();
    const pose = createRigPose();
    const rest = { ...stepRig(rig, input, 1 / 60, pose) }.wingSpreadL;
    input.flare = 1;
    for (let i = 0; i < 90; i += 1) stepRig(rig, input, 1 / 60, pose);
    expect(pose.wingSpreadL).toBeGreaterThan(rest + 0.3);
  });
});

describe("the face", () => {
  const run = (name: Parameters<typeof stepFace>[1], seconds: number, hz = 60) => {
    const face = createFace(3);
    const out = createFaceFrame();
    const shown: string[] = [];
    for (let i = 0; i < seconds * hz; i += 1) {
      stepFace(face, name, 0, 0, 1 / hz, out);
      shown.push(out.shown);
    }
    return { face, out, shown };
  };

  it("changes the drawing only behind a closed eye", () => {
    const face = createFace(3);
    const out = createFaceFrame();
    let blinkWhenChanged = -1;
    for (let i = 0; i < 60; i += 1) {
      stepFace(face, "shocked", 0, 0, 1 / 120, out);
      if (blinkWhenChanged < 0 && out.shown === "shocked") blinkWhenChanged = out.blink;
    }
    expect(blinkWhenChanged).toBeGreaterThan(0.5);
  });

  it("finishes the change in the time of one blink", () => {
    const { out } = run("sad", SWAP + 0.03);
    expect(out.shown).toBe("sad");
  });

  it("does not blink on a drawing with no eyes to shut", () => {
    const { shown, out } = run("exclaim", 0.3);
    expect(shown.at(-1)).toBe("exclaim");
    // After the change, 20 seconds with no blink at all.
    const face = createFace(5);
    setFaceNow(face, "question");
    let worst = 0;
    for (let i = 0; i < 20 * 60; i += 1) {
      stepFace(face, "question", 0, 0, 1 / 60, out);
      worst = Math.max(worst, out.blink);
    }
    expect(worst).toBe(0);
  });

  it("blinks by itself, unevenly, on a drawing with eyes", () => {
    const face = createFace(11);
    const out = createFaceFrame();
    const starts: number[] = [];
    let was = 0;
    for (let i = 0; i < 60 * 40; i += 1) {
      stepFace(face, "normal", 0, 0, 1 / 60, out);
      if (was < 0.05 && out.blink >= 0.05) starts.push(i / 60);
      was = out.blink;
    }
    expect(starts.length).toBeGreaterThan(5);
    const gaps = starts.slice(1).map((s, i) => s - (starts[i] ?? 0));
    expect(new Set(gaps.map((g) => g.toFixed(1))).size).toBeGreaterThan(3);
  });

  it("wears a drawing at once on demand", () => {
    const face = createFace();
    setFaceNow(face, "laugh");
    const out = createFaceFrame();
    stepFace(face, "laugh", 0, 0, 0, out);
    expect(out.shown).toBe("laugh");
    expect(out.blink).toBe(0);
  });

  it("slides the eyes toward a look and no further than they may go", () => {
    const face = createFace();
    const out = createFaceFrame();
    for (let i = 0; i < 120; i += 1) stepFace(face, "normal", 5, -5, 1 / 60, out);
    expect(out.lookX).toBeCloseTo(0.085, 3);
    expect(out.lookY).toBeCloseTo(-0.085 * 0.7, 3);
  });

  it("closes and opens the lid between 0 and 1", () => {
    expect(lid(0)).toBe(0);
    expect(lid(0.4)).toBeCloseTo(1, 6);
    expect(lid(1)).toBeCloseTo(0, 6);
  });
});
