import type { CharacterSlug } from "@/lib/slugs";

import { ORDER, orderIndex } from "./characters";

/** The character that was in front when the carousel was last left, for this visit. */
let last: CharacterSlug | null = null;

/** Remember the character in front, so a way back opens on it. */
export function rememberActive(slug: CharacterSlug): void {
  last = slug;
}

const ROUTE = /\/collection\/animation(?:\/([a-z]+))?\/?$/u;

/**
 * The character a carousel or a full screen view opens on, from an address: the character of the
 * full screen route, `?i=<clip id>` (the library search names a clip, `animation-<slug>-<name>`),
 * `?c=<slug>` (the old room's address), or null when the address names none.
 */
export function slugFromAddress(pathname: string, search: string): CharacterSlug | null {
  const m = ROUTE.exec(pathname);
  if (!m) return null;
  if (m[1] && orderIndex(m[1]) >= 0) return m[1] as CharacterSlug;
  const params = new URLSearchParams(search);
  const fromClip = /^animation-([a-z]+)-/u.exec(params.get("i") ?? "")?.[1];
  for (const slug of [fromClip, params.get("c")]) {
    if (slug && orderIndex(slug) >= 0) return slug as CharacterSlug;
  }
  return null;
}

/** The character the carousel opens on: the address, then the last one in front, then the first. */
export function startSlug(): CharacterSlug {
  if (typeof window !== "undefined") {
    const named = slugFromAddress(window.location.pathname, window.location.search);
    if (named) return named;
  }
  return last ?? ORDER[0]!;
}
