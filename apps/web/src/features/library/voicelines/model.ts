import type { Route } from "next";

import { libUrl } from "@/lib/library";
import type { CharacterSlug } from "@/lib/slugs";

import { ALIGNED_LANGS, isLangId, langInfo, type LangId } from "./languages";
import type { VoiceCharacterFile, VoiceLine } from "./types";

// Routes ----------------------------------------------------------------------------------------

/** The room: the ten Aspirants and the shortcuts to their languages. */
export const VOICELINES_ROUTE = "/collection/voicelines" as Route;

/**
 * The page of one Aspirant. A language and a line are parameters of the same page, never other
 * pages: `?lang=jp` and `&i=05`. Without a language the page opens in Japanese.
 */
export function voicelinesRoute(
  slug: CharacterSlug,
  options: { lang?: LangId; line?: number } = {},
): Route {
  const params = new URLSearchParams();
  if (options.lang) params.set("lang", options.lang);
  if (options.line) params.set("i", pad(options.line));
  const query = params.toString();
  return `${VOICELINES_ROUTE}/${slug}${query ? `?${query}` : ""}` as Route;
}

// Audio keys ------------------------------------------------------------------------------------

/**
 * The key (a path under `library/v1/`) of a line's files, without the extension. The Japanese list
 * keeps the keys of the first version of the room (`voicelines/<slug>/NN`); the other seven
 * languages are `voicelines/<slug>/<lang>/NN`.
 */
export function lineStem(slug: string, lang: LangId, n: number): string {
  return lang === "jp" ? `voicelines/${slug}/${pad(n)}` : `voicelines/${slug}/${lang}/${pad(n)}`;
}

/** The address of the AAC file that plays. */
export function lineAudioUrl(slug: string, lang: LangId, n: number): string {
  return libUrl(`${lineStem(slug, lang, n)}.m4a`);
}

/** The address and the extension of the original file that is downloaded. */
export function lineOriginal(
  slug: string,
  lang: LangId,
  line: VoiceLine,
): { url: string; ext: "flac" | "mp3" } {
  const ext = line.x ?? "flac";
  return { url: libUrl(`${lineStem(slug, lang, line.n)}.${ext}`), ext };
}

/** A readable name for a saved file: `Fanny - English - 05.flac`. */
export function downloadName(name: string, lang: LangId, n: number, ext: string): string {
  return `${name} - ${langInfo(lang).english} - ${pad(n)}.${ext}`.replace(/[\\/:*?"<>|]/gu, "");
}

export function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// Time ------------------------------------------------------------------------------------------

/** `0:42`, or `1:05:09` when it is longer than an hour. */
export function clock(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** `2.4 s` for a short line, `0:12` for a longer one. */
export function shortLength(seconds: number): string {
  return seconds < 10 ? `${seconds.toFixed(1)} s` : clock(seconds);
}

/** `About 14 min` for the sum of many lines. */
export function totalLength(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 90) return `${minutes} min`;
  const hours = seconds / 3600;
  return `${hours.toFixed(hours < 10 ? 1 : 0)} h`;
}

// Translations ----------------------------------------------------------------------------------

/**
 * Which languages can sit under a line as its translation. The seven languages that share one
 * list offer each other (a line is the same line in all of them). The Japanese list is its own
 * list, so it offers the English translation that came with it, and nothing else: a Japanese
 * line is never shown as the same line of another language.
 */
export function translationOptions(lang: LangId): readonly LangId[] {
  return lang === "jp" ? ["en"] : ALIGNED_LANGS.filter((id) => id !== lang);
}

/** The translation shown when the address names none: English, except for English itself. */
export function defaultTranslation(lang: LangId): LangId | "" {
  return lang === "en" ? "" : "en";
}

/**
 * The translation an address asks for (`?tr=id`, or `?tr=off` for none). One that this language
 * cannot offer, and a missing one, give the default.
 */
export function parseTranslation(value: string | null | undefined, lang: LangId): LangId | "" {
  const v = (value ?? "").trim().toLowerCase();
  if (v === "off") return "";
  if (isLangId(v) && translationOptions(lang).includes(v)) return v;
  return defaultTranslation(lang);
}

export interface Translation {
  lang: LangId;
  text: string;
  /** The same line in the other language, when it has a recording to play. */
  line: VoiceLine | null;
}

export function translationOf(
  file: VoiceCharacterFile,
  lang: LangId,
  line: VoiceLine,
  into: LangId | "",
): Translation | null {
  if (into === "" || !translationOptions(lang).includes(into)) return null;
  if (lang === "jp") return line.tr ? { lang: "en", text: line.tr, line: null } : null;
  const other = file.langs[into].find((l) => l.n === line.n);
  return other ? { lang: into, text: other.t, line: other.d === undefined ? null : other } : null;
}

// Search ----------------------------------------------------------------------------------------

/** Letters without accents and case, so `turkce` finds `türkçe` and `selena` finds `Selena`. */
export function foldText(text: string): string {
  return text.normalize("NFKD").replace(/\p{M}/gu, "").replace(/ı/gu, "i").toLocaleLowerCase();
}

/** The lines of a list that hold the words of a query, in the text or in the translation. */
export function filterLines(
  lines: readonly VoiceLine[],
  query: string,
  extra?: (line: VoiceLine) => string,
): VoiceLine[] {
  const words = foldText(query).split(/\s+/u).filter(Boolean);
  if (words.length === 0) return [...lines];
  return lines.filter((line) => {
    const hay = foldText(`${pad(line.n)} ${line.t} ${extra?.(line) ?? ""}`);
    return words.every((w) => hay.includes(w));
  });
}

/** A line number from an address (`5`, `05`), or null. */
export function lineParam(value: string | null | undefined): number | null {
  const n = Number.parseInt((value ?? "").trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Old addresses and search results --------------------------------------------------------------

/** What `?i=<id>` (a search result, the first version of the room) points at. */
export interface IdTarget {
  slug: CharacterSlug;
  lang: LangId;
  line: number | null;
  group: "line" | "compilation" | "trailer";
}

/**
 * The ids of the first version were `voice-<slug>-NN` (Japanese), `voice-<slug>-full` and
 * `voice-trailer-NN`; the English lines have `voice-<slug>-en-NN`. The index tells the slug of
 * a trailer clip (`items`), so the lookup is passed in.
 */
export function targetOfId(
  id: string,
  slugOf: (id: string) => CharacterSlug | null,
): IdTarget | null {
  const line = /^voice-([a-z]+)-(?:(en)-)?(\d{2})$/u.exec(id);
  if (line?.[1] && line[3] && line[1] !== "trailer") {
    const slug = slugOf(id);
    if (slug)
      return { slug, lang: line[2] === "en" ? "en" : "jp", line: Number(line[3]), group: "line" };
  }
  if (/^voice-[a-z]+-full$/u.test(id)) {
    const slug = slugOf(id);
    return slug ? { slug, lang: "jp", line: null, group: "compilation" } : null;
  }
  const clip = /^voice-(?:[a-z]+-)?trailer-(\d{2})$/u.exec(id);
  if (clip?.[1]) {
    const slug = slugOf(id);
    return slug ? { slug, lang: "jp", line: Number(clip[1]), group: "trailer" } : null;
  }
  return null;
}
