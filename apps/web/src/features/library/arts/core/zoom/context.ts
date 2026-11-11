"use client";

import { createContext, useContext } from "react";

import type { ZoomActions, ZoomApi, ZoomState } from "./types";

const noop = () => undefined;

/** The part of the zoom that never changes, so a tile that only opens a picture does not render again. */
export const ZoomActionsContext = createContext<ZoomActions>({ open: noop, close: noop });

/** What changes: which picture is open, and whether the viewer is ready. */
export const ZoomStateContext = createContext<ZoomState>({ openId: null, ready: false });

/** The open and close calls only. Stable for the life of the provider. */
export function useZoomActions(): ZoomActions {
  return useContext(ZoomActionsContext);
}

/**
 * The zoom of the room: `open(id, element)`, `close()`, the open picture's id and whether it is
 * ready. Outside a provider it does nothing. A component that only opens pictures should call
 * `useZoomActions` (or `useZoomTile`), which does not render again when the viewer opens.
 */
export function useZoom(): ZoomApi {
  const actions = useContext(ZoomActionsContext);
  const state = useContext(ZoomStateContext);
  return { ...actions, ...state };
}
