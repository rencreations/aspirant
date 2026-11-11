/**
 * The zoom of the Arts rooms: a cursor that says ZOOM IN over a picture, a viewer that grows the
 * picture out of its tile to the whole screen (and back), and the hover outline of the tiles.
 *
 *   <ZoomProvider pictures={pictures} tone="dark">          // wraps the room
 *     <Tile />                                              // spreads useZoomTile(id)
 *   </ZoomProvider>
 *
 * See `provider.tsx` for the address (`?i=<id>`), `tile.ts` for the hover outline, and
 * `zoom-math.ts` (import it by its own path) for the pure geometry of the move.
 */
export { ZoomProvider } from "./provider";
export { useZoom, useZoomActions } from "./context";
export { useZoomTile, findZoomTile } from "./tile";
export { recheckZoomCursor } from "./cursor";
export type { ZoomPicture } from "./types";
