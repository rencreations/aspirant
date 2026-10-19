/** Small pure helpers for the custom video player. */

export type CursorShape = "play" | "pause" | "leave" | "scrub" | "dot" | "busy";

/** 1:05, 12:30, 1:02:09. Unknown or negative values read 0:00. */
export function formatTime(seconds: number): string {
  const s = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const ss = String(r).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

export function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/**
 * The band along the top and the two sides of the screen where the cursor becomes "Leave" and a
 * click closes the player. The bottom is the control bar, so it is not part of it.
 */
export function inLeaveZone(x: number, y: number, width: number, height: number): boolean {
  const side = Math.max(48, width * 0.07);
  const top = Math.max(56, height * 0.09);
  return x < side || x > width - side || y < top;
}

/** Which shape the cursor takes. `target` says what is under it, `playing` and `busy` the state. */
export function cursorShape(options: {
  zone: "controls" | "timeline" | "button" | "stage";
  leave: boolean;
  playing: boolean;
  busy: boolean;
}): CursorShape {
  const { zone, leave, playing, busy } = options;
  if (zone === "timeline") return "scrub";
  if (zone === "button" || zone === "controls") return "dot";
  if (leave) return "leave";
  if (busy) return "busy";
  return playing ? "pause" : "play";
}

/** Fraction (0 to 1) along a track for a pointer x. */
export function fractionAt(clientX: number, left: number, width: number): number {
  return width > 0 ? clamp01((clientX - left) / width) : 0;
}
