/**
 * Where each section sits on the scroll and how long it is, read from the registry. The code that
 * needs an absolute position (a scene that spans two sections, a button that scrolls to a place,
 * a test that checks a joint) asks here instead of keeping a number of its own, so changing a
 * section's `screens` in its `index.ts` moves everything after it and breaks nothing.
 *
 * Two rules keep the module graph sound:
 *  - call these inside functions, never at the top level of a module (the registry may not have
 *    been evaluated yet);
 *  - a module that a section's `index.ts` or `preload.ts` imports (directly or not) must not import
 *    this file: the registry imports them, and this file imports the registry. `where.test.ts`
 *    walks the imports and fails if that happens.
 */
import { layoutSections, type Layout, type Placed } from "./layout";
import { SECTIONS } from "./sections";
import type { SectionId } from "./types";

let cached: Layout | null = null;
let byId: Map<SectionId, Placed> | null = null;

/** The real registry placed on the scroll. Built once. */
export function homeLayout(): Layout {
  cached ??= layoutSections(SECTIONS);
  return cached;
}

function placedOf(id: SectionId): Placed {
  byId ??= new Map(homeLayout().placed.map((p) => [p.id, p]));
  const p = byId.get(id);
  if (!p) throw new Error(`no section "${id}" in the registry`);
  return p;
}

/** The scroll position (screens) at which the section's `local` is 0. */
export function sectionStart(id: SectionId): number {
  return placedOf(id).start;
}

/** The section's length in screens: its `screens` in the registry. */
export function sectionScreens(id: SectionId): number {
  return placedOf(id).def.screens;
}

/** The scroll position (screens) at which the section starts to run: its start less its lead. */
export function sectionFrom(id: SectionId): number {
  return placedOf(id).from;
}

/** The scroll position (screens) at which the section's `local` is 1. */
export function sectionEnd(id: SectionId): number {
  return placedOf(id).end;
}
