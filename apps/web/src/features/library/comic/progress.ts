/** Where a visitor stopped in each comic, kept in this browser only. Storage may be blocked. */

const KEY = "aspirants:library:comic:";
const EVENT = "aspirants:library:comic-progress";

/** Parse a saved value into a page number, or null. */
export function parsePage(raw: string | null): number | null {
  if (raw === null) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function readProgress(comicId: string): number | null {
  try {
    return parsePage(window.localStorage.getItem(KEY + comicId));
  } catch {
    return null;
  }
}

export function writeProgress(comicId: string, page: number): void {
  try {
    window.localStorage.setItem(KEY + comicId, String(page));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* storage may be blocked */
  }
}

/** For `useSyncExternalStore`: tells the shelf when a place is saved (here or in another tab). */
export function subscribeProgress(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** The saved places of some comics as one string (a stable snapshot): `id:page` joined by commas. */
export function progressSnapshot(ids: readonly string[]): string {
  const out: string[] = [];
  for (const id of ids) {
    const page = readProgress(id);
    if (page !== null) out.push(`${id}:${page}`);
  }
  return out.join(",");
}

/** Read a snapshot back into a map. */
export function parseSnapshot(snapshot: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const part of snapshot.split(",")) {
    const cut = part.lastIndexOf(":");
    const page = cut > 0 ? parsePage(part.slice(cut + 1)) : null;
    if (page !== null) out[part.slice(0, cut)] = page;
  }
  return out;
}
