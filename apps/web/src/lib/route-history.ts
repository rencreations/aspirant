/**
 * Which page the visitor came from, inside the site. The transition provider notes every route it
 * shows (`noteRoute`), so a page can ask where it was opened from. The opening of `/character`
 * uses it: it plays when the visitor arrives from another page, not from inside the roster's own
 * pages (`/character/selena/` and the like).
 */
let current: string | null = null;
let previous: string | null = null;

/** Note the route now shown (the same route twice in a row counts once). */
export function noteRoute(path: string): void {
  if (path === current) return;
  previous = current;
  current = path;
}

/**
 * The route the visitor came to `path` from, or null on a fresh load. It is right whether it is
 * asked before the new route has been noted (the page change is starting) or after.
 */
export function routeBefore(path: string): string | null {
  return current === path ? previous : current;
}
