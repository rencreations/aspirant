/**
 * The eight languages of the Voicelines room, in the order of their shortcuts. The table is the one
 * `scripts/library/voicelines/build.py` writes into `voicelines.json` (a test keeps them equal), so
 * the shortcuts can be drawn into the page before any data has arrived.
 *
 * Japanese is the default, and its address is `?lang=jp`. `ja` is read too (the code of the
 * language itself), but the page writes `jp`.
 */
export const LANG_IDS = ["en", "id", "jp", "ar", "es", "pt", "tr", "ru"] as const;

export type LangId = (typeof LANG_IDS)[number];

/** The flag drawn beside a language (`flags.tsx`). Arabic has no country: the flag is the UAE's. */
export type FlagId = "gb" | "id" | "jp" | "ae" | "es" | "br" | "tr" | "ru";

export interface LangInfo {
  id: LangId;
  /** The name of the language in itself, as the shortcut says it. */
  name: string;
  /** The name in English, for the accessible name and the plain lists. */
  english: string;
  /** The `lang` attribute of text in this language. */
  html: string;
  dir: "ltr" | "rtl";
  flag: FlagId;
}

const INFO: Readonly<Record<LangId, LangInfo>> = {
  en: { id: "en", name: "English", english: "English", html: "en", dir: "ltr", flag: "gb" },
  id: {
    id: "id",
    name: "Bahasa Indonesia",
    english: "Indonesian",
    html: "id",
    dir: "ltr",
    flag: "id",
  },
  jp: { id: "jp", name: "日本語", english: "Japanese", html: "ja", dir: "ltr", flag: "jp" },
  ar: { id: "ar", name: "اللغة العربية", english: "Arabic", html: "ar", dir: "rtl", flag: "ae" },
  es: { id: "es", name: "español", english: "Spanish", html: "es", dir: "ltr", flag: "es" },
  pt: { id: "pt", name: "português", english: "Portuguese", html: "pt", dir: "ltr", flag: "br" },
  tr: { id: "tr", name: "türkçe", english: "Turkish", html: "tr", dir: "ltr", flag: "tr" },
  ru: { id: "ru", name: "русский", english: "Russian", html: "ru", dir: "ltr", flag: "ru" },
};

/** The languages in the order of the shortcuts. */
export const LANGUAGES: readonly LangInfo[] = LANG_IDS.map((id) => INFO[id]);

export const DEFAULT_LANG: LangId = "jp";

/** The seven languages that share one list of lines (line N is the same line in all of them). Japanese has its own list. */
export const ALIGNED_LANGS: readonly LangId[] = LANG_IDS.filter((id) => id !== "jp");

export function isLangId(value: string): value is LangId {
  return (LANG_IDS as readonly string[]).includes(value);
}

/** The language an address asks for: `jp` (or `ja`), `en`, `id` ... Anything else is the default. */
export function parseLang(value: string | null | undefined): LangId {
  const v = (value ?? "").trim().toLowerCase();
  if (v === "ja") return "jp";
  return isLangId(v) ? v : DEFAULT_LANG;
}

export function langInfo(id: LangId): LangInfo {
  return INFO[id];
}
