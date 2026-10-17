import type { Segment } from "@/content/story-types";

import { baseMetrics } from "./engine";
import {
  dropCapLength,
  findRanges,
  groupPieces,
  markRanges,
  plainText,
  splitAt,
  toPieces,
} from "./rich-text";

const segments: Segment[] = [
  { t: "text", text: "Below lay all of " },
  { t: "ent", id: "terrinia", text: "Terrinia" },
  { t: "text", text: ", under the web.", em: true },
];

describe("rich text", () => {
  it("keeps offsets and marks through a split", () => {
    const pieces = splitAt(toPieces(segments), [3, 20, 19]);
    expect(pieces.map((p) => p.text).join("")).toBe(plainText(segments));
    const ent = pieces.filter((p) => p.ent === "terrinia");
    expect(ent.map((p) => p.text)).toEqual(["Te", "r", "rinia"]);
    expect(groupPieces(pieces).filter((g) => g[0]?.ent)).toHaveLength(1);
    expect(pieces.at(-1)?.em).toBe(true);
  });

  it("marks emphasis ranges", () => {
    const text = plainText(segments);
    const ranges = findRanges(text, ["all of Terrinia"]);
    expect(ranges).toEqual([[10, 25]]);
    const pieces = markRanges(splitAt(toPieces(segments), ranges.flat()), ranges);
    expect(
      pieces
        .filter((p) => p.hi)
        .map((p) => p.text)
        .join(""),
    ).toBe("all of Terrinia");
  });

  it("finds a drop cap after opening quotes", () => {
    expect(dropCapLength("There was")).toBe(1);
    expect(dropCapLength("\"Don't")).toBe(2);
    expect(dropCapLength(" space")).toBe(0);
  });

  it("estimates a sensible height per word", () => {
    const m = baseMetrics(660, 25, 40, 24);
    expect(m.ppw).toBeGreaterThan(3);
    expect(m.ppw).toBeLessThan(5);
    expect(m.ppp).toBe(44);
  });
});
