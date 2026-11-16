import { describe, expect, it } from "vitest";

import {
  feedOf,
  groupOf,
  pinnedFirst,
  previewWindow,
  revealOffset,
  splitGroups,
  stepIndex,
  two,
  wheelBelongs,
} from "./video-logic";

describe("pinnedFirst", () => {
  it("puts the pinned videos first and keeps each group in its order", () => {
    const list = [
      { id: "a", pinned: false },
      { id: "b", pinned: true },
      { id: "c", pinned: false },
      { id: "d", pinned: true },
    ];
    expect(pinnedFirst(list).map((v) => v.id)).toEqual(["b", "d", "a", "c"]);
  });

  it("leaves a list that is already in order as it is, and does not touch the one given", () => {
    const list = [
      { id: "a", pinned: true },
      { id: "b", pinned: false },
    ];
    const out = pinnedFirst(list);
    expect(out).toEqual(list);
    expect(out).not.toBe(list);
  });
});

describe("stepIndex", () => {
  it("moves with both pairs of arrows and goes round at the ends", () => {
    expect(stepIndex("ArrowDown", 0, 4)).toBe(1);
    expect(stepIndex("ArrowRight", 3, 4)).toBe(0);
    expect(stepIndex("ArrowUp", 0, 4)).toBe(3);
    expect(stepIndex("ArrowLeft", 2, 4)).toBe(1);
  });

  it("goes to the ends with Home and End", () => {
    expect(stepIndex("Home", 2, 9)).toBe(0);
    expect(stepIndex("End", 2, 9)).toBe(8);
  });

  it("leaves every other key, and an empty list, alone", () => {
    expect(stepIndex("Enter", 1, 4)).toBeNull();
    expect(stepIndex("a", 1, 4)).toBeNull();
    expect(stepIndex("ArrowDown", 0, 0)).toBeNull();
  });
});

describe("wheelBelongs", () => {
  it("is the page's when the list does not scroll", () => {
    expect(wheelBelongs(100, 0, 400, 400)).toBe(false);
    expect(wheelBelongs(-100, 0, 400, 400.6)).toBe(false);
  });

  it("is the list's while the list can still move that way", () => {
    expect(wheelBelongs(100, 0, 400, 700)).toBe(true);
    expect(wheelBelongs(-100, 120, 400, 700)).toBe(true);
    expect(wheelBelongs(100, 120, 400, 700)).toBe(true);
  });

  it("is the page's at the end the wheel turns toward", () => {
    expect(wheelBelongs(-100, 0, 400, 700)).toBe(false);
    expect(wheelBelongs(100, 300, 400, 700)).toBe(false);
    expect(wheelBelongs(100, 299.8, 400, 700)).toBe(false);
    expect(wheelBelongs(0, 100, 400, 700)).toBe(false);
  });
});

describe("revealOffset", () => {
  it("stays where it is when the row is in view", () => {
    expect(revealOffset(120, 60, 100, 300, 8)).toBe(100);
  });

  it("moves back to a row above the view, and never past the start", () => {
    expect(revealOffset(40, 60, 100, 300, 8)).toBe(32);
    expect(revealOffset(4, 60, 100, 300, 8)).toBe(0);
  });

  it("moves on to a row below the view", () => {
    expect(revealOffset(380, 60, 100, 300, 8)).toBe(148);
  });
});

describe("two", () => {
  it("writes a count two figures wide", () => {
    expect(two(4)).toBe("04");
    expect(two(12)).toBe("12");
  });
});

describe("groupOf and splitGroups", () => {
  it("sorts by the shape of the picture", () => {
    expect(groupOf(2.37)).toBe("films");
    expect(groupOf(1)).toBe("films");
    expect(groupOf(0.5625)).toBe("others");
  });

  it("keeps the places of each kind in the order of the list", () => {
    const list = [{ ratio: 2.37 }, { ratio: 0.56 }, { ratio: 1.78 }, { ratio: 0.65 }];
    expect(splitGroups(list)).toEqual({ films: [0, 2], others: [1, 3] });
  });

  it("leaves a kind empty when the list has none of it", () => {
    expect(splitGroups([{ ratio: 1.78 }])).toEqual({ films: [0], others: [] });
  });
});

describe("previewWindow", () => {
  it("shows a short clip whole", () => {
    expect(previewWindow(11.67)).toEqual({ start: 0, end: 11.67 });
    expect(previewWindow(20)).toEqual({ start: 0, end: 20 });
  });

  it("starts a longer film a little way in and shows sixteen seconds", () => {
    expect(previewWindow(100)).toEqual({ start: 8, end: 24 });
    const live = previewWindow(1367);
    expect(live.start).toBe(12);
    expect(live.end).toBe(28);
  });

  it("never runs past the end", () => {
    const w = previewWindow(21);
    expect(w.start).toBeCloseTo(1.68);
    expect(w.end).toBeCloseTo(17.68);
    expect(w.end).toBeLessThanOrEqual(21);
  });

  it("gives nothing for a length it cannot read", () => {
    expect(previewWindow(0)).toEqual({ start: 0, end: 0 });
    expect(previewWindow(Number.NaN)).toEqual({ start: 0, end: 0 });
  });
});

describe("feedOf", () => {
  const on = { near: true, seen: true, shown: true, covered: false };

  it("plays only when everything allows it", () => {
    expect(feedOf(on)).toBe("play");
  });

  it("holds its frame off screen, in a hidden tab and under the player", () => {
    expect(feedOf({ ...on, seen: false })).toBe("hold");
    expect(feedOf({ ...on, shown: false })).toBe("hold");
    expect(feedOf({ ...on, covered: true })).toBe("hold");
  });

  it("lets its file go when the deck is far", () => {
    expect(feedOf({ ...on, near: false })).toBe("none");
  });
});
