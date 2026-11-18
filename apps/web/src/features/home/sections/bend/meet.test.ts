import { describe, expect, it } from "vitest";

import { BEND_SCREENS, STAGE, T, beatAt, newBeat, spotsOf } from "./beats";
import { droneAt, headOf, newDroneWant, paperDrone, restOf } from "./meet";

const vps = [
  { w: 1440, h: 900 },
  { w: 1706, h: 950 },
  { w: 390, h: 844 },
];

const at = (s: number, vp: { w: number; h: number }, time = 0) => {
  const beat = beatAt(s / BEND_SCREENS, newBeat(), vp);
  return { beat, want: droneAt(beat, vp, time, newDroneWant()) };
};

describe("the drone", () => {
  it("is not there before it comes out of the paper", () => {
    for (const vp of vps) {
      expect(at(T.popFrom - 0.05, vp).want.visible).toBe(false);
      expect(at(0, vp).want.visible).toBe(false);
      expect(at(T.popFrom + 0.01, vp).want.visible).toBe(true);
    }
  });

  it("comes out of the middle of the paper, small, and grows as it rises", () => {
    for (const vp of vps) {
      const paper = { x: 0, y: 0, height: 0, card: 0 };
      paperDrone(vp, paper);
      const a = at(T.popFrom + 0.001, vp).want;
      const b = at(T.popTo - 0.02, vp).want;
      expect(Math.abs(a.x - paper.x)).toBeLessThan(2);
      expect(a.height).toBeLessThan(paper.height * 0.6);
      expect(b.height).toBeGreaterThan(a.height);
      expect(b.height).toBeLessThanOrEqual(paper.height * 1.001);
      expect(b.y).toBeGreaterThan(a.y);
    }
  });

  it("goes above her head to pat it, and beside her chest to hug", () => {
    for (const vp of vps) {
      const { beat, want } = at((T.flyTo + T.patTo) / 2, vp, 0.3);
      const head = { x: 0, y: 0 };
      headOf(beat, vp, head);
      expect(want.y).toBeGreaterThan(head.y);
      expect(Math.abs(want.x - head.x)).toBeLessThan(vp.w * 0.1);
      expect(want.look).toBe(true);
      const hug = at((T.patTo + T.hugTo) / 2 + 0.05, vp).want;
      expect(hug.y).toBeLessThan(head.y);
      expect(hug.x).toBeGreaterThan(head.x);
    }
  });

  it("bobs onto her head while she is patted", () => {
    const vp = vps[0]!;
    const ys = [0, 0.15, 0.3, 0.45].map((t) => at((T.flyTo + T.patTo) / 2, vp, t).want.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(8);
  });

  it("ends at the rest beside Tetra (joint J14), the same on every screen", () => {
    for (const vp of vps) {
      const end = at(BEND_SCREENS, vp).want;
      const rest = restOf(vp);
      expect(end.x).toBeCloseTo(rest.x, 6);
      expect(end.y).toBeCloseTo(rest.y, 6);
      expect(end.height).toBeCloseTo(rest.height, 6);
      const spots = spotsOf(vp);
      expect(rest.x).toBeCloseTo(spots.restDrone.x * vp.w, 6);
      // To the right of her, and not far from her.
      expect(rest.x).toBeGreaterThan(spots.rest.tx * vp.w);
      expect(rest.x - spots.rest.tx * vp.w).toBeLessThan(vp.w * 0.35);
    }
  });

  it("holds the rest in the tail", () => {
    const vp = vps[0]!;
    const a = at(BEND_SCREENS, vp).want;
    const b = at(BEND_SCREENS + 0.4, vp).want;
    expect(b.x).toBe(a.x);
    expect(b.y).toBe(a.y);
    expect(b.height).toBe(a.height);
  });

  it("never jumps: no step of its place between close samples is large", () => {
    for (const vp of vps) {
      let prev = at(T.popFrom, vp, 0).want;
      for (let s = T.popFrom + 0.004; s <= BEND_SCREENS; s += 0.004) {
        const w = at(s, vp, 0).want;
        expect(Math.hypot(w.x - prev.x, w.y - prev.y)).toBeLessThan(vp.h * 0.06);
        expect(Math.abs(w.height - prev.height)).toBeLessThan(vp.h * 0.03);
        prev = w;
      }
    }
  });

  it("is the same for a jump as for a slow walk (a pure function of the beat and the time)", () => {
    const vp = vps[0]!;
    const direct = at(8.6, vp, 1.2).want;
    let walked = at(0, vp, 0).want;
    for (let s = 0; s <= 8.6; s += 0.1) walked = at(s, vp, 1.2).want;
    walked = at(8.6, vp, 1.2).want;
    expect(walked).toEqual(direct);
  });

  it("starts the stage where Tetra stands on the stage", () => {
    const vp = vps[0]!;
    const { beat } = at(T.holdFrom, vp);
    expect(beat.spot).toEqual(STAGE);
  });
});
