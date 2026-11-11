import { pairs } from "@/content/pairs";
import type { Slug } from "@/content/types";
import { CHARACTER_NAMES } from "@/lib/slugs";

import { MOVED_COSPLAY } from "../core/legacy-ids";
import { cosplayRoute } from "../core/routes";
import { facetsFrom } from "../core/flow/facets";
import { buildIndex, filterIndexes, searchIndexes } from "../core/flow/filter";
import type { Facet } from "../core/types";
import type { FanItem, FanRaw } from "./types";

const SEVERAL = "Several artists";

// ---------------------------------------------------------------------------------------------
// The items
// ---------------------------------------------------------------------------------------------

/** Who made a piece, in words. The sources do not always say. */
function whoWords(by: string | null | undefined): string {
  if (!by) return "an artist who is not named";
  return by === SEVERAL ? "several artists" : by;
}

/** Make one piece of the data file into what the flow and the zoom read. Nothing is invented: `alt` is the title and the maker. */
export function adaptFan(raw: FanRaw): FanItem {
  return {
    ...raw,
    collection: "arts",
    room: "fanart",
    alt: `${raw.title}. By ${whoWords(raw.credit?.by)}.`,
    places: raw.chars,
  };
}

/** The pictures (no videos), newest first. A post's pieces keep the order of the file. */
export function picturesNewest<T extends FanItem>(items: readonly T[]): T[] {
  return items.filter((i) => i.kind !== "video").sort(byDateDesc);
}

/** The videos: fan videos first, then the official reels, each newest first. */
export function videosOrdered<T extends FanItem>(items: readonly T[]): T[] {
  return items
    .filter((i) => i.kind === "video")
    .sort((a, b) => Number(a.canon !== "fan") - Number(b.canon !== "fan") || byDateDesc(a, b));
}

function byDateDesc(a: FanItem, b: FanItem): number {
  return (b.date ?? "").localeCompare(a.date ?? "");
}

/** Every piece, newest first. */
export function allNewest<T extends FanItem>(items: readonly T[]): T[] {
  return [...items].sort(byDateDesc);
}

// ---------------------------------------------------------------------------------------------
// Search and the filter
// ---------------------------------------------------------------------------------------------

/**
 * A facet is one id with a prefix for its kind, so one list serves one filter: `c:` an Aspirant,
 * `p:` a pair, `pl:` a platform, `a:` the artist of a piece.
 */
export function fanFacetOf(item: FanItem): readonly string[] {
  const out: string[] = [];
  for (const c of item.chars) out.push(`c:${c}`);
  for (const p of item.pairs) out.push(`p:${p}`);
  if (item.platform) out.push(`pl:${item.platform}`);
  if (item.artist) out.push(`a:${item.artist}`);
  return out;
}

/** Everything one piece is found by, as one string: title, maker, platform, kind, Aspirants, pairs, tags, note and year. */
export function fanSearchOf(item: FanItem): string {
  return [
    item.title,
    item.credit?.by ?? "",
    item.credit?.platform ?? "",
    item.platform ?? "",
    item.kind === "video" ? "video animation" : "picture art",
    ...item.chars.map((c) => CHARACTER_NAMES[c]),
    ...item.pairs.map(pairName),
    ...item.tags,
    item.credit?.note ?? "",
    item.date?.slice(0, 4) ?? "",
  ].join(" ");
}

/** A pair, platform or artist with fewer pictures than this is not a chip (it is still found by search and in the By artist view). */
const MIN_CHIP = 2;

function pairName(id: string): string {
  return pairs.find((p) => p.id === id)?.names ?? id;
}

/**
 * The filter of Fanart: the Aspirants first (the most pictures first), then the pairs, the
 * platforms and the artists with more than one piece. The counts are the pieces of `items`, so
 * pass the pictures for the wall (the chips then count what the rows show).
 */
export function fanFacets(items: readonly FanItem[]): Facet[] {
  const characterNames = new Map(Object.entries(CHARACTER_NAMES).map(([k, v]) => [`c:${k}`, v]));
  const pairNames = new Map(pairs.map((p) => [`p:${p.id}`, `Pair: ${p.names}`]));
  const platformNames = new Map<string, string>();
  const artistNames = new Map<string, string>();
  for (const it of items) {
    if (it.platform) platformNames.set(`pl:${it.platform}`, it.platform);
    if (it.artist && it.credit?.by && !artistNames.has(`a:${it.artist}`)) {
      artistNames.set(`a:${it.artist}`, it.credit.by);
    }
  }
  const part = (prefix: string, names: ReadonlyMap<string, string>, min: number) =>
    facetsFrom(items, (it) => fanFacetOf(it).filter((id) => id.startsWith(prefix)), names).filter(
      (facet) => facet.count >= min,
    );
  return [
    ...part("c:", characterNames, 1),
    ...part("p:", pairNames, MIN_CHIP),
    ...part("pl:", platformNames, MIN_CHIP),
    ...part("a:", artistNames, MIN_CHIP),
  ];
}

/**
 * The pieces that pass the search and the filter, in order: the same functions the flow uses on
 * the pictures, so the video row and the By artist view agree with the rows. A filter that the
 * list does not know is no filter.
 */
export function fanFilter<T extends FanItem>(
  items: readonly T[],
  facets: readonly Facet[],
  q: string,
  f: string,
): T[] {
  const index = buildIndex(items, fanFacetOf, fanSearchOf, facets);
  const chosen = facets.some((facet) => facet.id === f) ? f : "";
  return filterIndexes(index, searchIndexes(index, q), chosen)
    .map((i) => items[i])
    .filter((item): item is T => item !== undefined);
}

// ---------------------------------------------------------------------------------------------
// By artist
// ---------------------------------------------------------------------------------------------

interface ArtistGroup {
  key: string;
  name: string;
  platform: string | null;
  /** Pictures. */
  creative: number;
  /** Videos. */
  animated: number;
  items: FanItem[];
}

interface PostGroup {
  /** The post address, the group's identity. */
  key: string;
  date: string | null;
  platform: string | null;
  /** Handles named in the post, from the credit note. */
  artists: string[];
  items: FanItem[];
}

export interface ArtistView {
  artists: ArtistGroup[];
  posts: PostGroup[];
  official: FanItem[];
  unnamed: FanItem[];
}

/** The `@handles` a group post names, read from its credit note. */
export function namedArtists(note: string | undefined): string[] {
  const m = /Named in the post: (.+?)\. /u.exec(note ?? "");
  if (!m?.[1]) return [];
  return m[1].split(",").map((s) => s.trim());
}

/** Group pieces under the artist who made them. Group posts, official reels and unnamed work are kept apart. */
export function groupByArtist(items: readonly FanItem[]): ArtistView {
  const artists = new Map<string, ArtistGroup>();
  const posts = new Map<string, PostGroup>();
  const official: FanItem[] = [];
  const unnamed: FanItem[] = [];
  for (const it of items) {
    if (it.canon !== "fan") {
      official.push(it);
    } else if (it.artist) {
      let g = artists.get(it.artist);
      if (!g) {
        g = {
          key: it.artist,
          name: it.credit?.by ?? it.artist,
          platform: it.platform,
          creative: 0,
          animated: 0,
          items: [],
        };
        artists.set(it.artist, g);
      }
      if (it.kind === "video") g.animated += 1;
      else g.creative += 1;
      g.items.push(it);
    } else if (it.credit?.by === SEVERAL) {
      const key = it.credit.url ?? it.id;
      let g = posts.get(key);
      if (!g) {
        g = {
          key,
          date: it.date,
          platform: it.platform,
          artists: namedArtists(it.credit.note),
          items: [],
        };
        posts.set(key, g);
      }
      g.items.push(it);
    } else {
      unnamed.push(it);
    }
  }
  const sortedArtists = [...artists.values()].sort(
    (a, b) =>
      b.creative + b.animated - (a.creative + a.animated) || a.name.localeCompare(b.name, "en"),
  );
  const sortedPosts = [...posts.values()].sort((a, b) =>
    (b.date ?? "").localeCompare(a.date ?? ""),
  );
  return { artists: sortedArtists, posts: sortedPosts, official, unnamed };
}

/** The order of the By artist view, and of the viewer in it: artists, group posts, official, unnamed. */
export function artistOrder(view: ArtistView): FanItem[] {
  return [
    ...view.artists.flatMap((a) => a.items),
    ...view.posts.flatMap((p) => p.items),
    ...view.official,
    ...view.unnamed,
  ];
}

// ---------------------------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------------------------

/** The badge text. Fan work is fan work. The official account's reels are labelled as what they are. */
export function canonLabel(item: FanItem): string {
  if (item.canon === "fan") return "Fan work";
  return item.tags.includes("official") ? "Official reel, not story" : "Non-canon";
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(iso);
  if (!m) return iso;
  const name = MONTHS[Number(m[2]) - 1];
  return name ? `${name} ${Number(m[3])}, ${m[1]}` : iso;
}

/** The Aspirants in a piece, in words. A piece that shows none is about the heroes. */
export function charsWords(chars: readonly Slug[]): string {
  return chars.length > 0 ? chars.map((c) => CHARACTER_NAMES[c]).join(", ") : "Heroes";
}

// ---------------------------------------------------------------------------------------------
// The old address
// ---------------------------------------------------------------------------------------------

/**
 * Where an old picture id of this room lives now. The twelve cosplay photos left Fanart: the page
 * of their Aspirant in Cosplay, with the new id. Null for every other id. The route has no base path.
 */
export function movedTarget(id: string): string | null {
  if (!Object.hasOwn(MOVED_COSPLAY, id)) return null;
  const moved = MOVED_COSPLAY[id];
  if (!moved) return null;
  return `${cosplayRoute(moved.character as Slug)}/?i=${encodeURIComponent(moved.id)}`;
}
