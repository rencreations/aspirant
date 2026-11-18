/**
 * The pictures the bend section hangs in the air: the fan pictures (the garuda wall and the ring),
 * the ten splash arts (the spiral) and the picture of the drone (the last one of the spiral, the
 * one that holds the paper the drone comes out of). Pure data and addresses, no three.js: the
 * loading list imports it, and that is in the bundle of every page.
 */
import { asset } from "@/lib/asset";
import { libUrl } from "@/lib/library";

import { HERO_PORTRAITS } from "../../fx/image-field/picks-data";

import { FAN_PICS, type FanPic } from "./fan-data";

export { FAN_PICS };

/** A part of a picture to keep when it is decoded, in whole pixels of the file. */
interface PicCrop {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

/** Where one picture comes from and how it is decoded. */
export interface PicSource {
  /** Unique in the store. */
  readonly id: string;
  readonly url: string;
  readonly bytes: number;
  /** The size of the file in pixels. */
  readonly w: number;
  readonly h: number;
  /** The decoded picture is at most this many pixels on its long side (the GPU budget). */
  readonly maxSide: number;
  /** Cut before the resize (the drone's picture keeps only the drone). */
  readonly crop: PicCrop | null;
  /** Straight alpha is multiplied in when decoded (a picture with a see-through ground). */
  readonly premultiply: boolean;
  /** Width over height of what the texture holds. */
  readonly aspect: number;
  /** The mean colour, shown until the picture has arrived. */
  readonly color: string;
}

/** The long side of a decoded fan picture. 15 of them at this size hold about 40 MB with mips. */
export const FAN_MAX_SIDE = 704;
/** The long side of a splash card (the file is 960 by 1200). Ten of them hold about 35 MB with mips. */
export const ART_MAX_SIDE = 880;
/** The drone's picture, cut to the drone (see `DRONE_CROP`). */
const DRONE_MAX_SIDE = 640;

/** The drone's still holds the drone from x 13 to 1103 and y 5 to 705 of 1440 by 740. */
export const DRONE_CROP: PicCrop = { sx: 6, sy: 0, sw: 1106, sh: 712 };
const DRONE_FILE = { w: 1440, h: 740 };
const DRONE_PATH = "/img/about/drone.webp";
const DRONE_BYTES = 35914;

/** The library's `p` picture is the original, scaled down to at most this on its long side. */
const FAN_FILE_SIDE = 1280;

export function fanSource(pic: FanPic): PicSource {
  const k = Math.min(1, FAN_FILE_SIDE / Math.max(pic.w, pic.h));
  return {
    id: `bend:fan:${pic.id}`,
    url: libUrl(pic.key),
    bytes: pic.bytes,
    w: Math.round(pic.w * k),
    h: Math.round(pic.h * k),
    maxSide: FAN_MAX_SIDE,
    crop: null,
    premultiply: false,
    aspect: pic.w / pic.h,
    color: pic.color,
  };
}

/** The Aspirants in the order of the spiral (the order of the carousel and the voices). */
export const SPIRAL_ORDER = [
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

/** The paper colour of a splash card until its picture has arrived. */
const ART_COLOR = "#d9dde6";

/** The ten splash cards (4:5, official art only), in the order of the spiral. */
export function artSources(): PicSource[] {
  return SPIRAL_ORDER.map((id) => {
    const pic = HERO_PORTRAITS.find((p) => p.id === id);
    if (!pic) throw new Error(`no splash card for ${id}`);
    return {
      id: `bend:art:${pic.id}`,
      url: asset(pic.path),
      bytes: pic.bytes,
      w: pic.w,
      h: pic.h,
      maxSide: ART_MAX_SIDE,
      crop: null,
      premultiply: false,
      aspect: pic.w / pic.h,
      color: ART_COLOR,
    };
  });
}

export function droneSource(): PicSource {
  return {
    id: "bend:drone",
    url: asset(DRONE_PATH),
    bytes: DRONE_BYTES,
    w: DRONE_FILE.w,
    h: DRONE_FILE.h,
    maxSide: DRONE_MAX_SIDE,
    crop: DRONE_CROP,
    premultiply: true,
    aspect: DRONE_CROP.sw / DRONE_CROP.sh,
    color: "#e9edf4",
  };
}

/** The size a picture is decoded to: its long side is at most `maxSide`, it is never enlarged. */
export function decodedSize(src: PicSource): { w: number; h: number } {
  const sw = src.crop?.sw ?? src.w;
  const sh = src.crop?.sh ?? src.h;
  const k = Math.min(1, src.maxSide / Math.max(sw, sh));
  return { w: Math.max(1, Math.round(sw * k)), h: Math.max(1, Math.round(sh * k)) };
}

/** A colour as red, green and blue bytes over 255 (raw sRGB, as the shader writes it). */
export type Rgb = readonly [number, number, number];

export function hexToRgb(hex: string): Rgb {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return [0.85, 0.87, 0.9];
  return [parseInt(m[1]!, 16) / 255, parseInt(m[2]!, 16) / 255, parseInt(m[3]!, 16) / 255];
}
