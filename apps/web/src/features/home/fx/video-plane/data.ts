/**
 * What the film plane shows: the whole trailer (streamed, in the strip and its window) and the ten
 * preview clips of the official films. Written from `public/data/home/picks.json` (`trailer.film`
 * and `previews`), which the media workstream makes: `data.test.ts` keeps this file equal to it. It
 * is small on purpose, because `preload.ts` is in the bundle of every page.
 */

/**
 * The film the strip plays: the library's own file of "Day of Enders" (the same file the Films room
 * and the site's player stream), played whole, never held in memory. Round two (19 Nov 2026).
 */
export const TRAILER_FILM = {
  id: "film-selena-and-obsidia-video-trailer-001-3994447231709070185",
  title: "Day of Enders",
  href: "/collection/video/films?i=film-selena-and-obsidia-video-trailer-001-3994447231709070185",
  durLabel: "03:01",
  /** The key of the file in the bucket (`libUrl(key)` makes the address). */
  key: "video/films/film-selena-and-obsidia-video-trailer-001-3994447231709070185/video.mp4",
  /** The film's own picture, with the black bars already cut away: 1920 by 808. */
  w: 1920,
  h: 808,
  /** Width over height of the picture (2.376 to 1). The expanded window takes this shape: nothing of the picture is cropped. */
  aspect: 1920 / 808,
  /** Length in seconds and size in bytes (for the bar's estimate of the bytes it waits for). */
  dur: 180.8,
  bytes: 145190050,
  /**
   * Where the film rests and where its loop returns: the wide shot of Selena on the ledge with the
   * silver dragon (the cut is at 11.67 s). The film's own opening is a dark hall with a subtitle.
   */
  start: 11.7,
  /** The seconds from `start` that the loading bar waits for. The rest streams while it plays. */
  warmSeconds: 6,
} as const;

export interface PreviewFilm {
  /** The film's id in the collection (`FILM_IDS`). */
  readonly id: string;
  readonly title: string;
  /** Where the film opens in the collection. */
  readonly href: string;
  readonly path: string;
  readonly bytes: number;
  /** The clip's own size: the whole picture of the film, its real shape (16 to 9, or about 2.37 to 1). */
  readonly w: number;
  readonly h: number;
  /** The colour of the film: the card is this colour until its video arrives. */
  readonly color: string;
}

/**
 * The ten previews: 4 s loops, 1280 wide, each the whole picture of its film (v2, 19 Nov 2026), in the
 * order of the collection's films.
 */
export const PREVIEWS: readonly PreviewFilm[] = [
  {
    id: "film-selena-and-obsidia-video-trailer-001-3994447231709070185",
    title: "Day of Enders",
    href: "/collection/video/films?i=film-selena-and-obsidia-video-trailer-001-3994447231709070185",
    path: "/video/home/preview/v2/film-selena-and-obsidia-video-trailer-001-3994447231709070185.mp4",
    bytes: 1875899,
    w: 1280,
    h: 538,
    color: "#765978",
  },
  {
    id: "film-selena-and-obsidia-video-selena-video",
    title: "The Pawn's Gambit",
    href: "/collection/video/films?i=film-selena-and-obsidia-video-selena-video",
    path: "/video/home/preview/v2/film-selena-and-obsidia-video-selena-video.mp4",
    bytes: 1540339,
    w: 1280,
    h: 720,
    color: "#413964",
  },
  {
    id: "film-selena-and-obsidia-video-obsidia-001-3997406762701005025",
    title: "The Queen's Endgame",
    href: "/collection/video/films?i=film-selena-and-obsidia-video-obsidia-001-3997406762701005025",
    path: "/video/home/preview/v2/film-selena-and-obsidia-video-obsidia-001-3997406762701005025.mp4",
    bytes: 2023721,
    w: 1280,
    h: 720,
    color: "#533852",
  },
  {
    id: "film-vexana-and-guinevere-video-connection-lost-final-video",
    title: "Connection Lost",
    href: "/collection/video/films?i=film-vexana-and-guinevere-video-connection-lost-final-video",
    path: "/video/home/preview/v2/film-vexana-and-guinevere-video-connection-lost-final-video.mp4",
    bytes: 1367608,
    w: 1280,
    h: 540,
    color: "#aeaad2",
  },
  {
    id: "film-vexana-and-guinevere-video-relink-final-video2",
    title: "Re:Link",
    href: "/collection/video/films?i=film-vexana-and-guinevere-video-relink-final-video2",
    path: "/video/home/preview/v2/film-vexana-and-guinevere-video-relink-final-video2.mp4",
    bytes: 1948725,
    w: 1280,
    h: 540,
    color: "#785d92",
  },
  {
    id: "film-lesley-and-change-video-official-trailer-o3ryhixwofw",
    title: "Rekindled Light",
    href: "/collection/video/films?i=film-lesley-and-change-video-official-trailer-o3ryhixwofw",
    path: "/video/home/preview/v2/film-lesley-and-change-video-official-trailer-o3ryhixwofw.mp4",
    bytes: 781671,
    w: 1280,
    h: 540,
    color: "#8c767e",
  },
  {
    id: "film-ruby-and-angela-video-ruby-ruby-final",
    title: "A Way Out",
    href: "/collection/video/films?i=film-ruby-and-angela-video-ruby-ruby-final",
    path: "/video/home/preview/v2/film-ruby-and-angela-video-ruby-ruby-final.mp4",
    bytes: 702395,
    w: 1280,
    h: 540,
    color: "#43515d",
  },
  {
    id: "film-ruby-and-angela-video-angela-angela-final",
    title: "A Friend",
    href: "/collection/video/films?i=film-ruby-and-angela-video-angela-angela-final",
    path: "/video/home/preview/v2/film-ruby-and-angela-video-angela-angela-final.mp4",
    bytes: 991303,
    w: 1280,
    h: 540,
    color: "#637992",
  },
  {
    id: "film-ruby-and-angela-video-trailer-trailer-final",
    title: "Awakening",
    href: "/collection/video/films?i=film-ruby-and-angela-video-trailer-trailer-final",
    path: "/video/home/preview/v2/film-ruby-and-angela-video-trailer-trailer-final.mp4",
    bytes: 2023199,
    w: 1280,
    h: 540,
    color: "#4e4c61",
  },
  {
    id: "film-layla-and-fanny-video-official-lore-trailer-trailer",
    title: "Go For It! Aspirants!",
    href: "/collection/video/films?i=film-layla-and-fanny-video-official-lore-trailer-trailer",
    path: "/video/home/preview/v2/film-layla-and-fanny-video-official-lore-trailer-trailer.mp4",
    bytes: 1451430,
    w: 1280,
    h: 546,
    color: "#b59dc1",
  },
];

/** A preview's width over its height: the shape of its card in the orbit. */
export function previewAspect(film: PreviewFilm): number {
  return film.w / film.h;
}

/**
 * The shape the orbit lays its ellipse out for (the old 560 by 286 card). A card is drawn at its own
 * film's shape (`previewAspect`); this only sizes the ring, so the ring does not move with the films.
 */
export const PREVIEW_ASPECT = 560 / 286;
