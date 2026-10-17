/** Reading position per comic, kept in localStorage (this browser only). */

const KEY = "aspirants:collection:comic:";
export const COMIC_PROGRESS_EVENT = "aspirants:comic-progress";

/** The page number (original numbering) the visitor last reached, or null. */
export function readComicPage(comicId: string): number | null {
  try {
    const raw = window.localStorage.getItem(KEY + comicId);
    const n = raw === null ? NaN : Number(raw);
    return Number.isInteger(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export function writeComicPage(comicId: string, page: number): void {
  try {
    window.localStorage.setItem(KEY + comicId, String(page));
    window.dispatchEvent(new CustomEvent(COMIC_PROGRESS_EVENT, { detail: comicId }));
  } catch {
    /* storage may be blocked */
  }
}
