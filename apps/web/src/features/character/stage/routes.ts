import { PAGE_NAMES, type PageName } from "./timeline";

export const PAGE_LABEL: Record<PageName, string> = {
  about: "About",
  skills: "Skills",
  gallery: "Gallery",
};

/**
 * The addresses of a character's page and of her three pages. Each page has its own address under
 * hers (`/character/selena/about/`), with the trailing slash the static export uses.
 */
export function stageRoutes(slug: string) {
  const root = `/character/${slug}`;
  return {
    pageNames: PAGE_NAMES,
    /** The route of her page, or of one of her pages. */
    route: (page: PageName | null): string => (page ? `${root}/${page}/` : `${root}/`),
    /**
     * The page an address belongs to, or null for her own. The address may carry the deploy base
     * path (`/aspirant/character/selena/about/`), so only the end of it is read.
     */
    fromPath: (pathname: string): PageName | null => {
      const m = new RegExp(`/character/${slug}/([^/]+)/?$`).exec(pathname);
      const name = m?.[1];
      return name && (PAGE_NAMES as readonly string[]).includes(name) ? (name as PageName) : null;
    },
  };
}
