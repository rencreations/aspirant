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
 * The two outer quarters of the screen, left and right, where the cursor becomes "Leave" and a
 * click closes the player. The middle half plays and pauses.
 */
export function inLeaveZone(x: number, width: number): boolean {
  return x < width * 0.25 || x > width * 0.75;
}

/** Which shape the cursor takes. */
export function cursorShape(options: {
  /** The cursor is snapped to the timeline. */
  snapped: boolean;
  /** What is under it: a button, the control bar, or the picture. */
  zone: "controls" | "button" | "stage";
  leave: boolean;
  playing: boolean;
  busy: boolean;
}): CursorShape {
  const { snapped, zone, leave, playing, busy } = options;
  if (snapped) return "scrub";
  if (zone === "button" || zone === "controls") return "dot";
  if (leave) return "leave";
  if (busy) return "busy";
  return playing ? "pause" : "play";
}

/** Fraction (0 to 1) along a track for a pointer x. */
export function fractionAt(clientX: number, left: number, width: number): number {
  return width > 0 ? clamp01((clientX - left) / width) : 0;
}

interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
}

/**
 * When the pointer comes close to the timeline the cursor snaps onto it: it keeps following the
 * pointer along the track and sits in the middle of the track's height. Returns where it goes,
 * or null when the pointer is too far away.
 */
export function snapToTrack(
  x: number,
  y: number,
  track: Box,
  reach = 44,
): { x: number; y: number; fraction: number } | null {
  const middle = (track.top + track.bottom) / 2;
  if (Math.abs(y - middle) > reach) return null;
  if (x < track.left - reach / 2 || x > track.right + reach / 2) return null;
  const clamped = Math.min(track.right, Math.max(track.left, x));
  return { x: clamped, y: middle, fraction: fractionAt(clamped, track.left, track.width) };
}

export interface QualityOption {
  label: string;
  height: number;
  src: string;
}

/**
 * The size "Auto" picks: the smallest one that is sharp enough for the picture as it appears on
 * this screen (width matched, in device pixels), one step down on a very slow connection (under 1.5 Mbit/s).
 */
export function autoQuality<T extends QualityOption>(
  options: readonly T[],
  display: { width: number; height: number; dpr: number; downlinkMbps?: number },
): T {
  const sorted = [...options].sort((a, b) => a.height - b.height);
  const shown = Math.min(display.width, (display.height * 16) / 9) * display.dpr;
  const need = (shown * 9) / 16;
  let index = sorted.findIndex((o) => o.height >= need * 0.85);
  if (index === -1) index = sorted.length - 1;
  if (display.downlinkMbps !== undefined && display.downlinkMbps < 1.5 && index > 0) index -= 1;
  return sorted[index]!;
}
