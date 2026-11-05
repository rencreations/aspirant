import type { Slug } from "@/content/types";

import type { CollectionFile, ItemBase, LibImage } from "../types";

/** One block of a text, as written by `scripts/library/lore/parse.py`. */
export type Block =
  | { t: "h"; l: 2 | 3 | 4; x: string; id: string }
  | { t: "p"; x: string }
  | { t: "q"; x: string }
  | { t: "sub"; x: string }
  | { t: "note"; x: string }
  | { t: "ul"; i: string[] }
  | { t: "ol"; i: string[] }
  | { t: "kv"; rows: Array<[string, string]> }
  | { t: "tb"; head: string[]; rows: string[][] }
  | { t: "hr" }
  | { t: "rel"; x: string; rows: Array<{ w: string; r: string; s: string }> }
  | { t: "chart"; rows: Array<{ a: string; b: string; l: string; both: boolean }> };

export type GroupId = "world" | "characters" | "stories" | "videos";

export interface LoreText {
  id: string;
  title: string;
  group: GroupId;
  /** One plain sentence about the text. */
  summary: string;
  blocks: Block[];
  minutes: number;
  words: number;
  /** The Aspirants it mentions, most mentioned first. */
  chars: Slug[];
  /** "older" marks the two oldest texts, which rank lowest. */
  rank: "official" | "older";
  /** The profile that holds the same story. */
  also?: string;
  /** Atlas places the text mentions. */
  places: string[];
}

export interface Passage {
  text: string;
  /** Id of the text it is taken from. */
  from: string;
  /** The heading it sits under in that text, and that heading's anchor. */
  head: string;
  hid: string;
}

export type AtlasLayer = "worlds" | "notes" | "settings" | "figures";

export interface AtlasItem {
  id: string;
  kind: "place" | "entity";
  layer: AtlasLayer;
  name: string;
  /** The official passage, word for word. */
  text: string;
  from: string;
  /** The anchor of the heading the passage sits under. */
  hid: string;
  /** Further official passages about the same thing. */
  more: Passage[];
  img: LibImage;
  /** True for a cut-out with real transparency. */
  alpha: boolean;
  /** Texts that mention it. */
  texts: string[];
}

export interface Person {
  slug: Slug;
  name: string;
  aka: string;
  /** Role, status, ability and personality lines of the card, as given. */
  fields: Array<[string, string]>;
  /** The profile paragraph of the card. */
  text: string;
  /** The line about her in the relationship list. */
  blurb: string;
  /** Age, interest and similar lines of the four profile files. */
  facts: Array<[string, string]>;
  rels: Array<{ w: string; r: string; s: string }>;
  more: Array<{ name: string; text: string }>;
  texts: string[];
}

export interface LoreFile extends CollectionFile<ItemBase> {
  layers: Record<AtlasLayer, string>;
  texts: LoreText[];
  atlas: AtlasItem[];
  people: Person[];
}

export type LoreView = "texts" | "atlas" | "who";

export const LORE_VIEWS: ReadonlyArray<{ id: LoreView; label: string }> = [
  { id: "texts", label: "Texts" },
  { id: "atlas", label: "Atlas" },
  { id: "who", label: "Who is who" },
];

export function isLoreView(value: string): value is LoreView {
  return LORE_VIEWS.some((v) => v.id === value);
}

export const GROUPS: ReadonlyArray<{
  id: GroupId;
  index: string;
  title: string;
  line: string;
  note?: string;
}> = [
  {
    id: "world",
    index: "01",
    title: "World",
    line: "The universe, the places and the Enders.",
  },
  {
    id: "characters",
    index: "02",
    title: "Characters",
    line: "A profile for each Aspirant, and who is who to whom.",
  },
  {
    id: "stories",
    index: "03",
    title: "Stories",
    line: "Short stories and film summaries.",
    note: "These texts tell parts of the plot.",
  },
  {
    id: "videos",
    index: "04",
    title: "Videos",
    line: "What the official film descriptions say.",
  },
];

export const GROUP_TITLE: Readonly<Record<GroupId, string>> = {
  world: "World",
  characters: "Characters",
  stories: "Stories",
  videos: "Videos",
};
