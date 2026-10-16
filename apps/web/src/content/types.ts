/**
 * Shared content types for The Aspirants.
 *
 * Every value typed here comes from the author's sources (CANON-NOTES, the character bible,
 * the novel text and the voice tables). Where a source is silent, the value is `null` or
 * "Not specified".
 */

/** The ten Aspirants, in queue order (the `characters.md` roster order). */
export const SLUGS = [
  "fanny",
  "layla",
  "ruby",
  "angela",
  "lesley",
  "change",
  "guinevere",
  "vexana",
  "obsidia",
  "selena",
] as const;

export type Slug = (typeof SLUGS)[number];

/** Site groupings. `selena-obsidia` is a pairing of creator and creation, not partners. */
export type PairId =
  "fanny-layla" | "ruby-angela" | "lesley-change" | "guinevere-vexana" | "selena-obsidia";

/** Daybreak is the Academy side; Storm is the Ender side. */
export type Side = "daybreak" | "storm";

/** Chapter ids used across the site: `c01`..`c60`, plus the two "Far Above" interludes. */
export type ChapterId = `c${number}` | "i-far-above-1" | "i-far-above-2";

/** Colours taken from each character's official art. All values are hex. */
export interface Palette {
  /** The signature colour (usually hair). */
  readonly primary: string;
  /** The second colour of the costume or weapon. */
  readonly secondary: string;
  /** The colour of her light, energy or glow. */
  readonly glow: string;
  /** A deep shade for dark panels and text on light. */
  readonly ink: string;
}

export interface JapaneseName {
  /** Katakana or kanji, as confirmed by the author. */
  readonly script: string;
  /** Romaji, or `null` where the author gives none (Chang'e). */
  readonly romaji: string | null;
}

export interface VoiceLine {
  /** Line number from `voice.md`. */
  readonly n: number;
  /** The Japanese title of the audio line. */
  readonly jpTitle: string;
  /** The English translation, sanitised for the site rules. */
  readonly en: string;
  /** Relative asset path (no leading slash). Wrap it in `asset()` before use. */
  readonly file: string;
  /** A short editorial note, when the line needs one. */
  readonly note?: string;
}

export interface Relationship {
  /** The other Aspirant, or `null` when the person is not one of the ten. */
  readonly slug: Slug | null;
  /** The glossary entity for the person, when there is one. */
  readonly entityId?: string;
  readonly name: string;
  readonly text: string;
}

export interface CharacterSections {
  readonly personality: readonly string[];
  readonly appearance: readonly string[];
  readonly fighting: readonly string[];
  readonly background: readonly string[];
  readonly motivation: readonly string[];
  readonly flaws: readonly string[];
  readonly relationships: readonly Relationship[];
}

/** Late-story facts. Pages should keep these behind a reveal; each links to its chapter. */
export interface LaterFact {
  readonly text: string;
  readonly chapterId: ChapterId;
}

/** The two forms of the characters who have an Ender form. */
export interface Forms {
  readonly normal: string;
  readonly ender: string;
}

/** Hand-written character data. Voice lines are joined in from the generated module. */
export interface CharacterData {
  readonly slug: Slug;
  /** 1-based position in the queue. */
  readonly order: number;
  readonly name: string;
  readonly aspirantName: string;
  readonly jp: JapaneseName;
  /** Age as at the Academy's first winter, or "Not specified". */
  readonly ageText: string;
  readonly ageNote?: string;
  readonly birthday: string;
  readonly mbti: string;
  readonly role: string;
  readonly weapon: string;
  readonly partnerSlug: Slug | null;
  readonly pair: PairId;
  readonly side: Side;
  readonly palette: Palette;
  readonly tagline: string;
  readonly summary: string;
  readonly sections: CharacterSections;
  readonly laterInStory: readonly LaterFact[];
  readonly forms?: Forms;
  /** Voice line numbers worth featuring. */
  readonly keyQuotes: readonly number[];
  readonly inStory: { readonly chapterIds: readonly ChapterId[] };
}

export interface Character extends CharacterData {
  readonly voice: readonly VoiceLine[];
}
