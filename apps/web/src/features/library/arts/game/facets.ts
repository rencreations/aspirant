import type { ArtsFile, ArtsItem, Facet } from "../core/types";
import { defaultSearchOf, facetsOfFile } from "../core/flow/facets";

/**
 * The filter of Game: who or what the in-game stills show (an Aspirant, the Mother Matrix, drones),
 * the ones with the most pictures first. The data file names them in `places`.
 */
export function gameFacetOf(item: ArtsItem): readonly string[] {
  return item.places;
}

/** What a still is found by: its title, what is seen, its tags, the Aspirants and the names of its places. */
export const gameSearchOf = defaultSearchOf;

/** The chips of Game, from its data file. */
export function gameFacets(file: (ArtsFile & { facets?: readonly Facet[] }) | null): Facet[] {
  return facetsOfFile(file);
}
