import type { Facet } from "../types";

/**
 * Search and filter of a flow room, as pure functions over a small index. The index is built once
 * for a list of items. A search is the words of the query, all of which must appear in the item's
 * text; a filter is one facet (a place, a kind, an Aspirant) the item belongs to.
 */

/** Fold a text for matching: no case, no accents, no apostrophes, only letters and digits between single spaces. "Chang'e" and "change" are the same word. */
export function normalise(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]+/gu, "")
    .normalize("NFC")
    .toLowerCase()
    .replace(/['’ʼ`]/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** The words of a query, folded. */
export function queryTerms(query: string): string[] {
  const folded = normalise(query);
  return folded ? folded.split(" ") : [];
}

export interface FlowIndex {
  /** The facet ids of each item. */
  facets: ReadonlyArray<readonly string[]>;
  /** The folded text of each item, with a space at both ends so a term can match a whole word. */
  text: readonly string[];
}

/** Index a list of items. `facetOf` and `searchOf` are the room's own; the names of the facets are searched too. */
export function buildIndex<T>(
  items: readonly T[],
  facetOf: (item: T) => readonly string[],
  searchOf: (item: T) => string,
  facets: readonly Facet[] = [],
): FlowIndex {
  const names = new Map(facets.map((facet) => [facet.id, facet.name]));
  const folded = items.map((item) => Array.from(new Set(facetOf(item))));
  return {
    facets: folded,
    // What a picture is found by: its own text and the names of its facets (so "soldiers" finds "Oro Soldiers").
    text: items.map((item, i) => {
      const own = names.size ? (folded[i] ?? []).map((id) => names.get(id) ?? "").join(" ") : "";
      return ` ${normalise(`${searchOf(item)} ${own}`)} `;
    }),
  };
}

function matches(text: string, terms: readonly string[]): boolean {
  for (const term of terms) if (!text.includes(term)) return false;
  return true;
}

/** The indexes of the items that match the query, in order. An empty query matches everything. */
export function searchIndexes(index: FlowIndex, query: string): number[] {
  const terms = queryTerms(query);
  const out: number[] = [];
  for (let i = 0; i < index.text.length; i++) {
    if (terms.length === 0 || matches(index.text[i] ?? "", terms)) out.push(i);
  }
  return out;
}

/** The indexes (from `among`) of the items that belong to `facet`. An empty facet keeps all of them. */
export function filterIndexes(index: FlowIndex, among: readonly number[], facet: string): number[] {
  if (!facet) return [...among];
  return among.filter((i) => index.facets[i]?.includes(facet));
}

/** How many of the items in `among` belong to each facet. */
export function countFacets(index: FlowIndex, among: readonly number[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const i of among) {
    for (const id of index.facets[i] ?? []) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

/** A facet with the number of pictures it holds now (after the search). */
export interface LiveFacet extends Facet {
  live: number;
}

/**
 * The facets in the order the room gave them (by how many pictures they hold in the whole room),
 * with their count after the search. While a search is on, a facet with no match is left out,
 * except the one that is chosen. The order never changes with the search, so the chips do not
 * jump while the visitor types.
 */
export function liveFacets(
  facets: readonly Facet[],
  counts: ReadonlyMap<string, number>,
  searching: boolean,
  chosen: string,
): LiveFacet[] {
  const out: LiveFacet[] = [];
  for (const facet of facets) {
    const live = counts.get(facet.id) ?? 0;
    if (searching && live === 0 && facet.id !== chosen) continue;
    out.push({ ...facet, live });
  }
  return out;
}

/**
 * Split the facets into the ones that show as chips and the rest behind "See more". The chosen
 * facet always shows: when it is in the rest, it takes the last chip's place.
 */
export function splitFacets(
  facets: readonly LiveFacet[],
  shown: number,
  chosen: string,
): { chips: LiveFacet[]; more: LiveFacet[] } {
  const n = Math.max(1, shown);
  const chips = facets.slice(0, n);
  const more = facets.slice(n);
  if (chosen) {
    const at = more.findIndex((f) => f.id === chosen);
    const picked = more[at];
    if (picked) {
      const dropped = chips.pop();
      chips.push(picked);
      more.splice(at, 1);
      if (dropped) more.unshift(dropped);
    }
  }
  return { chips, more };
}

/** How many chips show before "See more", by the width of the page (CSS pixels): 6 to 8. */
export function chipsFor(width: number): number {
  if (width >= 1280) return 8;
  if (width >= 900) return 7;
  return 6;
}
