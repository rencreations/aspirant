/** How many times a picture that failed to load is asked for again before it is given up. */
export const IMAGE_RETRIES = 2;

/** The wait before the nth retry, in ms (1.5 s, then 3 s). */
export const retryDelay = (n: number) => 1500 * (n + 1);

/**
 * The same address with a query that makes the browser ask again (a failed answer can be kept, and a
 * connection that dropped half way can leave a half picture). Any other query is kept.
 */
export function retryUrl(src: string, n: number, base = "http://x.invalid"): string {
  if (!src) return src;
  try {
    const u = new URL(src, base);
    u.searchParams.set("vxr", String(n));
    // Keep a relative address relative so a base path is not turned into an absolute one.
    return /^[a-z][a-z0-9+.-]*:/i.test(src) ? u.toString() : u.pathname + u.search + u.hash;
  } catch {
    return src;
  }
}
