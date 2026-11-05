import { pairs } from "@/content/pairs";
import { libUrl } from "@/lib/library";
import { CHARACTER_NAMES } from "@/lib/slugs";

import type { Film, FilmChapter, FilmKind } from "./types";

/** The name of each kind of film, as a small label on a card. */
export const KIND_LABEL: Readonly<Record<FilmKind, string>> = {
  trailer: "Trailer",
  teaser: "Teaser",
  character: "Character film",
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
};

export interface RowDef {
  id: string;
  title: string;
  /** A short name for the filter chip. */
  chip: string;
  /** One line under the title. */
  note: string;
  kinds: readonly FilmKind[];
}

/** The rows of the room, in order. A film goes in the row that lists its kind. */
export const ROWS: readonly RowDef[] = [
  {
    id: "trailers",
    chip: "Trailers",
    title: "Trailers and teasers",
    note: "The animated films that open each story.",
    kinds: ["trailer", "teaser"],
  },
  {
    id: "characters",
    chip: "Character films",
    title: "Character films",
    note: "One Aspirant tells her own story.",
    kinds: ["character"],
  },
  {
    id: "lore",
    chip: "Story films",
    title: "Lore and story films",
    note: "Short films and the motion comic.",
    kinds: ["lore"],
  },
  {
    id: "shorts",
    chip: "Shorts",
    title: "Shorts",
    note: "Quick pieces, many of them vertical.",
    kinds: ["short", "social"],
  },
  {
    id: "showcases",
    chip: "Skin showcases",
    title: "Skin showcases",
    note: "The skins in the game.",
    kinds: ["showcase"],
  },
  {
    id: "music",
    chip: "Music and making of",
    title: "Music and behind the scenes",
    note: "The song, the soundtrack and the people who made them.",
    kinds: ["music", "behind-the-scenes"],
  },
  {
    id: "interviews",
    chip: "Interviews and events",
    title: "Interviews and events",
    note: "Voices, invitations and revamps.",
    kinds: ["interview", "event"],
  },
  {
    id: "drama",
    chip: "Interactive drama",
    title: "Interactive drama",
    note: "Thirteen films, six chapters, one choice at a time.",
    kinds: ["drama"],
  },
  {
    id: "live",
    chip: "Streams and matches",
    title: "Livestreams and matches",
    note: "Long recordings. Settle in.",
    kinds: ["livestream", "match"],
  },
  {
    id: "parody",
    chip: "Parody",
    title: "Live-action parody",
    note: "Made outside the story.",
    kinds: ["parody"],
  },
];

/** The row a kind belongs to. */
export function rowOf(kind: FilmKind): RowDef {
  return ROWS.find((r) => r.kinds.includes(kind)) ?? ROWS[0]!;
}

export interface FilmFilters {
  /** A character slug, or an empty string. */
  who: string;
  /** A pair id, or an empty string. */
  pair: string;
  /** A row id (see `ROWS`), or an empty string. */
  kind: string;
  /** Free text. */
  q: string;
}

export const NO_FILTERS: FilmFilters = { who: "", pair: "", kind: "", q: "" };

export function hasFilters(f: FilmFilters): boolean {
  return Boolean(f.who || f.pair || f.kind || f.q.trim());
}

const PAIR_NAMES: Readonly<Record<string, string>> = Object.fromEntries(
  pairs.map((p) => [p.id, p.names]),
);

export function pairName(id: string | null): string {
  return id ? (PAIR_NAMES[id] ?? id) : "";
}

const haystacks = new WeakMap<Film, string>();

/** The words a search looks in: title, text, tags, characters, pair and the scene captions. */
function haystack(film: Film): string {
  let h = haystacks.get(film);
  if (h === undefined) {
    h = [
      film.title,
      film.desc,
      film.tags.join(" "),
      KIND_LABEL[film.kind],
      pairName(film.pair),
      film.chars.map((c) => CHARACTER_NAMES[c]).join(" "),
      film.chapters.map((c) => c.l).join(" "),
    ]
      .join(" ")
      .toLowerCase();
    haystacks.set(film, h);
  }
  return h;
}

/** Does a film pass the filters? `skip` leaves one group out, to count how many each choice would leave. */
export function matches(film: Film, f: FilmFilters, skip?: "who" | "pair" | "kind"): boolean {
  if (skip !== "who" && f.who && !film.chars.includes(f.who as never)) return false;
  if (skip !== "pair" && f.pair && film.pair !== f.pair) return false;
  if (skip !== "kind" && f.kind && rowOf(film.kind).id !== f.kind) return false;
  const words = f.q.toLowerCase().split(/\s+/u).filter(Boolean);
  if (words.length > 0) {
    const h = haystack(film);
    if (!words.every((w) => h.includes(w))) return false;
  }
  return true;
}

export function filterFilms(films: readonly Film[], f: FilmFilters): Film[] {
  return films.filter((film) => matches(film, f));
}

interface Facets {
  who: Record<string, number>;
  pair: Record<string, number>;
  kind: Record<string, number>;
}

/** How many films each choice would leave, given the other choices. */
export function facets(films: readonly Film[], f: FilmFilters): Facets {
  const out: Facets = { who: {}, pair: {}, kind: {} };
  for (const film of films) {
    if (matches(film, f, "who")) {
      for (const c of film.chars) out.who[c] = (out.who[c] ?? 0) + 1;
    }
    if (matches(film, f, "pair") && film.pair) out.pair[film.pair] = (out.pair[film.pair] ?? 0) + 1;
    if (matches(film, f, "kind")) {
      const id = rowOf(film.kind).id;
      out.kind[id] = (out.kind[id] ?? 0) + 1;
    }
  }
  return out;
}

interface FilmRow {
  row: RowDef;
  films: Film[];
}

/** The films in rows, in the order of `ROWS`. Rows with no film are left out. */
export function groupRows(films: readonly Film[]): FilmRow[] {
  return ROWS.map((row) => ({
    row,
    films: films.filter((f) => row.kinds.includes(f.kind)),
  })).filter((r) => r.films.length > 0);
}

/** A film by its id, or by one of the ids of the same film posted under another name. */
export function findFilm(films: readonly Film[], id: string): Film | undefined {
  if (!id) return undefined;
  return films.find((f) => f.id === id) ?? films.find((f) => f.also?.includes(id));
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

/** The index of the scene that holds `time`, or -1 when the film has no scenes. */
export function chapterAt(chapters: readonly FilmChapter[], time: number): number {
  let found = -1;
  for (let i = 0; i < chapters.length; i++) {
    if (chapters[i]!.t <= time + 0.01) found = i;
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

/** A runtime in words: "1 min 40 s", "28 min", "2 h 5 min". */
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

export function totalRuntime(films: readonly Film[]): number {
  return films.reduce((sum, f) => sum + f.video.dur, 0);
}

/** Is the picture taller than wide? */
export function isVertical(film: Film): boolean {
  return film.video.h > film.video.w;
}

/** Width over height of the picture, for the stage. */
export function aspectOf(film: Film): number {
  return film.video.h > 0 ? film.video.w / film.video.h : 16 / 9;
}

/** The address of the file that plays: the site's own copy, or the library's. */
function videoUrl(film: Film): string {
  return film.video.local ?? libUrl(film.video.src);
}

/** The address with a start time, which the browser honours when the file loads (a media fragment). */
export function videoUrlAt(film: Film, start: number): string {
  const base = videoUrl(film);
  return start > 0 ? `${base}#t=${Number(start.toFixed(2))}` : base;
}

export function posterUrl(film: Film): string {
  return libUrl(film.video.poster);
}

export function thumbUrl(film: Film): string {
  return libUrl(film.thumb);
}

export function captionsUrl(film: Film): string | undefined {
  return film.video.captions ? libUrl(film.video.captions) : undefined;
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

/** The pictures of the first screen: the featured poster and the first thumbnails of the first row. */
export function firstScreenKeys(films: readonly Film[], featured: string, thumbs = 5): string[] {
  const hero = findFilm(films, featured);
  const first = groupRows(films)[0]?.films.slice(0, thumbs) ?? [];
  return [...(hero ? [hero.video.poster] : []), ...first.map((f) => f.thumb)];
}

/** Every other thumbnail, for the background. */
export function restKeys(films: readonly Film[], featured: string, thumbs = 5): string[] {
  const seen = new Set(firstScreenKeys(films, featured, thumbs));
  return films.map((f) => f.thumb).filter((k) => !seen.has(k));
}
