import { describe, expect, it } from "vitest";

import { PREVIEW_ASPECT } from "./data";
import {
  orbitMetrics,
  makeSlots,
  ORBIT_START,
  orbitPoses,
  orbitSlots,
  trainAngles,
  trainPlace,
} from "./orbit";
import { expandBox, sceneCentre } from "./layout";
import { makePoses as makePose } from "./scene";
import { makePlane, PLANE_COUNT } from "./types";

const vp = { w: 1440, h: 900 };

describe("the train", () => {
  it("has gaps in the digest's series: 0.619 rad first for twelve cards, each 0.88 of the last", () => {
    const g = trainAngles(12, new Float64Array(12));
    expect(g[0]).toBe(0);
    expect(g[1]! - g[0]!).toBeCloseTo(0.619, 3);
    expect((g[2]! - g[1]!) / (g[1]! - g[0]!)).toBeCloseTo(0.88, 9);
  });

  it("spans 0.62 of a turn from the leader to the tail, for eleven cards too", () => {
    const g = trainAngles(PLANE_COUNT, new Float64Array(PLANE_COUNT));
    expect(g[PLANE_COUNT - 1]).toBeCloseTo(0.62 * 2 * Math.PI, 9);
  });

  it("puts the trailer first and card 1 last (rank (n - e) mod n)", () => {
    expect(trainPlace(0)).toBe(0);
    expect(trainPlace(1)).toBe(1);
    expect(trainPlace(PLANE_COUNT - 1)).toBeCloseTo(1 / (PLANE_COUNT - 1), 9);
  });

  it("makes the leader the biggest and the tail the smallest and faintest", () => {
    const slots = orbitSlots(vp, ORBIT_START, makeSlots());
    const lead = slots[0]!;
    const tail = slots[1]!;
    expect(lead.a).toBe(0);
    expect(tail.a).toBe(1);
    expect(lead.s).toBeGreaterThan(tail.s * 2);
    expect(lead.o).toBeGreaterThan(tail.o);
    expect(lead.s).toBeCloseTo(1.25 * (0.82 + 0.18 * lead.front), 9);
    expect(tail.s).toBeCloseTo(0.4 * (0.82 + 0.18 * tail.front), 9);
  });

  it("stands the leader at the bottom right and runs the train up and to the left", () => {
    const slots = orbitSlots(vp, ORBIT_START, makeSlots());
    expect(slots[0]!.x).toBeGreaterThan(0);
    expect(slots[0]!.y).toBeGreaterThan(0);
    expect(slots[1]!.x).toBeLessThan(0);
  });

  it("keeps every card on the stage's ellipse", () => {
    const { rx, ry } = orbitMetrics(vp);
    for (const R of [0, 1, 2.5, 4]) {
      for (const s of orbitSlots(vp, R, makeSlots())) {
        expect((s.x / rx) ** 2 + (s.y / ry) ** 2).toBeCloseTo(1, 9);
      }
    }
  });

  it("turns the whole train when R moves", () => {
    const a = orbitSlots(vp, 1, makeSlots());
    const b = orbitSlots(vp, 1.4, makeSlots());
    expect(a[0]!.x).not.toBeCloseTo(b[0]!.x, 3);
  });
});

describe("the pull", () => {
  const base = { ...makePlane(), w: 1120, h: 630, x: 0, y: 0, corner: 20 };
  const centre = sceneCentre(vp.w, vp.h);
  const cx = centre.x - vp.w / 2;
  const cy = vp.h / 2 - centre.y;
  const { cardW } = orbitMetrics(vp);

  function poses(mode: "dolly" | "gather", pull: number, R = ORBIT_START) {
    const out = makePose();
    orbitPoses(vp, mode, pull, R, base, out);
    return out;
  }

  it("is the trailer's own frame at pull 0, with every preview hidden", () => {
    for (const mode of ["dolly", "gather"] as const) {
      const p = poses(mode, 0);
      expect(p[0]!.x).toBeCloseTo(base.x, 9);
      expect(p[0]!.y).toBeCloseTo(base.y, 9);
      expect(p[0]!.w).toBeCloseTo(1120, 9);
      expect(p[0]!.h).toBeCloseTo(630, 9);
      for (let k = 1; k < PLANE_COUNT; k++) expect(p[k]!.opacity).toBeCloseTo(0, 9);
    }
  });

  it("brings the trailer to the leader's own place and size at pull 1, and the previews to theirs", () => {
    const slots = orbitSlots(vp, ORBIT_START, makeSlots());
    for (const mode of ["dolly", "gather"] as const) {
      const p = poses(mode, 1);
      expect(p[0]!.x).toBeCloseTo(cx + slots[0]!.x, 6);
      expect(p[0]!.y).toBeCloseTo(cy - slots[0]!.y, 6);
      expect(p[0]!.w).toBeCloseTo(cardW * slots[0]!.s, 6);
      expect(p[0]!.w / p[0]!.h).toBeCloseTo(PREVIEW_ASPECT, 6);
      for (let k = 1; k < PLANE_COUNT; k++) {
        expect(p[k]!.x).toBeCloseTo(cx + slots[k]!.x, 6);
        expect(p[k]!.y).toBeCloseTo(cy - slots[k]!.y, 6);
        expect(p[k]!.w).toBeCloseTo(cardW * slots[k]!.s, 6);
        expect(p[k]!.opacity).toBeCloseTo(slots[k]!.o, 6);
      }
    }
  });

  it("zooms by a logarithm: halfway the width is the geometric mean (the dolly's constant speed)", () => {
    const slots = orbitSlots(vp, ORBIT_START, makeSlots());
    const t0w = cardW * slots[0]!.s;
    const p = poses("dolly", 0.5);
    expect(p[0]!.w).toBeCloseTo(Math.sqrt(1120 * t0w), 6);
  });

  it("starts the dolly zoomed in about 4 times: the previews are huge and off to the sides", () => {
    const slots = orbitSlots(vp, ORBIT_START, makeSlots());
    const Z = 1120 / (cardW * slots[0]!.s);
    expect(Z).toBeGreaterThan(3.5);
    const p = poses("dolly", 1e-6);
    // The tail card, at pull 0, is the natural size times the zoom.
    expect(p[1]!.w).toBeCloseTo(cardW * slots[1]!.s * Z, 3);
    // And the leader's neighbours are in the same relation to it as in the orbit, times the zoom.
    expect(p[2]!.x - p[0]!.x).toBeCloseTo((slots[2]!.x - slots[0]!.x) * Z, 3);
    expect(p[2]!.y - p[0]!.y).toBeCloseTo(-(slots[2]!.y - slots[0]!.y) * Z, 3);
  });

  it("makes the previews leave the trailer's frame in the gather, nearest the head of the train first", () => {
    const early = poses("gather", 0.3);
    // Every preview is still inside or near the frame at pull 0.
    const start = poses("gather", 0);
    for (let k = 1; k < PLANE_COUNT; k++) {
      expect(start[k]!.x).toBeCloseTo(start[0]!.x, 6);
      expect(start[k]!.y).toBeCloseTo(start[0]!.y, 6);
    }
    // The card right behind the leader (card 10) has moved before the tail (card 1).
    const slots = orbitSlots(vp, ORBIT_START, makeSlots());
    const moved = (k: number) => Math.hypot(early[k]!.x - early[0]!.x, early[k]!.y - early[0]!.y);
    expect(moved(PLANE_COUNT - 1)).toBeGreaterThan(moved(1));
    expect(slots[PLANE_COUNT - 1]!.a).toBeLessThan(slots[1]!.a);
  });

  it("orders the front of the ellipse over the back", () => {
    const p = poses("dolly", 1);
    const slots = orbitSlots(vp, ORBIT_START, makeSlots());
    let front = 1;
    let back = 1;
    for (let k = 1; k < PLANE_COUNT; k++) {
      if (slots[k]!.front > slots[front]!.front) front = k;
      if (slots[k]!.front < slots[back]!.front) back = k;
    }
    expect(p[front]!.order).toBeGreaterThan(p[back]!.order);
  });

  it("is the same for the same numbers", () => {
    const a = poses("dolly", 0.4, 1.7).map((p) => ({ ...p, q: [...p.q] }));
    const b = poses("dolly", 0.4, 1.7).map((p) => ({ ...p, q: [...p.q] }));
    expect(a).toEqual(b);
  });

  it("starts from the strip's window when the expand has finished", () => {
    const w = expandBox(vp.w, vp.h, 1);
    expect(w.w).toBe(1120);
  });
});
