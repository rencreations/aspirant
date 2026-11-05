"use client";

/**
 * The open picture, kept in the address as `?i=<id>`, so a view can be shared and the back
 * button closes the lightbox.
 *
 *   const lb = useLightboxParam(items);           // items: { id: string }[]
 *   <Gallery onOpen={(item) => lb.open(item.id)} ... />
 *   <Lightbox items={lb.list} index={lb.index} onIndexChange={lb.setIndex} />
 *
 * Opening adds one history entry, so Back closes the picture. Moving to the next picture replaces
 * the entry. Closing with the button or Esc goes back that one entry (or just clears the address
 * when the page was opened straight on a picture).
 *
 * A grid that is filtered passes the shown pictures as `items` and the whole set as `fallback`:
 * a picture that is not in the shown ones (a link, or a ribbon above the filters) is then opened
 * in the whole set, and `list` is the set the viewer must use.
 */
import { useCallback, useEffect, useRef } from "react";

import { useQueryState } from "../../use-query-state";

export interface LightboxParam<T extends { id: string } = { id: string }> {
  /** The pictures the viewer moves through: `items`, or `fallback` for a picture outside them. */
  list: readonly T[];
  /** The index in `list` of the open picture, or null when none is open or the id is unknown. */
  index: number | null;
  id: string;
  open: (id: string) => void;
  close: () => void;
  /** For `Lightbox`'s `onIndexChange`: an index moves, null closes. */
  setIndex: (next: number | null) => void;
}

export function useLightboxParam<T extends { id: string }>(
  items: readonly T[],
  param = "i",
  fallback?: readonly T[],
): LightboxParam<T> {
  const [id, setId] = useQueryState(param);
  const pushed = useRef(false);

  const inItems = id ? items.findIndex((it) => it.id === id) : -1;
  const list = inItems < 0 && fallback ? fallback : items;
  const found = inItems >= 0 ? inItems : id ? list.findIndex((it) => it.id === id) : -1;
  const index = found >= 0 ? found : null;

  // The entry we added is gone once the address has no picture (Back was pressed).
  useEffect(() => {
    if (!id) pushed.current = false;
  }, [id]);

  const open = useCallback(
    (next: string) => {
      if (!id && typeof window !== "undefined") {
        window.history.pushState(window.history.state, "", window.location.href);
        pushed.current = true;
      }
      setId(next);
    },
    [id, setId],
  );

  const close = useCallback(() => {
    if (pushed.current) {
      pushed.current = false;
      window.history.back();
    } else {
      setId("");
    }
  }, [setId]);

  const setIndex = useCallback(
    (next: number | null) => {
      const target = next === null ? undefined : list[next];
      if (target) setId(target.id);
      else close();
    },
    [list, setId, close],
  );

  return { list, index, id, open, close, setIndex };
}
