/**
 * The pure logic of the official art tab: search, the three filters and the counts on their chips.
 * Kept apart from the page so it can be tested.
 */
import { pairs } from "@/content/pairs";
import { CHARACTER_NAMES, CHARACTER_SLUGS } from "@/lib/slugs";

import { ART_KINDS, KIND_LABELS, type ArtItem, type ArtKind } from "./types";

export interface ArtFilters {
  /** Free text. Every word has to be found. */
  q: string;
  /** A character slug, or "". */
  who: string;
  kind: ArtKind | "";
  /** A pair id, or "". */
  pair: string;
}

export const NO_FILTERS: ArtFilters = { q: "", who: "", kind: "", pair: "" };

const PAIR_NAMES = new Map(pairs.map((p) => [p.id as string, p.names]));

export function pairName(id: string | null): string {
  return id ? (PAIR_NAMES.get(id) ?? "") : "";
}

export function charName(slug: string): string {
  return (CHARACTER_NAMES as Record<string, string>)[slug] ?? slug;
}

/** Everything a search can match, in lower case: the title, the words, the names, the kind. */
export function haystack(item: ArtItem): string {
  return [
    item.title,
    item.alt,
    item.note ?? "",
    item.tags.join(" "),
    item.chars.map(charName).join(" "),
    pairName(item.pair),
    KIND_LABELS[item.kind],
  ]
    .join(" ")
    .toLowerCase();
}

/** The words of a search box, lower case, without empty ones. */
export function words(q: string): string[] {
  return q.toLowerCase().split(/\s+/u).filter(Boolean);
}

export function matchesText(item: ArtItem, q: string): boolean {
  const ws = words(q);
  if (!ws.length) return true;
  const hay = haystack(item);
  return ws.every((w) => hay.includes(w));
}

type Facet = "who" | "kind" | "pair";

/** True when the item passes the filters. `skip` leaves one facet out (to count its chips). */
export function matches(item: ArtItem, f: ArtFilters, skip?: Facet): boolean {
  if (skip !== "who" && f.who && !item.chars.includes(f.who as ArtItem["chars"][number]))
    return false;
  if (skip !== "kind" && f.kind && item.kind !== f.kind) return false;
  if (skip !== "pair" && f.pair && item.pair !== f.pair) return false;
  return matchesText(item, f.q);
}

export function filterArts(items: readonly ArtItem[], f: ArtFilters): ArtItem[] {
  return items.filter((it) => matches(it, f));
}

export interface FacetCounts {
  who: Record<string, number>;
  kind: Record<string, number>;
  pair: Record<string, number>;
}

/**
 * How many pictures each chip would show if it were pressed, with the other filters kept. A chip
 * at 0 is disabled, so nobody lands on an empty page by pressing it.
 */
export function facetCounts(items: readonly ArtItem[], f: ArtFilters): FacetCounts {
  const out: FacetCounts = { who: {}, kind: {}, pair: {} };
  for (const slug of CHARACTER_SLUGS) out.who[slug] = 0;
  for (const k of ART_KINDS) out.kind[k] = 0;
  for (const p of pairs) out.pair[p.id] = 0;
  for (const it of items) {
    if (matches(it, f, "who")) for (const c of it.chars) out.who[c] = (out.who[c] ?? 0) + 1;
    if (matches(it, f, "kind")) out.kind[it.kind] = (out.kind[it.kind] ?? 0) + 1;
    if (matches(it, f, "pair") && it.pair) out.pair[it.pair] = (out.pair[it.pair] ?? 0) + 1;
  }
  return out;
}

/** The ten splash arts, in the order of the roster (Fanny first), for the ribbon. */
export function splashRibbon(items: readonly ArtItem[]): ArtItem[] {
  const out: ArtItem[] = [];
  for (const slug of CHARACTER_SLUGS) {
    const hit = items.find((it) => it.kind === "splash" && it.chars[0] === slug);
    if (hit) out.push(hit);
  }
  return out;
}

/** The ribbon shows previews (it is taller than a thumbnail is sharp). */
export function ribbonKeys(items: readonly ArtItem[]): string[] {
  return splashRibbon(items).map((it) => it.img.p);
}

/** The first screen: the ribbon's previews, then the thumbnails of the first pictures of the grid. */
export function firstScreenKeys(items: readonly ArtItem[], count = 12): string[] {
  const keys = ribbonKeys(items);
  for (const it of items) {
    if (keys.length >= count) break;
    if (!keys.includes(it.img.t)) keys.push(it.img.t);
  }
  return keys;
}

/** The thumbnails of everything else, for the background. */
export function restKeys(items: readonly ArtItem[], count = 12): string[] {
  const first = new Set(firstScreenKeys(items, count));
  return items.map((it) => it.img.t).filter((k) => !first.has(k));
}

/** A short line that says what the filters leave, for screen readers. */
export function summaryLine(shown: number, total: number, f: ArtFilters): string {
  const active = Boolean(f.q.trim() || f.who || f.kind || f.pair);
  if (!active) return `${total} pictures`;
  if (shown === 0) return "No picture matches";
  return `${shown} of ${total} pictures`;
}
