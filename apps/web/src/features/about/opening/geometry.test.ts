import { describe, expect, it } from "vitest";

import { holdEnd, morphEnd, windowBox, type Box } from "../film-geometry";
import { REEL_ASPECT } from "../layout";
import {
  BANDS,
  bandEdge,
  copyAt,
  perchBox,
  pictureAt,
  placementCss,
  placementOf,
  tagAt,
  tickAt,
  tintAt,
  TINT,
  type Placement,
} from "./geometry";

/** The four displays the page is checked on: width, height, the bar and the gutter in pixels. */
const DISPLAYS = [
  { name: "1366x768", vw: 1366, vh: 768, nav: 80, gutter: 70.2 },
  { name: "1440x900", vw: 1440, vh: 900, nav: 80, gutter: 72.1 },
  { name: "1920x1080", vw: 1920, vh: 1080, nav: 80, gutter: 84.4 },
  { name: "390x844", vw: 390, vh: 844, nav: 64, gutter: 17.8 },
] as const;

/** The preview's slot as the first screen lays it out: 34 percent wide, near the foot. */
function slotOf(vw: number, vh: number): Box {
  const w = Math.min(0.34 * vw, 0.56 * vh);
  return { x: 0.495 * vw, y: 0.73 * vh, w, h: w / REEL_ASPECT };
}

/** Where the wrapper's four corners land: its own box is `win`, its origin the top left. */
function corners(win: Box, p: Placement): Array<[number, number]> {
  const a = (p.tilt * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const at = (lx: number, ly: number): [number, number] => [
    win.x + p.x + p.scale * (cos * lx - sin * ly),
    win.y + p.y + p.scale * (sin * lx + cos * ly),
  ];
  return [at(0, 0), at(win.w, 0), at(win.w, win.h), at(0, win.h)];
}

describe("the picture", () => {
  for (const d of DISPLAYS) {
    const win = windowBox(d.vw, d.vh, d.nav, d.gutter);
    const slot = slotOf(d.vw, d.vh);

    it(`is exactly on the slot at the top of the page (${d.name})`, () => {
      const { box, place } = pictureAt(slot, win, 0, d.vh);
      expect(box).toEqual(slot);
      const [tl, tr, br, bl] = corners(win, place);
      expect(tl?.[0]).toBeCloseTo(slot.x, 6);
      expect(tl?.[1]).toBeCloseTo(slot.y, 6);
      expect(tr?.[0]).toBeCloseTo(slot.x + slot.w, 6);
      expect(br?.[1]).toBeCloseTo(slot.y + slot.h, 6);
      expect(bl?.[0]).toBeCloseTo(slot.x, 6);
      expect(place.tilt).toBeCloseTo(0, 9);
    });

    it(`is exactly on the window when the morph is complete (${d.name})`, () => {
      const { box, place } = pictureAt(slot, win, morphEnd(d.vh), d.vh);
      expect(box.x).toBeCloseTo(win.x, 9);
      expect(box.y).toBeCloseTo(win.y, 9);
      expect(box.w).toBeCloseTo(win.w, 9);
      expect(placementCss(place)).toBe("none");
    });

    it(`stands still in the stage through the hold and after it (${d.name})`, () => {
      const mid = pictureAt(slot, win, (morphEnd(d.vh) + holdEnd(d.vh)) / 2, d.vh);
      expect(placementCss(mid.place)).toBe("none");
      // Past the hold the box leaves with the page, and the stage carries the picture.
      const past = pictureAt(slot, win, holdEnd(d.vh) + 300, d.vh);
      expect(past.box.y).toBeCloseTo(win.y - 300, 6);
      expect(placementCss(past.place)).toBe("none");
    });

    it(`keeps the picture's shape and its middle through the tilt (${d.name})`, () => {
      const y = morphEnd(d.vh) / 2;
      const { box, place } = pictureAt(slot, win, y, d.vh);
      expect(place.tilt).toBeLessThan(-1);
      const [tl, , br] = corners(win, place);
      // The turn is about the picture's middle: the middle of the corners is the box's middle.
      expect(((tl?.[0] ?? 0) + (br?.[0] ?? 0)) / 2).toBeCloseTo(box.x + box.w / 2, 6);
      expect(((tl?.[1] ?? 0) + (br?.[1] ?? 0)) / 2).toBeCloseTo(box.y + box.h / 2, 6);
    });

    it(`perches the drone clear of the bar and on the window's top edge (${d.name})`, () => {
      const perch = perchBox(win, d.vw);
      expect(perch.w).toBeGreaterThanOrEqual(84);
      expect(perch.w).toBeLessThanOrEqual(150);
      // The whole anchor is under the bar, with air.
      expect(perch.y).toBeGreaterThanOrEqual(d.nav + 8);
      // Its middle is above the edge and its foot below it: part of the drone is behind the window.
      const cy = perch.y + perch.h / 2;
      expect(cy).toBeLessThan(win.y);
      expect(perch.y + perch.h).toBeGreaterThan(win.y);
      // Near the right end, and inside the window's width.
      const cx = perch.x + perch.w / 2;
      expect(cx).toBeGreaterThan(win.x + win.w * 0.6);
      expect(perch.x + perch.w).toBeLessThanOrEqual(win.x + win.w);
    });
  }

  it("turns nothing when the tilt is none", () => {
    const win = { x: 72, y: 233, w: 1296, h: 546.75 };
    const p = placementOf({ x: 712, y: 657, w: 489.6, h: 206.55 }, win, 0);
    expect(p.x).toBeCloseTo(640, 9);
    expect(p.y).toBeCloseTo(424, 9);
    expect(p.scale).toBeCloseTo(489.6 / 1296, 9);
  });
});

describe("the fades", () => {
  const vh = 900;
  it("veils the preview at the top and has lifted by 60 percent of the morph", () => {
    expect(tintAt(0, vh)).toBeCloseTo(TINT, 9);
    expect(tintAt(0.6 * morphEnd(vh), vh)).toBeCloseTo(0, 9);
    expect(tintAt(morphEnd(vh), vh)).toBe(0);
    expect(tintAt(0.3 * morphEnd(vh), vh)).toBeGreaterThan(0.2);
  });

  it("drops the tag early and the first screen's text before the picture is half way", () => {
    expect(tagAt(0, vh)).toBe(1);
    expect(tagAt(0.2 * morphEnd(vh), vh)).toBe(0);
    expect(copyAt(0, vh)).toBe(1);
    expect(copyAt(0.1 * morphEnd(vh), vh)).toBe(1);
    expect(copyAt(0.5 * morphEnd(vh), vh)).toBe(0);
  });
});

describe("the bands of the title", () => {
  const left = 72;
  const width = 1290;

  it("never opens ahead of the drone", () => {
    for (let i = 0; i < BANDS; i += 1)
      for (let x = left - 200; x <= left + width + 200; x += 7)
        expect(bandEdge(i, x, left, width)).toBeGreaterThanOrEqual(x);
  });

  it("only ever opens further as the drone flies left", () => {
    for (let i = 0; i < BANDS; i += 1) {
      let last = Infinity;
      for (let x = left + width + 100; x >= left - 100; x -= 3) {
        const e = bandEdge(i, x, left, width);
        expect(e).toBeLessThanOrEqual(last);
        last = e;
      }
    }
  });

  it("is a comb in the middle of the pass and closed at the left end", () => {
    const mid = Array.from({ length: BANDS }, (_, i) => bandEdge(i, left + width / 2, left, width));
    expect(Math.max(...mid) - Math.min(...mid)).toBeGreaterThan(width * 0.05);
    for (let i = 0; i < BANDS; i += 1) {
      expect(bandEdge(i, left, left, width)).toBe(left);
      expect(bandEdge(i, left - 80, left, width)).toBe(left - 80);
    }
  });

  it("puts its marks out as the drone reaches the left end", () => {
    expect(tickAt(left + width / 2, left, width)).toBe(1);
    expect(tickAt(left, left, width)).toBe(0);
    expect(tickAt(left - 90, left, width)).toBe(0);
    expect(tickAt(left + 0.07 * width, left, width)).toBeCloseTo(0.5, 6);
  });
});
