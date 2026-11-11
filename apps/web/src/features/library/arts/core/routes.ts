import type { Route } from "next";

import type { Slug } from "@/content/types";

/**
 * The Arts collection holds three rooms on the shelf (Official, Fanart, Cosplay), the way Video
 * holds two. Official has six sub-pages. Routes:
 *
 *   /collection/arts                      Official, Splash art
 *   /collection/arts/{scene,comic,game,design,others}   the other Official sub-pages
 *   /collection/arts/fanart               Fanart
 *   /collection/arts/cosplay              Cosplay, the ten Aspirants
 *   /collection/arts/cosplay/<slug>       Cosplay of one Aspirant
 *
 * The shelf is the chooser: `/collection?open=arts` is the Arts cover open into its three rooms.
 */

/** The six sub-pages of Official, in the order of their buttons. */
const OFFICIAL_ROOMS = ["splash", "scene", "comic", "game", "design", "others"] as const;

export type OfficialRoom = (typeof OFFICIAL_ROOMS)[number];

/** Every Arts room that has a data file (`arts-<room>.json`). */
export const ARTS_ROOMS = [...OFFICIAL_ROOMS, "fanart", "cosplay"] as const;

export type ArtsRoom = (typeof ARTS_ROOMS)[number];

/** The rooms served by `app/collection/arts/[room]/page.tsx` (Splash art and Cosplay have pages of their own). */
export const ARTS_SEGMENTS = ["scene", "comic", "game", "design", "others", "fanart"] as const;

export type ArtsSegment = (typeof ARTS_SEGMENTS)[number];

export function isArtsSegment(value: string): value is ArtsSegment {
  return (ARTS_SEGMENTS as readonly string[]).includes(value);
}

/** The words on the sub-page buttons and in the headings. */
export const ROOM_LABELS: Readonly<Record<ArtsRoom, string>> = {
  splash: "Splash art",
  scene: "Scene",
  comic: "Comic",
  game: "Game",
  design: "Design",
  others: "Others",
  fanart: "Fanart",
  cosplay: "Cosplay",
};

/** Route of one Arts room. Splash art is `/collection/arts` itself. */
export function artsRoute(room: ArtsRoom): Route {
  if (room === "splash") return "/collection/arts";
  return `/collection/arts/${room}` as Route;
}

/** Route of the Cosplay page of one Aspirant. */
export function cosplayRoute(slug: Slug): Route {
  return `/collection/arts/cosplay/${slug}` as Route;
}

/** The shelf with the Arts cover open: where the way back of every Arts room goes. */
export const ARTS_SHELF_HREF = "/collection?open=arts" as Route;

/** The sub-page buttons of Official. */
export const OFFICIAL_NAV: ReadonlyArray<{ room: OfficialRoom; label: string; href: Route }> =
  OFFICIAL_ROOMS.map((room) => ({ room, label: ROOM_LABELS[room], href: artsRoute(room) }));

/** The part of the route after `/collection/` for the loading list: `arts`, `arts/scene`, `arts/cosplay/ruby`. */
export function artsRoomOfPath(path: string): { room: ArtsRoom; character?: string } | null {
  const [slug, room, character] = path.replace(/^\/+|\/+$/gu, "").split("/");
  if (slug !== "arts") return null;
  if (!room) return { room: "splash" };
  if (room === "cosplay") return character ? { room: "cosplay", character } : { room: "cosplay" };
  return (ARTS_ROOMS as readonly string[]).includes(room) ? { room: room as ArtsRoom } : null;
}

/**
 * Where an Arts picture opens, from the room named in its search entry (`r`). A cosplay picture
 * opens on the page of its first Aspirant, the others on their room. An unknown room is Splash art.
 */
export function artsRoomHref(room: string | undefined, character?: string): Route {
  if (room === "cosplay") {
    return character ? cosplayRoute(character as Slug) : "/collection/arts/cosplay";
  }
  return artsRoute(
    (ARTS_ROOMS as readonly string[]).includes(room ?? "") ? (room as ArtsRoom) : "splash",
  );
}
