/** Filtering and search for the archive. Pure functions, no React. */
import { getPair } from "@/content/pairs";
import type { PairId, Slug } from "@/content/types";
import { CHARACTER_NAMES } from "@/lib/slugs";

import type { CollectionItem, WhoFilter } from "./types";

/** Lower-cased text a visitor can search for. Voice lines add their own text elsewhere. */
export function itemText(item: Exclude<CollectionItem, { kind: "voice" }>): string {
  const parts: string[] = [item.title];
  if (item.pair) parts.push(getPair(item.pair).names);
  for (const slug of item.characters) parts.push(CHARACTER_NAMES[slug]);
  switch (item.kind) {
    case "film":
      parts.push(item.category, item.vertical ? "vertical" : "", "film video");
      break;
    case "track":
      parts.push(item.role, item.credit, "music song audio");
      break;
    case "comic":
      parts.push("comic webtoon strip read");
      break;
    case "art":
      parts.push(item.artKind, "official art");
      break;
    case "fanart":
      parts.push(item.credit, item.artist ?? "", "fan art");
      break;
    case "model":
      parts.push("3d model glb");
      break;
  }
  return parts.join(" ").toLowerCase();
}

/** Every word of the query must appear in the text. An empty query matches everything. */
export function matchesQuery(text: string, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return words.every((word) => text.includes(word));
}

/** Does the item belong to the chosen character or pair? */
export function matchesWho(
  item: { pair: PairId | null; characters: readonly Slug[] },
  who: WhoFilter,
): boolean {
  if (who.type === "all") return true;
  if (who.type === "pair") return item.pair === who.id;
  return item.characters.includes(who.slug);
}

/** Human label for the active who filter. */
export function whoLabel(who: WhoFilter): string {
  if (who.type === "all") return "everyone";
  if (who.type === "pair") return getPair(who.id).names;
  return CHARACTER_NAMES[who.slug];
}

export function sameWho(a: WhoFilter, b: WhoFilter): boolean {
  if (a.type !== b.type) return false;
  if (a.type === "pair" && b.type === "pair") return a.id === b.id;
  if (a.type === "char" && b.type === "char") return a.slug === b.slug;
  return true;
}
