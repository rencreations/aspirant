/**
 * The shape of the story data in `public/data/story/` (written by `scripts/story/build.py` from
 * the novel `story/main.md` and the visual scripts in `scripts/story/visuals/`).
 *
 * `index.json` lists the chapters (the landing, the contents and the loading lists read it),
 * `c00.json` to `c87.json` hold one chapter each, `end.json` holds the back matter.
 */

/** `c00` is the Prologue, `c01` to `c87` the chapters. */
export type StoryChapterId = `c${number}`;

export interface ActMeta {
  /** "I" to "VI". */
  readonly roman: string;
  readonly title: string;
  /** First and last chapter number of the act (the Prologue is 0). */
  readonly from: number;
  readonly to: number;
}

/** A file the first screen of a chapter needs (waited for in the loading list). */
export interface FirstFile {
  readonly kind: "image" | "clip";
  readonly src: string;
  /** For a clip: its still. */
  readonly poster?: string;
  readonly bytes?: number;
}

export interface ChapterEntry {
  readonly id: StoryChapterId;
  /** `prologue` or `chapter-07`. */
  readonly slug: string;
  /** 0 for the Prologue. */
  readonly number: number;
  readonly title: string;
  /** The italic time and place line, or null. */
  readonly dateline: string | null;
  /** One spoiler-free line for the preview card, or null. */
  readonly mood: string | null;
  readonly words: number;
  readonly minutes: number;
  readonly paragraphs: number;
  /** "I" to "VI". */
  readonly act: string;
  /** Card picture (640 wide, 16:9). */
  readonly thumb: string;
  /** Sealed twin of the card picture, only for chapters whose picture gives something away. */
  readonly sealed: string | null;
  /** The hero's average colour. */
  readonly color: string;
  /** The title card's focus (`heroFocus`, a CSS object-position such as "60% 40%"). */
  readonly focus: string;
  readonly score: string | null;
  readonly first: readonly FirstFile[];
}

export interface StoryIndex {
  readonly title: string;
  readonly acts: readonly ActMeta[];
  readonly chapters: readonly ChapterEntry[];
  readonly stats: {
    readonly chapters: number;
    readonly words: number;
    readonly minutes: number;
    /** How many pictures (including comic panels), clips and voice lines the book carries. */
    readonly images: number;
    readonly clips: number;
    readonly voices: number;
  };
}

export interface ImageMedia {
  readonly kind: "image";
  readonly src: string;
  readonly w: number;
  readonly h: number;
  readonly color: string;
  /** The picture has a transparent background (a cut-out): shown with no frame and no backdrop. */
  readonly alpha?: true;
  readonly alt: string;
  readonly credit: string;
}

export interface ClipMedia {
  readonly kind: "clip";
  readonly src: string;
  readonly poster: string;
  readonly w: number;
  readonly h: number;
  /** Seconds. */
  readonly dur: number;
  readonly bytes: number;
  /** The file keeps its own sound. */
  readonly sound: boolean;
  readonly color: string;
  readonly alt: string;
  readonly credit: string;
}

export type Media = ImageMedia | ClipMedia;

/** Inline text: `em` marks italics (thoughts and emphasis). */
export interface Seg {
  readonly t: string;
  readonly em?: 1;
}

export interface VoiceRef {
  /** The Aspirant who speaks (`fanny`, `change`, ...). */
  readonly slug: string;
  /** Line number in the voice table. */
  readonly n: number;
  /** Relative file, wrap in `asset()`. */
  readonly src: string;
  readonly dur: number | null;
}

export interface ParagraphBlock {
  readonly t: "p";
  /** Paragraph number inside the chapter, from 0. The element id is `<chapter>-pNNN`. */
  readonly i: number;
  readonly segs: readonly Seg[];
  readonly voice?: VoiceRef;
}

export interface BreakBlock {
  readonly t: "break";
}

export type InsertKind = "plate" | "clip" | "panels" | "place" | "portrait" | "film" | "voice";

export interface InsertBlock {
  readonly t: "insert";
  readonly kind: InsertKind;
  /** Panels carry a list; the other kinds one picture (a portrait may carry none). */
  readonly media?: Media | readonly Media[];
  readonly caption?: string;
  readonly label?: string;
  readonly character?: string;
  /** `film` only: a file of `public/` played in the site's player. */
  readonly public?: string;
  readonly poster?: string;
  readonly title?: string;
  /** A clip only: text laid over the picture, for example "Meet Obsidia". */
  readonly overlay?: { readonly kicker?: string; readonly title: string };
  /** `voice` only: a spoken line taken from the sound of an official film. */
  readonly voice?: VoiceRef;
  /** `film` only: picture height of the file and its length in seconds. */
  readonly height?: number;
  readonly duration?: number;
}

export type Block = ParagraphBlock | BreakBlock | InsertBlock;

export interface Chapter {
  readonly id: StoryChapterId;
  readonly number: number;
  readonly slug: string;
  readonly title: string;
  readonly dateline: string | null;
  readonly mood: string | null;
  readonly words: number;
  readonly score: string | null;
  readonly hero: Media;
  /** CSS object-position of the hero on narrow screens. */
  readonly heroFocus: string;
  readonly blocks: readonly Block[];
}

/** The back matter of the book: who is who, and the timeline. */
export interface EndFile {
  readonly cast: ReadonlyArray<{
    readonly slug: string;
    readonly name: string;
    /** The Aspirant name, for example "Miss Hikari". */
    readonly aka: string;
    readonly text: readonly Seg[];
  }>;
  /** Other people the book names, as paragraphs. */
  readonly also: ReadonlyArray<readonly Seg[]>;
  readonly timeline: ReadonlyArray<{ readonly when: string; readonly text: readonly Seg[] }>;
}
