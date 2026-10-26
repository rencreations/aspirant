import { DRAMA_NODES, type DramaNode } from "./drama-graph";

/**
 * Where each episode sits in the decision tree of the level select. The six chapters are six
 * columns, left to right. The rows are chosen by hand so the answers cross as little as possible:
 * in the grid of three rows (0, 1, 2) with the middle ones at 0.5 and 1.5 for the columns of two.
 */
const ROWS: Readonly<Record<string, number>> = {
  "1": 1,
  "2A": 0.5,
  "2B": 1.5,
  "3A": 0.5,
  "3B": 1.5,
  "4A": 0.5,
  "4B": 1.5,
  "5A": 0,
  "5C": 1,
  "5B": 2,
  "6A": 0,
  "6B": 1,
  "6C": 2,
};

export const GRAPH_COLUMNS = 6;
export const GRAPH_ROWS = 3;

export interface GraphNode {
  id: string;
  /** 0 to 5, the chapter minus one. */
  col: number;
  /** 0 to 2. */
  row: number;
}

export interface GraphEdge {
  from: string;
  /** The index of the answer in the choices of `from`. */
  choice: number;
  to: string;
  /** The answer jumps over a chapter (4B to the ending 6C). */
  skip: boolean;
}

export function graphNodes(nodes: readonly DramaNode[] = DRAMA_NODES): GraphNode[] {
  return nodes.map((n) => ({ id: n.id, col: n.chapter - 1, row: ROWS[n.id] ?? 1 }));
}

export function graphEdges(nodes: readonly DramaNode[] = DRAMA_NODES): GraphEdge[] {
  const chapter = new Map(nodes.map((n) => [n.id, n.chapter]));
  return nodes.flatMap((n) =>
    n.choices.map((c, choice) => ({
      from: n.id,
      choice,
      to: c.to,
      skip: (chapter.get(c.to) ?? n.chapter) - n.chapter > 1,
    })),
  );
}

export interface Point {
  x: number;
  y: number;
}

const f = (n: number) => String(Math.round(n * 10) / 10);

/**
 * The curve of an answer, from the right edge of one card to the left edge of the next. An answer
 * that skips a chapter bows out below the grid so it does not run through the cards between.
 */
export function edgePath(a: Point, b: Point, skip: boolean, belowY: number): string {
  const dx = Math.max(10, (b.x - a.x) * 0.5);
  if (skip) {
    const sag = belowY;
    return `M${f(a.x)} ${f(a.y)} C${f(a.x + dx * 0.6)} ${f(sag)} ${f(b.x - dx * 0.6)} ${f(sag)} ${f(b.x)} ${f(b.y)}`;
  }
  return `M${f(a.x)} ${f(a.y)} C${f(a.x + dx)} ${f(a.y)} ${f(b.x - dx)} ${f(b.y)} ${f(b.x)} ${f(b.y)}`;
}

/** The middle of a curve, where the tag of the answer is written. */
export function edgeMiddle(a: Point, b: Point, skip: boolean, belowY: number): Point {
  if (skip) return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + (belowY - (a.y + b.y) / 2) * 0.75 };
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export type Move = "left" | "right" | "up" | "down";

/**
 * The episode an arrow key goes to from `id`: Left and Right to the nearest one in the chapter
 * before or after (the nearest row first), Up and Down to the next one in the same chapter.
 */
export function neighbour(nodes: readonly GraphNode[], id: string, move: Move): string | null {
  const here = nodes.find((n) => n.id === id);
  if (!here) return null;
  let best: GraphNode | null = null;
  let bestScore = Infinity;
  for (const n of nodes) {
    if (n.id === id) continue;
    let score: number;
    if (move === "right" || move === "left") {
      const d = move === "right" ? n.col - here.col : here.col - n.col;
      if (d <= 0) continue;
      score = d * 10 + Math.abs(n.row - here.row);
    } else {
      if (n.col !== here.col) continue;
      const d = move === "down" ? n.row - here.row : here.row - n.row;
      if (d <= 0) continue;
      score = d;
    }
    if (score < bestScore) {
      best = n;
      bestScore = score;
    }
  }
  return best?.id ?? null;
}
