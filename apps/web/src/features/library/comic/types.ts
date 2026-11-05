import type { CollectionFile, ItemBase, LibImage } from "../types";

/** One piece of a tall page, cut at a plain row so the pieces stack with no seam. */
export interface ComicSlice {
  /** Full width piece, a library key. */
  f: string;
  /** 1000 wide piece, a library key. */
  p: string;
  /** Height of the piece at the full width. */
  h: number;
  /** Height of the piece at the preview width. */
  ph: number;
}

/** One page of a comic. `n` is the page number in the original, so it can skip numbers. */
export interface ComicPage {
  n: number;
  /** Size of the whole page at the full width. */
  w: number;
  h: number;
  /** Thumbnail (480 wide), preview (1000 wide, the same file as `f` when the page is not wider) and full width. */
  t: string;
  p: string;
  f: string;
  /** Average colour, for the box while the picture loads. */
  c: string;
  /** Slices of a tall page, in order. Absent when the page is one picture. */
  s?: ComicSlice[];
  /** Indexes of the transcript blocks that cover this page. */
  x?: number[];
}

/** One line of the transcript: a spoken or boxed line, a description of the picture, or a note. */
export interface TranscriptLine {
  k: "say" | "scene" | "note";
  t: string;
  /** The speaker. Absent for a caption box that has no speaker. */
  who?: string;
}

/** The text the source groups under pages `from` to `to`. */
export interface TranscriptBlock {
  from: number;
  to: number;
  lines: TranscriptLine[];
}

export interface ComicItem extends ItemBase {
  collection: "comic";
  kind: "official" | "fan";
  description: string;
  note?: string;
  cover: LibImage;
  /** The highest page number of the original. */
  total: number;
  /** Page numbers that are not in the source. */
  missing: number[];
  pages: ComicPage[];
  transcript?: TranscriptBlock[];
}

export type ComicFile = CollectionFile<ComicItem>;

/** One place in the reading order: a page, or a gap where the source has no picture. */
export type SequenceEntry =
  { kind: "page"; n: number; page: ComicPage } | { kind: "missing"; n: number };
