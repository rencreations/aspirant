import { describe, expect, it } from "vitest";

import { qRotate } from "../image-field/math";
import { WALL_DISTANCE } from "../image-field/wall";
import { heroBase, PIXEL_LENS, rowsGeom } from "./hero";
import { expandBox, toFrame } from "./layout";
import { makePlane, makeState, type FilmState } from "./types";

const vp = { w: 1440, h: 900 };

function pose(over: Partial<FilmState>) {
  const out = makePlane();
  const lens = heroBase(vp, { ...makeState(), ...over }, out);
  return { out, lens };
}

describe("the trailer's base pose", () => {
  it("is the strip at morph 1 and expand 0, on the pixel plane, upright", () => {
    const { out, lens } = pose({ morph: 1, expand: 0 });
    expect(lens).toBe(PIXEL_LENS);
    expect(out.q.map((v) => Math.round(v * 1e9) / 1e9)).toEqual([0, 0, 0, 1]);
    expect(out.z).toBe(0);
    expect(out.w).toBeCloseTo(504, 6);
    expect(out.h).toBeCloseTo(136.25, 2);
    expect(out.opacity).toBe(1);
    // The reference's corner: 9 px at 0.45 of the full radius of 20.
    expect(out.corner).toBeCloseTo(9, 6);
  });

  it("is the full window at expand 1, with the full radius", () => {
    const { out } = pose({ morph: 1, expand: 1 });
    expect(out.w).toBeCloseTo(1120, 6);
    expect(out.h).toBeCloseTo(630, 6);
    expect(out.corner).toBeCloseTo(20, 6);
  });

  it("lies on the field's rows at morph 0: their rotation, their lens, at the screen's centre", () => {
    const g = rowsGeom(vp);
    const { out, lens } = pose({ morph: 0, appear: 1, angleSize: 1 });
    expect(lens).toBe(WALL_DISTANCE);
    expect(out.q[0]).toBeCloseTo(g.q[0], 9);
    expect(out.q[1]).toBeCloseTo(g.q[1], 9);
    expect(out.q[2]).toBeCloseTo(g.q[2], 9);
    expect(out.q[3]).toBeCloseTo(g.q[3], 9);
    expect(out.x).toBeCloseTo(0, 6);
    expect(out.y).toBeCloseTo(0, 6);
    expect(out.z).toBeCloseTo(0, 6);
    // A rows card: the same width, 16 to 9.
    expect(out.w).toBeCloseTo(g.cardW, 6);
    expect(out.w / out.h).toBeCloseTo(16 / 9, 6);
    // Its plane's own axes are the rows' (the rows lean the way the cards do).
    const right: [number, number, number] = [0, 0, 0];
    qRotate(out.q, 1, 0, 0, right);
    expect(right[0]).toBeCloseTo(g.right[0], 6);
    expect(right[2]).toBeCloseTo(g.right[2], 6);
  });

  it("can lie on another place of the rows' plane, with the plane's own z", () => {
    const g = rowsGeom(vp);
    const { out } = pose({ morph: 0, angleU: 300, angleV: -100 });
    expect(out.x).toBeCloseTo(g.frame.cx + 300 * g.right[0] - 100 * g.up[0], 6);
    expect(out.z).toBeCloseTo(300 * g.right[2] - 100 * g.up[2], 6);
  });

  it("appears as a fade at its full size (the rows' space is made for it)", () => {
    const a = pose({ morph: 0, appear: 0 }).out;
    const b = pose({ morph: 0, appear: 1 }).out;
    expect(a.opacity).toBe(0);
    expect(b.opacity).toBe(1);
    expect(a.w).toBeCloseTo(b.w, 6);
  });

  it("is the same pose for the same state, and moves smoothly between", () => {
    const a = pose({ morph: 0.37 }).out;
    const b = pose({ morph: 0.37 }).out;
    expect(a).toEqual(b);
    let last = pose({ morph: 0 }).out.w;
    // The width goes from the card's to the strip's without a step.
    for (let t = 0.05; t <= 1.0001; t += 0.05) {
      const w = pose({ morph: t }).out.w;
      expect(Math.abs(w - last)).toBeLessThan(60);
      last = w;
    }
    expect(last).toBeCloseTo(504, 6);
  });

  it("follows a box the section gives it instead of the chain", () => {
    const { out } = pose({ heroBox: { x: 100, y: 100, w: 300, h: 200 }, morph: 0 });
    const c = toFrame({ x: 100, y: 100, w: 300, h: 200 }, 1440, 900);
    expect(out.x).toBeCloseTo(c.x, 6);
    expect(out.y).toBeCloseTo(c.y, 6);
    expect(out.w).toBe(300);
  });

  it("opens about the scene's centre for any expand", () => {
    for (const e of [0, 0.3, 0.7, 1]) {
      const { out } = pose({ morph: 1, expand: e });
      const b = expandBox(1440, 900, e);
      expect(out.w).toBeCloseTo(b.w, 6);
      expect(out.h).toBeCloseTo(b.h, 6);
      expect(out.x).toBeCloseTo(0, 6);
    }
  });
});
