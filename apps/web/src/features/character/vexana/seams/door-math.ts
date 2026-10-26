import type { PerfLevel } from "@/lib/perf";

/** Which side of a boundary the page is on while it is at rest. */
export type Side = "before" | "after";

/**
 * The side the page rests on: "after" from the first screen of the section behind the boundary
 * (where its up threshold begins) on, "before" above it. A page that is opened part way down, or
 * flung past the doors, is put into the resting state of that side without playing anything.
 */
export function sideOf(y: number, afterStart: number | null): Side {
  return afterStart !== null && y >= afterStart - 2 ? "after" : "before";
}

/** The times of a door transition, in seconds (before the performance level shortens them). */
export const DOOR_TIMES = {
  /** The two leaves close. */
  close: 0.8,
  /** The two leaves open. */
  open: 0.64,
  /** The longest a section's exit is waited for. */
  leaveMax: 1.4,
  /** The longest the next section is waited for to be ready to show (its pictures decoded). */
  readyMax: 0.5,
  /** The longest the arrival of a section is waited for before the scroll is given back anyway. */
  arrivalMax: 3.2,
} as const;

/** The longest the scroll stays locked: a net for a hook that never answers, never a wait. */
export const DOOR_LOCK_MS = 5200;

/** A weak device plays the scenes a little shorter. */
export function speedFor(level: PerfLevel): number {
  return level === "lite" ? 0.7 : 1;
}
