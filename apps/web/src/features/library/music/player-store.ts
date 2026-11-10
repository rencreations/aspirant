"use client";

/**
 * State and actions of the music room's player. The sound itself is the shared engine
 * (`@/lib/audio`), so the site's mute button, the ducking under voice lines and the music
 * analyser all keep working. The page reads `track`, `playing` and the queue from here, and the
 * player bar reads the media element for the time and for seeking.
 */
import { create } from "zustand";

import { audio } from "@/lib/audio";
import { libUrl } from "@/lib/library";
import { withSound } from "@/lib/sound-prompt";

import { append, stepIn } from "./logic";
import type { MusicItem } from "./types";

interface PlayerState {
  track: MusicItem | null;
  playing: boolean;
  /** The order the tracks play in, the current one included. */
  queue: readonly MusicItem[];
  volume: number;
  /** The queue list above the player bar is open. */
  queueOpen: boolean;
}

export const usePlayer = create<PlayerState>(() => ({
  track: null,
  playing: false,
  queue: [],
  volume: 0.8,
  queueOpen: false,
}));

const get = usePlayer.getState;
const set = usePlayer.setState;

/** Removes the "ended" listener of the track that started last, so a track never advances twice. */
let offEnded: (() => void) | null = null;

function begin(item: MusicItem, queue: readonly MusicItem[]): void {
  audio.playMusic(libUrl(item.src), { loop: false, volume: get().volume, fadeMs: 250 });
  set({ track: item, playing: true, queue });
  offEnded?.();
  offEnded = null;
  const el = audio.getMusicElement();
  if (!el) return;
  const onEnded = () => {
    if (get().track?.id !== item.id) return;
    // The next track of the queue, the first one after the last.
    const next = stepIn(get().queue, item.id, 1);
    if (next) startTrack(next);
    else set({ playing: false });
  };
  el.addEventListener("ended", onEnded);
  offEnded = () => {
    el.removeEventListener("ended", onEnded);
  };
}

/** Start a track (the next one of the queue plays after it). Call inside a press: it unlocks the audio. */
function startTrack(item: MusicItem): void {
  audio.unlock();
  withSound("This track", () => {
    audio.stopVoice();
    const queue = get().queue;
    begin(item, queue.some((t) => t.id === item.id) ? queue : append(queue, item));
  });
}

/** Play `item` from a list: the list becomes the queue. The same track pressed again pauses or resumes. */
export function playTrack(item: MusicItem, list?: readonly MusicItem[]): void {
  audio.unlock();
  const { track } = get();
  const el = audio.getMusicElement();
  if (track?.id === item.id && el) {
    togglePlayback();
    return;
  }
  if (list) set({ queue: list.some((t) => t.id === item.id) ? list : [...list, item] });
  startTrack(item);
}

export function togglePlayback(): void {
  audio.unlock();
  const el = audio.getMusicElement();
  const { track, playing } = get();
  if (!track) return;
  if (!el) {
    startTrack(track);
    return;
  }
  if (playing && !el.paused) {
    audio.pauseMusic();
    set({ playing: false });
    return;
  }
  withSound("This track", () => {
    if (el.ended) el.currentTime = 0;
    audio.resumeMusic();
    set({ playing: true });
  });
}

/** The next or the previous track. A press on previous after three seconds restarts the track. */
export function stepTrack(direction: 1 | -1): void {
  const { track, queue } = get();
  if (!track) return;
  const el = audio.getMusicElement();
  if (direction === -1 && el && el.currentTime > 3) {
    el.currentTime = 0;
    return;
  }
  // The queue has no end, like the field of discs: after the last track comes the first.
  const next = stepIn(queue, track.id, direction);
  if (next) startTrack(next);
}

export function seekTo(seconds: number): void {
  const el = audio.getMusicElement();
  if (el && Number.isFinite(seconds)) el.currentTime = Math.max(0, seconds);
}

/** Jump to a time of the current track, or start the track there. */
export function playAt(item: MusicItem, seconds: number, list?: readonly MusicItem[]): void {
  const { track } = get();
  if (track?.id === item.id && audio.getMusicElement()) {
    seekTo(seconds);
    if (!get().playing) togglePlayback();
    return;
  }
  playTrack(item, list);
  // The new element has no time yet: it is set as soon as it can play. (If the sound prompt is
  // open, nothing has started yet and there is nothing to seek.)
  if (get().track?.id !== item.id) return;
  const el = audio.getMusicElement();
  if (el) {
    const apply = () => {
      el.currentTime = seconds;
    };
    if (el.readyState >= 1) apply();
    else el.addEventListener("loadedmetadata", apply, { once: true });
  }
}

export function changeVolume(volume: number): void {
  const v = Math.min(1, Math.max(0, volume));
  set({ volume: v });
  audio.setMusicVolume(v, 120);
}

export function toggleQueue(open?: boolean): void {
  set({ queueOpen: open ?? !get().queueOpen });
}

/** Fade out and hide the player. */
export function closePlayer(): void {
  offEnded?.();
  offEnded = null;
  audio.stopMusic(400);
  set({ track: null, playing: false, queue: [], queueOpen: false });
}

/** The player bar tells the store what the element reports, so a refused play is not shown as playing. */
export function syncPlaying(playing: boolean): void {
  if (get().playing !== playing) set({ playing });
}
