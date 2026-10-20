import type { Slug } from "@/content/types";

/**
 * The one picture the roster shows of each character: the splash art (2048 wide). Nothing else is
 * used on the roster.
 */
export const splashPath = (slug: Slug) => `/img/char/${slug}/splash.webp`;
