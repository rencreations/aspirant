import path from "node:path";

import type { NextConfig } from "next";

/**
 * Static export. `next build` writes a fully static site to `apps/web/out`, which is served
 * by GitHub Pages and by the nginx container image.
 *
 * BASE_PATH: production runs as a GitHub project page under "/aspirant". Leave it empty for a
 * domain root (dev, container, custom domain). Every non-route URL goes through `asset()`.
 *
 * NEXT_DIST_DIR: lets each engineer run a private dev server next to the owner's preview on
 * port 3000 without sharing a build folder, for example:
 *   NEXT_DIST_DIR=.next-shell pnpm --filter @aspirant/web exec next dev -p 3101
 * `output: "export"` still writes the static site to `out/`.
 */
const basePath = process.env.BASE_PATH ?? "";
const distDir = process.env.NEXT_DIST_DIR ?? ".next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  reactStrictMode: true,
  poweredByHeader: false,
  distDir,
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
  images: { unoptimized: true },
  transpilePackages: ["@aspirant/ui"],
  typedRoutes: true,
  // Resolve the monorepo root so Turbopack can follow workspace symlinks.
  turbopack: { root: path.join(import.meta.dirname, "../..") },
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default nextConfig;
