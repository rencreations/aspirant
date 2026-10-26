"use client";

import { useEffect } from "react";

import { startMusic, type Track } from "@/lib/now-playing";

import { MUSIC } from "./media";

const TRACK: Track = {
  title: "CROSSxCREDO: Guinevere Version",
  artist: "Eye",
  cover: "/img/char/guinevere/splash-sm.webp",
  src: MUSIC,
};

/**
 * Guinevere's theme. It lives in the layout of her route, so it keeps playing between her page and
 * her two story pages, and stops when the visitor leaves them. The site's sound button mutes it
 * and the record in the nav pauses it; nothing else controls it. If the browser blocks the start
 * (no gesture yet), the first touch, click or key press starts it.
 */
export function GuinevereMusic() {
  useEffect(() => startMusic(TRACK), []);
  return null;
}
