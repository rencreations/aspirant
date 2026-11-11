import { facetsFrom } from "../core/flow/facets";
import type { ArtsFile, Facet } from "../core/types";
import type { ComicHead, ComicId, ComicItem } from "./types";

/** The two webtoons, as the data file names them. A file that lacks its head still reads. */
const COMIC_NAMES: Readonly<Record<ComicId, string>> = {
  "the-aspirant": "The Aspirant",
  "guinevere-vexana": "Guinevere and Vexana",
};

/** The words of an id such as `layla` or `the-aspirant`. */
function spell(id: string): string {
  return id
    .split(/[-_]+/u)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

const nameOfComic = (id: string): string => COMIC_NAMES[id as ComicId] ?? spell(id);

/**
 * What a panel is filtered by: its comic and the Aspirants in it. Each Aspirant is in one comic
 * only, so the two kinds of facet sit in one list and choosing one never leaves an empty page.
 */
export function comicFacetOf(item: ComicItem): readonly string[] {
  return [item.comic, ...item.chars];
}

/**
 * The chips: the two comics, then the Aspirants, the ones with the most panels first. Counted from
 * the panels themselves, so the numbers always agree with what a chip shows.
 */
export function comicFacets(file: (ArtsFile<ComicItem> & Partial<ComicHead>) | null): Facet[] {
  if (!file) return [];
  const names = new Map<string, string>(Object.entries(COMIC_NAMES));
  for (const comic of file.comics ?? []) names.set(comic.id, comic.name);
  return facetsFrom(file.items, comicFacetOf, names);
}

/** "Page 12, panel 2" (the panel only when the sources give it). */
export function pageLabel(item: Pick<ComicItem, "page" | "panel">): string {
  return item.panel ? `Page ${item.page}, panel ${item.panel}` : `Page ${item.page}`;
}

/** "The Aspirant, page 12, panel 2": the line the viewer shows over a panel. */
export function placeLabel(item: Pick<ComicItem, "comic" | "page" | "panel">): string {
  const where = pageLabel(item);
  return `${nameOfComic(item.comic)}, ${where.charAt(0).toLowerCase()}${where.slice(1)}`;
}

/** What a panel is found by: its title and description, its tags, who is in it, its comic and its page. */
export function comicSearchOf(item: ComicItem): string {
  return [
    item.title,
    item.alt,
    item.tags.join(" "),
    item.chars.join(" "),
    nameOfComic(item.comic),
    `page ${item.page}`,
    item.panel ? `panel ${item.panel}` : "",
  ].join(" ");
}
