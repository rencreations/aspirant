import { findCharacter } from "@/content/characters";

import type { PageName } from "./director";
import { SELENA_PAGES } from "./timeline.generated";

/** Her page and its three pages. Each page has its own address under her own. */
const SELENA_ROOT = "/character/selena";

export const SELENA_PAGE_NAMES = Object.keys(SELENA_PAGES) as PageName[];

const LABEL: Record<PageName, string> = { about: "About", skills: "Skills", gallery: "Gallery" };

/** The route of her page, or of one of her pages, with the trailing slash the export uses. */
export function selenaRoute(page: PageName | null): string {
  return page ? `${SELENA_ROOT}/${page}/` : `${SELENA_ROOT}/`;
}

/**
 * The page an address belongs to, or null for her own. The address may carry the deploy base
 * path (`/aspirant/character/selena/about/`), so only the end of it is read.
 */
export function pageFromPath(pathname: string): PageName | null {
  const m = /\/character\/selena\/([^/]+)\/?$/.exec(pathname);
  const name = m?.[1];
  return name && (SELENA_PAGE_NAMES as string[]).includes(name) ? (name as PageName) : null;
}

/** The title of her page or of one of her pages. */
export function selenaTitle(page: PageName | null): string {
  const c = findCharacter("selena");
  const base = c ? `${c.name}, ${c.aspirantName}` : "Selena";
  return page ? `Selena, ${LABEL[page]}` : base;
}
