"use client";

import { useEffect, useRef, type RefObject } from "react";

import type { StageState } from "./director";

/** Focus that has fallen to the page itself: nothing the visitor can see is focused. */
function lost(): boolean {
  const a = document.activeElement;
  if (!a || a === document.body || a === document.documentElement || !a.isConnected) return true;
  if (a.id === "main") return true;
  if (a.closest("[inert]")) return true;
  return getComputedStyle(a).visibility === "hidden";
}

/** Focus `get()`, trying again a few times while the element is still fading in. */
function focusWhenReady(get: () => HTMLElement | null | undefined, alive: () => boolean) {
  let tries = 0;
  const attempt = () => {
    if (!alive()) return;
    const el = get();
    el?.focus({ preventScroll: true });
    if (el && document.activeElement === el) return;
    if (++tries < 4) window.setTimeout(attempt, 250);
  };
  attempt();
}

/**
 * Keeps the keyboard with the visitor on a stage page. The button that opens a page steps aside
 * with the rest of the menu (it goes inert), and the browser then drops focus to the page, so a
 * keyboard visitor would have to tab through everything to find the page they just opened. So: when
 * a page opens and focus has fallen, it goes to Back (the drawers follow it in the tab order), and
 * when she is idle again focus goes back to the last control the visitor used (the button of the
 * page they left, or the touch point of the short they played). A visitor using the mouse or touch
 * is not affected: nothing shows a ring that was not asked for.
 */
export function useStageFocus(
  mode: StageState["mode"],
  root: RefObject<HTMLElement | null>,
  back: RefObject<HTMLElement | null>,
) {
  const lastUsed = useRef<HTMLElement | null>(null);
  const away = useRef(false);
  const modeNow = useRef(mode);
  useEffect(() => {
    modeNow.current = mode;
  }, [mode]);

  // Remember the last control of the idle screen that had focus (the buttons and the touch points:
  // the Back button and the drawers are gone by the time she idles again).
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const onIn = (e: FocusEvent) => {
      const idleScreen = modeNow.current === "idle" || modeNow.current === "queued";
      if (idleScreen && e.target instanceof HTMLElement && e.target.closest("button, a")) {
        lastUsed.current = e.target;
      }
    };
    el.addEventListener("focusin", onIn);
    return () => {
      el.removeEventListener("focusin", onIn);
    };
  }, [root]);

  useEffect(() => {
    let alive = true;
    if (mode === "idle") {
      if (away.current) {
        away.current = false;
        if (lost() && lastUsed.current?.isConnected) {
          const el = lastUsed.current;
          focusWhenReady(
            () => el,
            () => alive,
          );
        }
      }
    } else if (mode === "page") {
      away.current = true;
      if (lost())
        focusWhenReady(
          () => back.current?.querySelector("button"),
          () => alive,
        );
    } else if (mode !== "boot" && mode !== "welcome") {
      away.current = true;
    }
    return () => {
      alive = false;
    };
  }, [mode, back]);
}
