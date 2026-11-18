import { describe, expect, it } from "vitest";

import {
  expandBox,
  orbitCardWidth,
  orbitStage,
  sceneBox,
  sceneCentre,
  sceneWidth,
  stripBox,
  stripLook,
  toFrame,
  windowBox,
} from "./layout";

describe("the scene, after the reference's own numbers", () => {
  it("is 1120 by 560 at (160, 170) at 1440 by 900", () => {
    const b = sceneBox(1440, 900);
    expect([b.x, b.y, b.w, b.h]).toEqual([160, 170, 1120, 560]);
  });

  it("is 1386 wide at 1706 by 950 (the owner's display)", () => {
    expect(sceneWidth(1706, 950)).toBe(1386);
    expect(sceneBox(1706, 950).h).toBe(693);
  });

  it("stops at 1600 on a wide screen and never outgrows the screen's height", () => {
    expect(sceneWidth(2560, 1440)).toBe(1600);
    // 1920 by 720: the window may not be taller than the screen less 96 px.
    expect(sceneWidth(1920, 720)).toBeCloseTo((720 - 96) * (16 / 9), 6);
  });

  it("is the padded column on a portrait screen", () => {
    const b = sceneBox(390, 844);
    expect([b.x, b.y, b.w, b.h]).toEqual([24, 160, 342, 636]);
  });
});

describe("the strip and the window", () => {
  it("is 504 by 136.25, centred, at 1440 by 900 (3.70 to 1)", () => {
    const s = stripBox(1440, 900);
    expect(s.w).toBeCloseTo(504, 6);
    expect(s.h).toBeCloseTo(136.25, 2);
    expect(s.w / s.h).toBeCloseTo(3.7, 2);
    expect(s.x + s.w / 2).toBeCloseTo(720, 6);
    expect(s.y + s.h / 2).toBeCloseTo(450, 6);
  });

  it("is 623.7 wide at 1706 by 950", () => {
    expect(stripBox(1706, 950).w).toBeCloseTo(623.7, 1);
  });

  it("uses the portrait rules on a tall screen (scale 0.7, inset 21.98 percent)", () => {
    expect(stripLook(390, 844)).toEqual({ scale: 0.7, inset: 0.2198 });
    const s = stripBox(390, 844);
    expect(s.w).toBeCloseTo(0.7 * 342, 6);
    expect(s.h).toBeCloseTo(0.7 * (342 / (16 / 9)) * (1 - 2 * 0.2198), 6);
    // Centred on the scene's own centre.
    expect(s.y + s.h / 2).toBeCloseTo(sceneCentre(390, 844).y, 6);
  });

  it("opens to 1120 by 630 at (160, 135) at 1440 by 900", () => {
    const w = windowBox(1440, 900);
    expect([w.x, w.y, w.w, w.h]).toEqual([160, 135, 1120, 630]);
  });

  it("opens by the reference's measured scale: 0.525 at a step of 0.1 of the expand", () => {
    // The digest measures 0.45 -> 0.525 over the first 50 px of 700; the scale is linear in `e`.
    const e = 50 / 700;
    expect(expandBox(1440, 900, e).w / 1120).toBeCloseTo(0.45 + 0.55 * e, 6);
  });

  it("keeps its centre while it opens and grows in both sides", () => {
    let last = 0;
    for (let i = 0; i <= 10; i++) {
      const b = expandBox(1440, 900, i / 10);
      expect(b.x + b.w / 2).toBeCloseTo(720, 6);
      expect(b.y + b.h / 2).toBeCloseTo(450, 6);
      expect(b.h).toBeGreaterThan(last);
      last = b.h;
    }
  });

  it("clamps a progress outside 0 and 1", () => {
    expect(expandBox(1440, 900, -3)).toEqual(expandBox(1440, 900, 0));
    expect(expandBox(1440, 900, 4)).toEqual(expandBox(1440, 900, 1));
  });

  it("maps a box to the stage's frame (origin in the middle, y up)", () => {
    const c = toFrame({ x: 468, y: 382, w: 504, h: 136 }, 1440, 900);
    expect(c.x).toBeCloseTo(0, 6);
    expect(c.y).toBeCloseTo(0, 6);
    expect(toFrame({ x: 0, y: 0, w: 100, h: 100 }, 1440, 900)).toEqual({ x: -670, y: 400 });
  });
});

describe("the orbit's stage", () => {
  it("is as wide as the scene and 633.6 or so high at 1440 by 900", () => {
    const s = orbitStage(1440, 900);
    expect(s.w).toBe(1120);
    expect(s.h).toBeCloseTo(633.6, 1);
  });

  it("makes a card 201.6 wide at 1440 (14 vw)", () => {
    expect(orbitCardWidth(1440, 900)).toBeCloseTo(201.6, 6);
    expect(orbitCardWidth(390, 844)).toBe(117);
  });
});
