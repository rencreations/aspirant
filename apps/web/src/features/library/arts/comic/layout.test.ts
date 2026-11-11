import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  PAN_BELOW,
  PAN_H,
  SPAN_ALWAYS,
  SPAN_MIN,
  SPAN_TOLERANCE,
  TWO_LANES_FROM,
  anchorAt,
  firstScreenIndexes,
  metricsFor,
  pickSize,
  planComic,
  ratioOf,
  scrollForTile,
  takesBothLanes,
  visibleIndexes,
  yOfAnchor,
  type ComicPlan,
  type Shape,
} from "./layout";

const sq = (w: number, ratio: number): Shape => ({ w, h: Math.round(w / ratio) });

function overlap(a: { x: number; y: number; w: number; h: number }, b: typeof a): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

function noOverlap(plan: ComicPlan): void {
  const t = plan.tiles;
  for (let i = 0; i < t.length; i++) {
    for (let j = i + 1; j < t.length; j++) {
      const a = t[i]!;
      const b = t[j]!;
      expect(overlap(a, b), `tiles ${String(i)} and ${String(j)} overlap`).toBe(false);
    }
  }
}

describe("metricsFor", () => {
  it("uses one lane on a phone and two on a wider page", () => {
    expect(metricsFor(358, 844).lanes).toBe(1);
    expect(metricsFor(TWO_LANES_FROM - 1, 900).lanes).toBe(1);
    expect(metricsFor(TWO_LANES_FROM, 900).lanes).toBe(2);
    expect(metricsFor(1344, 900).lanes).toBe(2);
  });

  it("splits the box into two lanes and a gap, and leaves one lane whole", () => {
    const wide = metricsFor(1344, 900);
    expect(wide.laneW * 2 + wide.gap).toBeLessThanOrEqual(1344);
    expect(wide.laneW * 2 + wide.gap).toBeGreaterThan(1340);
    const phone = metricsFor(358, 844);
    expect(phone.laneW).toBe(358);
  });

  it("keeps the gap within its floor and ceiling", () => {
    expect(metricsFor(700, 900).gap).toBeGreaterThanOrEqual(16);
    expect(metricsFor(2400, 900).gap).toBeLessThanOrEqual(28);
  });
});

describe("planComic, two lanes", () => {
  const m = metricsFor(1344, 900);

  it("puts a tall strip at the full width of its lane, as tall as its shape makes it", () => {
    const plan = planComic([sq(1000, 0.3)], m);
    const t = plan.tiles[0]!;
    expect(t.w).toBe(m.laneW);
    expect(Math.abs(t.h - m.laneW / (1000 / Math.round(1000 / 0.3)))).toBeLessThan(1);
    expect(t.h).toBeGreaterThan(m.laneW * 3);
    expect(t.span).toBe(false);
  });

  it("alternates between the lanes, the shorter first, the left on a tie", () => {
    const plan = planComic([sq(2000, 0.5), sq(2000, 1), sq(2000, 1), sq(2000, 1)], m);
    expect(plan.tiles.map((t) => t.lane)).toEqual([0, 1, 1, 0]);
    // The strip is 1312 tall and each square 656: two squares and a gap make the right lane longer.
    expect(plan.tiles[1]!.y).toBe(0);
    expect(plan.tiles[2]!.y).toBe(plan.tiles[1]!.h + m.gap);
  });

  it("never draws a tile wider than its own pixels, and centres it in its lane", () => {
    const plan = planComic([sq(342, 0.28), sq(500, 1)], m);
    const small = plan.tiles[0]!;
    expect(small.w).toBe(342);
    expect(small.x).toBe(Math.round((m.laneW - 342) / 2));
    const second = plan.tiles[1]!;
    expect(second.w).toBe(500);
    expect(second.x).toBe(m.laneW + m.gap + Math.round((m.laneW - 500) / 2));
  });

  it("keeps the top edges from going up, so the file order reads down the page", () => {
    const shapes = Array.from({ length: 60 }, (_, i) => sq(1000, 0.25 + ((i * 37) % 100) / 40));
    const plan = planComic(shapes, m);
    for (let i = 1; i < plan.tiles.length; i++) {
      expect(plan.tiles[i]!.y).toBeGreaterThanOrEqual(plan.tiles[i - 1]!.y);
    }
  });

  it("never lets two tiles overlap, whatever the shapes", () => {
    let seed = 7;
    const next = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    for (const width of [360, 700, 820, 1000, 1344, 1480]) {
      const shapes = Array.from({ length: 80 }, () =>
        sq(300 + Math.round(next() * 2200), 0.2 + next() * 3.2),
      );
      noOverlap(planComic(shapes, metricsFor(width, 900)));
    }
  });

  it("gives the box a height that ends at the last tile", () => {
    const plan = planComic([sq(1000, 1), sq(1000, 0.4), sq(1000, 1)], m);
    const bottom = Math.max(...plan.tiles.map((t) => t.y + t.h));
    expect(plan.height).toBe(bottom);
    expect(planComic([], m).height).toBe(0);
  });

  it("a very wide picture takes both lanes at the foot of the taller one", () => {
    const plan = planComic([sq(2500, 0.5), sq(2500, 1), sq(2500, 3.2)], m);
    const wide = plan.tiles[2]!;
    expect(wide.span).toBe(true);
    expect(wide.w).toBe(m.width);
    expect(wide.x).toBe(0);
    expect(wide.y).toBe(Math.max(...plan.tiles.slice(0, 2).map((t) => t.y + t.h + m.gap)));
    // Both lanes start level under it.
    const after = planComic(
      [sq(2500, 0.5), sq(2500, 1), sq(2500, 3.2), sq(2500, 1), sq(2500, 1)],
      m,
    );
    expect(after.tiles[3]!.y).toBe(after.tiles[4]!.y);
  });

  it("a wide picture of a small source spans at its own width, centred", () => {
    const plan = planComic([sq(1000, 3.2)], m);
    const t = plan.tiles[0]!;
    expect(t.span).toBe(true);
    expect(t.w).toBe(1000);
    expect(t.x).toBe(Math.round((m.width - 1000) / 2));
  });

  it("a moderately wide picture spans only when the lanes are near each other", () => {
    const flat = sq(2500, 2);
    // Level lanes: it spans.
    expect(planComic([flat], m).tiles[0]!.span).toBe(true);
    // One lane far taller: it takes the shorter lane at lane width.
    const far = planComic([sq(2500, 0.25), flat], m);
    expect(far.tiles[1]!.span).toBe(false);
    expect(far.tiles[1]!.lane).toBe(1);
    expect(far.tiles[1]!.w).toBe(m.laneW);
  });

  it("a picture flatter than the span floor never spans", () => {
    const plan = planComic([sq(2500, SPAN_MIN - 0.05)], m);
    expect(plan.tiles[0]!.span).toBe(false);
  });

  it("starts a new comic on a clean line", () => {
    const shapes = [sq(1000, 0.25), sq(1000, 1), sq(1000, 1)];
    const plan = planComic(shapes, m, ["a", "a", "b"]);
    const third = plan.tiles[2]!;
    const above = Math.max(...plan.tiles.slice(0, 2).map((t) => t.y + t.h));
    expect(third.y).toBe(above + 2 * m.gap);
    expect(third.lane).toBe(0);
  });

  it("does not make pan strips", () => {
    const plan = planComic([sq(1000, 3.2)], metricsFor(1000, 900));
    expect(plan.tiles.every((t) => t.pan === 0)).toBe(true);
  });
});

describe("takesBothLanes", () => {
  const m = metricsFor(1344, 900);
  it("always spans a ribbon, and a moderately wide one only within the tolerance", () => {
    expect(takesBothLanes(SPAN_ALWAYS, 5000, m)).toBe(true);
    expect(takesBothLanes(2, SPAN_TOLERANCE * m.laneW, m)).toBe(true);
    expect(takesBothLanes(2, SPAN_TOLERANCE * m.laneW + 1, m)).toBe(false);
    expect(takesBothLanes(1.5, 0, m)).toBe(false);
  });

  it("never spans on one lane", () => {
    expect(takesBothLanes(3, 0, metricsFor(358, 844))).toBe(false);
  });
});

describe("planComic, one lane", () => {
  const m = metricsFor(358, 844);

  it("stacks every picture at the width of the screen", () => {
    const plan = planComic([sq(1000, 0.3), sq(1000, 1), sq(1000, 1.6)], m);
    expect(plan.tiles.every((t) => t.lane === 0 && !t.span)).toBe(true);
    expect(plan.tiles.map((t) => t.w)).toEqual([358, 358, 358]);
    expect(plan.tiles[1]!.y).toBe(plan.tiles[0]!.h + m.gap);
    noOverlap(plan);
  });

  it("stands a ribbon taller and lets it slide, so what is drawn in it can be seen", () => {
    const plan = planComic([sq(1000, 3.2)], m);
    const t = plan.tiles[0]!;
    expect(t.pan).toBeGreaterThan(t.w);
    expect(t.h).toBeGreaterThanOrEqual(PAN_H - 2);
    expect(t.pan / t.h).toBeCloseTo(3.2, 1);
    expect(358 / 3.2).toBeLessThan(PAN_BELOW);
  });

  it("leaves a picture that is tall enough as it is", () => {
    const plan = planComic([sq(1000, 2)], m);
    expect(plan.tiles[0]!.pan).toBe(0);
    expect(plan.tiles[0]!.h).toBe(179);
  });

  it("does not slide a picture past its own pixels", () => {
    const plan = planComic([sq(420, 3.2)], m);
    const t = plan.tiles[0]!;
    expect(t.pan).toBeLessThanOrEqual(420);
  });
});

describe("pickSize", () => {
  it("asks for the preview unless the tile is wider than the preview fills", () => {
    expect(pickSize(660, 1, 2500)).toBe("p");
    expect(pickSize(660, 2, 2500)).toBe("p");
    expect(pickSize(1344, 1, 2500)).toBe("p");
    expect(pickSize(1344, 2, 2500)).toBe("f");
  });

  it("never asks for more than a source that fits the preview has", () => {
    expect(pickSize(1000, 3, 1000)).toBe("p");
  });
});

describe("the first screen", () => {
  const m = metricsFor(1344, 900);
  const shapes = [sq(1000, 0.3), sq(1000, 1), sq(1000, 1), sq(1000, 1), sq(1000, 1), sq(1000, 1)];
  const plan = planComic(shapes, m);

  it("holds the tiles that start above the fold", () => {
    const seen = firstScreenIndexes(plan, 340, 900, 8);
    expect(seen).toContain(0);
    expect(seen).toContain(1);
    expect(seen).not.toContain(5);
  });

  it("is capped", () => {
    expect(firstScreenIndexes(plan, 0, 100000, 3)).toHaveLength(3);
  });

  it("follows the scroll", () => {
    const far = visibleIndexes(plan, 340, plan.height - 900, 900);
    expect(far).not.toContain(1);
  });
});

describe("anchors", () => {
  const m = metricsFor(1344, 900);
  const shapes = [sq(1000, 0.5), sq(1000, 1), sq(1000, 1), sq(1000, 0.5)];

  it("find the tile at a height and the way back in another plan", () => {
    const plan = planComic(shapes, m);
    const y = plan.tiles[2]!.y + plan.tiles[2]!.h / 2;
    const anchor = anchorAt(plan, y)!;
    expect(anchor.index).toBe(2);
    expect(anchor.frac).toBeCloseTo(0.5, 2);
    const narrow = planComic(shapes, metricsFor(358, 844));
    const there = yOfAnchor(narrow, anchor)!;
    expect(there).toBeCloseTo(narrow.tiles[2]!.y + narrow.tiles[2]!.h / 2, 0);
  });

  it("take the nearest tile when the height is in a gap", () => {
    const plan = planComic(shapes, metricsFor(358, 844));
    const a = plan.tiles[0]!;
    const anchor = anchorAt(plan, a.y + a.h + 4);
    expect(anchor?.index).toBe(0);
    expect(anchor?.frac).toBe(1);
  });

  it("have none in an empty plan", () => {
    expect(anchorAt(planComic([], m), 10)).toBeNull();
  });
});

describe("scrollForTile", () => {
  it("centres a tile that fits and shows the top of a strip", () => {
    const plan = planComic(
      [sq(1000, 0.5), sq(1000, 1), sq(1000, 1), sq(1000, 1)],
      metricsFor(1344, 900),
    );
    const strip = plan.tiles[0]!;
    expect(scrollForTile(strip, 340, 900, 96, 99999)).toBe(Math.max(0, 340 + strip.y - 96 - 16));
    const square = plan.tiles[3]!;
    const y = scrollForTile(square, 340, 900, 96, 99999);
    // Its middle is in the middle of the free part of the screen.
    expect(340 + square.y + square.h / 2 - y).toBeCloseTo(96 + (900 - 96) / 2, 0);
  });

  it("stays inside the page", () => {
    const plan = planComic([sq(1000, 1)], metricsFor(1344, 900));
    expect(scrollForTile(plan.tiles[0]!, 340, 900, 96, 0)).toBe(0);
  });
});

describe("ratioOf", () => {
  it("is the shape's own, and a square for a broken one", () => {
    expect(ratioOf({ w: 1000, h: 500 })).toBe(2);
    expect(ratioOf({ w: 0, h: 500 })).toBe(1);
  });
});

// The real panels ---------------------------------------------------------------------------

interface Row {
  comic: string;
  page: number;
  img: { w: number; h: number };
}

const file = JSON.parse(
  readFileSync(
    path.resolve(import.meta.dirname, "../../../../../public/data/library/arts-comic.json"),
    "utf8",
  ),
) as { items: Row[] };

describe("the 114 panels of the file", () => {
  const shapes = file.items.map((item) => ({ w: item.img.w, h: item.img.h }));
  const groups = file.items.map((item) => item.comic);

  it("are in reading order: the comic, then the page", () => {
    const order = ["the-aspirant", "guinevere-vexana"];
    for (let i = 1; i < file.items.length; i++) {
      const a = file.items[i - 1]!;
      const b = file.items[i]!;
      const ca = order.indexOf(a.comic);
      const cb = order.indexOf(b.comic);
      expect(cb).toBeGreaterThanOrEqual(ca);
      if (ca === cb) expect(b.page).toBeGreaterThanOrEqual(a.page);
    }
  });

  for (const width of [358, 762, 1344, 1480]) {
    it(`fit a box ${String(width)} px wide: nothing overlaps and nothing is wider than its pixels`, () => {
      const plan = planComic(shapes, metricsFor(width, 900), groups);
      expect(plan.tiles).toHaveLength(file.items.length);
      noOverlap(plan);
      plan.tiles.forEach((t, i) => {
        expect(t.w).toBeLessThanOrEqual(shapes[i]!.w);
        expect(t.x).toBeGreaterThanOrEqual(0);
        expect(t.x + t.w).toBeLessThanOrEqual(width);
      });
    });
  }

  it("keep the widest strip at a readable size on a desktop", () => {
    const plan = planComic(shapes, metricsFor(1344, 900), groups);
    const ratios = shapes.map((s) => s.w / s.h);
    const widest = ratios.indexOf(Math.max(...ratios));
    const t = plan.tiles[widest]!;
    expect(t.span).toBe(true);
    expect(t.w).toBeGreaterThanOrEqual(1000);
  });

  it("leave no hole beside a tall strip bigger than a lane and a half", () => {
    const m = metricsFor(1344, 900);
    const plan = planComic(shapes, m, groups);
    // A spanning tile sits at the foot of both lanes: the free space above it is the hole.
    const spans = plan.tiles.filter((t) => t.span);
    for (const s of spans) {
      const lane = (n: 0 | 1) =>
        Math.max(
          0,
          ...plan.tiles
            .filter((t) => t.y < s.y && (t.span || t.lane === n))
            .map((t) => t.y + t.h + m.gap),
        );
      const hole = Math.abs(lane(0) - lane(1));
      expect(hole).toBeLessThanOrEqual(m.laneW * 1.5);
    }
  });
});
