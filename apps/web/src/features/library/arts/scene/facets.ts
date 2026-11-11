import type { ArtsFile, ArtsItem, Facet } from "../core/types";
import { aspirantsFirst, defaultSearchOf, facetsOfFile } from "../core/flow/facets";

/**
 * The filter of Scene: the entity folders (places) the stills were found in. The ten Aspirants come
 * first, in the order of the pairs, then the places with the most pictures first. A still can stand
 * in several (Vexana's still in the ruins of Obsidia's attack is in both), so the counts add up to
 * more than the stills.
 */
export function sceneFacetOf(item: ArtsItem): readonly string[] {
  return item.places;
}

/** What a still is found by: its title, what is seen, its tags, the Aspirants and the names of its places. */
export const sceneSearchOf = defaultSearchOf;

/** The chips of Scene, from its data file. */
export function sceneFacets(file: (ArtsFile & { facets?: readonly Facet[] }) | null): Facet[] {
  return aspirantsFirst(facetsOfFile(file));
}
