/**
 * Base-path helpers. Production is served under "/aspirant" (a GitHub project page), so every
 * URL that is not a Next route (image, video, audio, JSON, GLB, texture) must go through
 * `asset()`. Next routes rendered with <Link>/<TLink> get the base path from Next itself.
 */

const EXTERNAL = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i;

function normaliseBase(base: string | undefined): string {
  if (!base || base === "/") return "";
  return `/${base.replace(/^\/+|\/+$/g, "")}`;
}

/** Build an `asset()` function for a given base path. Exported for tests. */
export function createAsset(base: string | undefined): (path: string) => string {
  const prefix = normaliseBase(base);
  return (path: string) => {
    if (!path) return `${prefix}/`;
    if (EXTERNAL.test(path)) return path;
    const clean = `/${path.replace(/^\/+/, "")}`;
    if (prefix && (clean === prefix || clean.startsWith(`${prefix}/`))) return clean;
    return `${prefix}${clean}`;
  };
}

/** Build a `withBase()` function for a given base path. Exported for tests. */
export function createWithBase(base: string | undefined): (href: string) => string {
  const toAsset = createAsset(base);
  return (href: string) => {
    if (EXTERNAL.test(href) || href.startsWith("#")) return href;
    const match = /^([^?#]*)(.*)$/.exec(href);
    const pathname = match?.[1] ?? href;
    const rest = match?.[2] ?? "";
    const last = pathname.split("/").pop() ?? "";
    const needsSlash = !pathname.endsWith("/") && !last.includes(".");
    return toAsset(`${pathname}${needsSlash ? "/" : ""}`) + rest;
  };
}

/**
 * Prefix a public file path with the deploy base path.
 * `asset("/img/layla/splash.webp")` gives "/aspirant/img/layla/splash.webp" in production.
 * Leading slashes are optional, external URLs pass through, and it is safe to call twice.
 */
export const asset = createAsset(process.env.NEXT_PUBLIC_BASE_PATH);

/**
 * Prefix a route for a plain <a> or a share URL (not needed with <Link> or <TLink>).
 * Adds the trailing slash the static export uses: `withBase("/story")` gives "/aspirant/story/".
 * @public
 */
export const withBase = createWithBase(process.env.NEXT_PUBLIC_BASE_PATH);
