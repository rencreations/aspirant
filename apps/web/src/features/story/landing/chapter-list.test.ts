import type { ActMeta, ChapterEntry } from "@/content/story-types";

import { COLLAPSED_CARDS, countCards, groupByAct, visibleGroups } from "./chapter-list";

const acts: ActMeta[] = [
  { roman: "I", title: "One", from: 0, to: 4 },
  { roman: "II", title: "Two", from: 5, to: 12 },
  { roman: "III", title: "Three", from: 13, to: 14 },
];

const chapters = Array.from({ length: 15 }, (_, number) => ({ number })) as ChapterEntry[];

describe("chapter preview groups", () => {
  it("gathers the chapters under their acts, in book order", () => {
    const groups = groupByAct(acts, chapters);
    expect(groups.map((g) => g.chapters.length)).toEqual([5, 8, 2]);
    expect(groups[1]?.chapters[0]?.number).toBe(5);
  });

  it("drops an act with no chapters", () => {
    const more = [...acts, { roman: "IV", title: "Empty", from: 40, to: 48 }];
    expect(groupByAct(more, chapters)).toHaveLength(3);
  });

  it("folds the list to the first cards, and an act that loses all its cards goes too", () => {
    const groups = groupByAct(acts, chapters);
    const folded = visibleGroups(groups, false);
    expect(countCards(folded)).toBe(COLLAPSED_CARDS);
    expect(folded.map((g) => g.act.roman)).toEqual(["I", "II"]);
    expect(visibleGroups(groups, false, 5)).toHaveLength(1);
  });

  it("shows everything when it is open", () => {
    const groups = groupByAct(acts, chapters);
    expect(countCards(visibleGroups(groups, true))).toBe(15);
  });
});
