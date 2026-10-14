import type { MetadataRoute } from "next";

import { navItems, siteConfig } from "@/lib/site";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return navItems.map(({ href }) => ({
    url: `${siteConfig.url}${siteConfig.basePath}${href === "/" ? "" : href}/`,
    lastModified,
  }));
}
