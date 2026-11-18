import { Quaternion, Vector3 } from "three";
import { describe, expect, it } from "vitest";

import {
  CAMERA_DISTANCE,
  depthScale,
  fitScale,
  hiddenY,
  lift,
  projectToStage,
  reachProgress,
  viewRotation,
} from "./place";

const FINGERS = new Vector3(0, 0, -1);
const NORMAL = new Vector3(0, 1, 0);
const THUMB = new Vector3(-1, 0, 0);

function turned(q: Quaternion, v: Vector3): Vector3 {
  return v.clone().applyQuaternion(q);
}

describe("depth", () => {
  it("magnifies what is nearer and shrinks what is farther, with a limit near the camera", () => {
    expect(depthScale(0)).toBe(1);
    expect(depthScale(500)).toBeCloseTo(2, 9);
    expect(depthScale(-1000)).toBeCloseTo(0.5, 9);
    expect(depthScale(5000)).toBeCloseTo(10, 9);
    expect(CAMERA_DISTANCE).toBe(1000);
  });

  it("projects a point into the stage's pixels", () => {
    const out = { x: 0, y: 0, s: 0 };
    projectToStage(out, 100, -50, 500);
    expect(out).toEqual({ x: 200, y: -100, s: 2 });
  });
});

describe("viewRotation", () => {
  it("shows the hand the way the elbow does: fingers away from the camera, palm up and toward it, thumb on the left", () => {
    const q = new Quaternion();
    for (const y of [0, -250, -450]) {
      viewRotation(q, 0, y);
      const fingers = turned(q, FINGERS);
      const normal = turned(q, NORMAL);
      const thumb = turned(q, THUMB);
      expect(fingers.z).toBeLessThan(-0.8);
      expect(fingers.y).toBeGreaterThan(0);
      expect(normal.y).toBeGreaterThan(0.8);
      expect(normal.z).toBeGreaterThan(0);
      expect(thumb.x).toBeLessThan(-0.99);
    }
  });

  it("keeps the angle between the line of sight and the hand wherever the wrist is on the screen", () => {
    const q = new Quaternion();
    const reference = (() => {
      viewRotation(q, 0, 0);
      return Math.acos(Math.min(1, turned(q, FINGERS).dot(new Vector3(0, 0, -1))));
    })();
    // The elbow looks at the wrist from above: the line of sight is 31.6 degrees off the fingers
    // at the screen's centre; the angle between the sight line and the fingers must not change.
    for (const [x, y] of [
      [0, -450],
      [300, -300],
      [-400, -200],
      [100, 350],
    ] as const) {
      viewRotation(q, x, y);
      const sight = new Vector3(x, y, -CAMERA_DISTANCE).normalize();
      const angle = Math.acos(turned(q, FINGERS).dot(sight));
      const centred = Math.acos(
        turned(viewRotation(new Quaternion(), 0, 0), FINGERS).dot(new Vector3(0, 0, -1)),
      );
      expect(angle).toBeCloseTo(centred, 6);
      expect(angle).toBeCloseTo(reference, 6);
    }
  });

  it("is the elbow view at the centre of the screen: about 12 degrees of tilt about X", () => {
    const q = viewRotation(new Quaternion(), 0, 0);
    // The elbow camera looks 12.4 degrees down, and the wrist sits 19 degrees below its axis.
    const tilt = 2 * Math.asin(Math.abs(q.x));
    expect((tilt * 180) / Math.PI).toBeGreaterThan(30);
    expect((tilt * 180) / Math.PI).toBeLessThan(33);
    expect(Math.abs(q.y)).toBeLessThan(1e-9);
  });

  it("roll turns the hand about the screen's axis, yaw and pitch are small taste turns", () => {
    const q = new Quaternion();
    viewRotation(q, 0, -450, Math.PI / 2);
    const thumb = turned(q, THUMB);
    expect(thumb.y).toBeLessThan(-0.9);
    const base = viewRotation(new Quaternion(), 0, -450);
    const yawed = viewRotation(new Quaternion(), 0, -450, 0, 0.2);
    expect(base.angleTo(yawed)).toBeCloseTo(0.2, 5);
    const pitched = viewRotation(new Quaternion(), 0, -450, 0, 0, 0.1);
    expect(base.angleTo(pitched)).toBeCloseTo(0.1, 5);
  });
});

describe("fitScale", () => {
  // The claw tips of a hand about 14 cm long, fingers along -Z and a little up.
  const tips = [
    -0.13, 0.1, -0.05, -0.03, 0.12, -0.16, 0.02, 0.14, -0.15, 0.06, 0.14, -0.11, 0.07, 0.13, -0.05,
  ];

  function measured(k: number, q: Quaternion, y: number, z: number): number {
    const wy = y / depthScale(z);
    let top = -Infinity;
    for (let i = 0; i < tips.length; i += 3) {
      const p = new Vector3(tips[i], tips[i + 1], tips[i + 2]).applyQuaternion(q).multiplyScalar(k);
      top = Math.max(top, (wy + p.y) * depthScale(z + p.z));
    }
    return top - y;
  }

  it("makes the hand the height that was asked, at several places and depths", () => {
    const q = new Quaternion();
    for (const [x, y, z, height] of [
      [0, -440, 0, 500],
      [0, -300, 0, 320],
      [200, -380, 100, 450],
      [-300, -200, -200, 600],
    ] as const) {
      viewRotation(q, x, y);
      const k = fitScale(height, tips, q, y, z);
      expect(measured(k, q, y, z)).toBeCloseTo(height, 1);
    }
  });

  it("a taller hand is a bigger scale", () => {
    const q = viewRotation(new Quaternion(), 0, -440);
    expect(fitScale(600, tips, q, -440, 0)).toBeGreaterThan(fitScale(400, tips, q, -440, 0));
  });

  it("does not blow up on nothing to measure", () => {
    const q = new Quaternion();
    expect(Number.isFinite(fitScale(500, [], q, -440, 0))).toBe(true);
    expect(fitScale(500, [], q, -440, 0)).toBeGreaterThanOrEqual(1);
  });
});

describe("rise and sink", () => {
  it("hides the hand fully below the bottom edge", () => {
    expect(hiddenY(900, 500)).toBeLessThan(-450 - 500);
    expect(hiddenY(900, 500)).toBeLessThan(hiddenY(900, 300));
  });

  it("lift runs from hidden to rest and back with the sink", () => {
    expect(lift(0, 0)).toBe(0);
    expect(lift(1, 0)).toBe(1);
    expect(lift(1, 1)).toBe(0);
    let last = -1;
    for (let r = 0; r <= 1.0001; r += 0.05) {
      const v = lift(r, 0);
      expect(v).toBeGreaterThanOrEqual(last);
      last = v;
    }
    last = 2;
    for (let s = 0; s <= 1.0001; s += 0.05) {
      const v = lift(1, s);
      expect(v).toBeLessThanOrEqual(last);
      last = v;
    }
    // The hand arrives quickly, and leaves slowly at first.
    expect(lift(0.25, 0)).toBeGreaterThan(0.5);
    expect(lift(1, 0.25)).toBeGreaterThan(0.9);
  });

  it("the fingers open in the middle of the rise and relax a little as the hand sinks", () => {
    expect(reachProgress(0, 0)).toBe(0);
    expect(reachProgress(0.05, 0)).toBe(0);
    expect(reachProgress(1, 0)).toBe(1);
    expect(reachProgress(1, 1)).toBeCloseTo(0.7, 9);
    expect(reachProgress(0.5, 0)).toBeGreaterThan(0.3);
    expect(reachProgress(0.5, 0)).toBeLessThan(0.7);
  });
});
