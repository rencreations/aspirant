import { findCharacter } from "@/content/characters";

import { PAGE_LABEL, stageRoutes } from "../stage/routes";
import type { PageName } from "../stage/timeline";
import type { StageRoutes } from "../stage/use-stage-url";

const routes = stageRoutes("obsidia");

export const OBSIDIA_PAGE_NAMES = routes.pageNames;

/** The route of her page, or of one of her pages, with the trailing slash the export uses. */
export const obsidiaRoute = routes.route;

/** The page an address belongs to, or null for her own. */
export const obsidiaPageFromPath = routes.fromPath;

/** The title of her page or of one of her pages. */
export function obsidiaTitle(page: PageName | null): string {
  const c = findCharacter("obsidia");
  const base = c ? `${c.name}, ${c.aspirantName}` : "Obsidia";
  return page ? `Obsidia, ${PAGE_LABEL[page]}` : base;
}

/** How the stage reads and writes her addresses and titles. */
export const OBSIDIA_ROUTES: StageRoutes = {
  route: obsidiaRoute,
  fromPath: obsidiaPageFromPath,
  title: obsidiaTitle,
};
