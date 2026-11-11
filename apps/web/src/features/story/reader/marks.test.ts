import { describe, expect, it } from "vitest";

import { splitSegs, type Mark } from "./marks";

const mark = (phrase: string, slug = "x"): Mark => ({
  p: 0,
  phrase,
  slug,
  name: "X",
  kind: "thing",
  tip: "A tip.",
});

describe("splitSegs", () => {
  it("puts the paragraph back together letter for letter", () => {
    const segs = [
      { t: "The Storm Citadel is " },
      { t: "huge", em: 1 as const },
      { t: ". Really." },
    ];
    const pieces = splitSegs(segs, [mark("Storm Citadel"), mark("Really")]);
    expect(pieces.map((p) => p.t).join("")).toBe("The Storm Citadel is huge. Really.");
    expect(pieces.filter((p) => p.mark).map((p) => p.t)).toEqual(["Storm Citadel", "Really"]);
  });

  it("keeps the italics of the segment a mark is in", () => {
    const pieces = splitSegs([{ t: "a Control Core b", em: 1 as const }], [mark("Control Core")]);
    expect(pieces.map((p) => [p.t, p.em])).toEqual([
      ["a ", true],
      ["Control Core", true],
      [" b", true],
    ]);
  });

  it("marks only the first place the words are found, once per mark", () => {
    const pieces = splitSegs([{ t: "Oro and Oro" }], [mark("Oro")]);
    expect(pieces.filter((p) => p.mark)).toHaveLength(1);
    expect(pieces.map((p) => p.t).join("")).toBe("Oro and Oro");
  });

  it("leaves a paragraph with no marks as it is", () => {
    expect(splitSegs([{ t: "Plain." }], [])).toEqual([{ t: "Plain.", em: false }]);
  });
});
