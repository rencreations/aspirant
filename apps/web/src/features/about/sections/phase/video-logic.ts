/**
 * The small arithmetic of the video deck: the order of its list, where a key takes it, when a
 * turn of the wheel belongs to the list and not to the page, and how far the list must move to
 * show a row. Pure, so it is tested without a page.
 */

/** The pinned videos stand first. Each group keeps the order it was given in. */
export function pinnedFirst<T extends { readonly pinned: boolean }>(videos: readonly T[]): T[] {
  return [...videos.filter((v) => v.pinned), ...videos.filter((v) => !v.pinned)];
}

/**
 * Where a key takes the list from row `at`. The arrows go round, Home and End go to the ends.
 * Both pairs of arrows work, because the list stands upright on a wide screen and lies on its
 * side on a phone. Null for a key that is not the list's.
 */
export function stepIndex(key: string, at: number, count: number): number | null {
  if (count <= 0) return null;
  switch (key) {
    case "ArrowDown":
    case "ArrowRight":
      return (at + 1) % count;
    case "ArrowUp":
    case "ArrowLeft":
      return (at - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}

/**
 * A turn of the wheel belongs to the list only while the list can still move that way. At its
 * ends, and when it does not scroll at all, the turn is the page's, so the list never holds the
 * page.
 */
export function wheelBelongs(delta: number, top: number, height: number, full: number): boolean {
  const max = full - height;
  if (max <= 1) return false;
  if (delta < 0) return top > 0.5;
  if (delta > 0) return top < max - 0.5;
  return false;
}

/**
 * The scroll position that shows a row whole inside the list, with a little room around it. The
 * list is moved by this and never by `scrollIntoView`, which would move the page as well.
 */
export function revealOffset(
  rowStart: number,
  rowSize: number,
  scroll: number,
  viewSize: number,
  room = 0,
): number {
  if (rowStart - room < scroll) return Math.max(0, rowStart - room);
  if (rowStart + rowSize + room > scroll + viewSize) return rowStart + rowSize + room - viewSize;
  return scroll;
}

/** "08": the counts and the places of the deck, two figures wide. */
export function two(n: number): string {
  return String(n).padStart(2, "0");
}

/** The two kinds of video a deck may hold: films lie on their side, the others stand upright. */
export type VideoGroup = "films" | "others";

/** A video taller than wide is one of the others. The shape decides, never a name. */
export function groupOf(ratio: number): VideoGroup {
  return ratio < 1 ? "others" : "films";
}

/**
 * The places of each kind in the deck's list, in the list's order. A deck has a switch between
 * the two only when it holds both.
 */
export function splitGroups(
  videos: ReadonlyArray<{ readonly ratio: number }>,
): Readonly<Record<VideoGroup, readonly number[]>> {
  const films: number[] = [];
  const others: number[] = [];
  videos.forEach((video, index) => {
    (groupOf(video.ratio) === "films" ? films : others).push(index);
  });
  return { films, others };
}

/** How long a preview's loop is, in seconds. */
const PREVIEW_SECONDS = 16;

/**
 * The stretch of a video that its preview shows, over and over. A short clip is shown whole. A
 * longer film starts a little way in, past a black first second or a logo (8 percent of its
 * length, 12 seconds at most), and shows 16 seconds from there, so a preview never streams a
 * whole film.
 */
export function previewWindow(duration: number): { start: number; end: number } {
  if (!Number.isFinite(duration) || duration <= 0) return { start: 0, end: 0 };
  if (duration <= PREVIEW_SECONDS + 4) return { start: 0, end: duration };
  const start = Math.min(duration * 0.08, 12);
  return { start, end: Math.min(duration, start + PREVIEW_SECONDS) };
}

/** What a preview does: it has no file, it holds its frame, or it plays. */
export type PreviewFeed = "none" | "hold" | "play";

/**
 * A preview has its file only while its deck is near the screen. It plays only while its window
 * is on screen, the tab is shown and nothing covers the page (the site's player, a viewer).
 */
export function feedOf(state: {
  near: boolean;
  seen: boolean;
  shown: boolean;
  covered: boolean;
}): PreviewFeed {
  if (!state.near) return "none";
  return state.seen && state.shown && !state.covered ? "play" : "hold";
}
