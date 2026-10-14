import path from "node:path";

import type { NextConfig } from "next";

/**
 * Static export. `next build` writes a fully static site to `apps/web/out`, which is served
 * by GitHub Pages and by the nginx container image.
 *
 * GitHub Pages is served from the domain root (custom domain / org site), so no basePath is
 * needed. Set BASE_PATH (e.g. "/my-repo") only when deploying to a project page.
 */
const basePath = process.env.BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  reactStrictMode: true,
  poweredByHeader: false,
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
