"use client";

import { useEffect } from "react";

import { asset } from "@/lib/asset";
import { audio } from "@/lib/audio";
import { useSiteStore } from "@/lib/stores";

import type { Ambient } from "./ambient";
import { cueFile, VOICE_CUES } from "./audio-cues";
import { driver, onBeat, onPlace, onSceneChange } from "./driver";

/** Voice cues already played in this visit. */
const played = new Set<string>();
/** A cue plays only when its paragraph stays lit this long (no cues while skimming). */
const DWELL_MS = 1400;

/**
 * Ambient beds, stingers on `beat`, and voice lines at marked paragraphs. Silent until the
 * visitor has entered and audio is unlocked; if `entered` came back from the session (no Enter
 * click this time), the first tap or key on the page unlocks it. Obeys the global mute.
 */
export function useSceneAudio(): void {
  const entered = useSiteStore((s) => s.entered);
  const muted = useSiteStore((s) => s.muted);

  useEffect(() => {
    if (!entered || muted) return;
    let bed: Ambient | null = null;
    let cancelled = false;
    let dwell = 0;
    const offs: Array<() => void> = [];

    const syncBed = () => {
      if (!bed) return;
      bed.set(driver.ambient, driver.mood);
      bed.setLevel(driver.part === null ? 0 : 1);
    };

    const start = () => {
      const out = audio.getSynthOut();
      if (!out || bed || cancelled) return;
      void import("./ambient").then(({ Ambient }) => {
        if (cancelled || bed) return;
        bed = new Ambient(out.ctx, out.out);
        syncBed();
        bed.duck(audio.getVoiceState().playing);
      });
    };

    if (audio.unlocked) start();
    else {
      // The visitor entered earlier in this session; wait for a gesture on this page.
      const unlock = () => {
        audio.unlock();
        start();
        window.removeEventListener("pointerdown", unlock);
        window.removeEventListener("keydown", unlock);
      };
      window.addEventListener("pointerdown", unlock, { passive: true });
      window.addEventListener("keydown", unlock);
      offs.push(() => {
        window.removeEventListener("pointerdown", unlock);
        window.removeEventListener("keydown", unlock);
      });
    }

    offs.push(onSceneChange(syncBed));
    offs.push(onBeat(() => bed?.stinger()));
    offs.push(audio.onVoiceChange((s) => bed?.duck(s.playing)));
    offs.push(
      onPlace((d) => {
        window.clearTimeout(dwell);
        const id = d.paragraphId;
        const cue = id ? VOICE_CUES[id] : undefined;
        if (!id || !cue || played.has(id)) return;
        dwell = window.setTimeout(() => {
          if (driver.paragraphId !== id || !audio.unlocked || played.has(id)) return;
          played.add(id);
          void audio.playVoice(asset(cueFile(cue)), { volume: 0.85 });
        }, DWELL_MS);
      }),
    );

    return () => {
      cancelled = true;
      window.clearTimeout(dwell);
      for (const off of offs) off();
      bed?.dispose();
      bed = null;
    };
  }, [entered, muted]);
}
