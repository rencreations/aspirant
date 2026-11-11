import type { ArtsItem, Facet } from "../types";

/** The facets in the order the filter shows them: the most pictures first, then by name. Facets with no picture are dropped. */
export function orderFacets(facets: readonly Facet[]): Facet[] {
  return facets
    .filter((facet) => facet.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** Turn an id such as `oro-soldier` into words, for a facet a data file does not name. */
function nameOfId(id: string): string {
  const words = id.split(/[-_]+/u).filter(Boolean);
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

/**
 * The facets of a list of items by one field, counted from the items themselves. `names` gives the
 * spelled names; an id it does not know is spelled from the id.
 */
export function facetsFrom<T>(
  items: readonly T[],
  idsOf: (item: T) => readonly string[],
  names: ReadonlyMap<string, string> = new Map(),
): Facet[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    for (const id of new Set(idsOf(item))) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return orderFacets(
    [...counts].map(([id, count]) => ({ id, name: names.get(id) ?? nameOfId(id), count })),
  );
}

/**
 * The facets a data file lists, in the order of their counts. A file that lists none (or whose
 * counts are all zero) gets its facets counted from the places of its items.
 */
export function facetsOfFile(
  file: { facets?: readonly Facet[]; items: readonly ArtsItem[] } | null,
): Facet[] {
  if (!file) return [];
  const listed = orderFacets(file.facets ?? []);
  return listed.length > 0 ? listed : facetsFrom(file.items, (item) => item.places);
}

/** The words a picture is found by: its title, what is seen, its tags and the Aspirants in it. */
export function defaultSearchOf(item: ArtsItem): string {
  return [item.title, item.alt, item.tags.join(" "), item.chars.join(" ")].join(" ");
}
