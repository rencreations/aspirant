/** Small formatting helpers shared by the catalog and the UI. */

/** 308.48 gives "5:08"; 3725 gives "1:02:05". */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const ss = String(sec).padStart(2, "0");
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${ss}`;
  return `${m}:${ss}`;
}

/** 27720 gives "7 h 42 min". Under an hour it gives "42 min". */
export function formatRuntime(totalSeconds: number): string {
  const minutes = Math.round(totalSeconds / 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return `${h} h ${String(m).padStart(2, "0")} min`;
}

/** Two-digit counter: 7 gives "07". */
export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Spoken duration for assistive tech: "5 minutes 8 seconds". */
export function spokenDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  const parts: string[] = [];
  if (m) parts.push(`${m} ${m === 1 ? "minute" : "minutes"}`);
  if (sec || !m) parts.push(`${sec} ${sec === 1 ? "second" : "seconds"}`);
  return parts.join(" ");
}

/** Joins [3, 23, 40] into "3, 23 and 40". */
export function listPages(pages: readonly number[]): string {
  if (pages.length < 2) return pages.join("");
  return `${pages.slice(0, -1).join(", ")} and ${pages[pages.length - 1]}`;
}
