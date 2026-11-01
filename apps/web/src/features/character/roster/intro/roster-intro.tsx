"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

import { runIntro, setHandOver } from "./controller";
import { hideCover } from "./cover";
import { introPlays } from "./mode";

/**
 * The opening of `/character`: the panels arrive one by one over the page, a beam crosses the
 * screen and clears onto the finished roster. It is drawn in one WebGL canvas (`controller.ts`),
 * above the page and below the site bar, and removed when it ends. It plays on every arrival,
 * is skipped by a click, a tap or Esc, and does not play without WebGL.
 * `?intro=off` skips it and `?introT=<t>` freezes it at a time (`docs/design/roster-intro-engine.md`).
 */
export default function RosterIntro() {
  const host = useRef<HTMLDivElement>(null);

  // The page below hides its logo block and its idle effects while the intro plays.
  useLayoutEffect(() => {
    // Played: the page hides its logo block while the intro runs. Not played: it is finished at once.
    setHandOver(introPlays() ? "play" : "off");
  }, []);

  useEffect(() => {
    const el = host.current;
    if (!el || !introPlays()) {
      hideCover();
      setHandOver("off");
      return;
    }
    return runIntro(el);
  }, []);

  return <div ref={host} data-roster-intro="" />;
}
