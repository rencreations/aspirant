"use client";

import { useEffect } from "react";

import { startMusic, type Track } from "@/lib/now-playing";
import { MUSIC, PAIR_OFFICIAL } from "./media";

const TRACK: Track = {
  title: "We Believe",
  artist: "The Aspirants series theme",
  cover: PAIR_OFFICIAL,
  src: MUSIC,
};

/**
 * The pair's theme. It lives in the layout shared by Layla's and Fanny's pages, so it keeps playing
 * without a break when the visitor goes from one to the other, and stops when they leave both. The
 * site's sound button mutes it and the record in the nav pauses it. If the browser blocks the start
 * (no gesture yet), the first touch, click or key press starts it.
 */
export function LfMusic() {
  useEffect(() => startMusic(TRACK), []);
  return null;
}
