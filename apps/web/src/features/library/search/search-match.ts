import type { CollectionSlug, SearchEntry } from "../types";

export interface Scored {
  entry: SearchEntry;
  score: number;
}

/** Lower case and fold width variants, so Japanese and Latin text match without fuss. */
export function normalise(text: string): string {
  return text.normalize("NFKC").toLowerCase();
}

/**
 * Match a query against the library's search entries. Every word of the query must appear in the
 * title, the keywords or the character slugs. A hit in the title counts most, a hit at the start
 * of a word in the title counts a little more. Results come back best first, then by title.
 */
export function searchEntries(
  entries: readonly SearchEntry[],
  query: string,
  collection: CollectionSlug | "" = "",
  limit = 120,
): Scored[] {
  const terms = normalise(query).split(/\s+/u).filter(Boolean);
  if (terms.length === 0) return [];
  const out: Scored[] = [];
  for (const entry of entries) {
    if (collection && entry.c !== collection) continue;
    const title = normalise(entry.t);
    const rest = `${normalise(entry.k)} ${entry.w.join(" ")}`;
    let score = 0;
    let ok = true;
    for (const term of terms) {
      const inTitle = title.indexOf(term);
      if (inTitle >= 0) {
        score += 3;
        if (inTitle === 0 || title[inTitle - 1] === " ") score += 2;
      } else if (rest.includes(term)) {
        score += 1;
      } else {
        ok = false;
        break;
      }
    }
    if (ok) out.push({ entry, score });
  }
  out.sort((a, b) => b.score - a.score || a.entry.t.localeCompare(b.entry.t));
  return out.slice(0, limit);
}

/** How many of the matches fall in each collection (before the collection filter and the limit). */
export function countByCollection(
  entries: readonly SearchEntry[],
  query: string,
): Partial<Record<CollectionSlug, number>> {
  const counts: Partial<Record<CollectionSlug, number>> = {};
  for (const { entry } of searchEntries(entries, query, "", Number.MAX_SAFE_INTEGER)) {
    counts[entry.c] = (counts[entry.c] ?? 0) + 1;
  }
  return counts;
}
