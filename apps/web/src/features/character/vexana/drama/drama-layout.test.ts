import { describe, expect, it } from "vitest";

import { DRAMA_NODES } from "./drama-graph";
import { edgeMiddle, edgePath, graphEdges, graphNodes, neighbour } from "./drama-layout";

describe("the decision tree layout", () => {
  it("puts every episode in the column of its chapter, and no two in one place", () => {
    const nodes = graphNodes();
    expect(nodes).toHaveLength(DRAMA_NODES.length);
    const seen = new Set<string>();
    for (const n of nodes) {
      const key = `${String(n.col)}:${String(n.row)}`;
      expect(seen.has(key), n.id).toBe(false);
      seen.add(key);
      expect(n.row).toBeGreaterThanOrEqual(0);
      expect(n.row).toBeLessThanOrEqual(2);
      expect(n.col).toBe(DRAMA_NODES.find((d) => d.id === n.id)!.chapter - 1);
    }
  });

  it("has one edge for each answer, each going to a later column", () => {
    const edges = graphEdges();
    expect(edges).toHaveLength(DRAMA_NODES.reduce((sum, n) => sum + n.choices.length, 0));
    const col = new Map(graphNodes().map((n) => [n.id, n.col]));
    for (const e of edges) expect(col.get(e.to)!).toBeGreaterThan(col.get(e.from)!);
  });

  it("marks only the answer that skips a chapter", () => {
    const skips = graphEdges().filter((e) => e.skip);
    expect(skips.map((e) => `${e.from}>${e.to}`)).toEqual(["4B>6C"]);
  });

  it("draws a curve between two points, and a skipping one bows out below", () => {
    const a = { x: 10, y: 20 };
    const b = { x: 110, y: 60 };
    expect(edgePath(a, b, false, 200)).toBe("M10 20 C60 20 60 60 110 60");
    expect(edgePath(a, b, true, 200)).toContain(" 200 ");
    expect(edgeMiddle(a, b, false, 200)).toEqual({ x: 60, y: 40 });
    expect(edgeMiddle(a, b, true, 200).y).toBeGreaterThan(40);
  });
});

describe("moving with the arrow keys", () => {
  const nodes = graphNodes();

  it("goes right to the nearest episode of the next chapter, and back left", () => {
    expect(neighbour(nodes, "1", "right")).toBe("2A");
    expect(neighbour(nodes, "2A", "right")).toBe("3A");
    expect(neighbour(nodes, "4B", "right")).toBe("5B");
    expect(neighbour(nodes, "5B", "left")).toBe("4B");
    expect(neighbour(nodes, "6B", "left")).toBe("5C");
  });

  it("goes up and down inside a chapter", () => {
    expect(neighbour(nodes, "5A", "down")).toBe("5C");
    expect(neighbour(nodes, "5C", "down")).toBe("5B");
    expect(neighbour(nodes, "5B", "up")).toBe("5C");
    expect(neighbour(nodes, "2A", "down")).toBe("2B");
  });

  it("stays put at an edge and for an unknown episode", () => {
    expect(neighbour(nodes, "1", "left")).toBeNull();
    expect(neighbour(nodes, "1", "up")).toBeNull();
    expect(neighbour(nodes, "6A", "right")).toBeNull();
    expect(neighbour(nodes, "6A", "up")).toBeNull();
    expect(neighbour(nodes, "zz", "right")).toBeNull();
  });

  it("can reach every episode from the first by arrows", () => {
    const seen = new Set(["1"]);
    const queue = ["1"];
    while (queue.length > 0) {
      const id = queue.pop()!;
      for (const m of ["left", "right", "up", "down"] as const) {
        const n = neighbour(nodes, id, m);
        if (n && !seen.has(n)) {
          seen.add(n);
          queue.push(n);
        }
      }
    }
    expect(seen.size).toBe(nodes.length);
  });
});
