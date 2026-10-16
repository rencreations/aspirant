import type { MetadataRoute } from "next";

import { siteConfig } from "@/lib/site";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteConfig.name,
    short_name: siteConfig.shortName,
    description: siteConfig.description,
    start_url: `${siteConfig.basePath}/`,
    scope: `${siteConfig.basePath}/`,
    display: "standalone",
    background_color: "#05070c",
    theme_color: "#05070c",
    icons: [{ src: `${siteConfig.basePath}/icon.svg`, sizes: "any", type: "image/svg+xml" }],
  };
}
