"use client";

import { useIsoLayoutEffect } from "@/lib/hooks";

import { hideCover } from "./cover";
import styles from "./cover.module.css";
import { introMode } from "./mode";

/**
 * Black from the first paint. It is rendered with the page (so it is in the server's markup too),
 * and a visit that will not play the intro (reduced motion, no WebGL, `?intro=off`, or a return
 * from one of the roster's own pages) lets it go in a layout effect, before the first paint of a
 * page change. A hard load shows black until the scripts run, then lets go. The intro hides it once
 * its own canvas is up. See `cover.module.css` for the failsafe.
 */
export function RosterCover() {
  useIsoLayoutEffect(() => {
    if (introMode() === "off") hideCover();
  }, []);
  // The look is inline as well as in the stylesheet: black from the very first paint, whether or
  // not the stylesheet has arrived yet.
  return (
    <div
      className={styles.cover}
      style={{ position: "fixed", inset: 0, zIndex: 45, background: "#000" }}
      data-roster-cover=""
      aria-hidden="true"
    />
  );
}
