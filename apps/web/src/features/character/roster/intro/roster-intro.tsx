"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

import { runIntro, setHandOver } from "./controller";
import { introMode } from "./mode";

/**
 * The opening of `/character`: the panels arrive one by one over the page, a beam crosses the
 * screen and clears onto the finished roster. It is drawn in one WebGL canvas (`controller.ts`),
 * above the page and below the site bar, and removed when it ends. It plays on every arrival,
 * is skipped by a click, a tap or Esc, and does not play with reduced motion or without WebGL.
 * `?intro=off` skips it and `?introT=<t>` freezes it at a time (`docs/design/roster-intro-engine.md`).
 */
export default function RosterIntro() {
  const host = useRef<HTMLDivElement>(null);

  // The page below hides its logo block and its idle effects while the intro plays.
  useLayoutEffect(() => {
    if (introMode() !== "off") setHandOver("play");
  }, []);

  useEffect(() => {
    const el = host.current;
    const mode = introMode();
    if (!el || mode === "off") {
      setHandOver("done");
      return;
    }
    return runIntro(el, mode === "light");
  }, []);

  return <div ref={host} data-roster-intro="" />;
}
