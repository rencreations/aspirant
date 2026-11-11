import type { Route } from "next";

import type { VideoRoom } from "../types";

/**
 * The ten official films, in the order of the Films room (the owner's order, 10 Nov 2026). These
 * are the ids of the old Films data file, kept so the links already in the site still resolve.
 * Every other video is in the Others room.
 */
export const FILM_IDS = [
  "film-selena-and-obsidia-video-trailer-001-3994447231709070185",
  "film-selena-and-obsidia-video-selena-video",
  "film-selena-and-obsidia-video-obsidia-001-3997406762701005025",
  "film-vexana-and-guinevere-video-connection-lost-final-video",
  "film-vexana-and-guinevere-video-relink-final-video2",
  "film-lesley-and-change-video-official-trailer-o3ryhixwofw",
  "film-ruby-and-angela-video-ruby-ruby-final",
  "film-ruby-and-angela-video-angela-angela-final",
  "film-ruby-and-angela-video-trailer-trailer-final",
  "film-layla-and-fanny-video-official-lore-trailer-trailer",
] as const;

type FilmId = (typeof FILM_IDS)[number];

function isFilmId(id: string): id is FilmId {
  return (FILM_IDS as readonly string[]).includes(id);
}

/** The room that holds a video: one of the ten films, or Others. */
export function videoRoomOf(id: string): VideoRoom {
  return isFilmId(id) ? "films" : "others";
}

/** Route of a Video room, for example `/collection/video/films`. */
export function videoRoute(room: VideoRoom): Route {
  return `/collection/video/${room}` as Route;
}

/**
 * Rooms that link to a video and want the visitor back where they were when they close it. The
 * link carries `&from=<key>`; the video rooms read it (`returnOf`), send a close or a back button
 * to `href` instead of to their own parent, and say its `label` in the transition. Add a key here
 * before using it in a link.
 */
const RETURN_ROUTES = {
  music: { href: "/collection/music", label: "Music" },
  voicelines: { href: "/collection/voicelines", label: "Voicelines" },
  arts: { href: "/collection/arts", label: "Arts" },
} as const;

export type ReturnKey = keyof typeof RETURN_ROUTES;

function isReturnKey(value: string): value is ReturnKey {
  return Object.prototype.hasOwnProperty.call(RETURN_ROUTES, value);
}

export interface ReturnTarget {
  key: ReturnKey;
  href: Route;
  label: string;
}

/** Where the visitor came from, read from a query string (`?from=music`), or null. */
export function returnOf(search: string): ReturnTarget | null {
  const from = new URLSearchParams(search).get("from") ?? "";
  if (!isReturnKey(from)) return null;
  const { href, label } = RETURN_ROUTES[from];
  return { key: from, href: href as Route, label };
}

/**
 * A link that opens one video, at a second when `t` is given. Both rooms read `?i=<id>` and
 * `?t=<seconds>`: Films scrolls to that film and seeks, Others opens the video in its player. When
 * `from` is given, closing the video (or the room's back button) goes back to that room.
 */
export function videoHref(id: string, t?: number, from?: ReturnKey): Route {
  const time = t && t > 0 ? `&t=${Math.floor(t)}` : "";
  const back = from ? `&from=${from}` : "";
  return `${videoRoute(videoRoomOf(id))}?i=${encodeURIComponent(id)}${time}${back}` as Route;
}
