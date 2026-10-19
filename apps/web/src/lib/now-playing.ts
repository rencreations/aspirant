import { create } from "zustand";

import { asset } from "@/lib/asset";
import { audio } from "@/lib/audio";

export interface Track {
  title: string;
  artist: string;
  /** Public path of the album art (passed through asset()). */
  cover: string;
  /** Public path of the audio file (passed through asset()). */
  src: string;
}

interface NowPlayingState {
  track: Track | null;
  /** The music element is playing (it can still be silenced by the sound button). */
  playing: boolean;
}

/** What the nav's record widget shows. A page that has music sets it with `startMusic`. */
export const useNowPlaying = create<NowPlayingState>(() => ({ track: null, playing: false }));

let cleanup: (() => void) | null = null;

/**
 * Start a looping track for the page and show it in the nav. The audio engine owns the sound, so
 * the sound button mutes it. Returns a function that stops it. If the browser blocks the start
 * (no gesture yet), the first touch, click or key press starts it.
 */
export function startMusic(track: Track, volume = 0.5): () => void {
  cleanup?.();
  useNowPlaying.setState({ track, playing: false });
  audio.playMusic(asset(track.src), { loop: true, volume, fadeMs: 1600 });
  const el = audio.getMusicElement();
  const onPlay = () => {
    useNowPlaying.setState({ playing: true });
  };
  const onPause = () => {
    useNowPlaying.setState({ playing: false });
  };
  el?.addEventListener("play", onPlay);
  el?.addEventListener("pause", onPause);
  if (el && !el.paused) onPlay();
  let wanted = true;
  const retry = () => {
    if (wanted && el?.paused) audio.resumeMusic();
  };
  window.addEventListener("pointerdown", retry, { once: true });
  window.addEventListener("keydown", retry, { once: true });
  const stop = () => {
    wanted = false;
    window.removeEventListener("pointerdown", retry);
    window.removeEventListener("keydown", retry);
    el?.removeEventListener("play", onPlay);
    el?.removeEventListener("pause", onPause);
    audio.stopMusic(900);
    useNowPlaying.setState({ track: null, playing: false });
    if (cleanup === stop) cleanup = null;
  };
  cleanup = stop;
  return stop;
}

/** Pause or resume the track (the record widget). */
export function toggleMusic(): void {
  const el = audio.getMusicElement();
  if (!el) return;
  if (el.paused) audio.resumeMusic();
  else audio.pauseMusic();
}
