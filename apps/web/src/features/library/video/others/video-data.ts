import { pairs } from "@/content/pairs";
import { asset } from "@/lib/asset";
import { libUrl } from "@/lib/library";
import { CHARACTER_NAMES } from "@/lib/slugs";

import type { OtherVideo, VideoKind, VideoScene } from "./types";

/** The name of each kind, as the small label on a tile. */
export const KIND_LABEL: Readonly<Record<VideoKind, string>> = {
  trailer: "Trailer",
  teaser: "Teaser",
  lore: "Story film",
  short: "Short",
  social: "Card",
  showcase: "Skin showcase",
  music: "Music",
  "behind-the-scenes": "Behind the scenes",
  interview: "Interview",
  event: "Event",
  drama: "Interactive drama",
  livestream: "Livestream",
  match: "Match",
  parody: "Parody",
  reel: "Promo reel",
  gameplay: "Gameplay",
  emote: "Emote",
  edit: "Official edit",
  fan: "Fan video",
};

/** A group of videos on the wall: a shelf of one kind, one pair, or one length. */
export interface Group {
  id: string;
  title: string;
  /** A short name for the index and the filter chips. */
  chip: string;
  /** One line under the title. */
  note: string;
  items: OtherVideo[];
}

export interface ShelfDef {
  id: string;
  title: string;
  chip: string;
  note: string;
  kinds: readonly VideoKind[];
}

/**
 * The shelves of the room, in order. The same list (ids, titles, kinds) is `ROWS` in
 * `scripts/library/films/catalog.py`, and a unit test reads the data file to make sure every kind
 * has a shelf and every shelf the pipeline writes is here.
 */
export const SHELVES: readonly ShelfDef[] = [
  {
    id: "trailers",
    title: "Trailers and short films",
    chip: "Trailers",
    note: "Teasers, short trailers and the short films.",
    kinds: ["trailer", "teaser", "lore"],
  },
  {
    id: "shorts",
    title: "Shorts and cards",
    chip: "Shorts",
    note: "Quick pieces and portrait cards, many of them vertical.",
    kinds: ["short", "social"],
  },
  {
    id: "showcases",
    title: "Skin showcases",
    chip: "Showcases",
    note: "The skins, in the game.",
    kinds: ["showcase"],
  },
  {
    id: "music",
    title: "Music and making of",
    chip: "Music",
    note: "The song, the soundtrack and the people who made them.",
    kinds: ["music", "behind-the-scenes"],
  },
  {
    id: "interviews",
    title: "Interviews and events",
    chip: "Interviews",
    note: "Voices, invitations and revamps.",
    kinds: ["interview", "event"],
  },
  {
    id: "drama",
    title: "Interactive drama",
    chip: "Drama",
    note: "The episodes of the drama, in chapter order. Play it on its own page in the story.",
    kinds: ["drama"],
  },
  {
    id: "live",
    title: "Streams and the match",
    chip: "Streams",
    note: "Long recordings. Settle in.",
    kinds: ["livestream", "match"],
  },
  {
    id: "reels",
    title: "Promo reels",
    chip: "Reels",
    note: "Short reels the official account posted about the series.",
    kinds: ["reel"],
  },
  {
    id: "gameplay",
    title: "Gameplay clips",
    chip: "Gameplay",
    note: "Game footage. It is not part of the story.",
    kinds: ["gameplay"],
  },
  {
    id: "emotes",
    title: "Emotes",
    chip: "Emotes",
    note: "Chibi stickers of Fanny and Layla. They loop.",
    kinds: ["emote"],
  },
  {
    id: "edits",
    title: "Official edits",
    chip: "Edits",
    note: "Reels cut from in-game animation. Not part of the story.",
    kinds: ["edit"],
  },
  {
    id: "fan",
    title: "Fan videos",
    chip: "Fan videos",
    note: "Made by fans. Every one is credited.",
    kinds: ["fan"],
  },
  {
    id: "parody",
    title: "Live-action parody",
    chip: "Parody",
    note: "Made outside the story. Nothing in it counts as canon.",
    kinds: ["parody"],
  },
];

/** The shelf a kind belongs to. */
export function shelfOf(kind: VideoKind): ShelfDef {
  return SHELVES.find((s) => s.kinds.includes(kind)) ?? SHELVES[0]!;
}

export interface LengthBand {
  id: string;
  title: string;
  chip: string;
  note: string;
  /** Videos shorter than this many seconds are in the band. */
  below: number;
}

export const LENGTH_BANDS: readonly LengthBand[] = [
  {
    id: "quick",
    title: "Under 30 seconds",
    chip: "Under 30 s",
    note: "Loops, cards and quick looks.",
    below: 30,
  },
  {
    id: "short",
    title: "30 seconds to 2 minutes",
    chip: "30 s to 2 min",
    note: "Episodes, reels and short films.",
    below: 120,
  },
  {
    id: "medium",
    title: "2 to 10 minutes",
    chip: "2 to 10 min",
    note: "Showcases, talks and the music video.",
    below: 600,
  },
  {
    id: "long",
    title: "Over 10 minutes",
    chip: "Over 10 min",
    note: "Streams, the soundtrack and the match.",
    below: Number.POSITIVE_INFINITY,
  },
];

export function lengthBandOf(seconds: number): LengthBand {
  return LENGTH_BANDS.find((b) => seconds < b.below) ?? LENGTH_BANDS[LENGTH_BANDS.length - 1]!;
}

export type GroupMode = "kind" | "pair" | "length";

export const GROUP_MODES: ReadonlyArray<{ id: GroupMode; label: string }> = [
  { id: "kind", label: "Kind" },
  { id: "pair", label: "Pair" },
  { id: "length", label: "Length" },
];

export function isGroupMode(value: string): value is GroupMode {
  return value === "kind" || value === "pair" || value === "length";
}

export const CANON_OPTIONS = [
  { value: "official", label: "Official" },
  { value: "fan", label: "Fan work" },
  { value: "non-canon", label: "Non-canon" },
] as const;

export interface VideoFilters {
  /** A character slug, or an empty string. */
  who: string;
  /** A pair id, or an empty string. */
  pair: string;
  /** A shelf id (see `SHELVES`), or an empty string. */
  kind: string;
  /** `official`, `fan` or `non-canon`, or an empty string. */
  canon: string;
  /** A length band id (see `LENGTH_BANDS`), or an empty string. */
  length: string;
  /** Free text. */
  q: string;
}

export const NO_FILTERS: VideoFilters = {
  who: "",
  pair: "",
  kind: "",
  canon: "",
  length: "",
  q: "",
};

export function hasFilters(f: VideoFilters): boolean {
  return Boolean(f.who || f.pair || f.kind || f.canon || f.length || f.q.trim());
}

/** How many separate choices are on (the search counts as one). */
export function filterCount(f: VideoFilters): number {
  return [f.who, f.pair, f.kind, f.canon, f.length].filter(Boolean).length + (f.q.trim() ? 1 : 0);
}

const PAIR_NAMES: Readonly<Record<string, string>> = Object.fromEntries(
  pairs.map((p) => [p.id, p.names]),
);

export function pairName(id: string | null): string {
  return id ? (PAIR_NAMES[id] ?? id) : "";
}

const haystacks = new WeakMap<OtherVideo, string>();

/** The words a search looks in: title, text, tags, characters, pair, credit and the scene captions. */
function haystack(video: OtherVideo): string {
  let h = haystacks.get(video);
  if (h === undefined) {
    h = [
      video.title,
      video.desc,
      video.tags.join(" "),
      KIND_LABEL[video.kind],
      shelfOf(video.kind).title,
      pairName(video.pair),
      video.chars.map((c) => CHARACTER_NAMES[c]).join(" "),
      video.credit?.by ?? "",
      video.chapters.map((c) => c.l).join(" "),
    ]
      .join(" ")
      .toLowerCase();
    haystacks.set(video, h);
  }
  return h;
}

type FilterKey = "who" | "pair" | "kind" | "canon" | "length";

/** Does a video pass the filters? `skip` leaves one group out, to count what each choice would leave. */
function matches(video: OtherVideo, f: VideoFilters, skip?: FilterKey): boolean {
  if (skip !== "who" && f.who && !video.chars.includes(f.who as never)) return false;
  if (skip !== "pair" && f.pair && video.pair !== f.pair) return false;
  if (skip !== "kind" && f.kind && shelfOf(video.kind).id !== f.kind) return false;
  if (skip !== "canon" && f.canon && video.canon !== f.canon) return false;
  if (skip !== "length" && f.length && lengthBandOf(video.video.dur).id !== f.length) return false;
  const words = f.q.toLowerCase().split(/\s+/u).filter(Boolean);
  if (words.length > 0) {
    const h = haystack(video);
    if (!words.every((w) => h.includes(w))) return false;
  }
  return true;
}

export function filterVideos(videos: readonly OtherVideo[], f: VideoFilters): OtherVideo[] {
  return videos.filter((v) => matches(v, f));
}

export interface Facets {
  who: Record<string, number>;
  pair: Record<string, number>;
  kind: Record<string, number>;
  canon: Record<string, number>;
  length: Record<string, number>;
}

/** How many videos each choice would leave, given the other choices. */
export function facets(videos: readonly OtherVideo[], f: VideoFilters): Facets {
  const out: Facets = { who: {}, pair: {}, kind: {}, canon: {}, length: {} };
  const bump = (bucket: Record<string, number>, key: string) => {
    bucket[key] = (bucket[key] ?? 0) + 1;
  };
  for (const v of videos) {
    if (matches(v, f, "who")) for (const c of v.chars) bump(out.who, c);
    if (matches(v, f, "pair") && v.pair) bump(out.pair, v.pair);
    if (matches(v, f, "kind")) bump(out.kind, shelfOf(v.kind).id);
    if (matches(v, f, "canon")) bump(out.canon, v.canon);
    if (matches(v, f, "length")) bump(out.length, lengthBandOf(v.video.dur).id);
  }
  return out;
}

/** The videos in groups. Groups with no video are left out. The order inside a group is the data's order. */
export function groupVideos(videos: readonly OtherVideo[], mode: GroupMode): Group[] {
  let groups: Group[];
  if (mode === "kind") {
    groups = SHELVES.map((s) => ({
      id: s.id,
      title: s.title,
      chip: s.chip,
      note: s.note,
      items: videos.filter((v) => s.kinds.includes(v.kind)),
    }));
  } else if (mode === "pair") {
    groups = [
      ...pairs.map((p) => ({
        id: p.id,
        title: p.names,
        chip: p.names,
        note: `Every video about ${p.names}.`,
        items: videos.filter((v) => v.pair === p.id),
      })),
      {
        id: "none",
        title: "Not about one pair",
        chip: "Everyone",
        note: "Reels and polls that are about the whole line up.",
        items: videos.filter((v) => !v.pair),
      },
    ];
  } else {
    groups = LENGTH_BANDS.map((b) => ({
      id: b.id,
      title: b.title,
      chip: b.chip,
      note: b.note,
      items: videos.filter((v) => lengthBandOf(v.video.dur) === b),
    }));
    // Shortest first inside a band, so the wall reads from quick to long.
    for (const g of groups) g.items = [...g.items].sort((a, b) => a.video.dur - b.video.dur);
  }
  return groups.filter((g) => g.items.length > 0);
}

/** A video by its id, or by one of the ids of the same video posted under another name. */
export function findVideo(
  videos: readonly OtherVideo[],
  id: string | null | undefined,
): OtherVideo | undefined {
  if (!id) return undefined;
  return videos.find((v) => v.id === id) ?? videos.find((v) => v.also?.includes(id));
}

/** The video after (`1`) or before (`-1`) this one in a list, wrapping round. */
export function neighbour(
  list: readonly OtherVideo[],
  current: OtherVideo,
  direction: 1 | -1,
): OtherVideo | undefined {
  const i = list.indexOf(current);
  if (i < 0 || list.length === 0) return undefined;
  return list[(i + direction + list.length) % list.length];
}

/** "90", "1:30", "1m30s" and "90s" all mean ninety seconds (a tenth of a second is kept). Anything else is 0. */
export function parseSeconds(
  raw: string | null | undefined,
  max = Number.POSITIVE_INFINITY,
): number {
  if (!raw) return 0;
  const s = raw.trim().toLowerCase();
  let total = 0;
  const clock = /^(?:(\d+):)?(\d{1,2}):(\d{1,2})$/u.exec(s);
  const units = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+(?:\.\d+)?)s?)?$/u.exec(s);
  if (clock) {
    total = Number(clock[1] ?? 0) * 3600 + Number(clock[2]) * 60 + Number(clock[3]);
  } else if (units && s !== "") {
    total = Number(units[1] ?? 0) * 3600 + Number(units[2] ?? 0) * 60 + Number(units[3] ?? 0);
  }
  if (!Number.isFinite(total) || total < 0) return 0;
  return Math.min(Math.round(total * 10) / 10, Math.max(0, Math.floor(max) - 1));
}

/** The index of the scene that holds `time`, or -1 when the video has no scenes. */
export function sceneAt(scenes: readonly VideoScene[], time: number): number {
  let found = -1;
  for (let i = 0; i < scenes.length; i++) {
    if (scenes[i]!.t <= time + 0.01) found = i;
    else break;
  }
  return found;
}

/** `m:ss`, or `h:mm:ss` from an hour on. */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const two = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${two(m)}:${two(r)}` : `${m}:${two(r)}`;
}

/** A runtime in words: "12 s", "1 min 40 s", "28 min", "2 h 5 min". */
export function runtimeWords(seconds: number): string {
  const s = Math.round(seconds);
  if (s < 60) return `${s} s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return m > 0 ? `${h} h ${m} min` : `${h} h`;
  if (s >= 600 || r === 0) return `${m} min`;
  return `${m} min ${r} s`;
}

export function totalRuntime(videos: readonly OtherVideo[]): number {
  return videos.reduce((sum, v) => sum + v.video.dur, 0);
}

/** The address of the file that plays: the site's own copy, or the library's. */
function videoUrl(video: OtherVideo): string {
  return video.video.local ? asset(video.video.local) : libUrl(video.video.src);
}

/** The address with a start time, which the browser honours when the file loads (a media fragment). */
export function videoUrlAt(video: OtherVideo, start: number): string {
  const base = videoUrl(video);
  return start > 0 ? `${base}#t=${Number(start.toFixed(2))}` : base;
}

export function posterUrl(video: OtherVideo): string {
  return libUrl(video.video.poster);
}

export function thumbUrl(video: OtherVideo): string {
  return libUrl(video.thumb);
}

export function stripUrl(video: OtherVideo): string {
  return libUrl(video.strip.src);
}

export function captionsUrl(video: OtherVideo): string | undefined {
  return video.video.captions ? libUrl(video.video.captions) : undefined;
}

/** Size in words: "154 MB", "1.2 GB". */
export function sizeWords(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  return `${Math.max(1, Math.round(bytes / 1024 ** 2))} MB`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "26 Sep 2026" from an ISO date, or an empty string. */
export function dateWords(iso: string | undefined): string {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})/u.exec(iso) : null;
  if (!m) return "";
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1] ?? ""} ${m[1]}`;
}

/**
 * The label a tile and the viewer show for work that is not plain official story. A fan work and the
 * parody use the shared `CanonBadge`. The official reels that are not story (the edits, the gameplay
 * clips) say so in their own words: the parody wording is wrong for them.
 */
export function notice(video: OtherVideo): {
  kind: "badge" | "note";
  /** The full words, for the viewer. */
  text: string;
  /** The short words, for a small tile. */
  short: string;
} | null {
  if (video.canon === "fan" || video.kind === "parody") {
    return { kind: "badge", text: "", short: "" };
  }
  if (video.kind === "edit") {
    return { kind: "note", text: "Official reel, not story", short: "Not story" };
  }
  if (video.kind === "gameplay") return { kind: "note", text: "Not story", short: "Not story" };
  return null;
}

/** The pictures of the first screen: the posters of the videos in the first shelves (and the one in the address). */
export function firstScreenKeys(
  videos: readonly OtherVideo[],
  linked?: OtherVideo,
  count = 14,
): string[] {
  const first = groupVideos(videos, "kind")
    .flatMap((g) => g.items)
    .slice(0, count);
  const mosaic = groupVideos(videos, "kind")
    .slice(0, 8)
    .map((g) => g.items[0]!);
  const keys = [...first, ...mosaic].map((v) => v.thumb);
  if (linked) keys.push(linked.video.poster);
  return Array.from(new Set(keys));
}

/** Every other thumbnail, for the background. */
export function restKeys(videos: readonly OtherVideo[], linked?: OtherVideo): string[] {
  const seen = new Set(firstScreenKeys(videos, linked));
  return videos.map((v) => v.thumb).filter((k) => !seen.has(k));
}

/** Every hover strip, for the background. */
export function stripKeys(videos: readonly OtherVideo[]): string[] {
  return videos.map((v) => v.strip.src);
}

/** The measures a shelf is laid out with, in pixels: the width of the wall, one row's height and the gap. */
export interface WallSize {
  width: number;
  rowHeight: number;
  gap: number;
}

/** Height of a shelf's header (padding, number, title and note), a little over what it measures. */
const SHELF_HEAD_PX = 190;
/** Height of a tile's caption (two lines of title and the small line). */
const CAPTION_PX = 66;
/** Space between two rows of tiles. */
const ROW_GAP_PX = 24;

/**
 * About how tall a shelf will be, from the shapes of its pictures. A row takes tiles while their
 * natural widths fit, then stretches them to the full width, which is what the wall's CSS does. It
 * stands in for the shelf's height before the shelf has been drawn, so `content-visibility` and the
 * placeholder of a shelf not built yet keep the page about the right height (a jump to a shelf far
 * down lands where it should).
 */
export function estimateShelf(items: ReadonlyArray<{ ar: number }>, size: WallSize): number {
  const { width, rowHeight, gap } = size;
  if (width <= 0 || rowHeight <= 0 || items.length === 0) return SHELF_HEAD_PX;
  const rows: number[][] = [];
  let used = 0;
  for (const item of items) {
    const w = item.ar * rowHeight;
    const row = rows[rows.length - 1];
    if (row && used + gap + w <= width) {
      row.push(item.ar);
      used += gap + w;
    } else {
      rows.push([item.ar]);
      used = w;
    }
  }
  let total = SHELF_HEAD_PX + ROW_GAP_PX * (rows.length - 1);
  rows.forEach((row, i) => {
    const last = i === rows.length - 1;
    const sum = row.reduce((a, b) => a + b, 0);
    const height = last ? rowHeight : (width - gap * (row.length - 1)) / sum;
    total += height + CAPTION_PX;
  });
  return Math.round(total);
}

/** The part of `estimateShelf` that is the tiles, for a shelf that is not built yet. */
export const SHELF_HEAD = SHELF_HEAD_PX;
