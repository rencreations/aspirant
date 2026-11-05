import type { PairId, Slug } from "@/content/types";

import type { CollectionFile, ItemBase } from "../types";

/** A line is one voice line, a compilation is the long recording of one character, a trailer clip is a Japanese clip of the trailer. */
type VoiceGroup = "line" | "compilation" | "trailer";

export interface VoiceItem extends ItemBase {
  slug: Slug;
  /** Line number in the character's list, 0 for a compilation. */
  n: number;
  /** The Japanese, exactly as the file is named. Empty for a compilation. */
  jp: string;
  /** The English translation. Empty for a compilation and for a trailer clip. */
  en: string;
  /** A trailer clip only: the trailer's own English subtitle for the moment. */
  sub?: string;
  /** A trailer clip only: who speaks, for example `Angry Ruby`. */
  speaker?: string;
  note?: string;
  /** Library key of the AAC file. */
  m4a: string;
  /** Library key of the original lossless file. Compilations have none. */
  flac?: string;
  /** Seconds. */
  dur: number;
  /** A trailer clip only: where it starts in the trailer, in seconds. */
  t?: number;
  /** A trailer clip only: the id of the trailer in the Films room. */
  film?: string;
  group: VoiceGroup;
}

export interface VoiceCharacter {
  slug: Slug;
  name: string;
  /** The name in Japanese script. */
  jp: string;
  romaji: string | null;
  /** The Aspirant title, for example `Miss Hikari`. */
  aspirant: string;
  pair: PairId;
  palette: { primary: string; secondary: string; glow: string; ink: string };
  /** A path in `public/` (go through `asset()`). */
  splash: string;
  lines: number;
  /** Seconds of all the lines together. */
  dur: number;
  /** Id of the character's full compilation. */
  full: string;
  fullDur: number;
}

export interface VoicelinesFile extends CollectionFile<VoiceItem> {
  totals: { lines: number; compilations: number; trailer: number; seconds: number };
  characters: VoiceCharacter[];
}

/** Which languages the rows show. An empty string is both. */
export type VoiceLang = "" | "ja" | "en";
