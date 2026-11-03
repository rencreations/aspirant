import type { ActMeta, ChapterEntry } from "@/content/story-types";

/** How many preview cards show before "Show all". */
export const COLLAPSED_CARDS = 9;

export interface ActGroup {
  readonly act: ActMeta;
  readonly chapters: readonly ChapterEntry[];
}

/** The chapters gathered under their acts, in book order. */
export function groupByAct(
  acts: readonly ActMeta[],
  chapters: readonly ChapterEntry[],
): ActGroup[] {
  return acts
    .map((act) => ({
      act,
      chapters: chapters.filter((c) => c.number >= act.from && c.number <= act.to),
    }))
    .filter((g) => g.chapters.length > 0);
}

/**
 * Cut the groups to the first `limit` cards while the list is folded (an act that loses all its
 * cards disappears with its heading). Unfolded, everything shows.
 */
export function visibleGroups(
  groups: readonly ActGroup[],
  expanded: boolean,
  limit = COLLAPSED_CARDS,
): ActGroup[] {
  if (expanded) return [...groups];
  const out: ActGroup[] = [];
  let left = limit;
  for (const g of groups) {
    if (left <= 0) break;
    out.push({ act: g.act, chapters: g.chapters.slice(0, left) });
    left -= g.chapters.length;
  }
  return out;
}

/** The number of cards in the groups. */
export function countCards(groups: readonly ActGroup[]): number {
  return groups.reduce((sum, g) => sum + g.chapters.length, 0);
}
