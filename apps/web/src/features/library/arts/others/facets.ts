import type { Slug } from "@/content/types";

import type { ArtsFile, ArtsItem, Facet } from "../core/types";
import { defaultSearchOf, facetsFrom, orderFacets } from "../core/flow/facets";

/** One picture of Others: official art that fits no other room, and the pictures made for this site. */
export interface OthersItem extends ArtsItem {
  /** What it is: `chibi`, `lore`, `card`, `poster`, `pair`, `art`, `site`. */
  kind: string;
}

/** The head fields of `arts-others.json` besides `items`. */
export interface OthersHead {
  kinds?: Facet[];
  characters?: Array<{ slug: string; count: number }>;
}

/** The ten Aspirants, spelled as canon (`docs/design/canon-rules.md`). */
export const ASPIRANT_NAMES: Readonly<Record<Slug, string>> = {
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

const KIND = "kind:";
const CHAR = "char:";

/** The filter ids of one picture: its kind, and each Aspirant in it. */
export function othersFacetOf(item: OthersItem): readonly string[] {
  return [`${KIND}${item.kind}`, ...item.chars.map((slug) => `${CHAR}${slug}`)];
}

/** What a picture is found by: the usual words, its kind and where it came from. */
export function othersSearchOf(item: OthersItem): string {
  return [
    defaultSearchOf(item),
    item.kind,
    item.credit?.by ?? "",
    item.credit?.platform ?? "",
  ].join(" ");
}

/**
 * The filter of Others: one list, the kinds first (the one with the most pictures first), then the
 * Aspirants the same way. The ids carry a prefix so a kind and an Aspirant never meet. The data
 * file lists both; a file that lists none gets them counted from the pictures.
 */
export function othersFacets(file: (ArtsFile<OthersItem> & OthersHead) | null): Facet[] {
  if (!file) return [];
  const kinds = orderFacets(file.kinds ?? []).map((k) => ({ ...k, id: `${KIND}${k.id}` }));
  const counted = (): Facet[] =>
    facetsFrom(file.items, (item) => [`${KIND}${item.kind}`]).map((f) => ({
      ...f,
      name: kindName(f.id.slice(KIND.length)),
    }));
  const characters = orderFacets(
    file.characters
      ? file.characters.map((c) => ({
          id: `${CHAR}${c.slug}`,
          name: aspirantName(c.slug),
          count: c.count,
        }))
      : [],
  );
  const fromItems = facetsFrom(
    file.items,
    (item) => item.chars.map((slug) => `${CHAR}${slug}`),
    new Map(Object.entries(ASPIRANT_NAMES).map(([slug, name]) => [`${CHAR}${slug}`, name])),
  );
  return [
    ...(kinds.length > 0 ? kinds : counted()),
    ...(characters.length > 0 ? characters : fromItems),
  ];
}

const KIND_NAMES: Readonly<Record<string, string>> = {
  chibi: "Chibi",
  site: "Made for this site",
  lore: "Lore cards",
  art: "Art",
  card: "Trailer cards",
  poster: "Posters",
  pair: "Pair art",
};

function kindName(id: string): string {
  return KIND_NAMES[id] ?? id.charAt(0).toUpperCase() + id.slice(1);
}

function aspirantName(slug: string): string {
  return (ASPIRANT_NAMES as Readonly<Record<string, string>>)[slug] ?? slug;
}
