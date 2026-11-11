/**
 * The words of the stage, made from one picture of the data: the two lines of the caption, the
 * meta line, the cells of the title list and the line for a screen reader. A fact that the data
 * does not have (`null`) is never shown: no "Unknown".
 */
import { NAMES, type SplashItem } from "./data";
import { artsRoute } from "../core/routes";

/** The mark that a picture made for this site carries wherever it is named. */
export const NOT_OFFICIAL = "Made for this site. Not official art.";

/** The same mark under the caption, where the meta line already says it is made for this site. */
export const NOT_OFFICIAL_SHORT = "Not official art.";

/** Whether a picture is anything but official art. Such a picture always carries the mark. */
export function isMade(item: Pick<SplashItem, "canon">): boolean {
  return item.canon !== "official";
}

/** The Aspirants of a picture in canon spelling, for example `Fanny, Layla`. */
export function namesOf(chars: readonly string[]): string {
  return chars.map((slug) => (NAMES as Record<string, string>)[slug] ?? slug).join(", ");
}

const capital = (text: string) => (text ? text.charAt(0).toUpperCase() + text.slice(1) : text);

/**
 * The two lines of the caption: the part of the title before its first comma (the people) and what
 * follows it (the skin, the moment). A title without a comma is one line.
 */
export function captionLines(title: string): [string, string] {
  const at = title.indexOf(",");
  if (at < 0) return [title.trim(), ""];
  return [title.slice(0, at).trim(), capital(title.slice(at + 1).trim())];
}

/** The meta line under the title: the artist and the kind of picture, or the kind alone. */
export function metaLine(item: SplashItem): string {
  const parts = [item.facts.artist, item.facts.kind].filter((p): p is string => !!p);
  return parts.length > 0 ? parts.join(" / ") : "Splash art";
}

/** The year of a picture (`2022`), or an empty string when the data has no date. */
export function yearOf(item: Pick<SplashItem, "facts">): string {
  const m = /^(\d{4})/.exec(item.facts.date ?? "");
  return m?.[1] ?? "";
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** `22 January 2022` from `2022-01-22`, or an empty string when the data has no day. */
export function dateLabel(date: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date ?? "");
  if (!m) return "";
  const month = MONTHS[Number(m[2]) - 1];
  return month ? `${Number(m[3])} ${month} ${m[1]}` : "";
}

/** The artist, `Official` for official art that names none, and the mark for a picture made for this site. */
export function whoOf(item: SplashItem): string {
  if (isMade(item)) return "Not official";
  return item.facts.artist ?? "Official";
}

export interface RowCells {
  no: string;
  title: string;
  chars: string;
  who: string;
  year: string;
}

/**
 * Whether words over the colour `hex` (`#rrggbb`) read better in white (`dark`) or in ink (`light`).
 * The colour stands for a picture that has not arrived yet, with its loading words on it.
 */
export function toneOf(hex: string): "dark" | "light" {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/iu.exec(hex);
  if (!m) return "light";
  const channel = (h: string) => {
    const c = parseInt(h, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance =
    0.2126 * channel(m[1] ?? "00") +
    0.7152 * channel(m[2] ?? "00") +
    0.0722 * channel(m[3] ?? "00");
  // White and ink read the same at about 0.18; a little above that white still wins on a mid tone.
  return luminance < 0.22 ? "dark" : "light";
}

const two = (n: number) => String(n).padStart(2, "0");

/** The cells of one row of the title list: number, title, characters, artist or Official, year. */
export function rowCells(item: SplashItem, index: number): RowCells {
  return {
    no: two(index + 1),
    title: item.title,
    chars: namesOf(item.chars),
    who: whoOf(item),
    year: yearOf(item),
  };
}

/** What a screen reader says when the picture in front changes. */
export function spoken(item: SplashItem, index: number, total: number): string {
  const parts = [`${item.title}.`, `${metaLine(item)}.`];
  if (isMade(item)) parts.push(NOT_OFFICIAL);
  parts.push(`Picture ${index + 1} of ${total}.`);
  return parts.join(" ");
}

/** The address that opens a picture: the room with `?i=<id>`. A real link, for a crawler and for a new tab. */
export function hrefOf(id: string): string {
  return `${artsRoute("splash")}/?i=${encodeURIComponent(id)}`;
}
