import type { PairId, Slug } from "./types";

export interface Pair {
  readonly id: PairId;
  readonly members: readonly [Slug, Slug];
  /** "Fanny and Layla". */
  readonly names: string;
  /** Each member's primary colour, in member order. */
  readonly colours: readonly [string, string];
  /** Partners at the Academy, or a site grouping of creator and creation. */
  readonly kind: "partners" | "creator-and-creation";
  readonly tagline: string;
  /** Where the tagline comes from in the story. */
  readonly taglineSource: string;
}

/** Each tagline is a line, or a close echo of a line, from the chapter named in `taglineSource`. */
export const pairs: readonly Pair[] = [
  {
    id: "fanny-layla",
    members: ["fanny", "layla"],
    names: "Fanny and Layla",
    colours: ["#F5862A", "#FF7F7A"],
    kind: "partners",
    tagline: "Pride and warmth. They do not cancel. They complete.",
    taglineSource: "c03",
  },
  {
    id: "ruby-angela",
    members: ["ruby", "angela"],
    names: "Ruby and Angela",
    colours: ["#1E2A57", "#FFB28C"],
    kind: "partners",
    tagline: "Two people looking after each other.",
    taglineSource: "c37",
  },
  {
    id: "lesley-change",
    members: ["lesley", "change"],
    names: "Lesley and Chang'e",
    colours: ["#E4512B", "#FF8FC7"],
    kind: "partners",
    tagline: "Two halves of one thing.",
    taglineSource: "c21",
  },
  {
    id: "guinevere-vexana",
    members: ["guinevere", "vexana"],
    names: "Guinevere and Vexana",
    colours: ["#F6B98A", "#7A4FD6"],
    kind: "partners",
    tagline: "The sun, and the dark that makes it visible.",
    taglineSource: "c07",
  },
  {
    id: "selena-obsidia",
    members: ["selena", "obsidia"],
    names: "Selena and Obsidia",
    colours: ["#A6DCFF", "#B3122E"],
    kind: "creator-and-creation",
    tagline: "Creator and creation, made so alike.",
    taglineSource: "c58",
  },
];

export function getPair(id: PairId): Pair {
  const pair = pairs.find((candidate) => candidate.id === id);
  if (!pair) throw new Error(`Unknown pair: ${id}`);
  return pair;
}
