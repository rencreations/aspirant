import type { MetadataRoute } from "next";

import { characterRoute, navItems, siteConfig } from "@/lib/site";
import { CHARACTER_SLUGS } from "@/lib/slugs";

export const dynamic = "force-static";

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
  ];
}
