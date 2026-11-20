import { describe, expect, it } from "vitest";

import {
  EASE_EDGE,
  flyPose,
  itemProgress,
  LINES,
  lineAt,
  makeRoute,
  routeAt,
  setupRoute,
  STAGGER,
  steady,
  TRAIL_POINTS,
  trailOf,
  leaveRank,
} from "./flyoff";
import { makePlane, type PlanePose } from "./types";

const vp = { w: 1440, h: 900 };

function base(x: number, y: number, w = 200): PlanePose {
  return { ...makePlane(), x, y, w, h: w / 1.96, order: 60 };
}

describe("the four lines", () => {
  it("descend to the right (about 28 degrees) and stand where the digest puts them", () => {
    const a: [number, number] = [0, 0];
    const b: [number, number] = [0, 0];
    for (let k = 0; k < LINES.length; k++) {
      lineAt(vp, k, -0.6, a);
      lineAt(vp, k, 0.6, b);
      expect(b[0]).toBeGreaterThan(a[0]);
      expect(b[1]).toBeLessThan(a[1]);
    }
    // The first line stands above the middle, the last below it.
    lineAt(vp, 0, 0, a);
    lineAt(vp, 3, 0, b);
    expect(a[1]).toBeGreaterThan(b[1]);
  });

  it("is a pure function", () => {
    const a: [number, number] = [0, 0];
    const b: [number, number] = [0, 0];
    lineAt(vp, 2, 0.3, a);
    lineAt(vp, 2, 0.3, b);
    expect(a).toEqual(b);
  });
});

describe("the ride", () => {
  const route = makeRoute();

  it("joins the nearest line and ends clear of the screen at the bottom right", () => {
    for (const [x, y] of [
      [0, 0],
      [-400, 250],
      [380, -200],
      [-300, -250],
    ] as const) {
      setupRoute(vp, x, y, 150, route);
      expect(route.a1).toBeGreaterThan(route.a0);
      const out: [number, number] = [0, 0];
      routeAt(vp, route, 0, out);
      expect(out[0]).toBeCloseTo(x, 6);
      expect(out[1]).toBeCloseTo(y, 6);
      routeAt(vp, route, 1, out);
      expect(out[0] > vp.w / 2 || out[1] < -vp.h / 2).toBe(true);
    }
  });

  it("starts with the leader (the trailer) and the tail follows a little later, all done at 1", () => {
    expect(leaveRank(0)).toBe(0);
    expect(leaveRank(1)).toBe(1);
    expect(itemProgress(0.01, 0)).toBeGreaterThan(0);
    expect(itemProgress(0.01, 1)).toBe(0);
    expect(itemProgress(STAGGER, 1)).toBeCloseTo(0, 9);
    expect(itemProgress(1, 1)).toBe(1);
    expect(itemProgress(1, 0)).toBe(1);
  });

  it("steady: linear between two short eases, from 0 to 1, with a continuous speed", () => {
    expect(steady(0)).toBe(0);
    expect(steady(1)).toBeCloseTo(1, 12);
    // The middle is exactly linear: equal steps of the ride are equal distances.
    const d1 = steady(0.4) - steady(0.3);
    const d2 = steady(0.7) - steady(0.6);
    expect(d1).toBeCloseTo(d2, 12);
    // Monotone, and the speed does not jump at the ends of the eases.
    let last = 0;
    for (let i = 1; i <= 100; i++) {
      const v = steady(i / 100);
      expect(v).toBeGreaterThanOrEqual(last);
      last = v;
    }
    const speed = (u: number) => (steady(u + 1e-6) - steady(u - 1e-6)) / 2e-6;
    expect(speed(EASE_EDGE - 1e-4)).toBeCloseTo(speed(EASE_EDGE + 1e-4), 2);
    expect(speed(1 - EASE_EDGE - 1e-4)).toBeCloseTo(speed(1 - EASE_EDGE + 1e-4), 2);
  });

  it("walks the path at a constant speed: equal scroll, equal distance (round nine)", () => {
    for (const [x, y] of [
      [-300, -250],
      [0, 0],
      [-400, 250],
    ] as const) {
      setupRoute(vp, x, y, 300, route);
      const a: [number, number] = [0, 0];
      const b: [number, number] = [0, 0];
      const steps: number[] = [];
      routeAt(vp, route, 0.1, a);
      for (let i = 1; i <= 16; i++) {
        routeAt(vp, route, 0.1 + (0.8 * i) / 16, b);
        steps.push(Math.hypot(b[0] - a[0], b[1] - a[1]));
        a[0] = b[0];
        a[1] = b[1];
      }
      const lo = Math.min(...steps);
      const hi = Math.max(...steps);
      expect(hi / lo).toBeLessThan(1.12);
    }
  });
});

describe("the fly-off", () => {
  const pose = makePlane();

  it("is the base pose at 0", () => {
    const b = base(120, -40);
    flyPose(vp, 3, 0.5, b, 0, pose);
    expect(pose.x).toBe(120);
    expect(pose.y).toBe(-40);
    expect(pose.w).toBe(200);
    expect(pose.opacity).toBe(1);
  });

  it("leaves nothing at 1: faded, small and off the screen", () => {
    for (let k = 0; k < 11; k++) {
      for (const a of [0, 0.3, 1]) {
        flyPose(vp, k, a, base(-200 + 40 * k, 100 - 30 * k), 1, pose);
        expect(pose.opacity).toBeLessThan(1e-9);
        expect(pose.w).toBeCloseTo(200 * 0.32, 6);
        expect(pose.x > vp.w / 2 || pose.y < -vp.h / 2).toBe(true);
      }
    }
  });

  it("moves a plane toward the bottom right and back from it (reversible by f)", () => {
    const b = base(-300, 200);
    const a = makePlane();
    flyPose(vp, 4, 1, b, 0.2, pose);
    flyPose(vp, 4, 1, b, 0.6, a);
    expect(a.x).toBeGreaterThan(pose.x);
    expect(a.y).toBeLessThan(pose.y);
    const again = makePlane();
    flyPose(vp, 4, 1, b, 0.2, again);
    expect(again.x).toBe(pose.x);
    expect(again.y).toBe(pose.y);
    expect(again.q).toEqual(pose.q);
  });

  it("moves the trailer from the first pixel, and the tail of the train a little later (round nine)", () => {
    const hero = base(300, -100, 400);
    flyPose(vp, 0, 0, hero, 0.03, pose);
    expect(pose.x).not.toBe(300);
    const tail = base(-300, 200);
    flyPose(vp, 1, 1, tail, STAGGER * 0.5, pose);
    expect(pose.x).toBe(-300);
    flyPose(vp, 1, 1, tail, STAGGER * 1.5, pose);
    expect(pose.x).not.toBe(-300);
  });

  it("turns as it goes (a spiral), stays at its depth and is small at the end", () => {
    const b = base(0, 0);
    flyPose(vp, 5, 0.5, b, 0.9, pose);
    const turned = Math.abs(pose.q[0]) + Math.abs(pose.q[1]) + Math.abs(pose.q[2]);
    expect(turned).toBeGreaterThan(0.1);
    // No recede in depth: it slowed the picture on the screen.
    expect(pose.z).toBe(b.z);
    expect(pose.w).toBeLessThan(200);
  });

  it("keeps the painter's order", () => {
    flyPose(vp, 2, 0.4, base(10, 10), 0.5, pose);
    expect(pose.order).toBe(60);
  });
});

describe("the trail", () => {
  it("starts at the item's centre and ends behind it, on its own path", () => {
    const b = base(-200, 150);
    const pts = new Float32Array(TRAIL_POINTS * 2);
    const n = trailOf(vp, 1, b, 0.25, pts, 0);
    expect(n).toBe(TRAIL_POINTS);
    const pose = makePlane();
    flyPose(vp, 1, 1, b, 0.25, pose);
    expect(pts[0]).toBeCloseTo(pose.x, 3);
    expect(pts[1]).toBeCloseTo(pose.y, 3);
    // The tail of the trail is behind the head (up and to the left of it).
    expect(pts[(TRAIL_POINTS - 1) * 2]).toBeLessThan(pts[0]!);
  });

  it("is empty before the item starts and after it has gone", () => {
    const pts = new Float32Array(TRAIL_POINTS * 2);
    expect(trailOf(vp, 1, base(0, 0), STAGGER * 0.5, pts, 0)).toBe(0);
    expect(trailOf(vp, 1, base(0, 0), 1, pts, 0)).toBe(0);
    expect(trailOf(vp, 1, base(0, 0), 0, pts, 0)).toBe(0);
  });
});
