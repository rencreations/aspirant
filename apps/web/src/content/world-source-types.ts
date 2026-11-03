/**
 * Types of the frozen back matter of the old story (`world-source.generated.ts`), which the About
 * page reads through `world.ts`. The story pages use `story-types.ts`.
 */
import type { ChapterId } from "./types";

/** Inline formatting from the source: `*italic*` and `**bold**`. */
interface Marks {
  readonly em?: true;
  readonly strong?: true;
}

interface TextSegment extends Marks {
  readonly t: "text";
  readonly text: string;
}

/** A name, place or term with a hover card. `id` is a key of the entity glossary. */
interface EntitySegment extends Marks {
  readonly t: "ent";
  readonly id: string;
  readonly text: string;
}

type Segment = TextSegment | EntitySegment;

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
