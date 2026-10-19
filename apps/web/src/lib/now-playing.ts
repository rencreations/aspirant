import { create } from "zustand";

import { mediaUrl } from "@/lib/media-store";
import { audio } from "@/lib/audio";
import { useSiteStore } from "@/lib/stores";

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

/** How loud page music sits. Voice lines are lifted well above it, and it ducks under them. */
const MUSIC_VOLUME = 0.22;
/** Music fades in and out slowly, so it never starts or stops with a jolt. */
const FADE_IN_MS = 5000;
const FADE_OUT_MS = 3500;

/**
 * Start a looping track for the page and show it in the nav. The audio engine owns the sound, so
 * the sound button mutes it. Returns a function that stops it. If the browser blocks the start
 * (no gesture yet), the first touch, click or key press starts it.
 */
export function startMusic(track: Track, volume = MUSIC_VOLUME): () => void {
  cleanup?.();
  useNowPlaying.setState({ track, playing: false });
  audio.playMusic(mediaUrl(track.src), { loop: true, volume, fadeMs: FADE_IN_MS });
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
    if (wanted && el?.paused) audio.resumeMusic(FADE_IN_MS);
  };
  window.addEventListener("pointerdown", retry, { once: true });
  window.addEventListener("keydown", retry, { once: true });
  const stop = () => {
    wanted = false;
    window.removeEventListener("pointerdown", retry);
    window.removeEventListener("keydown", retry);
    el?.removeEventListener("play", onPlay);
    el?.removeEventListener("pause", onPause);
    audio.stopMusic(FADE_OUT_MS);
    useNowPlaying.setState({ track: null, playing: false });
    if (cleanup === stop) cleanup = null;
  };
  cleanup = stop;
  return stop;
}

/**
 * The record widget. Pauses or resumes the track, with a fade. If the sound is off, a press turns
 * the sound on and starts the record, since that is what the press means.
 */
export function toggleMusic(): void {
  const el = audio.getMusicElement();
  if (!el) return;
  const site = useSiteStore.getState();
  const state = useNowPlaying;
  if (site.muted) {
    site.setMuted(false);
    audio.setMuted(false);
    audio.resumeMusic(1800);
    state.setState({ playing: true });
    return;
  }
  if (el.paused) {
    audio.resumeMusic(1800);
    state.setState({ playing: true });
  } else {
    audio.pauseMusic(900);
    state.setState({ playing: false });
  }
}
