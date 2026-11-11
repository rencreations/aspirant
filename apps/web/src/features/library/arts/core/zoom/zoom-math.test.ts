import { describe, expect, it } from "vitest";

import { clipLayers, composeLayers, type Box, type Rect } from "@/features/story/morph/morph-math";

import {
  canFlyTo,
  containBox,
  contains,
  contentRect,
  dragOffset,
  dragProgress,
  fadePose,
  intersect,
  morphFrames,
  neighbourIndexes,
  openLayout,
  poseAt,
  shouldDismiss,
  sourcePose,
  stepIndex,
  visibleFraction,
} from "./zoom-math";

const VIEW: Box = { w: 1440, h: 900 };
const PHONE: Box = { w: 390, h: 844 };

function near(a: number, b: number, digits = 5) {
  expect(a).toBeCloseTo(b, digits);
}

describe("containBox", () => {
  it("fits the width of a wide picture on a wide screen", () => {
    const b = containBox(VIEW, 16 / 9);
    near(b.w, 1440);
    near(b.h, 810);
  });

  it("fits the height when the picture is taller than the screen's shape", () => {
    const b = containBox(VIEW, 1);
    near(b.w, 900);
    near(b.h, 900);
    const tall = containBox(VIEW, 0.5);
    near(tall.h, 900);
    near(tall.w, 450);
  });

  it("never cuts: the box is inside the screen and keeps the shape", () => {
    for (const aspect of [0.2, 0.5, 0.75, 1, 1.78, 2.56, 5]) {
      for (const view of [VIEW, PHONE, { w: 1920, h: 1080 }, { w: 820, h: 1180 }]) {
        const b = containBox(view, aspect);
        expect(b.w).toBeLessThanOrEqual(view.w + 1e-9);
        expect(b.h).toBeLessThanOrEqual(view.h + 1e-9);
        near(b.w / b.h, aspect);
        // It touches the screen on at least one axis (it is as big as it can be).
        expect(Math.max(b.w / view.w, b.h / view.h)).toBeGreaterThan(1 - 1e-9);
      }
    }
  });

  it("survives a bad aspect", () => {
    expect(containBox(VIEW, 0).w).toBeGreaterThan(0);
    expect(containBox(VIEW, Number.NaN).h).toBeGreaterThan(0);
  });
});

describe("openLayout", () => {
  it("centres a fitted picture in the screen with a scale of 1", () => {
    const l = openLayout(VIEW, 1, "fit");
    expect(l.scrollable).toBe(false);
    near(l.open.c.s, 1);
    near(l.open.c.x, 270);
    near(l.open.c.y, 0);
    expect(l.open.win).toEqual({ x: 270, y: 0, w: 900, h: 900 });
  });

  it("a wide picture on a tall screen is fitted by its width, with bars above and below", () => {
    const l = openLayout(PHONE, 16 / 9, "fit");
    near(l.box.w, 390);
    near(l.open.c.y, (844 - 390 / (16 / 9)) / 2);
  });

  it("a tall strip in scroll mode fits the width and scrolls the rest", () => {
    const l = openLayout(VIEW, 1000 / 4950, "scroll");
    expect(l.scrollable).toBe(true);
    near(l.box.w, 1440);
    near(l.box.h, 1440 * 4.95);
    near(l.travel, 1440 * 4.95 - 900);
    expect(l.open.win).toEqual({ x: 0, y: 0, w: 1440, h: 900 });
    expect(l.open.c).toEqual({ x: 0, y: 0, s: 1 });
  });

  it("a strip that is not taller than the screen does not scroll", () => {
    const l = openLayout(VIEW, 2, "scroll");
    expect(l.scrollable).toBe(false);
    near(l.box.w, 1440);
    near(l.box.h, 720);
  });

  it("the open window is always the picture, or the screen for a strip", () => {
    for (const aspect of [0.3, 1, 1.78, 2.56]) {
      const l = openLayout(VIEW, aspect, "fit");
      expect(l.open.win).toEqual(contentRect(l.box, l.open));
    }
  });
});

describe("sourcePose", () => {
  const box: Box = { w: 1440, h: 810 };

  it("a whole picture in a tile of its own shape starts as the tile", () => {
    const tile: Rect = { x: 100, y: 200, w: 480, h: 270 };
    const p = sourcePose(tile, undefined, box, VIEW);
    near(p.c.s, 480 / 1440);
    expect(p.win).toEqual(tile);
    const r = contentRect(box, p);
    near(r.x, tile.x);
    near(r.y, tile.y);
    near(r.w, tile.w);
    near(r.h, tile.h);
  });

  it("a frame fills the tile like object-fit cover, centred on the frame", () => {
    // A 1:1 picture shown through a 16:9 window that starts a third of the way down.
    const square: Box = { w: 900, h: 900 };
    const frame = { x: 0, y: 0.2, w: 1, h: 0.5625 };
    const tile: Rect = { x: 50, y: 60, w: 640, h: 360 };
    const p = sourcePose(tile, frame, square, VIEW);
    near(p.c.s, 640 / 900);
    // The top left of the frame lands on the top left of the tile.
    near(p.c.x + frame.x * 900 * p.c.s, tile.x);
    near(p.c.y + frame.y * 900 * p.c.s, tile.y);
    const r = contentRect(square, p);
    expect(contains(r, tile)).toBe(true);
  });

  it("a tile of another shape than its frame is covered, never stretched", () => {
    const tile: Rect = { x: 0, y: 0, w: 400, h: 400 };
    const p = sourcePose(tile, { x: 0, y: 0, w: 1, h: 1 }, box, VIEW);
    // Cover: the scale takes the long side, so the picture is wider than the tile.
    near(p.c.s, 400 / 810);
    expect(contains(contentRect(box, p), tile)).toBe(true);
  });

  it("only the part of a tile that is on the screen is the window", () => {
    const tile: Rect = { x: -100, y: 700, w: 400, h: 400 };
    const p = sourcePose(tile, undefined, { w: 800, h: 800 }, VIEW);
    expect(p.win).toEqual({ x: 0, y: 700, w: 300, h: 200 });
  });

  it("ignores a frame that makes no sense", () => {
    const a = sourcePose({ x: 0, y: 0, w: 100, h: 100 }, { x: 0, y: 0, w: 0, h: 0 }, box, VIEW);
    const b = sourcePose({ x: 0, y: 0, w: 100, h: 100 }, undefined, box, VIEW);
    expect(a).toEqual(b);
  });
});

describe("the move", () => {
  const cases: Array<{
    name: string;
    tile: Rect;
    frame?: { x: number; y: number; w: number; h: number };
    aspect: number;
    mode?: "fit" | "scroll";
  }> = [
    { name: "a 16:9 tile", tile: { x: 120, y: 300, w: 400, h: 225 }, aspect: 16 / 9 },
    {
      name: "a window on a square",
      tile: { x: 700, y: 120, w: 480, h: 270 },
      frame: { x: 0, y: 0.18, w: 1, h: 0.5625 },
      aspect: 1,
    },
    {
      name: "a tile that is cut by the screen",
      tile: { x: 1300, y: 700, w: 400, h: 400 },
      aspect: 1,
    },
    {
      name: "a tall tile",
      tile: { x: 300, y: -200, w: 220, h: 1100 },
      aspect: 1000 / 4950,
      mode: "scroll",
    },
    { name: "an ultra wide tile", tile: { x: 40, y: 500, w: 900, h: 300 }, aspect: 3 },
  ];

  for (const c of cases) {
    it(`${c.name}: the window stays inside the picture, the scale stays uniform, nothing stretches`, () => {
      const layout = openLayout(VIEW, c.aspect, c.mode ?? "fit");
      const from = sourcePose(c.tile, c.frame, layout.box, VIEW);
      for (let i = 0; i <= 20; i += 1) {
        const t = i / 20;
        const at = poseAt(from, layout.open, t);
        // The picture is always larger than its window, so no blank shows.
        expect(contains(contentRect(layout.box, at), at.win, 0.5)).toBe(true);
        // One scale for both axes: the content box keeps its shape.
        const r = contentRect(layout.box, at);
        near(r.w / r.h, layout.box.w / layout.box.h, 4);
      }
    });

    it(`${c.name}: the layers compose back to the pose at every step`, () => {
      const layout = openLayout(VIEW, c.aspect, c.mode ?? "fit");
      const from = sourcePose(c.tile, c.frame, layout.box, VIEW);
      for (const t of [0, 0.25, 0.5, 0.8, 1]) {
        const at = poseAt(from, layout.open, t);
        const composed = composeLayers(clipLayers(at.win, at.c, VIEW), VIEW);
        near(composed.content.x, at.c.x, 4);
        near(composed.content.y, at.c.y, 4);
        near(composed.content.s, at.c.s, 4);
        // The visible window is the pose's window cut to the screen.
        const shown = intersect(at.win, { x: 0, y: 0, w: VIEW.w, h: VIEW.h });
        expect(shown).not.toBeNull();
        near(composed.win.x, shown!.x, 3);
        near(composed.win.y, shown!.y, 3);
        near(composed.win.w, shown!.w, 3);
        near(composed.win.h, shown!.h, 3);
      }
    });

    it(`${c.name}: the end of the move is the open pose`, () => {
      const layout = openLayout(VIEW, c.aspect, c.mode ?? "fit");
      const from = sourcePose(c.tile, c.frame, layout.box, VIEW);
      expect(poseAt(from, layout.open, 1)).toEqual(layout.open);
      expect(poseAt(from, layout.open, 0)).toEqual(from);
    });
  }

  it("writes two keyframes for each layer", () => {
    const layout = openLayout(VIEW, 16 / 9);
    const from = sourcePose({ x: 100, y: 100, w: 400, h: 225 }, undefined, layout.box, VIEW);
    const f = morphFrames(from, layout.open, VIEW);
    for (const pair of [f.outer, f.inner, f.counter, f.content]) {
      expect(pair).toHaveLength(2);
      expect(pair[0]).not.toBe(pair[1]);
    }
    // The content only moves and scales uniformly.
    expect(f.content[0]).toMatch(/^translate\([^)]+\) scale\([\d.]+\)$/u);
    // A 16:9 picture on 1440 by 900 stands 45 px down, at its own size.
    expect(f.content[1]).toBe("translate(0px, 45px) scale(1)");
  });
});

describe("fadePose", () => {
  it("shrinks the window and the content together toward the middle of the screen", () => {
    const layout = openLayout(VIEW, 16 / 9);
    const p = fadePose(layout.open, VIEW);
    near(p.c.s, 0.96);
    near(p.win.w, 1440 * 0.96);
    // Still inside: a fade never shows a blank edge either.
    expect(contains(contentRect(layout.box, p), p.win)).toBe(true);
    const mid = { x: VIEW.w / 2, y: VIEW.h / 2 };
    near(p.win.x + p.win.w / 2, mid.x);
    near(p.win.y + p.win.h / 2, mid.y);
  });
});

describe("where the picture can fly to", () => {
  it("flies to a tile that is on the screen", () => {
    expect(canFlyTo({ x: 100, y: 100, w: 300, h: 200 }, VIEW)).toBe(true);
  });

  it("fades out when the tile is off the screen, empty or barely there", () => {
    expect(canFlyTo(null, VIEW)).toBe(false);
    expect(canFlyTo({ x: 0, y: 2000, w: 300, h: 200 }, VIEW)).toBe(false);
    expect(canFlyTo({ x: 0, y: 0, w: 0, h: 0 }, VIEW)).toBe(false);
    expect(canFlyTo({ x: 100, y: 895, w: 400, h: 300 }, VIEW)).toBe(false);
  });

  it("flies to a very tall tile when a good part of it shows", () => {
    expect(canFlyTo({ x: 300, y: -400, w: 220, h: 1500 }, VIEW)).toBe(true);
  });

  it("measures how much of a tile shows", () => {
    near(visibleFraction({ x: -100, y: 0, w: 200, h: 100 }, VIEW), 0.5);
    near(visibleFraction({ x: 0, y: 0, w: 100, h: 100 }, VIEW), 1);
    near(visibleFraction({ x: 5000, y: 0, w: 100, h: 100 }, VIEW), 0);
  });
});

describe("neighbours", () => {
  it("steps within the list and stops at the ends", () => {
    expect(stepIndex(3, 1, 10)).toBe(4);
    expect(stepIndex(3, -1, 10)).toBe(2);
    expect(stepIndex(0, -1, 10)).toBeNull();
    expect(stepIndex(9, 1, 10)).toBeNull();
  });

  it("lists the next picture first, then the one before", () => {
    expect(neighbourIndexes(5, 10)).toEqual([6, 4]);
    expect(neighbourIndexes(0, 10)).toEqual([1]);
    expect(neighbourIndexes(9, 10)).toEqual([8]);
    expect(neighbourIndexes(0, 1)).toEqual([]);
  });
});

describe("swipe down", () => {
  it("lets go after a long pull or a quick flick", () => {
    expect(shouldDismiss(120, 0)).toBe(true);
    expect(shouldDismiss(50, 0.8)).toBe(true);
    expect(shouldDismiss(50, 0.2)).toBe(false);
    expect(shouldDismiss(-200, 2)).toBe(false);
  });

  it("follows the finger down, less so up", () => {
    expect(dragOffset(100)).toBe(100);
    expect(dragOffset(-100)).toBe(-25);
    near(dragProgress(360, 900), 1);
    near(dragProgress(0, 900), 0);
  });
});
