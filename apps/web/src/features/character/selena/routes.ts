import { findCharacter } from "@/content/characters";

import { PAGE_LABEL, stageRoutes } from "../stage/routes";
import type { StageRoutes } from "../stage/use-stage-url";
import type { PageName } from "../stage/timeline";

const routes = stageRoutes("selena");

export const SELENA_PAGE_NAMES = routes.pageNames;

/** The route of her page, or of one of her pages, with the trailing slash the export uses. */
export const selenaRoute = routes.route;

/** The page an address belongs to, or null for her own. */
export const pageFromPath = routes.fromPath;

/** The title of her page or of one of her pages. */
export function selenaTitle(page: PageName | null): string {
  const c = findCharacter("selena");
  const base = c ? `${c.name}, ${c.aspirantName}` : "Selena";
  return page ? `Selena, ${PAGE_LABEL[page]}` : base;
}

/** How the stage reads and writes her addresses and titles. */
export const SELENA_ROUTES: StageRoutes = {
  route: selenaRoute,
  fromPath: pageFromPath,
  title: selenaTitle,
};
