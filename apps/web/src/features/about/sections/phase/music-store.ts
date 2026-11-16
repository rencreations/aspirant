"use client";

/**
 * The player of the music decks. There is one for the five decks, so only one track plays at a
 * time. The sound itself is the site's engine (`@/lib/audio`), as in the Music room: the sound
 * button of the top bar mutes it, it ducks under a voice line, and the site's video player pauses
 * it while a video is open and lets it go on afterwards.
 *
 * Nothing here starts by itself: every start is inside a press. What the decks show (playing,
 * waiting) is what the audio element reports, never a flag of our own, because the element is
 * also paused and resumed behind us (the record in the top bar, the video player).
 */
import { create } from "zustand";

import { audio } from "@/lib/audio";
import { useNowPlaying, type Track } from "@/lib/now-playing";
import { withSound } from "@/lib/sound-prompt";

import type { PhaseTrack } from "./types";

interface DeckPlayer {
  /** The track the decks started last, or null. */
  readonly id: string | null;
  /** Its sound is running. */
  readonly playing: boolean;
  /** It was asked to play and the file has not arrived yet. */
  readonly waiting: boolean;
}

export const useDeckPlayer = create<DeckPlayer>(() => ({
  id: null,
  playing: false,
  waiting: false,
}));

const get = useDeckPlayer.getState;
const set = useDeckPlayer.setState;

/** How loud a track sits, as in the Music room. */
const VOLUME = 0.8;
const FADE_MS = 250;

/** The element our track plays on, and what takes our listeners off it. */
let bound: HTMLAudioElement | null = null;
let unbind: (() => void) | null = null;
/** What the record of the top bar shows while a track of ours is the music. */
let navTrack: Track | null = null;
let refused = 0;

/** The audio element of our track, or null when the engine's music is no longer ours. */
export function deckElement(): HTMLAudioElement | null {
  return bound && audio.getMusicElement() === bound ? bound : null;
}

function showInNav(track: PhaseTrack, playing: boolean): void {
  const lead = track.credits.find((credit) => credit.role === "Vocals") ?? track.credits[0];
  navTrack = {
    title: track.title,
    artist: lead ? lead.name : track.ep,
    cover: track.cover.small,
    src: track.audio,
  };
  useNowPlaying.setState({ track: navTrack, playing });
}

function clearNav(): void {
  if (navTrack && useNowPlaying.getState().track === navTrack)
    useNowPlaying.setState({ track: null, playing: false });
  navTrack = null;
}

function release(): void {
  unbind?.();
  unbind = null;
  bound = null;
  window.clearTimeout(refused);
}

/** Follow the element of `track`: the store says what it reports, for as long as it is ours. */
function follow(el: HTMLAudioElement, track: PhaseTrack): void {
  release();
  bound = el;
  const mine = () => bound === el && audio.getMusicElement() === el && get().id === track.id;
  const onPlaying = () => {
    if (!mine()) return;
    set({ playing: true, waiting: false });
    useNowPlaying.setState({ playing: true });
  };
  const onWaiting = () => {
    if (mine() && !el.paused) set({ waiting: true });
  };
  const onStop = () => {
    if (!mine()) return;
    set({ playing: false, waiting: false });
    useNowPlaying.setState({ playing: false });
  };
  el.addEventListener("playing", onPlaying);
  el.addEventListener("waiting", onWaiting);
  el.addEventListener("pause", onStop);
  el.addEventListener("ended", onStop);
  el.addEventListener("error", onStop);
  unbind = () => {
    el.removeEventListener("playing", onPlaying);
    el.removeEventListener("waiting", onWaiting);
    el.removeEventListener("pause", onStop);
    el.removeEventListener("ended", onStop);
    el.removeEventListener("error", onStop);
  };
}

/** A start the browser refused leaves the element paused: it must not stay shown as arriving. */
function watchRefusal(el: HTMLAudioElement): void {
  window.clearTimeout(refused);
  refused = window.setTimeout(() => {
    if (bound === el && el.paused && get().waiting) set({ waiting: false });
  }, 700);
}

function start(track: PhaseTrack): void {
  audio.stopVoice();
  audio.playMusic(track.audio, { loop: false, volume: VOLUME, fadeMs: FADE_MS });
  const el = audio.getMusicElement();
  if (!el) return;
  el.loop = false;
  // The engine reuses an element that may still be fading the track before last, and its fade
  // can refuse the new level: the element is then paused on our track. Resuming plays it.
  if (el.paused) audio.resumeMusic(FADE_MS);
  set({ id: track.id, playing: false, waiting: true });
  follow(el, track);
  showInNav(track, false);
  watchRefusal(el);
}

/**
 * The press on a disc or on its Play pill: start the track, or pause it, or carry on. Another
 * track that was playing stops. Call it inside the press, so the browser lets the sound start.
 * With the site's sound off, the site asks first whether to turn it on.
 */
export function toggleTrack(track: PhaseTrack): void {
  audio.unlock();
  const el = deckElement();
  if (get().id === track.id && el) {
    if (!el.paused) {
      audio.pauseMusic();
      return;
    }
    withSound("This track", () => {
      if (el.ended) el.currentTime = 0;
      set({ waiting: true });
      // With a fade, so a track the top bar's record faded out comes back at its own level.
      audio.resumeMusic(FADE_MS);
      watchRefusal(el);
    });
    return;
  }
  withSound("This track", () => {
    start(track);
  });
}

/**
 * Before a video of the decks opens in the site's player (the music video is the same song): the
 * track is paused here, so the player finds nothing to carry on with when it closes.
 */
export function pauseForVideo(): void {
  const el = deckElement();
  if (el && !el.paused) audio.pauseMusic();
}

/** Fade the track out and forget it. The decks call it when the page is left. */
function stopDecks(): void {
  const el = deckElement();
  release();
  if (el) audio.stopMusic(400);
  clearNav();
  set({ id: null, playing: false, waiting: false });
}

interface DeckHook {
  state: () => {
    id: string | null;
    playing: boolean;
    waiting: boolean;
    paused: boolean | null;
    time: number | null;
    duration: number | null;
    muted: boolean;
    nav: string | null;
  };
  /** Jump to a time of the track that plays, in seconds. */
  seek: (seconds: number) => void;
}

/** How many decks are on the page. The player belongs to them: it stops when the last one leaves. */
let decks = 0;

/** A deck is on the page. Returns what to call when it leaves. */
export function joinDecks(): () => void {
  decks += 1;
  // For the probes and the tests: what plays, as the element itself reports it.
  (window as unknown as { __aboutMusic?: DeckHook }).__aboutMusic = {
    state: () => {
      const el = deckElement();
      return {
        ...get(),
        paused: el ? el.paused : null,
        time: el ? el.currentTime : null,
        duration: el ? el.duration : null,
        muted: audio.isMuted,
        nav: useNowPlaying.getState().track?.title ?? null,
      };
    },
    seek: (seconds) => {
      const el = deckElement();
      if (el && Number.isFinite(seconds)) el.currentTime = Math.max(0, seconds);
    },
  };
  return () => {
    decks -= 1;
    if (decks > 0) return;
    stopDecks();
    delete (window as unknown as { __aboutMusic?: DeckHook }).__aboutMusic;
  };
}
