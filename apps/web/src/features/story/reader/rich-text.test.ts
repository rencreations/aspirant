import type { Segment } from "@/content/story-types";

import { groupPieces, plainText, splitAt, toPieces } from "./rich-text";

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
});
