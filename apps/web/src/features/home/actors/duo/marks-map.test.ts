import { describe, expect, it } from "vitest";

import { COMIC_KIND, comicMark } from "./marks-map";
import type { DuoMark, DuoMarkKind } from "./pose";

const KINDS: DuoMarkKind[] = [
  "bang",
  "ask",
  "spark",
  "heart",
  "lines",
  "drop",
  "puff",
  "swirl",
  "ha",
  "vein",
  "star",
  "note",
];

describe("comicMark", () => {
  it("covers every cue of the duo", () => {
    expect(Object.keys(COMIC_KIND).sort()).toEqual([...KINDS].sort());
  });

  it("a question is a question, a sweat drop is a sweat, the cyan tone is the sky", () => {
    const mark: DuoMark = { kind: "ask", x: 0, y: 0, tone: "cyan", size: 1.5, turn: 90, from: "a" };
    const out = comicMark(mark);
    expect(out.kind).toBe("question");
    expect(out.color).toBe("sky");
    expect(out.size).toBeCloseTo(96, 9);
    expect(out.rotation).toBeCloseTo(Math.PI / 2, 9);
    expect(comicMark({ ...mark, kind: "drop" }).kind).toBe("sweat");
  });
});
