"use client";

import { useEffect, useRef, type RefObject } from "react";

import { withBase } from "@/lib/asset";

import type { PageName, StageState } from "./director";
import { pageFromPath, selenaRoute, selenaTitle } from "./routes";
import type { StageApi } from "./stage";

interface Options {
  state: StageState;
  stage: RefObject<StageApi | null>;
  /** The page the address named when the visitor arrived, or null for her own page. */
  initial: PageName | null;
}

const here = () => pageFromPath(window.location.pathname);

/**
 * Keeps the address in step with her pages. Each page has its own address
 * (`/character/selena/about/`), but she stays on one stage: the address is changed with the
 * history API, so nothing reloads and no animation is cut.
 *
 * - When a page opens (its entrance starts) its address is pushed. When it is left (Back, Esc)
 *   the address goes back: one step back in history if the page was opened here, her own
 *   address otherwise.
 * - Arriving at a page's address plays that page's entrance on the idle loop. The welcome is
 *   skipped, because the page asked for is the point.
 * - The browser's back and forward buttons ask the stage for the page or the exit.
 */
export function useSelenaUrl({ state, stage, initial }: Options) {
  const { mode, scene, leaving } = state;
  /** The page the address asked for that the stage has not opened yet. */
  const asked = useRef<PageName | null>(initial);
  /** The stage has to be asked for `asked` (it is idle and has not been asked yet). */
  const needRequest = useRef(initial !== null);
  /** This visit pushed the page's address (so leaving it can step back instead). */
  const pushed = useRef(false);
  const live = useRef({ mode, scene, leaving });

  useEffect(() => {
    live.current = { mode, scene, leaving };
  }, [mode, scene, leaving]);

  // The stage to the address.
  useEffect(() => {
    const page = scene === "about" || scene === "skills" || scene === "gallery" ? scene : null;
    const open = page !== null && (mode === "intro" || mode === "page") && !leaving;
    const now = here();
    if (open) {
      if (asked.current === page) asked.current = null;
      if (now !== page) {
        window.history.pushState({ selenaPage: page }, "", withBase(selenaRoute(page)));
        pushed.current = true;
        document.title = selenaTitle(page);
      }
      return;
    }
    if (now === null) return;
    // The address asked for a page that has not started yet: leave it alone.
    if (asked.current === now && (needRequest.current || mode === "queued")) return;
    // She is leaving the page (or never opened it): the address goes back to her own.
    asked.current = null;
    if (pushed.current && (window.history.state as { selenaPage?: string } | null)?.selenaPage) {
      pushed.current = false;
      window.history.back();
    } else {
      window.history.replaceState(null, "", withBase(selenaRoute(null)));
    }
    document.title = selenaTitle(null);
  }, [mode, scene, leaving]);

  // The address to the stage: an address that asked for a page, as soon as she idles.
  useEffect(() => {
    if (mode !== "idle" || !needRequest.current || asked.current === null) return;
    needRequest.current = false;
    stage.current?.request(asked.current);
  }, [mode, stage]);

  // The browser's back and forward buttons.
  useEffect(() => {
    const onPop = () => {
      const target = here();
      const cur = live.current;
      if (target) {
        asked.current = target;
        needRequest.current = true;
        // Another page is open: leave it first, the request goes out when she idles.
        if (cur.mode === "page" || cur.mode === "intro") {
          if (cur.scene !== target) stage.current?.leave();
          else needRequest.current = false;
        } else if (cur.mode === "idle") {
          needRequest.current = false;
          stage.current?.request(target);
        }
      } else {
        asked.current = null;
        needRequest.current = false;
        if ((cur.mode === "page" || cur.mode === "intro") && !cur.leaving) stage.current?.leave();
      }
      document.title = selenaTitle(target);
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
    };
  }, [stage]);
}
