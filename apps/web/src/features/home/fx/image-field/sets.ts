/**
 * The picture sets of the field and the pure helpers around them. A set is the pictures a field
 * of cards shows: the portrait (4:5) pictures the cards have in the hero and in the ring, and the
 * wide (16:9) pictures they have on the wall. No three.js and no DOM here: the preload list and
 * the tests read it too.
 */
import { libUrl } from "@/lib/library";
import { asset } from "@/lib/asset";

import { HERO_PORTRAITS, HERO_WALLS } from "./picks-data";
import { WALL_TILES } from "./tiles-data";

/** A rectangle as fractions of a whole picture. */
interface Window {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PortraitPic {
  id: string;
  /** Character ids (a single id for a one-character picture). */
  chars: readonly string[];
  /** A path under `public/`. */
  path: string;
  w: number;
  h: number;
  bytes: number;
  /** The subject, as fractions of the picture: the crop of another shape is centred on it. */
  focus: { x: number; y: number };
}

export interface WidePic {
  id: string;
  chars: readonly string[];
  /** The library key of the 1280 wide `p` picture. */
  key: string;
  w: number;
  h: number;
  bytes: number;
  /** The 16:9 window to show (the game's corner mark is out of it). */
  clean: Window;
  focus: { x: number; y: number };
}

export interface FieldSetDef {
  readonly name: FieldSetName;
  readonly portraits: readonly PortraitPic[];
  /** The wall's pictures in one cyclic order: slot `s` of the wall shows `walls[s]`. */
  readonly walls: readonly WidePic[];
  /** More official pictures for the wall only (small thumbnails), so the many small cards do not repeat much. */
  readonly tiles: readonly WidePic[];
}

/** Every picture the wall can show: the splash art, then the tiles. A card's `wide` is an index into it. */
export function poolOf(def: FieldSetDef): readonly WidePic[] {
  return def.tiles.length === 0 ? def.walls : [...def.walls, ...def.tiles];
}

export type FieldSetName = "hero";

const SETS: Readonly<Record<FieldSetName, FieldSetDef>> = {
  hero: { name: "hero", portraits: HERO_PORTRAITS, walls: HERO_WALLS, tiles: WALL_TILES },
};

export function setDef(name: FieldSetName): FieldSetDef {
  return SETS[name];
}

/** A pixel crop of a decoded picture. */
export interface Crop {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

/** The window of a wide picture in whole pixels, kept inside the picture. */
export function wideCrop(pic: WidePic): Crop {
  const sx = Math.max(0, Math.round(pic.clean.x * pic.w));
  const sy = Math.max(0, Math.round(pic.clean.y * pic.h));
  const sw = Math.max(1, Math.min(pic.w - sx, Math.round(pic.clean.w * pic.w)));
  const sh = Math.max(1, Math.min(pic.h - sy, Math.round(pic.clean.h * pic.h)));
  return { sx, sy, sw, sh };
}

/** Where one picture comes from and how it is cut when it is decoded. */
export interface PicSource {
  /** Unique in the store. */
  readonly id: string;
  readonly url: string;
  readonly crop: Crop | null;
  readonly bytes: number;
  /** Width over height of what the texture holds. */
  readonly aspect: number;
}

export function portraitSource(pic: PortraitPic): PicSource {
  return {
    id: `field:p:${pic.id}`,
    url: asset(pic.path),
    crop: null,
    bytes: pic.bytes,
    aspect: pic.w / pic.h,
  };
}

export function wideSource(pic: WidePic): PicSource {
  const crop = wideCrop(pic);
  return {
    id: `field:w:${pic.id}`,
    url: libUrl(pic.key),
    crop,
    bytes: pic.bytes,
    aspect: crop.sw / crop.sh,
  };
}

/**
 * Where the subject of a wide picture is inside its window, as fractions of the window. A card
 * narrower than the window shows a slice of it, centred on this point.
 */
export function focusInWindow(pic: WidePic): { x: number; y: number } {
  const x = (pic.focus.x - pic.clean.x) / pic.clean.w;
  const y = (pic.focus.y - pic.clean.y) / pic.clean.h;
  return { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) };
}
