"use client";

import { useEffect } from "react";

import { startMusic, type Track } from "@/lib/now-playing";

import { MUSIC } from "./media";

const TRACK: Track = {
  title: "Vexana theme",
  artist: "The Aspirants",
  cover: "/img/char/vexana/splash-sm.webp",
  src: MUSIC,
};

/**
 * Vexana's theme. It lives in the layout of her route, so it keeps playing between her page and
 * her two story pages, and stops when the visitor leaves them. The site's sound button mutes it
 * and the record in the nav pauses it; nothing else controls it. If the browser blocks the start
 * (no gesture yet), the first touch, click or key press starts it.
 */
export function VexanaMusic() {
  useEffect(() => startMusic(TRACK), []);
  return null;
}
