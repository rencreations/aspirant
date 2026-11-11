"use client";

import { useMemo, type KeyboardEvent, type MouseEvent } from "react";

import { useZoomActions } from "./context";
import { intersect } from "./zoom-math";
import styles from "./tile.module.css";

/**
 * The class that gives a tile the hover outline and the focus ring of the zoom: a 2 px outline
 * drawn inside the tile (so a row that clips its track never cuts it), faded in with its offset.
 * Over a light room use `zoomTileClassLight`.
 */
const zoomTileClass = styles.tile ?? "";
const zoomTileClassLight = `${styles.tile ?? ""} ${styles.light ?? ""}`;

/** The element that shows picture `id` now (the one on the screen when several do), or null. */
export function findZoomTile(id: string): HTMLElement | null {
  if (typeof document === "undefined") return null;
  let list: NodeListOf<HTMLElement>;
  try {
    list = document.querySelectorAll<HTMLElement>(`[data-zoom-id="${CSS.escape(id)}"]`);
  } catch {
    return null;
  }
  const view = { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight };
  let first: HTMLElement | null = null;
  for (const el of list) {
    first ??= el;
    const r = el.getBoundingClientRect();
    if (intersect({ x: r.left, y: r.top, w: r.width, h: r.height }, view)) return el;
  }
  return first;
}

export interface ZoomTileProps {
  "data-zoom": "in";
  "data-zoom-id": string;
  className: string;
  onClick: (event: MouseEvent<HTMLElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}

/**
 * Props for the element of a room that opens picture `id`: spread them on the tile.
 *
 *   const zoom = useZoomTile(item.id);
 *   <button type="button" {...zoom} className={`${zoom.className} ${styles.tile}`}>
 *
 * `data-zoom="in"` is what the cursor reads, `data-zoom-id` is how the viewer finds the tile again
 * to land on it, and `className` adds the hover outline (`tone` picks its colour). A press (or
 * Enter on an element that is not a button) opens the picture from this element. The hook uses only
 * the stable part of the zoom, so a list of tiles does not render again when the viewer opens.
 */
export function useZoomTile(id: string, tone: "dark" | "light" = "dark"): ZoomTileProps {
  const { open } = useZoomActions();
  return useMemo(
    () => ({
      "data-zoom": "in",
      "data-zoom-id": id,
      className: tone === "light" ? zoomTileClassLight : zoomTileClass,
      onClick: (event: MouseEvent<HTMLElement>) => {
        // A modified click (a new tab, a download) is not ours.
        if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey) return;
        open(id, event.currentTarget);
      },
      onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
        const el = event.currentTarget;
        // A button and a link already click on Enter.
        if (
          event.key !== "Enter" ||
          el instanceof HTMLButtonElement ||
          el instanceof HTMLAnchorElement
        )
          return;
        event.preventDefault();
        open(id, el);
      },
    }),
    [id, open, tone],
  );
}
