/**
 * The decision tree of the interactive drama, as the section draws it: thirteen films in six
 * chapters, and the twenty answers that lead from one to the next. It is the tree of the game
 * itself (`features/character/vexana/drama/drama-graph.ts`), kept here as plain ids so the page
 * does not carry the game's texts. A test holds the two together.
 */
export interface TreeNode {
  /** "1", "2A", "5C": the chapter and the branch. */
  readonly id: string;
  /** 0 to 5. */
  readonly chapter: number;
  /** Its place among the films of its chapter, from -1 (first) to 1 (last); 0 when it is alone. */
  readonly lane: number;
  /** The films its two answers lead to. None for an ending. */
  readonly to: readonly string[];
}

const LINKS: ReadonlyArray<readonly [string, readonly string[]]> = [
  ["1", ["2A", "2B"]],
  ["2A", ["3A", "3B"]],
  ["2B", ["3A", "3B"]],
  ["3A", ["4A", "4B"]],
  ["3B", ["4A", "4B"]],
  ["4A", ["5A", "5C"]],
  ["4B", ["6C", "5B"]],
  ["5A", ["6A", "6B"]],
  ["5B", ["6A", "6C"]],
  ["5C", ["6B", "6C"]],
  ["6A", []],
  ["6B", []],
  ["6C", []],
];

/** The chapter of a film, from its id: "4B" is the fourth, so 3. */
export function chapterOf(id: string): number {
  return Number.parseInt(id, 10) - 1;
}

/** Where a film stands among the `count` films of its chapter: -1 to 1, evenly, 0 when alone. */
export function laneOf(index: number, count: number): number {
  return count <= 1 ? 0 : (index / (count - 1)) * 2 - 1;
}

export const DRAMA_TREE: readonly TreeNode[] = LINKS.map(([id, to]) => {
  const chapter = chapterOf(id);
  const mates = LINKS.filter(([other]) => chapterOf(other) === chapter).map(([other]) => other);
  return { id, chapter, lane: laneOf(mates.indexOf(id), mates.length), to };
});

export interface TreeEdge {
  readonly from: string;
  readonly to: string;
}

export const DRAMA_EDGES: readonly TreeEdge[] = DRAMA_TREE.flatMap((node) =>
  node.to.map((to) => ({ from: node.id, to })),
);

/** The films that have no answers: the endings. */
export const DRAMA_ENDINGS = DRAMA_TREE.filter((node) => node.to.length === 0).length;

/** The id of the film a still shows, from the still's own id: `drama-4b` is "4B". */
export function filmOfStill(stillId: string): string {
  return stillId.replace(/^drama-/u, "").toUpperCase();
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

/**
 * Where a film stands on the drawing, in its units. The chapters run along the long side
 * (`across` wide, six steps) and the lanes along the short one (`span` from the first lane to
 * the last). `upright` turns the drawing for a narrow screen: the chapters then run down.
 */
export function pointOf(
  node: Pick<TreeNode, "chapter" | "lane">,
  size: { across: number; span: number; chapters: number },
  upright: boolean,
): Point {
  const along = ((node.chapter + 0.5) / size.chapters) * size.across;
  const side = (node.lane * size.span) / 2;
  return upright ? { x: side, y: along } : { x: along, y: side };
}

/**
 * A thin curve from one film to the next: it leaves and arrives along the way the chapters run.
 * One answer skips a chapter (4B to 6C). Its line must not run through the film it skips, so it
 * swings out by `bulge` on the outer side of the lanes.
 */
export function edgeCurve(a: Point, b: Point, upright: boolean, bulge = 0): string {
  const f = (v: number) => String(Number(v.toFixed(1)));
  // The middle of a curve whose two handles are pushed out by `c` lies `0.75 c` out.
  const out = bulge / 0.75;
  if (upright) {
    const third = (b.y - a.y) / 3;
    if (bulge)
      return `M${f(a.x)} ${f(a.y)}C${f(a.x + out)} ${f(a.y + third)} ${f(b.x + out)} ${f(b.y - third)} ${f(b.x)} ${f(b.y)}`;
    const mid = (a.y + b.y) / 2;
    return `M${f(a.x)} ${f(a.y)}C${f(a.x)} ${f(mid)} ${f(b.x)} ${f(mid)} ${f(b.x)} ${f(b.y)}`;
  }
  const third = (b.x - a.x) / 3;
  if (bulge)
    return `M${f(a.x)} ${f(a.y)}C${f(a.x + third)} ${f(a.y + out)} ${f(b.x - third)} ${f(b.y + out)} ${f(b.x)} ${f(b.y)}`;
  const mid = (a.x + b.x) / 2;
  return `M${f(a.x)} ${f(a.y)}C${f(mid)} ${f(a.y)} ${f(mid)} ${f(b.y)} ${f(b.x)} ${f(b.y)}`;
}

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];

/** A small count in words, as the page's sentences write it: 6 is "six". Larger ones stay figures. */
export function countWord(n: number): string {
  return WORDS[n] ?? String(n);
}
