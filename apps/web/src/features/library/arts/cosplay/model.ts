import { CHARACTER_NAMES, isCharacterSlug, type CharacterSlug } from "@/lib/slugs";

import type { ArtsFile, ArtsItem } from "../core/types";

/**
 * The logic of the Cosplay rooms, with no React and no browser: which photos belong to an Aspirant,
 * the order of the ten, how many of her photos the roster shows as thumbnails, and the words. The
 * pages (`page.tsx`, `character.tsx`) and the loading list (`preload.ts`) all read it.
 */

/** One cosplay photo (`public/data/library/arts-cosplay.json`). A duo photo lists both Aspirants and shows under both. */
export interface CosplayItem extends ArtsItem {
  /** ISO date of the post. */
  date?: string;
  /** Which of the three official reveals it came from (1 to 3). */
  reveal?: number;
  /** Its place in the reveal (1 to 4). */
  photo?: number;
}

/** One of the ten, as the data file lists her. */
interface CosplayCharacter {
  slug: CharacterSlug;
  name: string;
  pair: string;
  /** How many photos hold her. */
  count: number;
}

/** The head of the data file: all ten Aspirants, with or without a photo. */
export interface CosplayHead {
  characters: CosplayCharacter[];
}

export type CosplayFile = ArtsFile<CosplayItem> & CosplayHead;

/**
 * The ten in pair order, the order of the data file and of the roster: Fanny and Layla, Ruby and
 * Angela, Lesley and Chang'e, Guinevere and Vexana, Selena and Obsidia. A test checks it against the
 * data file. It is the order of the roster, the switcher and the arrow keys.
 */
export const ROSTER_ORDER: readonly CharacterSlug[] = [
  "fanny",
  "layla",
  "ruby",
  "angela",
  "lesley",
  "change",
  "guinevere",
  "vexana",
  "selena",
  "obsidia",
];

/** One line of the roster: an Aspirant and how many photos hold her. `count` is null until the data is in. */
export interface RosterEntry {
  slug: CharacterSlug;
  name: string;
  count: number | null;
}

/** The ten, in order. Before the data has arrived every count is null, so the page can stand with her name and art. */
export function rosterOf(items: readonly CosplayItem[] | null): RosterEntry[] {
  return ROSTER_ORDER.map((slug) => ({
    slug,
    name: CHARACTER_NAMES[slug],
    count: items ? photosOf(items, slug).length : null,
  }));
}

/**
 * The photos that hold one Aspirant: her own first, then the ones she shares with a partner (a duo
 * photo stands under both). Each group keeps the order of the file (the order of the posts). So the
 * two Aspirants of a pair do not open on the same pictures.
 */
export function photosOf(items: readonly CosplayItem[], slug: CharacterSlug): CosplayItem[] {
  const mine = items.filter((item) => (item.chars as readonly string[]).includes(slug));
  return [
    ...mine.filter((item) => item.chars.length === 1),
    ...mine.filter((item) => item.chars.length > 1),
  ];
}

/** The Aspirant a photo opens under: the first one it lists in the roster's order. */
export function firstCharacterOf(item: CosplayItem): CharacterSlug | null {
  for (const slug of ROSTER_ORDER) {
    if ((item.chars as readonly string[]).includes(slug)) return slug;
  }
  return null;
}

/** How many photos there are in all, and how many Aspirants hold at least one. */
export function totalsOf(items: readonly CosplayItem[]): { photos: number; withPhotos: number } {
  const roster = rosterOf(items);
  return { photos: items.length, withPhotos: roster.filter((r) => (r.count ?? 0) > 0).length };
}

/** The Aspirant after or before `slug`, going round the ten. */
export function neighbour(slug: CharacterSlug, delta: 1 | -1): CharacterSlug {
  const at = ROSTER_ORDER.indexOf(slug);
  const start = at < 0 ? 0 : at;
  const next = (start + delta + ROSTER_ORDER.length) % ROSTER_ORDER.length;
  return ROSTER_ORDER[next] ?? slug;
}

/** How many thumbnails a roster tile shows when there are photos. */
export const THUMBS = 4;

/**
 * The thumbnails of a roster tile: up to `max` photos, and when there are more than `max` the last
 * cell is a "+N" counter instead of a picture.
 */
export function thumbsOf<T>(photos: readonly T[], max = THUMBS): { shown: T[]; more: number } {
  if (photos.length <= max) return { shown: [...photos], more: 0 };
  return { shown: photos.slice(0, max - 1), more: photos.length - (max - 1) };
}

/** The count in words, as a tile and the heading say it. `null` is a count that has not arrived. */
export function countWords(count: number | null): string {
  if (count === null) return "";
  if (count === 0) return "No cosplay yet";
  return count === 1 ? "1 photo" : `${count} photos`;
}

/** The count as two digits, for the roster tile. */
export function countDigits(count: number): string {
  return String(count).padStart(2, "0");
}

/** The calm line of an Aspirant with no photo. */
export const NO_COSPLAY = "No cosplay yet.";

/**
 * The one plain sentence under the art of a page that has photos: they show a real person, they
 * are credited, and where to ask for a removal.
 */
export const PEOPLE_LINE =
  "These are photos of real people who cosplay her, each credited to the person named in its post. To ask for a removal, use the link at the foot of the page.";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** `2022-01-14` as `14 Jan 2022`. Anything else comes back as it is. */
export function dateWords(iso: string | undefined): string {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})$/u.exec(iso) : null;
  if (!iso || !m) return iso ?? "";
  const month = MONTHS[Number(m[2]) - 1];
  return month ? `${Number(m[3])} ${month} ${m[1] ?? ""}` : iso;
}

/** Everything a search can find a photo by: what is seen, who it shows, who made it and the words of its tags. */
export function cosplaySearchOf(item: CosplayItem): string {
  const names = item.chars.map((slug) => (isCharacterSlug(slug) ? CHARACTER_NAMES[slug] : slug));
  return [item.title, item.alt, item.tags.join(" "), names.join(" "), item.credit?.by ?? ""].join(
    " ",
  );
}

/** No filter: a page of one Aspirant has nothing to filter by. */
export function noFacets(): readonly string[] {
  return [];
}
