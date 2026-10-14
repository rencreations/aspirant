import type { MetadataRoute } from "next";

import { siteConfig } from "@/lib/site";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteConfig.name,
    short_name: siteConfig.name,
    description: siteConfig.description,
    start_url: `${siteConfig.basePath}/`,
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [{ src: `${siteConfig.basePath}/icon.svg`, sizes: "any", type: "image/svg+xml" }],
  };
}
