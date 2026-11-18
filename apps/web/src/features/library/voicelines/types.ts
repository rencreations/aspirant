import type { PairId, Slug } from "@/content/types";

import type { ItemBase } from "../types";
import type { LangId } from "./languages";

/** A row of the search index (`voicelines.json` `items`): a line, a recording or a trailer clip. */
interface VoiceItem extends ItemBase {
  slug: Slug;
  /** Line number in its list, 0 for a recording. */
  n: number;
  /** The language of the line: `jp` for the Japanese list, `en` for the English line. */
  lang: LangId;
  jp: string;
  en: string;
  note?: string;
  group: "line" | "compilation" | "trailer";
}

interface VoiceLanguageTotals {
  id: LangId;
  /** The table of `languages.ts` as the pipeline wrote it (a test keeps the two equal). */
  native: string;
  english: string;
  html: string;
  dir: "ltr" | "rtl";
  flag: string;
  lines: number;
  seconds: number;
  /** Lines that have a text but no recording. */
  noAudio: number;
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
  /** How many lines each language has. */
  lines: Record<LangId, number>;
}

/** The film behind the title (`scripts/library/voicelines/hero.py`): keys of the bucket. */
export interface VoiceHeroFilm {
  src: string;
  w: number;
  h: number;
  dur: number;
  bytes: number;
}

export interface VoiceHero {
  poster: string;
  pw: number;
  ph: number;
  /** Average colour of the still. */
  c: string;
  films: VoiceHeroFilm[];
}

/** `public/data/library/voicelines.json`: what the room needs on its first screen. */
export interface VoiceIndex {
  v: 2;
  slug: "voicelines";
  totals: {
    lines: number;
    languages: number;
    seconds: number;
    compilations: number;
    trailer: number;
  };
  languages: VoiceLanguageTotals[];
  characters: VoiceCharacter[];
  hero?: VoiceHero;
  items: VoiceItem[];
}

/** One line of one language. A line with no `d` has a text and no recording. */
export interface VoiceLine {
  n: number;
  /** The text of the line, in its language. */
  t: string;
  /** Japanese only: the English translation of the Japanese. */
  tr?: string;
  /** Seconds. */
  d?: number;
  /** Japanese only: the original file is an mp3 (a trailer line), not a FLAC. */
  x?: "mp3";
  /**
   * Gain in dB that levels this clip to the others (`scripts/library/voicelines/loudness.py`). Pass it to
   * `audio.playVoice` as `gainDb`.
   */
  g?: number;
  note?: string;
}

/** A Japanese trailer clip: its own recording, with the trailer's subtitle or a tentative translation. */
export interface VoiceTrailerClip {
  id: string;
  n: number;
  t: string;
  tr: string;
  who: string;
  d: number;
  /** Library keys. */
  m4a: string;
  flac: string;
  /** Gain in dB, as on a `VoiceLine`. */
  g?: number;
  /** The id of the film it was cut from, in the Films room (the first sixteen only). */
  film?: string;
  /** Where it starts in that film, in seconds. */
  at?: number;
  note?: string;
}

/** `public/data/library/voicelines-<slug>.json`: every language of one Aspirant. */
export interface VoiceCharacterFile {
  v: 2;
  slug: Slug;
  name: string;
  /** What the page of her needs to colour itself and to title her, so it does not read the index. */
  card: Pick<VoiceCharacter, "jp" | "romaji" | "aspirant" | "palette">;
  langs: Record<LangId, VoiceLine[]>;
  /** The long recording of the Japanese lines. */
  full: { id: string; m4a: string; d: number; note: string; g?: number };
  trailer?: VoiceTrailerClip[];
}
