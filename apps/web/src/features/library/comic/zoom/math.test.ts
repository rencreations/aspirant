import { describe, expect, it } from "vitest";

import {
  centreOf,
  coverCamera,
  easeInOut,
  pageAfterZoom,
  partShift,
  settleMs,
  unturnedSize,
  vividColour,
  zoomExponent,
  zoomSamples,
  zoomed,
} from "./math";

const VIEW = { x: 0, y: 0, w: 1440, h: 900 };

describe("coverCamera", () => {
  it("brings a box to the middle of the view, covering it", () => {
    const box = { x: 512, y: 214, w: 296, h: 244 };
    const { k, pivot } = coverCamera(box, VIEW);
    // The width is the tight side (1440 / 296 against 900 / 244).
    expect(k).toBeCloseTo(1440 / 296, 6);
    const c = zoomed(centreOf(box), pivot, k);
    expect(c.x).toBeCloseTo(720, 6);
    expect(c.y).toBeCloseTo(450, 6);
    const a = zoomed({ x: box.x, y: box.y }, pivot, k);
    const b = zoomed({ x: box.x + box.w, y: box.y + box.h }, pivot, k);
    expect(a.x).toBeLessThanOrEqual(0.0001);
    expect(a.y).toBeLessThanOrEqual(0.0001);
    expect(b.x).toBeGreaterThanOrEqual(1439.9999);
    expect(b.y).toBeGreaterThanOrEqual(899.9999);
  });

  it("covers on the tall side when the box is wide", () => {
    const { k } = coverCamera({ x: 100, y: 100, w: 400, h: 100 }, VIEW);
    expect(k).toBeCloseTo(9, 6);
  });

  it("leaves a box that already is the view alone", () => {
    const { k } = coverCamera(VIEW, VIEW);
    expect(k).toBe(1);
  });
});

describe("partShift", () => {
  it("moves a part to where the camera puts its centre", () => {
    const pivot = { x: 100, y: 50 };
    const centre = { x: 300, y: 250 };
    const k = 3;
    const shift = partShift(centre, pivot, k, 0);
    const end = zoomed(centre, pivot, k);
    expect(centre.x + shift.x).toBeCloseTo(end.x, 6);
    expect(centre.y + shift.y).toBeCloseTo(end.y, 6);
  });

  it("turns the move back by the part's rotation", () => {
    const pivot = { x: 0, y: 0 };
    const centre = { x: 100, y: 0 };
    // On the screen the part must move 200 to the right (k = 3). It is turned 90 degrees, so in its
    // own frame that move is 200 up.
    const s = partShift(centre, pivot, 3, 90);
    expect(s.x).toBeCloseTo(0, 6);
    expect(s.y).toBeCloseTo(-200, 6);
  });
});

describe("zoomExponent", () => {
  it("is 1 for the first panel, more in front, less behind", () => {
    expect(zoomExponent(0.5, 0.5)).toBe(1);
    expect(zoomExponent(1.9, 0.5)).toBeGreaterThan(1);
    expect(zoomExponent(-0.5, 0.5)).toBeLessThan(1);
  });

  it("never stands still", () => {
    expect(zoomExponent(-20, 0.5)).toBe(0.25);
  });
});

describe("zoomSamples", () => {
  it("starts at 1 and ends at the camera's scale, rising all the way", () => {
    const s = zoomSamples(6, 10);
    expect(s).toHaveLength(11);
    expect(s[0]).toBe(1);
    expect(s[10]).toBeCloseTo(6, 9);
    for (let i = 1; i < s.length; i += 1) expect(s[i]!).toBeGreaterThanOrEqual(s[i - 1]!);
  });

  it("eases in and out", () => {
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(1)).toBe(1);
    expect(easeInOut(0.5)).toBeCloseTo(0.5, 9);
    expect(easeInOut(0.1)).toBeLessThan(0.1);
    expect(easeInOut(0.9)).toBeGreaterThan(0.9);
  });
});

describe("pageAfterZoom", () => {
  it("puts the cut's own pixels where the panel's picture shows them", () => {
    // The Aspirant's first panel: a 1000 by 820 cut from the top of the page, shown in a box of the
    // same shape.
    const fit = {
      box: { x: 500, y: 200, w: 250, h: 205 },
      cut: { w: 1000, h: 820 },
      at: { x: 0, y: 0 },
    };
    const { k, pivot } = coverCamera(fit.box, VIEW);
    const page = pageAfterZoom(fit, pivot, k);
    // One page pixel is as many screen pixels as the box is wide over the cut, times the camera.
    expect(page.scale).toBeCloseTo(k * 0.25, 9);
    // The cut's top left corner is the page's, and it lands on the zoomed box's corner.
    const corner = zoomed({ x: fit.box.x, y: fit.box.y }, pivot, k);
    expect(page.x).toBeCloseTo(corner.x, 6);
    expect(page.y).toBeCloseTo(corner.y, 6);
  });

  it("follows the cut down the page", () => {
    // A cut from the middle of a page (its top is at 2250): the page's own top is above it.
    const fit = {
      box: { x: 300, y: 100, w: 300, h: 150 },
      cut: { w: 2500, h: 1250 },
      at: { x: 0, y: 2250 },
    };
    const pivot = { x: 0, y: 0 };
    const page = pageAfterZoom(fit, pivot, 1);
    expect(page.scale).toBeCloseTo(0.12, 9);
    expect(page.y).toBeCloseTo(100 - 2250 * 0.12, 6);
  });

  it("allows for the part of the cut that the box does not show", () => {
    // A box wider than the cut: the picture covers it and the top and bottom of the cut are cut off.
    const fit = {
      box: { x: 0, y: 0, w: 200, h: 100 },
      cut: { w: 100, h: 100 },
      at: { x: 10, y: 20 },
    };
    const page = pageAfterZoom(fit, { x: 0, y: 0 }, 1);
    // c = 2; the visible window of the cut starts 25 pixels down.
    expect(page.scale).toBe(2);
    expect(page.x).toBeCloseTo(-(10 + 0) * 2, 9);
    expect(page.y).toBeCloseTo(-(20 + 25) * 2, 9);
  });
});

describe("settleMs", () => {
  it("is short for a short way and capped for a long one", () => {
    expect(settleMs(0)).toBe(650);
    expect(settleMs(1300)).toBeGreaterThan(1000);
    expect(settleMs(99999)).toBe(1250);
  });
});

describe("unturnedSize", () => {
  it("gives back the size of a box from the box that holds it once turned", () => {
    const w = 300;
    const h = 200;
    const deg = 0.7;
    const a = (deg * Math.PI) / 180;
    const holdW = w * Math.cos(a) + h * Math.sin(a);
    const holdH = w * Math.sin(a) + h * Math.cos(a);
    const out = unturnedSize(holdW, holdH, deg);
    expect(out.w).toBeCloseTo(w, 6);
    expect(out.h).toBeCloseTo(h, 6);
  });

  it("leaves a box that is not turned", () => {
    expect(unturnedSize(300, 200, 0)).toEqual({ w: 300, h: 200 });
  });
});

describe("vividColour", () => {
  it("keeps the hue and makes the colour loud", () => {
    // A dull mauve stays reddish and becomes saturated.
    const out = vividColour("#c4b0ae");
    expect(out).toMatch(/^#[0-9a-f]{6}$/);
    const r = Number.parseInt(out.slice(1, 3), 16);
    const g = Number.parseInt(out.slice(3, 5), 16);
    const b = Number.parseInt(out.slice(5, 7), 16);
    expect(r).toBeGreaterThan(g);
    expect(r).toBeGreaterThan(b);
    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeGreaterThan(100);
  });

  it("gives a loud default for something that is not a colour", () => {
    expect(vividColour("nope")).toBe("#ff5a7a");
  });

  it("gives a pure blue for a pure blue", () => {
    const out = vividColour("#0000ff");
    expect(Number.parseInt(out.slice(5, 7), 16)).toBeGreaterThan(
      Number.parseInt(out.slice(1, 3), 16),
    );
  });
});
