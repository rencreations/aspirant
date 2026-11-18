import { describe, expect, it } from "vitest";

import { BookState, OPEN_V, TURN_SECONDS, boardAngles, pageTurn, popScale } from "./book";

describe("the book's boards", () => {
  it("lies shut with the front board behind the back one, and open with a gentle V", () => {
    const shut = boardAngles(0);
    expect(shut.front).toBeCloseTo(Math.PI, 6);
    expect(shut.back).toBeCloseTo(0, 6);
    const open = boardAngles(1);
    expect(open.front).toBeCloseTo(OPEN_V, 6);
    expect(open.back).toBeCloseTo(-OPEN_V, 6);
  });

  it("opens monotonically: the front board only ever swings one way", () => {
    let last = Math.PI + 1;
    for (let i = 0; i <= 50; i += 1) {
      const a = boardAngles(i / 50).front;
      expect(a).toBeLessThanOrEqual(last + 1e-9);
      last = a;
    }
  });
});

describe("a page turn", () => {
  it("goes from flat on the right to flat on the left, rising over the top in between", () => {
    expect(pageTurn(0)).toEqual({ angle: 0, lift: 0, bend: 0 });
    const end = pageTurn(1);
    expect(end.angle).toBeCloseTo(Math.PI, 6);
    expect(end.lift).toBeCloseTo(0, 6);
    expect(pageTurn(0.5).lift).toBeCloseTo(1, 6);
    let last = -1;
    for (let i = 0; i <= 40; i += 1) {
      const a = pageTurn(i / 40).angle;
      expect(a).toBeGreaterThanOrEqual(last);
      last = a;
    }
  });
});

describe("the pop", () => {
  it("is nothing before the book is out, rises past one and ends on one", () => {
    expect(popScale(0)).toBe(0);
    let peak = 0;
    for (let i = 1; i <= 100; i += 1) peak = Math.max(peak, popScale(i / 100));
    expect(peak).toBeGreaterThan(1.02);
    expect(popScale(1)).toBeCloseTo(1, 6);
  });
});

describe("the book's state", () => {
  it("comes out first and opens after, then shuts first and goes after", () => {
    const b = new BookState();
    b.wantPresent = 1;
    b.wantOpen = 1;
    let openedAt = -1;
    let outAt = -1;
    for (let i = 0; i < 240; i += 1) {
      b.step(1 / 60);
      if (outAt < 0 && b.present.x > 0.9) outAt = i;
      if (openedAt < 0 && b.open.x > 0.9) openedAt = i;
    }
    expect(outAt).toBeGreaterThan(0);
    expect(openedAt).toBeGreaterThan(outAt);
    expect(b.open.x).toBeGreaterThan(0.98);

    b.wantPresent = 0;
    b.wantOpen = 0;
    let shutAt = -1;
    let goneAt = -1;
    for (let i = 0; i < 300; i += 1) {
      b.step(1 / 60);
      if (shutAt < 0 && b.open.x < 0.1) shutAt = i;
      if (goneAt < 0 && b.present.x < 0.1) goneAt = i;
    }
    expect(shutAt).toBeGreaterThan(0);
    expect(goneAt).toBeGreaterThan(0);
  });

  it("turns a page only when it is open, one at a time, and counts it", () => {
    const b = new BookState();
    expect(b.turnPage()).toBe(false);
    b.wantPresent = 1;
    b.wantOpen = 1;
    b.snap();
    expect(b.turnPage()).toBe(true);
    expect(b.turnPage()).toBe(false);
    for (let t = 0; t < TURN_SECONDS + 0.1; t += 1 / 60) b.step(1 / 60);
    expect(b.turning).toBe(-1);
    expect(b.turned).toBe(1);
  });

  it("snaps to what is asked, with nothing moving", () => {
    const b = new BookState();
    b.wantPresent = 1;
    b.wantOpen = 1;
    b.snap();
    expect(b.present.x).toBe(1);
    expect(b.open.x).toBe(1);
    expect(b.open.v).toBe(0);
  });
});
