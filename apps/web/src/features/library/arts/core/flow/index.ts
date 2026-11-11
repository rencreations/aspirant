/**
 * The flow: a room of rows of pictures that slide sideways with the scroll. Scene, Game, Others,
 * Fanart and Cosplay use it.
 *
 *   <FlowRoom room="scene" title="Scene" items={items} facets={facets} facetOf={...} searchOf={...} />
 *
 * Helpers a room's own files use are imported by path: `./facets` (`facetsFrom`, `facetsOfFile`,
 * `orderFacets`, `defaultSearchOf`) and `./first-screen` (`flowFirstScreen`, for the room's loading
 * list: import it from there, not from here, so the list does not pull in the components).
 */
export { FlowRoom } from "./flow-room";
