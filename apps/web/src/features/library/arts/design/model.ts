import type { Slug } from "@/content/types";

import { normalise, queryTerms } from "../core/flow/filter";
import type { Facet } from "../core/types";
import { KIND_IDS, type DesignFile, type DesignItem, type DesignQuery } from "./types";

/**
 * The pure logic of the Design room: the two filters (a kind and an Aspirant), the search, the
 * counts on the chips and the sheets the loading list waits for. No component and no DOM, so the
 * loading list and the page read the same answers.
 */

/** The Aspirants as the site spells them. */
const ASPIRANT_NAMES: Readonly<Record<Slug, string>> = {
  fanny: "Fanny",
  layla: "Layla",
  ruby: "Ruby",
  angela: "Angela",
  lesley: "Lesley",
  change: "Chang'e",
  guinevere: "Guinevere",
  vexana: "Vexana",
  obsidia: "Obsidia",
  selena: "Selena",
};

/** The words on the kind chips (many) and on a sheet's notes (one). */
const KIND_MANY: Readonly<Record<string, string>> = {
  character: "Characters",
  mecha: "Mecha",
  weapon: "Weapons",
  droid: "Droids",
  other: "Other",
};

const KIND_ONE: Readonly<Record<string, string>> = {
  character: "Character",
  mecha: "Mecha",
  weapon: "Weapon",
  droid: "Droid",
  other: "Other",
};

const words = (id: string): string =>
  id
    .split(/[-_]+/u)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

/** The name of an Aspirant from its slug. */
export function aspirantName(slug: string): string {
  return ASPIRANT_NAMES[slug as Slug] ?? words(slug);
}

/** The name of a kind on a chip, for example "Characters". */
export function kindName(id: string): string {
  return KIND_MANY[id] ?? words(id);
}

/** The name of a kind for one sheet, for example "Character". */
export function kindOne(id: string): string {
  return KIND_ONE[id] ?? words(id);
}

/**
 * The kind chips: the kinds that have a sheet, the most sheets first, then in the order of
 * `KIND_IDS`. The names come from the head of the data file when it gives them.
 */
export function kindFacets(file: Pick<DesignFile, "items" | "kinds"> | null): Facet[] {
  if (!file) return [];
  const named = new Map((file.kinds ?? []).map((kind) => [kind.id, kind.name]));
  const counts = new Map<string, number>();
  for (const item of file.items) counts.set(item.what, (counts.get(item.what) ?? 0) + 1);
  const rank = (id: string) => {
    const at = (KIND_IDS as readonly string[]).indexOf(id);
    return at < 0 ? KIND_IDS.length : at;
  };
  return [...counts]
    .map(([id, count]) => ({ id, name: named.get(id) ?? kindName(id), count }))
    .sort((a, b) => b.count - a.count || rank(a.id) - rank(b.id) || a.id.localeCompare(b.id));
}

/** The Aspirant chips: the ones that appear in a sheet, the most sheets first, ties in page order. */
export function whoFacets(items: readonly DesignItem[]): Facet[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    for (const id of new Set(item.chars)) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const seen = [...counts.keys()];
  return [...counts]
    .map(([id, count]) => ({ id, name: aspirantName(id), count }))
    .sort((a, b) => b.count - a.count || seen.indexOf(a.id) - seen.indexOf(b.id));
}

/** What a sheet is found by, folded, with a space at both ends. One string per item, in the order of `items`. */
export function buildDesignIndex(items: readonly DesignItem[]): string[] {
  return items.map(
    (item) =>
      ` ${normalise(
        [
          item.title,
          item.alt,
          item.tags.join(" "),
          kindOne(item.what),
          kindName(item.what),
          item.chars.map(aspirantName).join(" "),
          item.credit?.by ?? "",
        ].join(" "),
      )} `,
  );
}

/** The state of the room for one query. */
export interface DesignView {
  /** The sheets that show, in the order of the data. */
  shown: DesignItem[];
  /** How many sheets match the search alone. */
  searched: number;
  /** What each kind chip would show if it were chosen (the search and the Aspirant apply). */
  kinds: Map<string, number>;
  /** What each Aspirant chip would show if it were chosen (the search and the kind apply). */
  who: Map<string, number>;
}

/**
 * The sheets for a query, with the number each chip would show. A search is the words of the
 * query, all of which must appear. The two chips are independent: both can be on, and a sheet has
 * to pass both. The count on a chip leaves out its own group, so it tells what the chip would do.
 */
export function viewOf(
  items: readonly DesignItem[],
  index: readonly string[],
  query: DesignQuery,
): DesignView {
  const terms = queryTerms(query.q);
  const shown: DesignItem[] = [];
  const kinds = new Map<string, number>();
  const who = new Map<string, number>();
  let searched = 0;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item) continue;
    const text = index[i] ?? "";
    if (!terms.every((term) => text.includes(term))) continue;
    searched += 1;
    const kindOk = !query.kind || item.what === query.kind;
    const whoOk = !query.who || item.chars.includes(query.who as Slug);
    if (whoOk) kinds.set(item.what, (kinds.get(item.what) ?? 0) + 1);
    if (kindOk) {
      for (const id of new Set(item.chars)) who.set(id, (who.get(id) ?? 0) + 1);
    }
    if (kindOk && whoOk) shown.push(item);
  }
  return { shown, searched, kinds, who };
}

/** A value from the address that no chip has is no filter. */
export function resolveQuery(
  raw: DesignQuery,
  kinds: readonly Facet[],
  who: readonly Facet[],
): DesignQuery {
  return {
    q: raw.q,
    kind: kinds.some((facet) => facet.id === raw.kind) ? raw.kind : "",
    who: who.some((facet) => facet.id === raw.who) ? raw.who : "",
  };
}

/** The first `n` sheets that show for an address's query: what the loading list waits for. */
export function firstShown(file: DesignFile, raw: DesignQuery, n: number): DesignItem[] {
  const query = resolveQuery(raw, kindFacets(file), whoFacets(file.items));
  return viewOf(file.items, buildDesignIndex(file.items), query).shown.slice(0, n);
}

/** The number of a sheet in the whole room, two digits: 7 is "07". */
export function sheetNumber(n: number): string {
  return String(n).padStart(2, "0");
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-09-27" as "27 Sep 2026". Anything else is returned as it came. */
export function formatDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(iso);
  if (!match) return iso;
  const month = MONTHS[Number(match[2]) - 1];
  if (!month) return iso;
  return `${Number(match[3])} ${month} ${match[1]}`;
}

/** A sheet is wide and has writing on it: on a phone held upright it needs the phone turned to read. */
export function isWideWriting(item: DesignItem): boolean {
  const ratio = item.img.w / Math.max(1, item.img.h);
  const writing = item.tags.some((tag) => /sheet|chart|card/u.test(tag));
  return writing && ratio >= 1.35;
}
