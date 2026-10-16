/**
 * The shape of the story JSON in `public/data/story/` (written by
 * `scripts/content/build-story.mjs` from `short-v2.md`).
 *
 * `index.json` holds the front matter, the parts, chapter metadata and the back matter.
 * `part-01.json` .. `part-12.json` hold the chapter text, one part per file.
 */
import type { ChapterId } from "./types";

/** Inline formatting from the source: `*italic*` and `**bold**`. */
export interface Marks {
  readonly em?: true;
  readonly strong?: true;
}

export interface TextSegment extends Marks {
  readonly t: "text";
  readonly text: string;
}

/** A name, place or term with a hover card. `id` is a key of the entity glossary. */
export interface EntitySegment extends Marks {
  readonly t: "ent";
  readonly id: string;
  readonly text: string;
}

export type Segment = TextSegment | EntitySegment;

export interface ParagraphBlock {
  readonly type: "p";
  /** Stable id, for example `c05-p012`. */
  readonly id: string;
  /** Global paragraph index across the whole story (0-based). */
  readonly i: number;
  readonly segments: readonly Segment[];
  /** The paragraph opens with speech. */
  readonly dialogue?: true;
  /** Entity id of the one speaker, when the text names exactly one ("said Fanny"). */
  readonly speaker?: string;
}

/** Verse with hard line breaks (the skipping rhyme). */
export interface PoemBlock {
  readonly type: "poem";
  readonly id: string;
  readonly i: number;
  readonly lines: ReadonlyArray<readonly Segment[]>;
}

/** The `* * *` break between scenes. */
export interface SceneBreakBlock {
  readonly type: "scene-break";
  readonly id: string;
}

export type Block = ParagraphBlock | PoemBlock | SceneBreakBlock;

export type ChapterKind = "chapter" | "interlude";

export interface ChapterMeta {
  readonly id: ChapterId;
  readonly kind: ChapterKind;
  /** 1 to 60 for chapters, `null` for interludes. */
  readonly number: number | null;
  readonly title: string;
  /** Part number, 1 to 12. */
  readonly part: number;
  /** The italic time or place line that opens some chapters. */
  readonly timeNote: string | null;
  readonly wordCount: number;
  readonly paragraphCount: number;
  /** Global index of the chapter's first paragraph. */
  readonly firstParagraphIndex: number;
}

export interface Chapter extends ChapterMeta {
  readonly blocks: readonly Block[];
}

export interface PartMeta {
  readonly number: number;
  /** "Part One" .. "Part Twelve". */
  readonly label: string;
  readonly title: string;
  /** The italic line under the part title. */
  readonly setting: string;
  readonly chapterIds: readonly ChapterId[];
  /** Relative path of the part file (no leading slash). Wrap it in `asset()`. */
  readonly file: string;
  readonly wordCount: number;
}

export interface PartFile {
  readonly part: PartMeta;
  readonly chapters: readonly Chapter[];
}

export interface FrontParagraph {
  readonly type: "p";
  readonly segments: readonly Segment[];
}

export interface FrontPeople {
  readonly type: "people";
  readonly rows: ReadonlyArray<{
    readonly entityId: string | null;
    readonly name: string;
    readonly text: string;
  }>;
}

export interface FrontSection {
  readonly id: string;
  readonly title: string;
  readonly blocks: ReadonlyArray<FrontParagraph | FrontPeople>;
}

export interface OpenQuestion {
  readonly question: string;
  readonly answer: string;
}

export interface WhoRow {
  readonly entityId: string | null;
  readonly name: string;
  readonly title: string;
  readonly text: string;
}

export interface AlsoRow {
  readonly entityId: string | null;
  readonly name: string;
  readonly text: string;
}

export interface TimeOrderRow {
  readonly when: string;
  readonly what: string;
  /** The chapter cell as printed, with ranges written "15 to 17". */
  readonly chapters: string;
  /** In the order the source lists them. */
  readonly chapterIds: readonly ChapterId[];
}

export interface WordToKnow {
  readonly term: string;
  readonly entityId: string | null;
  readonly text: string;
  readonly segments: readonly Segment[];
}

export interface BackMatter {
  readonly openQuestions: {
    readonly title: string;
    readonly intro: string;
    readonly items: readonly OpenQuestion[];
  };
  readonly closing: string;
  readonly reference: { readonly title: string; readonly intro: string };
  readonly whoIsWho: {
    readonly title: string;
    readonly rows: readonly WhoRow[];
    readonly also: readonly AlsoRow[];
  };
  readonly timeOrder: { readonly title: string; readonly rows: readonly TimeOrderRow[] };
  readonly wordsToKnow: { readonly title: string; readonly items: readonly WordToKnow[] };
}

export interface StoryStats {
  readonly parts: number;
  readonly chapters: number;
  readonly interludes: number;
  readonly paragraphs: number;
  readonly words: number;
}

export interface StoryIndex {
  readonly title: string;
  readonly subtitle: string;
  readonly intro: string;
  readonly epigraph: { readonly lines: readonly string[]; readonly attribution: string };
  readonly beforeYouBegin: readonly FrontSection[];
  readonly parts: readonly PartMeta[];
  readonly chapters: readonly ChapterMeta[];
  readonly backMatter: BackMatter;
  readonly stats: StoryStats;
}
