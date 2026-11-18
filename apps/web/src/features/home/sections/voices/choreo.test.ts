import { describe, expect, it } from "vitest";

import {
  OUT_FROM,
  ballSize,
  cornerSpots,
  dwellSpots,
  duoSpotsAt,
  edgeSpots,
  emergeAt,
  leaveAt,
  newSpots,
  rowLook,
  stepDance,
  type StageRect,
} from "./choreo";

const VIEWS = [
  { w: 1440, h: 900 },
  { w: 1706, h: 950 },
  { w: 390, h: 844 },
  // The widest screen the CSS still treats as narrow (an art band under the chooser).
  { w: 900, h: 700 },
];

function artFor(vp: { w: number; h: number }): StageRect {
  if (vp.w <= 900) {
    return {
      left: -vp.w / 2 + 16,
      right: vp.w / 2 - 16,
      top: vp.h / 2 - 170,
      bottom: vp.h / 2 - 350,
    };
  }
  return { left: 0.04 * vp.w, right: vp.w / 2 - 40, top: vp.h / 2 - 190, bottom: -vp.h / 2 + 30 };
}

describe("emerge and leave", () => {
  it("starts hidden, ends shown, and never goes backwards", () => {
    for (let part = 0; part < 12; part++) {
      expect(emergeAt(0, part)).toBe(0);
      expect(emergeAt(0.5, part)).toBe(1);
      let last = 0;
      for (let i = 0; i <= 100; i++) {
        const v = emergeAt(i / 100, part);
        expect(v).toBeGreaterThanOrEqual(last - 1e-12);
        last = v;
      }
    }
  });

  it("stands until the leave starts and has gone at the end", () => {
    expect(leaveAt(OUT_FROM - 0.01)).toBe(0);
    expect(leaveAt(1)).toBe(1);
    expect(leaveAt(1.2)).toBe(1);
  });

  it("keeps every row shown while the section stands and hidden after it", () => {
    const out = { opacity: 0, lift: 0 };
    for (let row = 0; row < 8; row++) {
      rowLook(0.5, row, out);
      expect(out.opacity).toBe(1);
      expect(out.lift).toBe(0);
      rowLook(1, row, out);
      expect(out.opacity).toBe(0);
      rowLook(-0.2, row, out);
      expect(out.opacity).toBe(0);
    }
  });

  it("brings the rows in one after the other", () => {
    const out = { opacity: 0, lift: 0 };
    const at = (local: number, row: number) => rowLook(local, row, out).opacity;
    // Somewhere on the way in the first row is further along than the last.
    const local = 0.1;
    expect(at(local, 0)).toBeGreaterThan(at(local, 7));
  });
});

describe("where the drones are", () => {
  it("stands off screen at the side edges at the start (J9)", () => {
    for (const vp of VIEWS) {
      const spots = duoSpotsAt(0, vp, artFor(vp), newSpots());
      const r = ballSize(vp) / 2;
      expect(spots.a.x + r).toBeLessThan(-vp.w / 2);
      expect(spots.b.x - r).toBeGreaterThan(vp.w / 2);
    }
  });

  it("stands in the two bottom corners at the end (J10), inside the screen", () => {
    for (const vp of VIEWS) {
      const spots = duoSpotsAt(1, vp, artFor(vp), newSpots());
      const corner = cornerSpots(vp, newSpots());
      expect(spots.a.x).toBeCloseTo(corner.a.x, 6);
      expect(spots.a.y).toBeCloseTo(corner.a.y, 6);
      expect(spots.b.x).toBeCloseTo(corner.b.x, 6);
      expect(spots.b.y).toBeCloseTo(corner.b.y, 6);
      expect(Math.abs(spots.a.x)).toBeLessThan(vp.w / 2);
      // The ball with its gloves (1.25 diameters either side) is wholly on the screen.
      expect(Math.abs(spots.a.x) + 1.25 * spots.a.h).toBeLessThanOrEqual(vp.w / 2 + 1e-9);
      expect(Math.abs(spots.b.x) + 1.25 * spots.b.h).toBeLessThanOrEqual(vp.w / 2 + 1e-9);
      expect(spots.a.y).toBeLessThan(0);
      expect(spots.a.x).toBeLessThan(0);
      expect(spots.b.x).toBeGreaterThan(0);
    }
  });

  it("holds the corners after the end and the edges before the start", () => {
    for (const vp of VIEWS) {
      const art = artFor(vp);
      expect(duoSpotsAt(1.2, vp, art, newSpots())).toEqual(duoSpotsAt(1, vp, art, newSpots()));
      expect(duoSpotsAt(-0.2, vp, art, newSpots())).toEqual(duoSpotsAt(0, vp, art, newSpots()));
    }
  });

  it("stands at the dwell spots in the middle of the section, on the screen", () => {
    for (const vp of VIEWS) {
      const art = artFor(vp);
      const stand = duoSpotsAt(0.5, vp, art, newSpots());
      const dwell = dwellSpots(vp, art, newSpots());
      for (const [got, want] of [
        [stand.a, dwell.a],
        [stand.b, dwell.b],
      ] as const) {
        expect(got.x).toBeCloseTo(want.x, 6);
        expect(got.y).toBeCloseTo(want.y, 6);
        expect(got.h).toBeCloseTo(want.h, 6);
      }
      for (const s of [stand.a, stand.b]) {
        expect(Math.abs(s.x) + s.h / 2).toBeLessThan(vp.w / 2);
        expect(Math.abs(s.y) + s.h / 2).toBeLessThan(vp.h / 2);
      }
    }
  });

  it("keeps the two apart by more than a ball on the dwell", () => {
    for (const vp of VIEWS) {
      const dwell = dwellSpots(vp, artFor(vp), newSpots());
      const d = Math.hypot(dwell.a.x - dwell.b.x, dwell.a.y - dwell.b.y);
      expect(d).toBeGreaterThan(dwell.a.h * 0.9);
    }
  });

  it("starts the edges level with the dwell", () => {
    const vp = VIEWS[0]!;
    const dwell = dwellSpots(vp, artFor(vp), newSpots());
    const edge = edgeSpots(vp, dwell, newSpots());
    expect(edge.a.y).toBe(dwell.a.y);
    expect(edge.b.y).toBe(dwell.b.y);
  });

  it("moves smoothly: no step bigger than a tenth of the screen for a hundredth of the section", () => {
    for (const vp of VIEWS) {
      const art = artFor(vp);
      let last = duoSpotsAt(0, vp, art, newSpots());
      for (let i = 1; i <= 100; i++) {
        const now = duoSpotsAt(i / 100, vp, art, newSpots());
        // The way in is the longest: it crosses half the screen in a fifth of the section.
        expect(Math.hypot(now.a.x - last.a.x, now.a.y - last.a.y)).toBeLessThan(0.3 * vp.w);
        last = now;
      }
    }
  });
});

describe("the dance weight", () => {
  it("rises toward 1 while a line plays and falls toward 0 after it", () => {
    let w = 0;
    for (let i = 0; i < 120; i++) w = stepDance(w, true, 1 / 60);
    expect(w).toBeGreaterThan(0.95);
    for (let i = 0; i < 400; i++) w = stepDance(w, false, 1 / 60);
    expect(w).toBe(0);
  });

  it("falls more slowly than it rises", () => {
    expect(stepDance(1, false, 0.1)).toBeGreaterThan(1 - stepDance(0, true, 0.1));
  });

  it("does not move with a zero step", () => {
    expect(stepDance(0.4, true, 0)).toBeCloseTo(0.4, 12);
  });
});

describe("ballSize", () => {
  it("is held between a floor and a ceiling", () => {
    expect(ballSize({ w: 1000, h: 300 })).toBe(84);
    expect(ballSize({ w: 300, h: 300 })).toBe(56);
    expect(ballSize({ w: 3000, h: 3000 })).toBe(210);
    expect(ballSize({ w: 390, h: 844 })).toBeLessThan(80);
  });
});

describe("the narrow layout", () => {
  it("is the CSS's own: a screen of 900 px is narrow, one of 901 is not", () => {
    const narrow = ballSize({ w: 900, h: 700 });
    const wide = ballSize({ w: 901, h: 700 });
    // A narrow screen sizes the ball by its width (at most 90), a wide one by its height (0.17 of 700).
    expect(narrow).toBeLessThanOrEqual(90);
    expect(wide).toBeCloseTo(0.17 * 700, 6);
  });

  it("keeps the pair in the band's corner on a 900 px screen, off the chooser", () => {
    const vp = { w: 900, h: 700 };
    const art = artFor(vp);
    const spots = duoSpotsAt(0.5, vp, art, newSpots());
    for (const s of [spots.a, spots.b]) {
      // Below the top of the band (the chooser is above it).
      expect(s.y + s.h / 2).toBeLessThanOrEqual(art.top);
    }
  });
});

describe("the corners (J10)", () => {
  it("keep the two drones apart: their balls never overlap", () => {
    for (const vp of VIEWS) {
      const c = cornerSpots(vp, newSpots());
      expect(c.b.x - c.a.x).toBeGreaterThanOrEqual(c.a.h * 1.5);
    }
  });
});
