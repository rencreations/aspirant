import type { PreloadProgress } from "@/lib/preload";

/** Bytes in plain words: "812 KB", "42 MB", "1.3 GB". */
function formatBytes(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)} GB`;
  if (n >= 1e6) return `${Math.round(n / 1e6)} MB`;
  return `${Math.max(1, Math.round(n / 1e3))} KB`;
}

/** The real progress in words: "42%, 120 MB of 290 MB" (the bytes only where the sizes are known). */
function progressWords(p: PreloadProgress | null): string {
  if (!p) return "";
  const percent = `${Math.round(p.progress * 100)}%`;
  const b = p.bytes;
  if (!b || b.total <= 0) return percent;
  // While some downloads have not said their size, "of" would promise a total that is not final.
  return b.partial
    ? `${percent}, ${formatBytes(b.received)} received`
    : `${percent}, ${formatBytes(b.received)} of ${formatBytes(b.total)}`;
}

/**
 * What the first loading screen says once the connection is slow (after 15 seconds), or at once
 * when the device is offline. It is the same real progress as the bar, never an estimate, and it
 * promises one thing: the page opens when everything is loaded.
 */
export function loadingNote(
  p: PreloadProgress | null,
  state: { offline: boolean; retrying: boolean },
): string {
  const progress = progressWords(p);
  if (state.offline) {
    return `Offline. Waiting for the connection. Loading goes on by itself when it is back.${progress ? ` ${progress}.` : ""}`;
  }
  const retry = state.retrying ? " The connection stalled, so a download is trying again." : "";
  return `Slow connection. Still loading${progress ? `, ${progress}` : ""}.${retry} The page opens when everything is loaded, with all its animations.`;
}
