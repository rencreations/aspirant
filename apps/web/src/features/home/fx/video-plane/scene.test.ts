import { describe, expect, it } from "vitest";

import { heroBase } from "./hero";
import { expandBox } from "./layout";
import { composeScene, makePoses, orbitTurn } from "./scene";
import { makePlane, makeState, PLANE_COUNT, type FilmState, type PlanePose } from "./types";

const vp = { w: 1440, h: 900 };

function scene(over: Partial<FilmState>, drift = 0) {
  const out = makePoses();
  const bases = makePoses();
  const lens = composeScene(vp, { ...makeState(), ...over }, drift, out, bases);
  return { out, bases, lens };
}

function snap(p: PlanePose) {
  return [p.x, p.y, p.z, ...p.q, p.w, p.h, p.corner, p.opacity];
}

describe("the film scene's joints", () => {
  it("morph 1 is expand 0: the strip", () => {
    const a = scene({ morph: 1, expand: 0 }).out[0]!;
    const b = makePlane();
    heroBase(vp, { ...makeState(), morph: 1, expand: 0 }, b);
    expect(snap(a)).toEqual(snap(b));
    const strip = expandBox(vp.w, vp.h, 0);
    expect(a.w).toBeCloseTo(strip.w, 9);
  });

  it("expand 1 is pull 0: the window, with no preview showing", () => {
    const a = scene({ morph: 1, expand: 1, pull: 0 });
    const w = expandBox(vp.w, vp.h, 1);
    expect(a.out[0]!.w).toBeCloseTo(w.w, 9);
    for (let k = 1; k < PLANE_COUNT; k++) expect(a.out[k]!.opacity).toBe(0);
    // A hair into the pull gives the same frame.
    const b = scene({ morph: 1, expand: 1, pull: 1e-9 });
    expect(b.out[0]!.w).toBeCloseTo(w.w, 4);
    expect(b.out[0]!.x).toBeCloseTo(a.out[0]!.x, 4);
  });

  it("pull 1 is fly 0: the orbit at rest", () => {
    const a = scene({ morph: 1, expand: 1, pull: 1, fly: 0 });
    const b = scene({ morph: 1, expand: 1, pull: 1, fly: 1e-9 });
    for (let k = 0; k < PLANE_COUNT; k++) {
      expect(a.out[k]!.x).toBeCloseTo(b.out[k]!.x, 4);
      expect(a.out[k]!.y).toBeCloseTo(b.out[k]!.y, 4);
      expect(a.out[k]!.w).toBeCloseTo(b.out[k]!.w, 4);
      expect(a.out[k]!.opacity).toBeCloseTo(b.out[k]!.opacity, 6);
    }
  });

  it("fly 1 leaves nothing on the screen", () => {
    const a = scene({ morph: 1, expand: 1, pull: 1, fly: 1 });
    for (let k = 0; k < PLANE_COUNT; k++) {
      expect(a.out[k]!.opacity).toBeLessThan(1e-6);
    }
  });

  it("draws the rows' long lens while the trailer leans and the pixel lens once it stands", () => {
    expect(scene({ morph: 0 }).lens).toBe(2000);
    expect(scene({ morph: 1 }).lens).toBe(1000);
    expect(scene({ morph: 0.5 }).lens).toBeGreaterThan(1000);
    expect(scene({ morph: 0.5 }).lens).toBeLessThan(2000);
  });

  it("is the same poses for the same state, whatever came before", () => {
    const a = scene({ morph: 1, expand: 1, pull: 0.6, fly: 0.2 }, 0.3).out.map(snap);
    scene({ morph: 0, fly: 1 }, 5);
    const b = scene({ morph: 1, expand: 1, pull: 0.6, fly: 0.2 }, 0.3).out.map(snap);
    expect(a).toEqual(b);
  });

  it("turns the orbit with the scroll's travel and the actor's drift, and not the trailer's frame before the pull", () => {
    expect(orbitTurn({ ...makeState(), travel: 1 }, 0.5)).toBeCloseTo(
      orbitTurn(makeState(), 0) + 1.5,
      9,
    );
    const a = scene({ morph: 1, expand: 1, pull: 0 }, 0);
    const b = scene({ morph: 1, expand: 1, pull: 0 }, 2);
    expect(snap(a.out[0]!)).toEqual(snap(b.out[0]!));
    const c = scene({ pull: 1 }, 0);
    const d = scene({ pull: 1 }, 0.5);
    expect(c.out[3]!.x).not.toBeCloseTo(d.out[3]!.x, 3);
  });

  it("gives the bases (before the fly-off) for the trails", () => {
    const a = scene({ morph: 1, expand: 1, pull: 1, fly: 0.5 });
    const b = scene({ morph: 1, expand: 1, pull: 1, fly: 0 });
    for (let k = 0; k < PLANE_COUNT; k++) expect(snap(a.bases[k]!)).toEqual(snap(b.out[k]!));
  });
});

describe("the film scene is continuous", () => {
  // Walk each part of the chain in 400 steps: no plane may jump, whatever the screen.
  const steps = 400;
  function walk(
    vpSize: { w: number; h: number },
    key: "morph" | "expand" | "pull" | "fly",
    mode: "dolly" | "gather" = "dolly",
  ) {
    const base: Partial<FilmState> = { morph: 1, expand: 1, pull: 1, arrival: mode };
    if (key === "morph") Object.assign(base, { expand: 0, pull: 0 });
    if (key === "expand") Object.assign(base, { pull: 0 });
    if (key === "pull") Object.assign(base, { fly: 0 });
    let prev: PlanePose[] | null = null;
    let worst = 0;
    let worstOpacity = 0;
    for (let i = 0; i <= steps; i++) {
      const st = { ...makeState(), ...base, [key]: i / steps };
      const out = makePoses();
      composeScene(vpSize, st, 0.2, out, makePoses());
      if (prev) {
        for (let k = 0; k < PLANE_COUNT; k++) {
          const a = prev[k]!;
          const b = out[k]!;
          // A plane that is not there does not count (a preview that is still hidden).
          if (a.opacity < 0.02 && b.opacity < 0.02) continue;
          worst = Math.max(worst, Math.hypot(b.x - a.x, b.y - a.y), Math.abs(b.w - a.w));
          worstOpacity = Math.max(worstOpacity, Math.abs(b.opacity - a.opacity));
        }
      }
      prev = out.map((p) => ({ ...p, q: [...p.q] }));
    }
    return { worst, worstOpacity };
  }

  for (const size of [
    { w: 1440, h: 900 },
    { w: 1706, h: 950 },
    { w: 390, h: 844 },
  ]) {
    it(`never jumps at ${size.w} by ${size.h}`, () => {
      for (const key of ["morph", "expand", "pull", "fly"] as const) {
        const r = walk(size, key);
        // 400 steps: even the fastest plane moves under a tenth of the screen's width a step.
        expect(r.worst, `${key}`).toBeLessThan(size.w * 0.06);
        expect(r.worstOpacity, `${key} opacity`).toBeLessThan(0.1);
      }
      expect(walk(size, "pull", "gather").worst).toBeLessThan(size.w * 0.06);
    });
  }
});
