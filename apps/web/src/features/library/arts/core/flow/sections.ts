import { pairs } from "@/content/pairs";
import { CHARACTER_NAMES } from "@/lib/slugs";

import type { ArtsItem } from "../types";
import type { FlowPart } from "./math";

/**
 * The groups of a wall. While nothing is searched or filtered, a room can show its pictures in
 * groups, each under a small heading, so a visitor finds an Aspirant or a kind of picture by where
 * it stands. A picture is in exactly one group.
 */
export interface WallSection {
  id: string;
  name: string;
}

/** The groups of a room and the one a picture belongs to. Stable values (module constants). */
export interface WallSections<T extends ArtsItem = ArtsItem> {
  /** The groups in the order they show. A group with no picture is left out. */
  list: readonly WallSection[];
  /** The id of a picture's group. An id that is not in `list` goes to the last group, "More". */
  of: (item: T) => string;
}

const EVERYONE = "everyone";
const WORLD = "world";
const MORE: WallSection = { id: "more", name: "More" };

/**
 * The ten Aspirants in the order of the five pairs, each pair followed by the pictures that hold
 * both of them, then the pictures of the whole group and the pictures with no Aspirant in them.
 */
export const ASPIRANT_LIST: readonly WallSection[] = [
  ...pairs.flatMap((pair) => [
    ...pair.members.map((slug) => ({ id: slug, name: CHARACTER_NAMES[slug] })),
    { id: pair.id, name: pair.names },
  ]),
  { id: EVERYONE, name: "The Aspirants" },
  { id: WORLD, name: "The world" },
];

const PAIR_OF_MEMBERS = new Map(
  pairs.map((pair) => [[...pair.members].sort().join("+"), pair.id as string]),
);
const KNOWN = new Set(ASPIRANT_LIST.map((section) => section.id));

/** An Aspirant's picture is in her group, the two of a pair are in the pair's, three or more in the whole group's, none in the world's. */
export function aspirantSectionOf(item: ArtsItem): string {
  const who = item.chars;
  if (who.length === 0) return WORLD;
  if (who.length === 1) {
    const only = who[0] ?? WORLD;
    return KNOWN.has(only) ? only : WORLD;
  }
  if (who.length === 2) return PAIR_OF_MEMBERS.get([...who].sort().join("+")) ?? EVERYONE;
  return EVERYONE;
}

/** The Aspirant groups as one value for a room. */
export const ASPIRANT_SECTIONS: WallSections = { list: ASPIRANT_LIST, of: aspirantSectionOf };

/**
 * Put the pictures in their groups. The list comes back in the order of the groups (a picture keeps
 * its place among the pictures of its group), with the groups as ranges of it.
 */
export function groupBySection<T extends ArtsItem>(
  items: readonly T[],
  sections: WallSections<T>,
): { items: T[]; parts: FlowPart[] } {
  const known = new Set(sections.list.map((section) => section.id));
  const buckets = new Map<string, T[]>();
  for (const item of items) {
    const id = sections.of(item);
    const key = known.has(id) ? id : MORE.id;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(item);
    else buckets.set(key, [item]);
  }
  const ordered: T[] = [];
  const parts: FlowPart[] = [];
  for (const section of [...sections.list, MORE]) {
    const bucket = buckets.get(section.id);
    if (!bucket || bucket.length === 0) continue;
    parts.push({ id: section.id, name: section.name, start: ordered.length, count: bucket.length });
    ordered.push(...bucket);
  }
  return { items: ordered, parts };
}
