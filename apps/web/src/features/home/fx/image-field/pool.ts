/**
 * The wall's picture pool: about 160 different official pictures (`public/data/home/wall.json`, cut to 640 wide WebP
 * in `public/img/home/wall/` by `scripts/home/media/pool.py`). The wall used to repeat its 18 splash arts and 50
 * thumbnails too often, and showed look-alikes side by side. This file is the reader: the types, a lazy loader, and
 * the pure helpers a wall needs to keep pictures apart. No three.js and no DOM except in `loadPool`, so the preload
 * list and the tests import it. The data is NOT bundled (160 records, 100 KB): `loadPool()` fetches it.
 *
 * A picture is `apart` from another when it is not the same picture, not in the same `group` (the same scene or shot,
 * whoever stands in it) and not the same single Aspirant. `order` is one cyclic order in which every two pictures less
 * than `gap` places apart are `apart` (checked here and by the test on the real file): deal the wall from it and
 * nothing repeats near itself. To place pictures another way, `pickApart` takes the pictures on show and returns one
 * that is apart from all of them, the least used first.
 */
import { asset } from "@/lib/asset";
import { fetchWhole } from "@/lib/media-store";
import { untilItArrives } from "@/lib/retry";

import type { PicSource } from "./sets";

export const POOL_DATA_PATH = "/data/home/wall.json";

/** One of the ten Aspirants (a picture of her alone), or "group" (two or more Aspirants, or none). */
export type PoolCharacter =
  | "fanny"
  | "layla"
  | "ruby"
  | "angela"
  | "lesley"
  | "change"
  | "guinevere"
  | "vexana"
  | "obsidia"
  | "selena"
  | "group";

export interface PoolPicture {
  /** The id of the picture in the collection's Arts data (the splash arts keep their ids from `picks.json`). */
  id: string;
  /** A path under `public/`, 640 wide, with no corner mark. */
  file: string;
  w: number;
  h: number;
  bytes: number;
  character: PoolCharacter;
  /** Every Aspirant in the picture (empty for a picture with none). */
  chars: readonly string[];
  /** The pair of the picture ("fanny-layla"), or null. */
  pair: string | null;
  /** The dominant hue, 0 to 360. */
  hue: number;
  /** The mean luminance, 0 (black) to 1 (white). The name is the brief's. */
  dark: number;
  /** Pictures that look alike share a group key. */
  group: string;
  /** Where the picture comes from: splash, game or scene (official Arts rooms only). */
  room: string;
  /** "16:9", "wide" (2 to 1 and more) or "square" (under 1.6 to 1). */
  shape: string;
  /** The subject, as fractions of the picture: a crop of another shape is centred on it. */
  focus: { x: number; y: number };
  title: string;
  alt: string;
  /** The same picture in the collection's bucket: keys of the 1280 wide and the full size, and the full size's pixels. */
  lib: { p: string; f: string; w: number; h: number };
}

export interface Pool {
  readonly cardW: number;
  /** In `order`, two pictures closer than this are always apart. */
  readonly gap: number;
  /** The first N pictures of `order` are waited for by the loading list. */
  readonly first: number;
  readonly count: number;
  readonly bytes: number;
  readonly counts: Readonly<Record<string, number>>;
  /** Every picture, by id, in the file's own order (sorted by id). */
  readonly items: readonly PoolPicture[];
  readonly byId: ReadonlyMap<string, PoolPicture>;
  /** The ids of one cyclic order. */
  readonly order: readonly string[];
}

const CHARACTERS: readonly string[] = [
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
  "group",
];

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function num(v: unknown, what: string): number {
  if (typeof v !== "number" || !Number.isFinite(v))
    throw new Error(`pool: ${what} is not a number`);
  return v;
}

function str(v: unknown, what: string): string {
  if (typeof v !== "string" || v.length === 0) throw new Error(`pool: ${what} is not a string`);
  return v;
}

function parsePicture(raw: unknown): PoolPicture {
  if (!isObject(raw)) throw new Error("pool: a picture is not an object");
  const id = str(raw.id, "id");
  const character = str(raw.character, `${id}.character`);
  if (!CHARACTERS.includes(character))
    throw new Error(`pool: ${id} has an unknown character ${character}`);
  const focus = isObject(raw.focus) ? raw.focus : {};
  const lib = isObject(raw.lib) ? raw.lib : {};
  const chars = Array.isArray(raw.chars) ? raw.chars.map((c) => str(c, `${id}.chars`)) : [];
  return {
    id,
    file: str(raw.file, `${id}.file`),
    w: num(raw.w, `${id}.w`),
    h: num(raw.h, `${id}.h`),
    bytes: num(raw.bytes, `${id}.bytes`),
    character: character as PoolCharacter,
    chars,
    pair: typeof raw.pair === "string" ? raw.pair : null,
    hue: num(raw.hue, `${id}.hue`),
    dark: num(raw.dark, `${id}.dark`),
    group: str(raw.group, `${id}.group`),
    room: str(raw.room, `${id}.room`),
    shape: str(raw.shape, `${id}.shape`),
    focus: { x: num(focus.x, `${id}.focus.x`), y: num(focus.y, `${id}.focus.y`) },
    title: str(raw.title, `${id}.title`),
    alt: str(raw.alt, `${id}.alt`),
    lib: {
      p: str(lib.p, `${id}.lib.p`),
      f: str(lib.f, `${id}.lib.f`),
      w: num(lib.w, `${id}.lib.w`),
      h: num(lib.h, `${id}.lib.h`),
    },
  };
}

/** Read the parsed JSON of `wall.json`. Throws when the file is not what `pool.py` writes. */
export function parsePool(raw: unknown): Pool {
  if (!isObject(raw) || !Array.isArray(raw.items) || !Array.isArray(raw.order)) {
    throw new Error("pool: not a pool file");
  }
  const items = raw.items.map(parsePicture);
  const byId = new Map(items.map((p) => [p.id, p] as const));
  if (byId.size !== items.length) throw new Error("pool: a picture is listed twice");
  const order = raw.order.map((id) => str(id, "order"));
  for (const id of order)
    if (!byId.has(id)) throw new Error(`pool: order names ${id}, which is not a picture`);
  if (new Set(order).size !== order.length || order.length !== items.length) {
    throw new Error("pool: order is not every picture once");
  }
  return {
    cardW: num(raw.cardW, "cardW"),
    gap: num(raw.gap, "gap"),
    first: num(raw.first, "first"),
    count: items.length,
    bytes: items.reduce((a, p) => a + p.bytes, 0),
    counts: isObject(raw.counts) ? (raw.counts as Record<string, number>) : {},
    items,
    byId,
    order,
  };
}

let loading: Promise<Pool> | null = null;

/**
 * Fetch and parse the pool, once. The loading list (`pool-preload.ts`) and the wall both call it, so the file is read a
 * single time. A failed try is made again until the file arrives (`untilItArrives`).
 */
export function loadPool(): Promise<Pool> {
  loading ??= untilItArrives(() => fetchWhole(asset(POOL_DATA_PATH)))
    .then(async ({ blob }) => parsePool(JSON.parse(await blob.text())))
    .catch((error: unknown) => {
      loading = null;
      throw error;
    });
  return loading;
}

/** The pictures of one Aspirant ("group" for the group pictures), in the file's order. */
export function byCharacter(pool: Pool, character: PoolCharacter): readonly PoolPicture[] {
  return pool.items.filter((p) => p.character === character);
}

/** The pictures that share a group key (the same scene or shot), in the file's order. */
export function byGroup(pool: Pool, group: string): readonly PoolPicture[] {
  return pool.items.filter((p) => p.group === group);
}

/** Every picture in the cyclic `order`. */
export function ordered(pool: Pool): readonly PoolPicture[] {
  return pool.order.map((id) => pool.byId.get(id)!);
}

/** The pictures the loading list waits for: the first of `order`. */
export function firstScreen(pool: Pool): readonly PoolPicture[] {
  return ordered(pool).slice(0, pool.first);
}

/**
 * True when two pictures may stand near each other: not the same picture, not the same group, not the same single
 * Aspirant, and not two group pictures of the very same Aspirants.
 */
export function apart(a: PoolPicture, b: PoolPicture): boolean {
  if (a.id === b.id || a.group === b.group) return false;
  if (a.character !== "group" && a.character === b.character) return false;
  if (a.character === "group" && b.character === "group" && a.chars.length > 0) {
    return a.chars.join() !== b.chars.join();
  }
  return true;
}

/** The pairs of `order` closer than `gap` places (the order is cyclic) that are not `apart`. Empty when the order holds. */
export function orderProblems(pool: Pool, gap: number = pool.gap): string[] {
  const seq = ordered(pool);
  const n = seq.length;
  const bad: string[] = [];
  for (let i = 0; i < n; i += 1) {
    for (let k = 1; k <= gap && k < n; k += 1) {
      const a = seq[i]!;
      const b = seq[(i + k) % n]!;
      if (!apart(a, b)) bad.push(`${a.id} and ${b.id} are ${k} apart`);
    }
  }
  return bad;
}

/**
 * A picture for a place on the wall, apart from every picture `near` it (the neighbours, the row, what is on screen).
 * `used` counts how often each id has been shown: the least used wins, a seeded `rand` breaks the ties. Null when
 * nothing in the pool is apart from all of `near`.
 */
export function pickApart(
  pool: Pool,
  near: readonly PoolPicture[],
  used: ReadonlyMap<string, number>,
  rand: () => number,
): PoolPicture | null {
  let best: PoolPicture | null = null;
  let bestCost = Infinity;
  for (const pic of pool.items) {
    if (!near.every((n) => apart(pic, n))) continue;
    const cost = (used.get(pic.id) ?? 0) + rand() * 0.5;
    if (cost < bestCost) {
      best = pic;
      bestCost = cost;
    }
  }
  return best;
}

/** Where a pool picture comes from and how it is decoded: the whole file, no crop (it is already cut). */
export function poolSource(pic: PoolPicture): PicSource {
  return {
    id: `field:pool:${pic.id}`,
    url: asset(pic.file),
    crop: null,
    bytes: pic.bytes,
    aspect: pic.w / pic.h,
  };
}
