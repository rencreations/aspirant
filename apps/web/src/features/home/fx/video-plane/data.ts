/**
 * What the film plane shows: the trailer loop of the strip (two sizes, picked by the display) and
 * the ten preview clips of the official films. Written from `public/data/home/picks.json`
 * (`trailer.strip` and `previews`), which the media workstream makes: `data.test.ts` keeps this
 * file equal to it. It is small on purpose, because `preload.ts` is in the bundle of every page.
 */

export interface StripFile {
  /** A public path, the key of the media store (the same string everywhere, so one download is shared). */
  readonly path: string;
  readonly w: number;
  readonly h: number;
  readonly bytes: number;
}

/** The trailer loop, 8.96 s, 24 fps, muted, seamless: 1280 by 538 and 1920 by 808. */
export const STRIPS: readonly [StripFile, StripFile] = [
  { path: "/video/home/strip-1280.mp4", w: 1280, h: 538, bytes: 2431307 },
  { path: "/video/home/strip-1920.mp4", w: 1920, h: 808, bytes: 3814520 },
];

/** The first frame of the strip loop (the colour check compares the paused plane with it). */
export const STRIP_POSTER = "/img/home/strip-poster.webp";

/** What the "Play Films" button opens: the library's film that the strip is cut from. */
export const TRAILER_FILM = {
  id: "film-selena-and-obsidia-video-trailer-001-3994447231709070185",
  title: "Day of Enders",
  href: "/collection/video/films?i=film-selena-and-obsidia-video-trailer-001-3994447231709070185",
  durLabel: "03:01",
} as const;

export interface PreviewFilm {
  /** The film's id in the collection (`FILM_IDS`). */
  readonly id: string;
  readonly title: string;
  /** Where the film opens in the collection. */
  readonly href: string;
  readonly path: string;
  readonly bytes: number;
  /** The colour of the clip's first frame: the card is this colour until its video arrives. */
  readonly color: string;
}

/** The ten previews: 4 s loops of 560 by 286 (1.96 to 1), in the order of the collection's films. */
export const PREVIEWS: readonly PreviewFilm[] = [
  {
    id: "film-selena-and-obsidia-video-trailer-001-3994447231709070185",
    title: "Day of Enders",
    href: "/collection/video/films?i=film-selena-and-obsidia-video-trailer-001-3994447231709070185",
    path: "/video/home/preview/film-selena-and-obsidia-video-trailer-001-3994447231709070185.mp4",
    bytes: 257333,
    color: "#765978",
  },
  {
    id: "film-selena-and-obsidia-video-selena-video",
    title: "The Pawn's Gambit",
    href: "/collection/video/films?i=film-selena-and-obsidia-video-selena-video",
    path: "/video/home/preview/film-selena-and-obsidia-video-selena-video.mp4",
    bytes: 500322,
    color: "#413964",
  },
  {
    id: "film-selena-and-obsidia-video-obsidia-001-3997406762701005025",
    title: "The Queen's Endgame",
    href: "/collection/video/films?i=film-selena-and-obsidia-video-obsidia-001-3997406762701005025",
    path: "/video/home/preview/film-selena-and-obsidia-video-obsidia-001-3997406762701005025.mp4",
    bytes: 330542,
    color: "#533852",
  },
  {
    id: "film-vexana-and-guinevere-video-connection-lost-final-video",
    title: "Connection Lost",
    href: "/collection/video/films?i=film-vexana-and-guinevere-video-connection-lost-final-video",
    path: "/video/home/preview/film-vexana-and-guinevere-video-connection-lost-final-video.mp4",
    bytes: 221010,
    color: "#aeaad2",
  },
  {
    id: "film-vexana-and-guinevere-video-relink-final-video2",
    title: "Re:Link",
    href: "/collection/video/films?i=film-vexana-and-guinevere-video-relink-final-video2",
    path: "/video/home/preview/film-vexana-and-guinevere-video-relink-final-video2.mp4",
    bytes: 407645,
    color: "#785d92",
  },
  {
    id: "film-lesley-and-change-video-official-trailer-o3ryhixwofw",
    title: "Rekindled Light",
    href: "/collection/video/films?i=film-lesley-and-change-video-official-trailer-o3ryhixwofw",
    path: "/video/home/preview/film-lesley-and-change-video-official-trailer-o3ryhixwofw.mp4",
    bytes: 161047,
    color: "#8c767e",
  },
  {
    id: "film-ruby-and-angela-video-ruby-ruby-final",
    title: "A Way Out",
    href: "/collection/video/films?i=film-ruby-and-angela-video-ruby-ruby-final",
    path: "/video/home/preview/film-ruby-and-angela-video-ruby-ruby-final.mp4",
    bytes: 145559,
    color: "#43515d",
  },
  {
    id: "film-ruby-and-angela-video-angela-angela-final",
    title: "A Friend",
    href: "/collection/video/films?i=film-ruby-and-angela-video-angela-angela-final",
    path: "/video/home/preview/film-ruby-and-angela-video-angela-angela-final.mp4",
    bytes: 175916,
    color: "#637992",
  },
  {
    id: "film-ruby-and-angela-video-trailer-trailer-final",
    title: "Awakening",
    href: "/collection/video/films?i=film-ruby-and-angela-video-trailer-trailer-final",
    path: "/video/home/preview/film-ruby-and-angela-video-trailer-trailer-final.mp4",
    bytes: 182750,
    color: "#4e4c61",
  },
  {
    id: "film-layla-and-fanny-video-official-lore-trailer-trailer",
    title: "Go For It! Aspirants!",
    href: "/collection/video/films?i=film-layla-and-fanny-video-official-lore-trailer-trailer",
    path: "/video/home/preview/film-layla-and-fanny-video-official-lore-trailer-trailer.mp4",
    bytes: 305251,
    color: "#b59dc1",
  },
];

export const PREVIEW_ASPECT = 560 / 286;

/**
 * The strip that matches a display: its width in physical pixels, which is the CSS width times the
 * pixel ratio (never capped: the stage's own ratio is capped and would pick the other file). By the
 * display only, never by the device or the connection.
 */
export function pickStrip(cssWidth: number, pixelRatio: number): StripFile {
  const physical = cssWidth * (pixelRatio > 0 ? pixelRatio : 1);
  return physical >= 1920 ? STRIPS[1] : STRIPS[0];
}

/** The strip for this window, or the 1280 one when there is no window (the server). */
export function stripForWindow(): StripFile {
  if (typeof window === "undefined") return STRIPS[0];
  return pickStrip(window.innerWidth, window.devicePixelRatio || 1);
}
