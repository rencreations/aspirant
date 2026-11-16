import type { AboutPlace } from "@/lib/return-to";

/**
 * Coming back to the page at the place the visitor left it. A link that leads out of this page
 * says where it was pressed (`at=phase-4`, see `lib/return-to.ts`), the page it opens sends the
 * visitor back to `/about?at=phase-4`, and the root of this page (`about-root.tsx`) opens there:
 * no opening, no first screen. This file is the arithmetic of it, without the page.
 */

/**
 * Where a place is in the page. A phase is its own block in the list of the phases, a section is
 * the section. The place is one of a fixed list, so nothing of the address reaches the selector.
 */
export function placeSelector(place: AboutPlace): string {
  const phase = /^phase-([1-5])$/u.exec(place);
  return phase
    ? `[data-about-section="phases"] li[data-phase="${phase[1] ?? ""}"]`
    : `[data-about-section="${place}"]`;
}

/**
 * The room kept above a place, in pixels. A phase starts with its big numeral, so it is set just
 * under the top bar. A section brings its own room at the top, so it starts at the very top.
 */
export function placeLead(place: AboutPlace, navH: number): number {
  return place.startsWith("phase-") ? navH : 0;
}

/**
 * The scroll that shows a place: its top in the document less the room above it, kept inside the
 * page (`max` is the furthest the page scrolls).
 */
export function placeScroll(top: number, lead: number, max: number): number {
  return Math.round(Math.min(Math.max(0, max), Math.max(0, top - lead)));
}

/** An address with `at` taken out, as a path with its search and hash: a reload does not jump again. */
export function withoutPlace(href: string): string {
  const url = new URL(href);
  url.searchParams.delete("at");
  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * The top of an element in the document, from the layout alone. The parts of the page arrive with
 * a slide (a transform), and a measured box would be off by it while they do.
 */
export function layoutTop(el: HTMLElement): number {
  let top = 0;
  for (let node: HTMLElement | null = el; node; node = node.offsetParent as HTMLElement | null) {
    top += node.offsetTop;
  }
  return top;
}
