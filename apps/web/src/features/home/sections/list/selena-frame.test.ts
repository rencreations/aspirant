import { describe, expect, it } from "vitest";

import { listGeometry } from "./layout";
import { DRAWER_SHARE, dollHang, selenaEnd, selenaFree, selenaInFrame } from "./selena-frame";

const SIZES = [
  { w: 1440, h: 900 },
  { w: 1706, h: 950 },
  { w: 390, h: 844 },
];

describe("selena frame", () => {
  it("has her free area right of the drawer on a desktop and above the sheet on a phone", () => {
    const d = selenaFree({ w: 1440, h: 900 });
    expect(d.x).toBeCloseTo(DRAWER_SHARE * 1440, 6);
    expect(d.x + d.w).toBeCloseTo(1440, 6);
    const p = selenaFree({ w: 390, h: 844 });
    expect(p.x).toBe(0);
    expect(p.h).toBeLessThan(844 * 0.7);
  });

  it("ends with her placed in the free area, finite and positive", () => {
    for (const vp of SIZES) {
      const e = selenaEnd(vp);
      expect(Number.isFinite(e.x)).toBe(true);
      expect(Number.isFinite(e.y)).toBe(true);
      expect(e.height).toBeGreaterThan(vp.h * 0.15);
      expect(e.height).toBeLessThan(vp.h * 1.4);
      const free = selenaFree(vp);
      // Her anchor is on the side of the free area's middle.
      const cx = free.x + free.w / 2 - vp.w / 2;
      expect(Math.abs(e.x - cx)).toBeLessThan(free.w * 0.6);
    }
  });

  it("is deterministic (the section after the list reads the same numbers)", () => {
    for (const vp of SIZES) expect(selenaEnd(vp)).toEqual(selenaEnd({ ...vp }));
  });

  it("fits her standing pose to the 4:5 frame", () => {
    for (const vp of SIZES) {
      const f = listGeometry(vp).frame;
      const p = selenaInFrame(vp, f);
      expect(p.height).toBeGreaterThan(f.h * 0.5);
      expect(p.height).toBeLessThan(f.h * 1.3);
      // Centred on the frame, within a quarter of its width.
      expect(Math.abs(p.x - (f.x + f.w / 2 - vp.w / 2))).toBeLessThan(f.w * 0.25);
    }
  });

  it("hangs the doll at the top, right of the drawer's words", () => {
    for (const vp of SIZES) {
      const h = dollHang(vp);
      expect(h.y).toBeGreaterThan(vp.h / 2 - 0.06 * vp.h);
      expect(h.x + vp.w / 2).toBeGreaterThan(DRAWER_SHARE * vp.w);
      expect(h.height).toBeGreaterThan(0);
    }
  });
});
