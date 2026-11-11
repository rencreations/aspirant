"use client";

/**
 * The zoom of one Arts room. It wraps the room, mounts the one cursor and the viewer, and keeps the
 * open picture in the address as `?i=<id>`:
 *
 *  - Opening adds one history entry, so the browser's Back closes the viewer (with the same move as
 *    a press). Closing by a press, Esc or a swipe goes back that one entry, or just clears the
 *    address when the page was opened straight on a picture.
 *  - A load with `?i=<id>` of a known picture opens it from the middle of the screen, with no move.
 *    An id that the room does not know is left alone. The library search, which sets `?i=` and sends
 *    a popstate, opens the picture from its tile when the tile is on the page.
 *  - Stepping to a neighbour (the arrows, the side buttons, a swipe) replaces the entry.
 *
 * The provider reads the list of pictures only when something opens, never per picture on mount.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { useIsoLayoutEffect, useMounted } from "@/lib/hooks";
import { libUrl } from "@/lib/library";

import { useQueryState } from "../../../use-query-state";
import { ZoomActionsContext, ZoomStateContext } from "./context";
import { ZoomCursor, recheckZoomCursor, setZoomLingerHandler } from "./cursor";
import { findZoomTile } from "./tile";
import type {
  ViewerHandle,
  ZoomActions,
  ZoomOpenOptions,
  ZoomPicture,
  ZoomState,
  ZoomTone,
  ZoomView,
} from "./types";
import { Viewer } from "./viewer";
import { stepIndex, type Rect } from "./zoom-math";

export interface ZoomProviderProps {
  /** The pictures of the room, in the order the arrow keys move through them. */
  pictures: readonly ZoomPicture[];
  /** Called with the id when a picture opens or the viewer steps to another, and with null when it starts to close. */
  onOpenChange?: (id: string | null) => void;
  /** The tone of the room: the backdrop and the chrome follow it. Absent: a deep neutral. */
  tone?: ZoomTone;
  children: ReactNode;
}

const PARAM = "i";

const readParam = (): string | null =>
  typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get(PARAM);

function rectOf(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}

export function ZoomProvider({ pictures, onOpenChange, tone, children }: ZoomProviderProps) {
  const [view, setView] = useState<ZoomView | null>(null);
  const [closing, setClosing] = useState(false);
  const [wanted, setWanted] = useQueryState(PARAM);
  const ready = useMounted();

  const picturesRef = useRef(pictures);
  const notify = useRef(onOpenChange);
  const viewRef = useRef<ZoomView | null>(null);
  const closingRef = useRef(false);
  const handleRef = useRef<ViewerHandle | null>(null);
  const seq = useRef(0);
  /** The address has an entry that this provider added (Back removes it). */
  const pushed = useRef(false);
  /** The address asked for this close (Back), so the move must not touch the history again. */
  const fromAddress = useRef(false);
  /** The id the page was loaded with, until it has been opened (it opens with no move). */
  const bootId = useRef<string | null>(null);

  useIsoLayoutEffect(() => {
    picturesRef.current = pictures;
    notify.current = onOpenChange;
  });

  const commit = useCallback((next: ZoomView | null) => {
    viewRef.current = next;
    setView(next);
  }, []);

  const make = useCallback(
    (
      index: number,
      entry: ZoomView["entry"],
      source: HTMLElement | null,
      rect: Rect | null,
      frame?: ZoomOpenOptions["frame"],
    ): ZoomView | null => {
      const list = picturesRef.current;
      const picture = list[index];
      if (!picture) return null;
      seq.current += 1;
      return { seq: seq.current, picture, index, total: list.length, entry, source, rect, frame };
    },
    [],
  );

  const stepTo = useCallback(
    (index: number) => {
      const v = viewRef.current;
      if (!v || closingRef.current) return;
      const next = picturesRef.current[index];
      if (!next || next.id === v.picture.id) return;
      const made = make(index, "step", findZoomTile(next.id), null);
      if (!made) return;
      commit(made);
      setWanted(next.id);
      notify.current?.(next.id);
    },
    [commit, make, setWanted],
  );

  const step = useCallback(
    (delta: 1 | -1) => {
      const v = viewRef.current;
      if (!v || closingRef.current) return;
      const list = picturesRef.current;
      const at = list.findIndex((p) => p.id === v.picture.id);
      const next = stepIndex(at < 0 ? v.index : at, delta, list.length);
      if (next !== null) stepTo(next);
    },
    [stepTo],
  );

  const open = useCallback(
    (id: string, source: HTMLElement | null, options?: ZoomOpenOptions) => {
      const list = picturesRef.current;
      const index = list.findIndex((p) => p.id === id);
      if (index < 0) return;
      const current = viewRef.current;
      if (current) {
        if (!closingRef.current && current.picture.id !== id) stepTo(index);
        return;
      }
      const el = source?.isConnected ? source : null;
      const rect = el ? rectOf(el) : null;
      const made = make(
        index,
        rect && !options?.instant ? "morph" : "fade",
        el,
        rect,
        options?.frame,
      );
      if (!made) return;
      commit(made);
      bootId.current = null;
      // One entry for the picture, so Back closes it. A page that was opened on this picture's own
      // `?i=` already has it.
      if (readParam() !== id) {
        window.history.pushState(window.history.state, "", window.location.href);
        pushed.current = true;
      }
      setWanted(id);
      notify.current?.(id);
    },
    [commit, make, setWanted, stepTo],
  );

  const close = useCallback(() => {
    handleRef.current?.close(true);
  }, []);

  /** The closing move has begun: the address follows (unless the address asked for it). */
  const onCloseStart = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    notify.current?.(null);
    if (fromAddress.current) {
      fromAddress.current = false;
      pushed.current = false;
    } else if (pushed.current) {
      pushed.current = false;
      window.history.back();
    } else {
      setWanted("");
    }
  }, [setWanted]);

  const onClosed = useCallback(() => {
    closingRef.current = false;
    setClosing(false);
    commit(null);
    requestAnimationFrame(recheckZoomCursor);
  }, [commit]);

  // A pointer that rests on a tile warms that picture's preview (not its full size), so it has
  // arrived by the time a press has grown the picture. Remembered per id; the list is read here, on
  // a rest, and never on mount.
  useEffect(() => {
    const warmed = new Set<string>();
    setZoomLingerHandler((id) => {
      if (warmed.has(id) || viewRef.current) return;
      const found = picturesRef.current.find((p) => p.id === id);
      if (!found) return;
      if (warmed.size > 200) warmed.clear();
      warmed.add(id);
      new Image().src = libUrl(found.img.p);
    });
    return () => {
      setZoomLingerHandler(null);
    };
  }, []);

  // What the page was loaded with, read once (the first render sees none, as the server did).
  useEffect(() => {
    bootId.current = readParam();
  }, []);

  // The address leads: a picture it names opens, and an address with none closes what is open.
  useEffect(() => {
    const current = viewRef.current;
    if (!wanted) {
      if (current && !closingRef.current) {
        fromAddress.current = true;
        pushed.current = false;
        if (!handleRef.current?.close(true)) fromAddress.current = false;
      }
      return;
    }
    const list = picturesRef.current;
    const index = list.findIndex((p) => p.id === wanted);
    if (index < 0) return;
    if (!current) {
      const initial = bootId.current === wanted;
      bootId.current = null;
      const tile = initial ? null : findZoomTile(wanted);
      const made = make(index, tile ? "morph" : "fade", tile, tile ? rectOf(tile) : null);
      if (made) {
        commit(made);
        notify.current?.(wanted);
      }
    } else if (current.picture.id !== wanted && !closingRef.current) {
      stepTo(index);
    }
  }, [wanted, pictures, commit, make, stepTo]);

  const getList = useCallback(() => picturesRef.current, []);
  const actions = useMemo<ZoomActions>(() => ({ open, close }), [open, close]);
  const state = useMemo<ZoomState>(
    () => ({ openId: view && !closing ? view.picture.id : null, ready }),
    [view, closing, ready],
  );

  return (
    <ZoomActionsContext.Provider value={actions}>
      <ZoomStateContext.Provider value={state}>
        {children}
        <ZoomCursor />
        {view ? (
          <Viewer
            view={view}
            tone={tone}
            list={getList}
            handleRef={handleRef}
            onStep={step}
            onCloseStart={onCloseStart}
            onClosed={onClosed}
          />
        ) : null}
      </ZoomStateContext.Provider>
    </ZoomActionsContext.Provider>
  );
}
