import { describe, expect, it } from "vitest";

import { DRAMA_NODES } from "@/features/character/vexana/drama/drama-graph";

import {
  chapterOf,
  countWord,
  DRAMA_EDGES,
  DRAMA_ENDINGS,
  DRAMA_TREE,
  edgeCurve,
  filmOfStill,
  laneOf,
  pointOf,
} from "./drama-tree";

describe("the tree of the drama", () => {
  it("is the tree of the game itself", () => {
    expect(DRAMA_TREE.map((n) => n.id).sort()).toEqual(DRAMA_NODES.map((n) => n.id).sort());
    for (const node of DRAMA_NODES) {
      const mine = DRAMA_TREE.find((n) => n.id === node.id);
      expect(mine?.to, node.id).toEqual(node.choices.map((choice) => choice.to));
      expect(mine?.chapter, node.id).toBe(node.chapter - 1);
    }
  });

  it("has thirteen films, twenty answers and three endings in six chapters", () => {
    expect(DRAMA_TREE).toHaveLength(13);
    expect(DRAMA_EDGES).toHaveLength(20);
    expect(DRAMA_ENDINGS).toBe(3);
    expect(new Set(DRAMA_TREE.map((n) => n.chapter)).size).toBe(6);
  });

  it("only ever leads forward", () => {
    for (const edge of DRAMA_EDGES)
      expect(chapterOf(edge.to), `${edge.from} to ${edge.to}`).toBeGreaterThan(
        chapterOf(edge.from),
      );
  });

  it("spreads the films of a chapter evenly over the lanes", () => {
    expect(laneOf(0, 1)).toBe(0);
    expect([laneOf(0, 2), laneOf(1, 2)]).toEqual([-1, 1]);
    expect([laneOf(0, 3), laneOf(1, 3), laneOf(2, 3)]).toEqual([-1, 0, 1]);
    expect(DRAMA_TREE.find((n) => n.id === "1")?.lane).toBe(0);
    expect(DRAMA_TREE.find((n) => n.id === "5B")?.lane).toBe(0);
    expect(DRAMA_TREE.find((n) => n.id === "6C")?.lane).toBe(1);
  });

  it("names the film of a still", () => {
    expect(filmOfStill("drama-1")).toBe("1");
    expect(filmOfStill("drama-4b")).toBe("4B");
    for (const id of ["1", "2a", "3a", "4b", "5c", "6c"])
      expect(DRAMA_TREE.some((n) => n.id === filmOfStill(`drama-${id}`))).toBe(true);
  });
});

describe("the drawing of the tree", () => {
  const size = { across: 1200, span: 280, chapters: 6 };

  it("runs the chapters along the page, or down it when upright", () => {
    expect(pointOf({ chapter: 0, lane: 0 }, size, false)).toEqual({ x: 100, y: 0 });
    expect(pointOf({ chapter: 5, lane: 1 }, size, false)).toEqual({ x: 1100, y: 140 });
    expect(pointOf({ chapter: 5, lane: -1 }, size, true)).toEqual({ x: -140, y: 1100 });
  });

  it("draws a line that leaves and arrives along the chapters", () => {
    expect(edgeCurve({ x: 0, y: 0 }, { x: 100, y: 50 }, false)).toBe("M0 0C50 0 50 50 100 50");
    expect(edgeCurve({ x: 0, y: 0 }, { x: 50, y: 100 }, true)).toBe("M0 0C0 50 50 50 50 100");
  });

  it("swings the line that skips a chapter clear of the film it skips", () => {
    // The handles are pushed out so that the middle of the curve is the bulge away.
    expect(edgeCurve({ x: 0, y: 0 }, { x: 300, y: 0 }, false, 75)).toBe(
      "M0 0C100 100 200 100 300 0",
    );
    expect(edgeCurve({ x: 0, y: 0 }, { x: 0, y: 300 }, true, 75)).toBe(
      "M0 0C100 100 100 200 0 300",
    );
  });
});

describe("a count in words", () => {
  it("writes the small ones out", () => {
    expect(countWord(6)).toBe("six");
    expect(countWord(3)).toBe("three");
    expect(countWord(13)).toBe("13");
  });
});
