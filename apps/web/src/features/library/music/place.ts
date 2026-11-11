/**
 * The track the visitor was on, kept for the tab (`sessionStorage`). A video opened from the Watch
 * list comes back to `/collection/music` without `?i=`; the room then opens on this track again.
 */
const KEY = "aspirants:music-place";

export function readPlace(): string | null {
  try {
    return window.sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function writePlace(id: string): void {
  try {
    window.sessionStorage.setItem(KEY, id);
  } catch {
    /* Private windows may refuse: the room then opens on its first track. */
  }
}
