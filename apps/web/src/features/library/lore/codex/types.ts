/**
 * The lore codex: a page for every person, creature, thing, place, group, idea and event of the
 * story, and one for every relationship between two of them. The data is `lore-codex.json`, made
 * by `scripts/library/lore/codex/build_codex.py` from the novel. Chapter numbers are the book's
 * (0 is the prologue); `p` is a paragraph number of that chapter, counted from 0 after its
 * dateline, as the story pages count it (`c05-p012`).
 */
export type CodexKind = "person" | "creature" | "thing" | "place" | "group" | "idea" | "event";

export const CODEX_KINDS: readonly CodexKind[] = [
  "person",
  "place",
  "thing",
  "group",
  "creature",
  "idea",
  "event",
];

export const KIND_META: Readonly<
  Record<CodexKind, { label: string; plural: string; line: string }>
> = {
  person: { label: "Person", plural: "People", line: "Everyone who acts or matters." },
  place: { label: "Place", plural: "Places", line: "Every place and setting, past and present." },
  thing: { label: "Thing", plural: "Things", line: "Machines, weapons, drones and objects." },
  group: { label: "Group", plural: "Groups", line: "Councils, divisions, classes and crews." },
  creature: { label: "Creature", plural: "Creatures", line: "The Enders and other living things." },
  idea: { label: "Idea", plural: "Ideas", line: "Powers, rules, terms and customs." },
  event: { label: "Event", plural: "Events", line: "Battles, attacks and turning points." },
};

export type RelType =
  | "family"
  | "partner"
  | "friend"
  | "rival"
  | "teacher"
  | "student"
  | "ally"
  | "enemy"
  | "maker"
  | "creation"
  | "guardian"
  | "ward"
  | "leader"
  | "serves"
  | "member"
  | "owns"
  | "lives"
  | "found"
  | "part";

/** One thing the book says about an entry, in the chapter and paragraph that say it. */
export interface CodexFact {
  n: number;
  p: number;
  t: string;
}

/** A tie from one entry to another. `dir` is "out" when this entry is the one the type describes. */
export interface CodexRel {
  to: string;
  type: RelType;
  dir: "out" | "in";
  n: number;
  p: number;
  t: string;
}

export interface CodexMedia {
  /** A path under `public/` (a local picture) or a library key (starts with `lib:`). */
  src: string;
  alt: string;
  credit: string;
}

export interface CodexEntry {
  slug: string;
  kind: CodexKind;
  /** The small label: "android", "classroom", "weapon". */
  sub: string;
  name: string;
  aka: string[];
  /** One line for lists. */
  line: string;
  /** The tooltip: what a reader needs in two sentences. */
  short: string;
  summary: string;
  /** The first chapter in which the book shows or names it, and the last. */
  first: number;
  last: number;
  /** "A" entries are written in full, "B" ones are short. */
  tier: "A" | "B";
  /** The slug of an Aspirant, whose own page is `/character/<slug>`. */
  character?: string;
  /** Label, value, and the chapter from which the row is safe to show. */
  rows: Array<[string, string, number]>;
  /** `n` is the chapter it first shows in. */
  weapons: Array<{ name: string; note: string; n: number }>;
  facts: CodexFact[];
  rel: CodexRel[];
  /** Chapters in which it appears. */
  seen: number[];
  /** Where the book explains it to the reader. */
  explained: Array<{ n: number; p: number }>;
  media: CodexMedia[];
  /** Official passages about it, word for word, with the text each is taken from. */
  official?: Array<{ text: string; source: string }>;
}

interface CodexTie {
  type: RelType;
  /** "out" when `a` is the one the type describes (a serves b), "in" when `b` is. */
  dir: "out" | "in";
  n: number;
  p: number;
  t: string;
}

/** The page of one relationship between two entries; its slug is `rel-<a>-<b>`, a before b. */
export interface CodexPair {
  slug: string;
  a: string;
  b: string;
  /** Paragraphs of prose about the two together (only the important pairs have it). */
  text: string[];
  ties: CodexTie[];
  chapters: number[];
}

export interface CodexFile {
  v: 1;
  entries: CodexEntry[];
  pairs: CodexPair[];
}
