import { firstScreenIndexes, metricsFor, pickSize, tileRatio } from "../core/flow/math";
import {
  allNewest,
  artistOrder,
  fanFacets,
  fanFilter,
  groupByArtist,
  picturesNewest,
  videosOrdered,
} from "./model";
import type { FanItem } from "./types";

/** About this many pictures of the rows are waited for. */
const FIRST_PICTURES = 28;
/** This many posters of the video row. */
const FIRST_POSTERS = 6;
/** The first thumbnails of the By artist view. */
const FIRST_BLOCK_TILES = 14;
/**
 * What stands above the rows, measured on the page at 1440 and at 390 wide: the top bar, the title,
 * the search, the view switch and the filter. A phone's head is taller (the controls stand in a column).
 */
const HEAD_WIDE = 302;
const HEAD_NARROW = 392;
const NARROW = 640;
/** The video row on top of the rows: its heading, the text under a card and the gap after it, plus the card's own height (0.72 of a row). */
const STRIP_WIDE = 237;
const STRIP_NARROW = 202;
const STRIP_CARD = 0.72;

export interface ScreenSize {
  width: number;
  height: number;
  dpr: number;
}

/**
 * The files of the first screen, as the page's own maths and the address (`q`, `f`, `view`, `i`)
 * make it: the first rows of pictures and the first posters of the video row, or the first
 * thumbnails of the By artist view, and the picture that `?i=` opens. The loading bar waits for
 * these, so it waits for what the page draws.
 */
export function firstKeys(all: readonly FanItem[], search: string, size: ScreenSize): string[] {
  const params = new URLSearchParams(search);
  const q = params.get("q") ?? "";
  const f = params.get("f") ?? "";
  const open = params.get("i") ?? "";
  const keys: string[] = [];

  if (params.get("view") === "artist") {
    const sorted = allNewest(all);
    const shown = fanFilter(sorted, fanFacets(sorted), q, f);
    for (const item of artistOrder(groupByArtist(shown)).slice(0, FIRST_BLOCK_TILES)) {
      keys.push(item.kind === "video" && item.video ? item.video.poster : item.img.t);
    }
  } else {
    const pictures = picturesNewest(all);
    const facets = fanFacets(pictures);
    const shown = fanFilter(pictures, facets, q, f);
    const videos = fanFilter(videosOrdered(all), facets, q, f);
    const m = metricsFor(size.width, size.height);
    const ratios = shown.map((item) => tileRatio(item.img.w, item.img.h));
    const narrow = size.width <= NARROW;
    const strip = Math.round(m.rowH * STRIP_CARD) + (narrow ? STRIP_NARROW : STRIP_WIDE);
    const head = (narrow ? HEAD_NARROW : HEAD_WIDE) + (videos.length > 0 ? strip : 0);
    for (const at of firstScreenIndexes(ratios, m, head, FIRST_PICTURES)) {
      const item = shown[at];
      if (!item) continue;
      const w = Math.round((ratios[at] ?? 1) * m.rowH);
      keys.push(item.img[pickSize(w, m.rowH, size.dpr)]);
    }
    for (const video of videos.slice(0, FIRST_POSTERS)) {
      if (video.video) keys.push(video.video.poster);
    }
  }

  // The picture the address opens (the video row marks a video, the zoom opens a picture).
  const linked = open ? all.find((item) => item.id === open) : undefined;
  if (linked) {
    keys.push(linked.kind === "video" && linked.video ? linked.video.poster : linked.img.p);
  }
  return [...new Set(keys)];
}
