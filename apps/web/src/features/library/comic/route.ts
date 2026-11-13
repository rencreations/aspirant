/**
 * Every comic has its own address, `/collection/comic/<slug>/`: a page, not a state of the room.
 * The slug is written by `scripts/library/comic/build.py` from the title.
 */
const BASE = "/collection/comic";

/** The address of a comic, or of the room when there is no slug. */
export function comicPath(slug = ""): string {
  return slug ? `${BASE}/${slug}/` : `${BASE}/`;
}

/** The slug in `/collection/comic/<slug>/`, or "" for the room itself. */
export function comicSlugFromPath(pathname: string): string {
  const m = /^\/collection\/comic\/([a-z0-9-]+)\/?$/u.exec(pathname);
  return m?.[1] ?? "";
}
