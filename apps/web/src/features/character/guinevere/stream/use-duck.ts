"use client";

import { useCallback, useEffect, useRef } from "react";

import { audio } from "@/lib/audio";

/**
 * The page's music steps aside while a video with sound plays inline, and comes back when it stops
 * (or when the section goes away). `duck(true)` also stops any voice line.
 */
export function useMusicDuck() {
  const paused = useRef(false);
  const duck = useCallback((on: boolean) => {
    if (on) {
      const el = audio.getMusicElement();
      if (el && !el.paused && !paused.current) {
        paused.current = true;
        audio.pauseMusic(900);
      }
      audio.stopVoice();
    } else if (paused.current) {
      paused.current = false;
      audio.resumeMusic(1600);
    }
  }, []);
  useEffect(
    () => () => {
      if (paused.current) audio.resumeMusic(1200);
    },
    [],
  );
  return duck;
}
