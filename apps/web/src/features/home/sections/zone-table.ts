/**
 * Builds a section's table of scroll zones from lengths written in SCREENS (round three). A section
 * is a row of segments: a ZONE, where the scroll drives the scene (`kernel/scrub.ts`), and a REST,
 * where the page is free and the scene stands (the visitor reads, picks, plays). The plays table the
 * kernel wants is in fractions of the section (`at`, `span`), so this turns one into the other and
 * returns the lengths the section's `index.ts` needs.
 *
 * Pure and import free (a type only) on purpose: `index.ts` reads it, and `index.ts` must never reach
 * `kernel/where.ts`.
 */
import type { HomePlay, PlayEase } from "../kernel/plays";

/** A stretch where the page is free and the scene stands. */
export interface RestSegment {
  readonly rest: number;
}

/** A stretch where the scroll drives the scene from the station before it to `to`. */
export interface ZoneSegment {
  /** Length in screens. */
  readonly zone: number;
  /** The value of `local` at the end of the zone. */
  readonly to: number;
  readonly ease?: PlayEase;
}

export type Segment = RestSegment | ZoneSegment;

export interface ZoneTable {
  /** The section's length in screens: every segment added up. */
  readonly screens: number;
  readonly plays: readonly HomePlay[];
  /** Where each zone starts and ends, in screens from the section's start. */
  readonly zones: readonly { readonly from: number; readonly to: number }[];
}

/** The idle snap of a full traverse: about half a second a screen, never under 0.35 s or over 0.9 s. */
export function snapSeconds(screens: number): number {
  return Math.min(0.9, Math.max(0.35, 0.55 * screens));
}

/**
 * `first` is the value of `local` at the start of the section. The values must differ from zone to
 * zone and the zones must end at or before the section's end (a trailing rest is fine).
 */
export function zoneTable(first: number, segments: readonly Segment[]): ZoneTable {
  let total = 0;
  for (const s of segments) total += "zone" in s ? s.zone : s.rest;
  const plays: HomePlay[] = [];
  const zones: { from: number; to: number }[] = [];
  let at = 0;
  let value = first;
  for (const s of segments) {
    if (!("zone" in s)) {
      at += s.rest;
      continue;
    }
    plays.push({
      at: at / total,
      span: s.zone / total,
      from: value,
      to: s.to,
      seconds: snapSeconds(s.zone),
      ease: s.ease ?? "linear",
    });
    zones.push({ from: at, to: at + s.zone });
    at += s.zone;
    value = s.to;
  }
  return { screens: total, plays, zones };
}
