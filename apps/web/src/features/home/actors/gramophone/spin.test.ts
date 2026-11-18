import {
  clientToStage,
  depthScale,
  project,
  scaleForSize,
  segmentDistance,
  unprojectToDepth,
} from "./frame";
import {
  GEAR,
  PLATTER_MAX_OMEGA,
  TAU,
  planeAngle,
  stepArm,
  stepCrank,
  stepCrankDriven,
  stepCrankHeld,
  stepPlatter,
  unwrapNear,
  wrapAngle,
  type ArmState,
  type CrankState,
  type PlatterState,
} from "./spin";

const DT = 1 / 60;

describe("angles", () => {
  it("wraps into (-PI, PI]", () => {
    expect(wrapAngle(0)).toBe(0);
    expect(wrapAngle(Math.PI * 3)).toBeCloseTo(Math.PI, 9);
    expect(wrapAngle(-Math.PI * 2.5)).toBeCloseTo(-Math.PI / 2, 9);
  });

  it("unwraps next to the previous angle", () => {
    expect(unwrapNear(3.1, -3.1)).toBeCloseTo(-3.1 + TAU, 9);
    expect(unwrapNear(0, 0.4)).toBeCloseTo(0.4, 9);
    expect(unwrapNear(10, 10.2 + TAU * 3)).toBeCloseTo(10.2, 9);
  });
});

describe("planeAngle", () => {
  it("is the plain angle when the circle faces the screen", () => {
    // a = +X, b = +Y on the screen
    expect(planeAngle(1, 0, 0, 1, 0, 1)).toBeCloseTo(Math.PI / 2, 9);
    expect(planeAngle(1, 0, 0, 1, -2, 0)).toBeCloseTo(Math.PI, 9);
  });

  it("turns the other way when the plane is seen from behind", () => {
    // +Y lands downward: a pointer above the centre is at -90 degrees in the plane
    expect(planeAngle(1, 0, 0, -1, 0, 1)).toBeCloseTo(-Math.PI / 2, 9);
  });

  it("undoes an ellipse (a plane turned toward the screen)", () => {
    // axes squashed to 0.5 vertically and sheared: a point at plane angle 40 degrees
    const ax = 80;
    const ay = 10;
    const bx = -20;
    const by = 40;
    const t = (40 * Math.PI) / 180;
    const dx = ax * Math.cos(t) + bx * Math.sin(t);
    const dy = ay * Math.cos(t) + by * Math.sin(t);
    expect(planeAngle(ax, ay, bx, by, dx, dy)).toBeCloseTo(t, 9);
  });

  it("gives up when the plane is edge on", () => {
    expect(planeAngle(1, 0, 2, 0, 1, 1)).toBeNull();
    expect(planeAngle(0, 0, 0, 0, 1, 1)).toBeNull();
  });
});

describe("crank", () => {
  it("speeds up to the asked speed and settles there", () => {
    const s: CrankState = { angle: 0, omega: 0 };
    const want = 2 * TAU;
    for (let i = 0; i < 240; i++) stepCrank(s, want, DT);
    expect(s.omega).toBeCloseTo(want, 2);
    expect(s.angle).toBeGreaterThan(10);
  });

  it("coasts to a stop slowly after a let go, and stops exactly", () => {
    const s: CrankState = { angle: 0, omega: TAU };
    stepCrank(s, 0, DT);
    expect(s.omega).toBeGreaterThan(TAU * 0.9);
    for (let i = 0; i < 60 * 12; i++) stepCrank(s, 0, DT);
    expect(s.omega).toBe(0);
  });

  it("does nothing for a zero or negative step", () => {
    const s: CrankState = { angle: 1, omega: 2 };
    stepCrank(s, 5, 0);
    stepCrank(s, 5, -1);
    expect(s).toEqual({ angle: 1, omega: 2 });
  });

  it("follows a held target and reads its speed", () => {
    const s: CrankState = { angle: 0, omega: 0 };
    for (let i = 0; i < 90; i++) stepCrankHeld(s, i * 0.1, DT, 20);
    // the target moves 6 rad/s: the angle is close behind it and the speed near 6
    expect(s.omega).toBeGreaterThan(4.5);
    expect(s.omega).toBeLessThan(7);
    expect(Math.abs(s.angle - 8.9)).toBeLessThan(0.5);
  });

  it("caps a flick", () => {
    const s: CrankState = { angle: 0, omega: 0 };
    stepCrankHeld(s, 100, DT, 20);
    expect(s.omega).toBeLessThanOrEqual(20);
  });
});

describe("driven crank", () => {
  it("is exactly the angle it is given and reads the speed from it", () => {
    const s: CrankState = { angle: 0, omega: 0 };
    stepCrankDriven(s, 100, DT, true, 40);
    expect(s.angle).toBe(100);
    expect(s.omega).toBe(0);
    const rate = 2 * TAU;
    for (let i = 1; i <= 90; i++) stepCrankDriven(s, 100 + rate * i * DT, DT, false, 40);
    expect(s.angle).toBeCloseTo(100 + rate * 90 * DT, 9);
    expect(s.omega).toBeGreaterThan(rate * 0.95);
    expect(s.omega).toBeLessThan(rate * 1.02);
  });

  it("does not spin the platter on a far first value", () => {
    const s: CrankState = { angle: 5, omega: 3 };
    stepCrankDriven(s, 5000, DT, true, 40);
    expect(s.omega).toBe(0);
  });

  it("keeps its speed and takes the angle when the clock is stopped", () => {
    const s: CrankState = { angle: 1, omega: 2 };
    stepCrankDriven(s, 3, 0, false, 40);
    expect(s).toEqual({ angle: 3, omega: 2 });
  });

  it("caps a jump in the angle", () => {
    const s: CrankState = { angle: 0, omega: 0 };
    stepCrankDriven(s, 1000, DT, false, 20);
    expect(s.omega).toBeLessThanOrEqual(20);
  });
});

describe("platter", () => {
  it("turns at the gear ratio of the crank and keeps turning when the crank stops", () => {
    const p: PlatterState = { angle: 0, omega: 0 };
    for (let i = 0; i < 600; i++) stepPlatter(p, 2 * TAU, DT);
    expect(p.omega).toBeCloseTo(2 * TAU * GEAR, 2);
    const before = p.angle;
    for (let i = 0; i < 30; i++) stepPlatter(p, 0, DT);
    expect(p.omega).toBeGreaterThan(0);
    expect(p.angle).toBeGreaterThan(before);
  });

  it("runs down more slowly than it speeds up", () => {
    const up: PlatterState = { angle: 0, omega: 0 };
    let tUp = 0;
    while (up.omega < 0.9 * 2 * GEAR * TAU && tUp < 1200) {
      stepPlatter(up, 2 * TAU, DT);
      tUp++;
    }
    const down: PlatterState = { angle: 0, omega: 2 * GEAR * TAU };
    let tDown = 0;
    while (down.omega > 0.1 * 2 * GEAR * TAU && tDown < 1200) {
      stepPlatter(down, 0, DT);
      tDown++;
    }
    expect(tDown).toBeGreaterThan(tUp);
  });

  it("never passes a 78 rpm record", () => {
    const p: PlatterState = { angle: 0, omega: 0 };
    for (let i = 0; i < 600; i++) stepPlatter(p, 100 * TAU, DT);
    expect(p.omega).toBeLessThanOrEqual(PLATTER_MAX_OMEGA + 1e-9);
  });

  it("stops exactly", () => {
    const p: PlatterState = { angle: 0, omega: 1 };
    for (let i = 0; i < 60 * 40; i++) stepPlatter(p, 0, DT);
    expect(p.omega).toBe(0);
  });
});

describe("tonearm", () => {
  it("lifts to the target without passing it much", () => {
    const a: ArmState = { angle: 0, vel: 0 };
    let peak = 0;
    for (let i = 0; i < 180; i++) {
      stepArm(a, 50, DT);
      peak = Math.max(peak, a.angle);
    }
    expect(a.angle).toBeCloseTo(50, 1);
    expect(peak).toBeLessThan(50.6);
  });

  it("lands on the record: never below 0, one click, a small rebound, then rest", () => {
    const a: ArmState = { angle: 50, vel: 0 };
    let min = 50;
    let clicks = 0;
    let rebounds = 0;
    let prev = a.angle;
    for (let i = 0; i < 240; i++) {
      const hit = stepArm(a, 0, DT);
      if (hit > 0) clicks++;
      if (a.angle > prev && prev < 3 && i > 5) rebounds++;
      prev = a.angle;
      min = Math.min(min, a.angle);
    }
    expect(min).toBeGreaterThanOrEqual(0);
    expect(clicks).toBeGreaterThanOrEqual(1);
    expect(clicks).toBeLessThanOrEqual(3);
    expect(rebounds).toBeGreaterThan(0);
    expect(a.angle).toBe(0);
    expect(a.vel).toBe(0);
  });

  it("is steady under a long frame", () => {
    const a: ArmState = { angle: 50, vel: 0 };
    stepArm(a, 0, 0.5);
    expect(Number.isFinite(a.angle)).toBe(true);
    expect(a.angle).toBeGreaterThanOrEqual(0);
    expect(stepArm(a, 0, 0)).toBe(0);
  });
});

describe("pixel frame", () => {
  it("is one to one at z = 0 and larger nearer", () => {
    expect(depthScale(0)).toBe(1);
    expect(depthScale(500)).toBeCloseTo(2, 9);
    expect(depthScale(-1000)).toBeCloseTo(0.5, 9);
  });

  it("never runs away near the camera", () => {
    expect(depthScale(5000)).toBeCloseTo(10, 9);
  });

  it("sizes a model so it shows the asked height", () => {
    const s = scaleForSize(300, 250, 0.5);
    expect(0.5 * s * depthScale(250)).toBeCloseTo(300, 9);
  });

  it("projects and unprojects", () => {
    const w = unprojectToDepth({ x: 0, y: 0 }, 100, -40, 300);
    const p = project({ x: 0, y: 0 }, w.x, w.y, 300);
    expect(p.x).toBeCloseTo(100, 9);
    expect(p.y).toBeCloseTo(-40, 9);
  });

  it("converts client pixels", () => {
    const o = clientToStage({ x: 0, y: 0 }, 100, 50, 1000, 600);
    expect(o).toEqual({ x: -400, y: 250 });
  });

  it("finds the nearest point on a segment", () => {
    const r = segmentDistance(5, 3, 0, 0, 10, 0);
    expect(r.d).toBeCloseTo(3, 9);
    expect(r.t).toBeCloseTo(0.5, 9);
    expect(segmentDistance(-4, 3, 0, 0, 10, 0).d).toBeCloseTo(5, 9);
    expect(segmentDistance(1, 1, 2, 2, 2, 2).d).toBeCloseTo(Math.SQRT2, 9);
  });
});
