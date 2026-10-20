"use client";

/**
 * State and actions of the collection's music player. The audio itself lives in the shared
 * engine (`@/lib/audio`), so global mute, ducking under voice lines and the analyser all
 * keep working. Track cards read `track` and `playing` from here; the mini player reads the
 * element for time and seeking.
 */
import { create } from "zustand";

import { asset } from "@/lib/asset";
import { audio } from "@/lib/audio";
import { withSound } from "@/lib/sound-prompt";

import type { TrackItem } from "./types";

interface PlayerState {
  track: TrackItem | null;
  playing: boolean;
  queue: readonly TrackItem[];
  volume: number;
}

export const usePlayer = create<PlayerState>(() => ({
  track: null,
  playing: false,
  queue: [],
  volume: 0.7,
}));

const get = usePlayer.getState;
const set = usePlayer.setState;

export function setQueue(queue: readonly TrackItem[]): void {
  set({ queue });
}

/** Start a track. Call inside the click handler: it unlocks audio. Same track toggles. */
export function playTrack(track: TrackItem): void {
  audio.unlock();
  const { track: current } = get();
  if (current?.id === track.id && audio.getMusicElement()) {
    togglePlayback();
    return;
  }
  // With the sound off the visitor is asked first (a song is only sound).
  withSound("This track", () => {
    audio.playMusic(asset(track.src), { loop: false, volume: get().volume, fadeMs: 250 });
    set({ track, playing: true });
  });
}

export function togglePlayback(): void {
  audio.unlock();
  const el = audio.getMusicElement();
  const { track, playing } = get();
  if (!track) return;
  if (!el) {
    playTrack(track);
    return;
  }
  if (playing && !el.paused) {
    audio.pauseMusic();
    set({ playing: false });
  } else {
    withSound("This track", () => {
      audio.resumeMusic();
      set({ playing: true });
    });
  }
}

/** Move to the next or previous track in the queue (wraps). */
export function stepTrack(direction: 1 | -1): void {
  const { track, queue } = get();
  if (!track || queue.length < 2) return;
  const index = queue.findIndex((t) => t.id === track.id);
  const next = queue[(index + direction + queue.length) % queue.length];
  if (next) playTrack(next);
}

export function seekTo(seconds: number): void {
  const el = audio.getMusicElement();
  if (el && Number.isFinite(seconds)) el.currentTime = Math.max(0, seconds);
}

export function changeVolume(volume: number): void {
  set({ volume });
  audio.setMusicVolume(volume);
}

/** Pause for something louder (a film). Does not resume by itself. */
export function pauseForFilm(): void {
  if (get().playing) {
    audio.pauseMusic();
    set({ playing: false });
  }
}

/** Fade out and hide the player. */
export function closePlayer(): void {
  audio.stopMusic(400);
  set({ track: null, playing: false });
}

/** Called by the player when the element reports a state the store missed. */
export function syncPlaying(playing: boolean): void {
  if (get().playing !== playing) set({ playing });
}
