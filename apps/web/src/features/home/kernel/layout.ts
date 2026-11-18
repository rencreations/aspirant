/**
 * Where each section sits on the scroll, in screens, and the rules that say when it runs. Pure: no
 * DOM, no three. Everything the runner, the ground and the probes need to know about position is
 * computed here from the registry, so a section that changes its length moves every later one.
 */
import type { HomeSection, SectionId } from "./types";

/** A section placed on the scroll. All numbers are in screens. */
export interface Placed {
  readonly def: HomeSection;
  readonly id: SectionId;
  readonly index: number;
  /** The scroll position at which `local` is 0. */
  readonly start: number;
  /** `start + screens`. */
  readonly end: number;
  /** The first position at which the section runs: `start - lead`. */
  readonly from: number;
  /** The last position at which the section runs: `end + tail`. */
  readonly to: number;
}

export interface Layout {
  readonly placed: readonly Placed[];
  /** The scroll distance of the whole story: the sum of the lengths. */
  readonly total: number;
}

/** A section mounts when the scroll is within this many screens of its range. */
const MOUNT_AHEAD = 2;

/** Place the sections one after another. Only the last may keep its text in the page's flow. */
export function layoutSections(defs: readonly HomeSection[]): Layout {
  let at = 0;
  const placed = defs.map((def, index): Placed => {
    if (def.dom === "flow" && index !== defs.length - 1) {
      throw new Error(`section ${def.id}: only the last section may be "flow"`);
    }
    const start = at;
    at += def.screens;
    return {
      def,
      id: def.id,
      index,
      start,
      end: at,
      from: start - def.lead,
      to: at + def.tail,
    };
  });
  return { placed, total: at };
}

/** 0 at the start of the section, 1 at its end. Outside the section it runs on, unclamped. */
export function localOf(p: Placed, S: number): number {
  return (S - p.start) / p.def.screens;
}

/** True while the section runs: from its lead to the end of its tail. */
export function isRunning(p: Placed, S: number): boolean {
  return S >= p.from && S <= p.to;
}

/** True once the scroll is past the section's tail. */
export function isPassed(p: Placed, S: number): boolean {
  return S > p.to;
}

/**
 * True when the section should have its runtime mounted: near, or running, or carried. A section
 * that builds a heavy actor names its own `mountAhead` (it is given a long way to do it between two
 * scroll events, instead of two screens).
 */
export function wantsMount(p: Placed, S: number, ahead = MOUNT_AHEAD): boolean {
  if (p.def.carry) return true;
  return S >= p.from - (p.def.mountAhead ?? ahead) && S <= p.to + 1;
}

/** The section that owns a scroll position: the last one whose start is at or before it. */
export function sectionAt(layout: Layout, S: number): Placed {
  const list = layout.placed;
  let found = list[0]!;
  for (const p of list) {
    if (p.start <= S) found = p;
    else break;
  }
  return found;
}

/**
 * The section that owns the top bar at a scroll position: the last one whose start, less its own
 * `nav.early`, is at or before it.
 */
export function navOwnerAt(layout: Layout, S: number): Placed {
  const list = layout.placed;
  let found = list[0]!;
  for (const p of list) {
    if (p.start - (p.def.nav.early ?? 0) <= S) found = p;
    else break;
  }
  return found;
}

/**
 * The document, in screens: the scroll distance plus the one screen the viewport itself covers.
 * The last section ends exactly at the end of the page.
 */
export function documentScreens(layout: Layout): number {
  return layout.total + 1;
}

/**
 * The scroll room of the fixed sections, in screens: everything but a last section that keeps its
 * text in the page's flow (that one is as tall as its own length plus the final screen).
 */
export function trackScreens(layout: Layout): number {
  const last = layout.placed[layout.placed.length - 1];
  if (last?.def.dom === "flow") return last.start;
  return layout.total + 1;
}

/** The length of the flowing last section's block, in screens, or 0 when it is fixed. */
export function flowScreens(layout: Layout): number {
  const last = layout.placed[layout.placed.length - 1];
  return last?.def.dom === "flow" ? last.def.screens + 1 : 0;
}
