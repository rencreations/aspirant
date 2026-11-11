/**
 * The flow: a room of rows of pictures that fill the page's width and stand still, in groups under
 * small headings. Scene, Game, Others, Fanart and Cosplay use it.
 *
 *   <FlowRoom room="scene" title="Scene" items={items} facets={facets} facetOf={...} searchOf={...} sections={ASPIRANT_SECTIONS} />
 *
 * Helpers a room's own files use are imported by path: `./facets` (`facetsFrom`, `facetsOfFile`,
 * `orderFacets`, `aspirantsFirst`, `defaultSearchOf`), `./sections` (`ASPIRANT_SECTIONS` and the
 * type of a room's own groups) and `./first-screen` (`flowFirstScreen`, for the room's loading
 * list: import it from there, not from here, so the list does not pull in the components).
 */
export { FlowRoom } from "./flow-room";
