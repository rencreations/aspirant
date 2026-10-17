/**
 * Turns story segments into flat "pieces" with character offsets, so the renderer can split
 * them for emphasis, excerpts, drop caps and word-by-word reveals without losing the inline
 * marks or the entity a piece belongs to. Pure functions, unit tested.
 */
import type { Segment } from "@/content/story-types";

export interface Piece {
  readonly text: string;
  /** Offset of the first character in the paragraph's plain text. */
  readonly start: number;
  /** Index of the source segment (pieces of one entity share it). */
  readonly seg: number;
  readonly em?: true;
  readonly strong?: true;
  /** Entity id when the piece belongs to an entity segment. */
  readonly ent?: string;
  /** Inside an emphasis range. */
  readonly hi?: true;
}

export function plainText(segments: readonly Segment[]): string {
  return segments.map((segment) => segment.text).join("");
}

export function toPieces(segments: readonly Segment[]): Piece[] {
  let at = 0;
  return segments.map((segment, seg) => {
    const piece: Piece = {
      text: segment.text,
      start: at,
      seg,
      ...(segment.em ? { em: true as const } : {}),
      ...(segment.strong ? { strong: true as const } : {}),
      ...(segment.t === "ent" ? { ent: segment.id } : {}),
    };
    at += segment.text.length;
    return piece;
  });
}

/** Split pieces so that every offset in `cuts` falls on a piece boundary. */
export function splitAt(pieces: readonly Piece[], cuts: readonly number[]): Piece[] {
  const sorted = [...new Set(cuts)].sort((a, b) => a - b);
  const out: Piece[] = [];
  for (const piece of pieces) {
    const end = piece.start + piece.text.length;
    let from = piece.start;
    for (const cut of sorted) {
      if (cut <= from || cut >= end) continue;
      out.push({ ...piece, text: piece.text.slice(from - piece.start, cut - piece.start), start: from });
      from = cut;
    }
    out.push({ ...piece, text: piece.text.slice(from - piece.start), start: from });
  }
  return out.filter((piece) => piece.text.length > 0);
}

/** Character ranges [start, end) of every occurrence of each phrase. */
export function findRanges(text: string, phrases: readonly string[]): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  for (const phrase of phrases) {
    if (!phrase) continue;
    let from = text.indexOf(phrase);
    while (from !== -1) {
      ranges.push([from, from + phrase.length]);
      from = text.indexOf(phrase, from + phrase.length);
    }
  }
  return ranges;
}

/** Mark pieces that fall inside any of the ranges. Call after splitting at the range edges. */
export function markRanges(pieces: readonly Piece[], ranges: ReadonlyArray<[number, number]>) {
  return pieces.map((piece) =>
    ranges.some(([a, b]) => piece.start >= a && piece.start < b) ? { ...piece, hi: true as const } : piece,
  );
}

/**
 * Where a drop cap ends: leading quotes or brackets plus the first letter or digit.
 * Returns 0 when the text does not start with a letter after the punctuation.
 */
export function dropCapLength(text: string): number {
  const match = /^(["'“‘(]*)[\p{L}\p{N}]/u.exec(text);
  return match ? match[0].length : 0;
}

/** Group consecutive pieces of one entity segment so each entity renders as one button. */
export function groupPieces(pieces: readonly Piece[]): Piece[][] {
  const groups: Piece[][] = [];
  for (const piece of pieces) {
    const last = groups.at(-1);
    const prev = last?.at(-1);
    if (last && prev && piece.ent !== undefined && prev.ent === piece.ent && prev.seg === piece.seg)
      last.push(piece);
    else groups.push([piece]);
  }
  return groups;
}
