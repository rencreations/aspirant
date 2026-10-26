import type { MetadataRoute } from "next";

import { OBSIDIA_PAGE_NAMES, obsidiaRoute } from "@/features/character/obsidia/routes";
import { SELENA_PAGE_NAMES, selenaRoute } from "@/features/character/selena/routes";
import { characterRoute, navItems, siteConfig } from "@/lib/site";
import { CHARACTER_SLUGS } from "@/lib/slugs";

export const dynamic = "force-static";

const STORY_PAGES = [
  "/character/vexana/story/academic",
  "/character/vexana/story/ender",
  "/character/guinevere/story/alone",
  "/character/guinevere/story/partner",
] as const;

/** Absolute URL with the base path and the trailing slash the static export uses. */
function absolute(path: string): string {
  const clean = path === "/" ? "" : path.replace(/\/+$/, "");
  return `${siteConfig.url}${siteConfig.basePath}${clean}/`;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    ...navItems.map(({ href }) => ({
      url: absolute(href),
      lastModified,
      priority: href === "/" ? 1 : 0.8,
    })),
    ...CHARACTER_SLUGS.map((slug) => ({
      url: absolute(characterRoute(slug)),
      lastModified,
      priority: 0.6,
    })),
    // Their three pages have an address of their own.
    ...SELENA_PAGE_NAMES.map((page) => ({
      url: absolute(selenaRoute(page)),
      lastModified,
      priority: 0.5,
    })),
    ...OBSIDIA_PAGE_NAMES.map((page) => ({
      url: absolute(obsidiaRoute(page)),
      lastModified,
      priority: 0.5,
    })),
    // The two story pages of the long-scroll pair have an address of their own too.
    ...STORY_PAGES.map((path) => ({ url: absolute(path), lastModified, priority: 0.5 })),
  ];
}
