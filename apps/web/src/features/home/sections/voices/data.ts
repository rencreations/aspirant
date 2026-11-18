/**
 * The curated voice lines of the home (`public/data/home/voices.json`, made by
 * `scripts/home/media/voices.py`): one line for each of eight languages for each of the ten
 * Aspirants. This module is read by the server markup only. The runtime and the loading list never
 * import it (the loading list is in every page's bundle): they read what the markup carries
 * (`data-key`, `data-gain`) or the slugs of `content.ts`.
 */
import raw from "../../../../../public/data/home/voices.json";

interface VoiceLine {
  n: number;
  /** The `lang` attribute of the text. */
  lang: string;
  dir: "ltr" | "rtl";
  t: string;
  /** The English that came with the line (the Japanese lines and the shared list). */
  tr?: string;
  /** Length in seconds. */
  d: number;
  /** The baked gain in dB that levels the clip (`audio.playVoice` `gainDb`). */
  g: number;
  /** The library key of the clip (`libUrl(key)` makes the address). */
  key: string;
}

export interface VoiceLanguage {
  id: string;
  html: string;
  dir: "ltr" | "rtl";
  /** The name of the language in itself. */
  native: string;
  english: string;
  /** The flag id of the Voicelines room (`flags.tsx`). */
  flag: string;
}

export interface VoiceCharacter {
  slug: string;
  name: string;
  /** The name in Japanese. */
  jp: string;
  palette: { primary: string; secondary: string; ink: string };
  /** The 16 by 9 art, small (800 px). */
  splash: string;
  /** Her page in the Voicelines room. */
  page: string;
  /** One line for each language, keyed by the language's id. */
  lines: Readonly<Record<string, VoiceLine>>;
}

interface VoicesFile {
  languages: VoiceLanguage[];
  characters: VoiceCharacter[];
}

const FILE = raw as unknown as VoicesFile;

/** The eight languages in the owner's order: Japanese first, then English, then the rest. */
export const VOICE_LANGUAGES: readonly VoiceLanguage[] = FILE.languages;

/** The ten Aspirants in the owner's order. */
export const VOICE_CHARACTERS: readonly VoiceCharacter[] = FILE.characters;

/**
 * Where the frame of the art rests on the 16 by 9 picture, so the Aspirant stays in view when the
 * frame is taller than the picture (`object-position`, x then y). Chosen by looking at the ten.
 */
export const ART_POSITION: Readonly<Record<string, string>> = {
  fanny: "32% 40%",
  ruby: "28% 40%",
  lesley: "68% 40%",
  guinevere: "50% 40%",
  selena: "60% 40%",
  layla: "96% 40%",
  angela: "78% 40%",
  change: "76% 40%",
  vexana: "86% 40%",
  obsidia: "24% 40%",
};

/** The large picture of an Aspirant (2048 px). The small one is `splash`. */
export function splashLarge(slug: string): string {
  return `/img/char/${slug}/splash.webp`;
}

export interface LinePart {
  text: string;
  /** A stage direction in brackets, for example "(Chuckles)": the audio's own cue, not a word. */
  direction: boolean;
}

/**
 * Split a line at its stage directions. Three of the curated lines hold one ("(Chuckles)"): the
 * page draws it small and quiet, the way a script would.
 */
export function splitDirections(text: string): LinePart[] {
  const parts: LinePart[] = [];
  const pattern = /\([^()]*\)/gu;
  let from = 0;
  for (const match of text.matchAll(pattern)) {
    const at = match.index;
    if (at > from) parts.push({ text: text.slice(from, at), direction: false });
    parts.push({ text: match[0], direction: true });
    from = at + match[0].length;
  }
  if (from < text.length) parts.push({ text: text.slice(from), direction: false });
  return parts;
}
