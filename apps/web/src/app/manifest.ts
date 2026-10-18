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
    background_color: "#f4f6f9",
    theme_color: "#f4f6f9",
    icons: [
      { src: `${siteConfig.basePath}/icon.svg`, sizes: "any", type: "image/svg+xml" },
      { src: `${siteConfig.basePath}/icons/icon-192.png`, sizes: "192x192", type: "image/png" },
      { src: `${siteConfig.basePath}/icons/icon-512.png`, sizes: "512x512", type: "image/png" },
    ],
  };
}
