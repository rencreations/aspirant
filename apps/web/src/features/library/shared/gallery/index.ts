/**
 * The shared picture gallery of the collection rooms: a grid, a viewer and the address state
 * that ties them together. Fanart, Design, Comic, Others and Arts all use it.
 *
 *   import { Gallery, Lightbox, useLightboxParam } from "../shared/gallery";
 *
 *   const lb = useLightboxParam(items);                      // `?i=<id>` in the address
 *   <Gallery items={items} label="Fan art" onOpen={(it) => lb.open(it.id)} activeId={lb.id} />
 *   <Lightbox items={lb.list} index={lb.index} onIndexChange={lb.setIndex} label="Fan art" />
 *
 * `items` are anything with `{ id, title, img: LibImage }` (see `GalleryItem` for the optional
 * fields: characters, pair, canon, credit, original file, extra facts). Keep the list in one
 * order for both components: the viewer's arrow keys follow it.
 */
export { Gallery, type GalleryProps } from "./gallery";
export { Lightbox, type LightboxProps } from "./lightbox";
export { useLightboxParam, type LightboxParam } from "./use-lightbox-param";
export type { Download, GalleryItem } from "./types";
export type { GalleryLayout } from "./layout";
