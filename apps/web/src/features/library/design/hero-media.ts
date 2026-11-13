import { libUrl } from "@/lib/library";

import type { DesignHero, DesignHeroFilm } from "./types";

/**
 * Narrow displays (a phone, a small window) get the small film; every other display gets the large
 * one. Only the width of the display decides it: the device, the connection and the memory never
 * lower it. It is the same film, cut to the size the display can show.
 */
const SMALL_BELOW = 700;

export function pickFilm(hero: DesignHero, displayWidth: number): DesignHeroFilm | undefined {
  const bySize = [...hero.films].sort((a, b) => b.w - a.w);
  return displayWidth < SMALL_BELOW ? (bySize[bySize.length - 1] ?? bySize[0]) : bySize[0];
}

/** The address of the film that fits this display. */
export function heroFilmUrl(hero: DesignHero): { url: string; bytes: number } | null {
  const film = pickFilm(hero, typeof window === "undefined" ? 1440 : window.innerWidth);
  return film ? { url: libUrl(film.src), bytes: film.bytes } : null;
}
