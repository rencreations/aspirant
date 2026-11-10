import { describe, expect, it } from "vitest";

import {
  dragTarget,
  dragTurn,
  feedWheel,
  FLAT,
  fullWindow,
  newWheel,
  offsetOf,
  placement,
  ringContent,
  ringGeometry,
  visibility,
  WHEEL_GAP_MS,
  wrapIndex,
  wrapOffset,
} from "./ring";

type M = number[]; // 4x4, column major like CSS matrix3d

const I: M = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

function mul(a: M, b: M): M {
  const out = new Array<number>(16).fill(0);
  for (let c = 0; c < 4; c += 1)
    for (let r = 0; r < 4; r += 1)
      for (let k = 0; k < 4; k += 1) out[c * 4 + r]! += a[k * 4 + r]! * b[c * 4 + k]!;
  return out;
}

const T = (x: number, y: number, z: number): M => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
const S = (x: number, y: number, z: number): M => [x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1];
const RX = (a: number): M => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1];
};
const RY = (a: number): M => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1];
};
const RZ = (a: number): M => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
};

/** Read a transform list made by `placement` into a matrix. */
function parse(list: string): M {
  let m = I;
  for (const [, fn, args] of list.matchAll(/(\w+)\(([^)]*)\)/gu)) {
    const n = args!.split(",").map((v) => Number.parseFloat(v));
    const rad = ((n[0] ?? 0) * Math.PI) / 180;
    const step =
      fn === "translate3d"
        ? T(n[0]!, n[1]!, n[2]!)
        : fn === "translateZ"
          ? T(0, 0, n[0]!)
          : fn === "scale3d"
            ? S(n[0]!, n[1]!, n[2]!)
            : fn === "rotateX"
              ? RX(rad)
              : fn === "rotateY"
                ? RY(rad)
                : RZ(rad);
    m = mul(m, step);
  }
  return m;
}

/** Where a point of a panel's box lands on screen (origin of the transform: the box's middle). */
function project(
  list: string,
  view: { w: number; h: number },
  perspective: number,
  x: number,
  y: number,
) {
  const m = parse(list);
  const px = x - view.w / 2;
  const py = y - view.h / 2;
  const X = m[0]! * px + m[4]! * py + m[12]!;
  const Y = m[1]! * px + m[5]! * py + m[13]!;
  const Z = m[2]! * px + m[6]! * py + m[14]!;
  const k = perspective / (perspective - Z);
  return { x: view.w / 2 + X * k, y: view.h / 2 + Y * k, z: Z };
}

describe("ringGeometry", () => {
  it("gives a wide screen a panel of the screen's shape, a little above the middle", () => {
    const g = ringGeometry({ w: 1440, h: 900 });
    expect(g.narrow).toBe(false);
    expect(g.win.w / g.win.h).toBeCloseTo(1.6, 5);
    expect(g.win.w).toBeCloseTo(0.62 * 1440, 5);
    expect(g.win.x).toBeCloseTo((1440 - g.win.w) / 2, 5);
    // A 35 degree field of view.
    expect(g.perspective).toBeCloseTo(720 / Math.tan((17.5 * Math.PI) / 180), 3);
  });

  it("gives a phone portrait panels in its upper part", () => {
    const g = ringGeometry({ w: 390, h: 844 });
    expect(g.narrow).toBe(true);
    expect(g.win.w / g.win.h).toBeCloseTo(0.68, 5);
    const centre = project(placement(g, 0), g.view, g.perspective, 195, 422);
    expect(centre.y).toBeLessThan(844 * 0.42);
    expect(centre.y).toBeGreaterThan(844 * 0.3);
  });

  it("puts the front panel near the screen plane, the centre where the layout wants it", () => {
    for (const view of [
      { w: 1440, h: 900 },
      { w: 1920, h: 1080 },
      { w: 390, h: 844 },
    ]) {
      const g = ringGeometry(view);
      const c = project(placement(g, 0), g.view, g.perspective, view.w / 2, view.h / 2);
      expect(Math.abs(c.z)).toBeLessThan(g.win.w * 0.05);
      expect(c.x).toBeCloseTo(view.w / 2, 0);
      const want = g.narrow ? 0.36 * view.h : 0.47 * view.h;
      expect(Math.abs(c.y - want)).toBeLessThan(view.h * 0.02);
    }
  });

  it("puts the next panel to the right and further back, the one before to the left", () => {
    const g = ringGeometry({ w: 1440, h: 900 });
    const front = project(placement(g, 0), g.view, g.perspective, 720, 450);
    const next = project(placement(g, 1), g.view, g.perspective, 720, 450);
    const before = project(placement(g, -1), g.view, g.perspective, 720, 450);
    expect(next.x).toBeGreaterThan(front.x + g.win.w / 2);
    expect(before.x).toBeLessThan(front.x - g.win.w / 2);
    expect(next.z).toBeLessThan(front.z);
    expect(before.z).toBeLessThan(front.z);
  });
});

describe("placement", () => {
  it("lists the same functions as the flat transform, so the browser can animate between them", () => {
    const names = (list: string) => Array.from(list.matchAll(/(\w+)\(/gu), (m) => m[1]);
    const g = ringGeometry({ w: 1440, h: 900 });
    expect(names(placement(g, 0.37))).toEqual(names(FLAT));
  });

  it("is none at all when flat", () => {
    const m = parse(FLAT);
    m.forEach((v, i) => {
      expect(v).toBeCloseTo(I[i]!, 9);
    });
  });
});

describe("the window of a panel", () => {
  it("shows the whole full screen view on a wide screen, scaled down", () => {
    const g = ringGeometry({ w: 1440, h: 900 });
    const c = ringContent(g);
    expect(c.s).toBeCloseTo(g.win.w / 1440, 5);
    expect(c.x).toBeCloseTo(g.win.x, 3);
    expect(c.y).toBeCloseTo(g.win.y, 3);
  });

  it("shows a band of the full screen view on a phone, never outside it", () => {
    const g = ringGeometry({ w: 390, h: 844 });
    const c = ringContent(g);
    expect(c.x).toBeLessThanOrEqual(g.win.x + 1e-6);
    expect(c.y).toBeLessThanOrEqual(g.win.y + 1e-6);
    expect(c.x + 390 * c.s).toBeGreaterThanOrEqual(g.win.x + g.win.w - 1e-6);
    expect(c.y + 844 * c.s).toBeGreaterThanOrEqual(g.win.y + g.win.h - 1e-6);
  });

  it("is the screen in full view", () => {
    const g = ringGeometry({ w: 1440, h: 900 });
    expect(fullWindow(g)).toEqual({
      win: { x: 0, y: 0, w: 1440, h: 900 },
      content: { x: 0, y: 0, s: 1 },
    });
  });
});

describe("offsets", () => {
  it("wraps into the half open range around the front", () => {
    expect(wrapOffset(0, 10)).toBe(0);
    expect(wrapOffset(5, 10)).toBe(-5);
    expect(wrapOffset(-5, 10)).toBe(-5);
    expect(wrapOffset(9, 10)).toBe(-1);
    expect(wrapOffset(-9.5, 10)).toBeCloseTo(0.5, 9);
    expect(offsetOf(0, 9, 10)).toBe(1);
    expect(offsetOf(9, 0, 10)).toBe(-1);
    expect(wrapIndex(-1, 10)).toBe(9);
    expect(wrapIndex(10.2, 10)).toBe(0);
  });

  it("hides the far side of the ring", () => {
    expect(visibility(0)).toBe(1);
    expect(visibility(2)).toBe(1);
    expect(visibility(-2.7)).toBeCloseTo(0.5, 9);
    expect(visibility(3.5)).toBe(0);
    expect(visibility(-5)).toBe(0);
  });
});

describe("drag", () => {
  it("turns the ring towards the next panel when dragged to the left", () => {
    expect(dragTurn(-1440, 1440)).toBeCloseTo(0.75, 9);
    expect(dragTurn(300, 1440)).toBeLessThan(0);
  });

  it("springs back from a short drag, and goes on from a longer one", () => {
    expect(dragTarget(3, 3.02)).toBe(3);
    expect(dragTarget(3, 3.2)).toBe(4);
    expect(dragTarget(3, 2.9)).toBe(2);
    expect(dragTarget(3, 4.7)).toBe(5);
  });
});

describe("feedWheel", () => {
  it("makes one step a gesture, however long its momentum", () => {
    const m = newWheel();
    let t = 0;
    const steps: number[] = [];
    for (let i = 0; i < 40; i += 1) {
      t += 16;
      steps.push(feedWheel(m, 30 * Math.exp(-i / 10), t));
    }
    expect(steps.filter((s) => s !== 0)).toEqual([1]);
  });

  it("takes a new step after a pause, and goes back with an upward wheel", () => {
    const m = newWheel();
    expect(feedWheel(m, 100, 0)).toBe(1);
    expect(feedWheel(m, 100, 50)).toBe(0);
    expect(feedWheel(m, 100, 50 + WHEEL_GAP_MS + 1)).toBe(1);
    expect(feedWheel(m, -120, 1000)).toBe(-1);
  });
});
