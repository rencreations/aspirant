import type { DuoMark, DuoMarkKind, DuoMarkTone } from "./pose";

/**
 * The duo asks for its comic cues in its own words (`DuoMark`). The home's marks (`fx/comic-marks`)
 * draw them. This table says which of the marks' kinds and colours each cue is, so a section hands
 * the duo's marks to `marks.emit` in a few lines:
 *
 *   duo.setMarkSink((m) => {
 *     const mark = comicMark(m);
 *     marks.emit(mark.kind, { at: { x: m.x, y: m.y }, size: mark.size, color: mark.color,
 *                             rotation: mark.rotation });
 *   });
 *
 * No import of the marks here: the names are theirs, written as plain strings, and a test keeps
 * every cue of the duo covered.
 */
type ComicKind =
  | "bang"
  | "question"
  | "spark"
  | "heart"
  | "speed"
  | "sweat"
  | "poof"
  | "dizzy"
  | "sparkle"
  | "vein"
  | "starburst"
  | "note";

type ComicColor = "ink" | "pink" | "gold" | "sky";

export const COMIC_KIND: Readonly<Record<DuoMarkKind, ComicKind>> = {
  bang: "bang",
  ask: "question",
  spark: "spark",
  heart: "heart",
  lines: "speed",
  drop: "sweat",
  puff: "poof",
  swirl: "dizzy",
  ha: "sparkle",
  vein: "vein",
  star: "starburst",
  note: "note",
};

const COLOR: Readonly<Record<DuoMarkTone, ComicColor>> = {
  ink: "ink",
  pink: "pink",
  gold: "gold",
  cyan: "sky",
};

/** The height of one cue at size 1, in CSS pixels. The duo has already scaled `size` by the drone's. */
const BASE = 64;

interface ComicMark {
  kind: ComicKind;
  color: ComicColor;
  /** Height in CSS pixels. */
  size: number;
  /** Radians, anticlockwise (a quarter turn is up for the speed lines). */
  rotation: number;
}

/** A cue of the duo as the marks want it. */
export function comicMark(mark: DuoMark): ComicMark {
  return {
    kind: COMIC_KIND[mark.kind],
    color: COLOR[mark.tone],
    size: BASE * mark.size,
    rotation: (mark.turn * Math.PI) / 180,
  };
}
