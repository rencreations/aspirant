import { describe, expect, it } from "vitest";

import { PICTURE_FRAMES } from "./frames";
import {
  FRAME_RATIO,
  containIn,
  listGeometry,
  mixRect,
  pictureSize,
  placements,
  windowFit,
} from "./layout";

const SIZES = [
  { w: 1440, h: 900 },
  { w: 1706, h: 950 },
  { w: 390, h: 844 },
  { w: 1024, h: 768 },
];

describe("list geometry", () => {
  it("keeps the frame 4:5, inside the screen, with room on top for the doll", () => {
    for (const vp of SIZES) {
      const g = listGeometry(vp);
      expect(g.frame.w / g.frame.h).toBeCloseTo(FRAME_RATIO, 6);
      expect(g.frame.x).toBeGreaterThanOrEqual(0);
      expect(g.frame.x + g.frame.w).toBeLessThanOrEqual(vp.w);
      expect(g.frame.y + g.frame.h).toBeLessThanOrEqual(vp.h);
      // The doll sits on the top edge: her height fits between the bar (64 px) and the edge.
      expect(g.frame.y - g.dollHeight * 0.7).toBeGreaterThan(40);
    }
  });

  it("is 0.70 of the screen tall on a desktop and as wide as the screen allows on a phone", () => {
    expect(listGeometry({ w: 1440, h: 900 }).frame.h).toBeCloseTo(630, 3);
    const p = listGeometry({ w: 390, h: 844 });
    expect(p.frame.w).toBeCloseTo(390 - 48, 3);
  });

  it("seats the doll right of the middle, on the top edge", () => {
    for (const vp of SIZES) {
      const g = listGeometry(vp);
      expect(g.sitX).toBeGreaterThan(0);
      expect(g.sitX).toBeLessThan(g.frame.x + g.frame.w - vp.w / 2);
      expect(g.sitY).toBeCloseTo(vp.h / 2 - g.frame.y - 4, 6);
    }
  });
});

describe("window fit", () => {
  it("lays the whole picture so the window fills the frame", () => {
    const win = { x: 0.4359, y: 0, w: 0.3599, h: 0.8 };
    const f = windowFit(500, 625, 1920, 1080, win);
    expect(f.width * win.w).toBeGreaterThanOrEqual(499);
    expect(f.height * win.h).toBeGreaterThanOrEqual(624);
    // The window's centre is the frame's centre.
    expect(f.left + (win.x + win.w / 2) * f.width).toBeCloseTo(250, 3);
    expect(f.top + (win.y + win.h / 2) * f.height).toBeCloseTo(312.5, 3);
  });
});

describe("rectangles", () => {
  it("mixes two rectangles", () => {
    const m = mixRect({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 20, w: 30, h: 50 }, 0.5);
    expect(m).toEqual({ x: 5, y: 10, w: 20, h: 30 });
  });

  it("fits a picture inside an area with margins, centred", () => {
    const r = containIn({ x: 0, y: 0, w: 1440, h: 900 }, 16 / 9, 60);
    expect(r.w / r.h).toBeCloseTo(16 / 9, 6);
    expect(r.x).toBeGreaterThanOrEqual(60);
    expect(r.y).toBeGreaterThanOrEqual(60);
    expect(r.x + r.w / 2).toBeCloseTo(720, 6);
    expect(r.y + r.h / 2).toBeCloseTo(450, 6);
  });
});

describe("viewer placements", () => {
  it("shows the crop in the frame at the start and the whole in the window at the end", () => {
    const frame = PICTURE_FRAMES[2]!;
    const F = { x: 460, y: 180, w: 518, h: 648 };
    const size = pictureSize(frame);
    const T = containIn({ x: 0, y: 0, w: 1440, h: 900 }, size.w / size.h, 81);
    const { from, to } = placements(frame, F, T);
    expect(to).toEqual({ x: T.x, y: T.y, s: 1 });
    // The window's corner of the picture is the frame's corner.
    expect(from.x + frame.window.x * T.w * from.s).toBeCloseTo(F.x, 6);
    expect(from.y + frame.window.y * T.h * from.s).toBeCloseTo(F.y, 6);
    // The window's width fills the frame's width.
    expect(frame.window.w * T.w * from.s).toBeCloseTo(F.w, 6);
    // And the window's height fills the frame's height (the window is 4:5).
    expect(frame.window.h * T.h * from.s).toBeGreaterThan(F.h * 0.97);
    expect(frame.window.h * T.h * from.s).toBeLessThan(F.h * 1.03);
  });
});
