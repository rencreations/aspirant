import { pairs } from "@/content/pairs";
import { CHARACTER_NAMES } from "@/lib/slugs";

import type { FanItem, FanPicture, Filters, KindFilter } from "./types";

export const SEVERAL = "Several artists";
const NOT_NAMED = "Artist not named";

/** The kind chip a piece belongs to. */
export function kindOf(item: FanItem): Exclude<KindFilter, ""> {
  return item.kind === "video" ? "video" : item.kind === "cosplay" ? "cosplay" : "art";
}

/** Lower case words a search looks in: title, artist, characters, medium, platform. */
export function searchText(item: FanItem): string {
  const names = item.chars.map((c) => CHARACTER_NAMES[c]);
  return [
    item.title,
    item.credit?.by ?? "",
    item.platform ?? "",
    item.kind === "video" ? "video animation" : item.kind === "cosplay" ? "cosplay photo" : "art",
    ...names,
    ...item.tags,
    item.credit?.note ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

/** Every word of the query must appear. An empty query matches everything. */
export function matchesQuery(item: FanItem, q: string): boolean {
  const words = q.toLowerCase().split(/\s+/u).filter(Boolean);
  if (words.length === 0) return true;
  const hay = searchText(item);
  return words.every((w) => hay.includes(w));
}

export function matches(item: FanItem, f: Filters): boolean {
  if (f.pair && !item.pairs.includes(f.pair as FanItem["pairs"][number])) return false;
  if (f.who && !item.chars.includes(f.who as FanItem["chars"][number])) return false;
  if (f.platform && item.platform !== f.platform) return false;
  if (f.kind && kindOf(item) !== f.kind) return false;
  return matchesQuery(item, f.q);
}

export function filterItems<T extends FanItem>(items: readonly T[], f: Filters): T[] {
  return items.filter((it) => matches(it, f));
}

export function isFiltered(f: Filters): boolean {
  return Boolean(f.q.trim() || f.pair || f.who || f.platform || f.kind);
}

/** How many items each value of a filter would leave, with the other filters applied. */
export function countBy(
  items: readonly FanItem[],
  filters: Filters,
  skip: keyof Filters,
  keys: (item: FanItem) => readonly string[],
): Map<string, number> {
  const out = new Map<string, number>();
  const f: Filters = { ...filters, [skip]: "" };
  for (const it of items) {
    if (!matches(it, f)) continue;
    for (const k of keys(it)) out.set(k, (out.get(k) ?? 0) + 1);
  }
  return out;
}

export function pairName(id: string): string {
  return pairs.find((p) => p.id === id)?.names ?? id;
}

/** Newest first. Pieces of one post stay together in their order. */
export function byDate<T extends FanItem>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
}

// ---------------------------------------------------------------------------------------------
// By artist
// ---------------------------------------------------------------------------------------------

export interface ArtistGroup {
  key: string;
  name: string;
  platform: string | null;
  /** Pictures and cosplay photos. */
  creative: number;
  /** Videos. */
  animated: number;
  items: FanItem[];
}

export interface PostGroup {
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

/** The order the viewer walks through in the By artist view: artists, group posts, official, unnamed. */
export function artistOrder(view: ArtistView): FanItem[] {
  return [
    ...view.artists.flatMap((a) => a.items),
    ...view.posts.flatMap((p) => p.items),
    ...view.official,
    ...view.unnamed,
  ];
}

// ---------------------------------------------------------------------------------------------
// Text for the viewer
// ---------------------------------------------------------------------------------------------

export function creditText(item: FanItem): string {
  const by = item.credit?.by ?? NOT_NAMED;
  return item.credit?.platform ? `${by} on ${item.credit.platform}` : by;
}

/** The badge text. Fan work is fan work. The official account's reels are labelled as what they are. */
export function canonLabel(item: FanItem): string {
  if (item.canon === "fan") return "Fan work";
  return item.tags.includes("official") ? "Official reel, not story" : "Non-canon";
}

export function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(iso);
  if (!m) return iso;
  const months = [
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
  const name = months[Number(m[2]) - 1];
  return name ? `${name} ${Number(m[3])}, ${m[1]}` : iso;
}

const MEDIUM = [
  "digital",
  "sketch",
  "lineart",
  "speedpaint",
  "animation",
  "comic",
  "pencil",
  "chibi",
];

/** Make a piece readable by the shared viewer: a note, and the facts shown beside the picture. */
export function toPicture(item: FanItem): FanPicture {
  const facts: Array<[string, string]> = [];
  const kind =
    item.kind === "cosplay" ? "Cosplay photo" : item.kind === "video" ? "Video" : "Fan art";
  facts.push(["Kind", kind]);
  const date = formatDate(item.date);
  if (date) facts.push(["Posted", date]);
  if (item.platform) facts.push(["Platform", item.platform]);
  const medium = item.tags.filter((t) => MEDIUM.includes(t));
  if (medium.length) facts.push(["Medium", medium.join(", ")]);
  return { ...item, note: item.credit?.note, facts };
}
