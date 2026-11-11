import type { Route } from "next";

import { acts, chapters } from "@/content/story";
import { chapterHref } from "@/features/story/chapter-href";

const pad = (n: number, w: number) => String(n).padStart(w, "0");

/** The id of a chapter by its number (0 is the prologue): `c00`, `c15`. */
const chapterId = (n: number): string => `c${pad(n, 2)}`;

/** The story page of a chapter, at a paragraph when `p` is given. */
export function chapterLink(n: number, p?: number): Route {
  const id = chapterId(n);
  return chapterHref(id, p === undefined ? undefined : `${id}-p${pad(p, 3)}`);
}

/** "Prologue" or "Chapter 15". */
export const chapterName = (n: number): string => (n === 0 ? "Prologue" : `Chapter ${String(n)}`);

/** The short chip: "Prologue" or "Ch 15". */
export const chapterChip = (n: number): string => (n === 0 ? "Prologue" : `Ch ${String(n)}`);

/** The title of a chapter, or "" when the number is not one. */
export const chapterTitle = (n: number): string => chapters[n]?.title ?? "";

export interface ActInfo {
  roman: string;
  title: string;
  from: number;
  to: number;
}

/** The act a chapter belongs to. */
export function actOfChapter(n: number): ActInfo | undefined {
  return acts.find((a) => n >= a.from && n <= a.to);
}
