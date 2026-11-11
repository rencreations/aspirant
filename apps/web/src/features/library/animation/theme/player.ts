"use client";

import { audio } from "@/lib/audio";
import { libUrl } from "@/lib/library";
import { loadMedia, releaseMedia } from "@/lib/media-store";
import { useNowPlaying, type Track } from "@/lib/now-playing";
import { untilItArrives } from "@/lib/retry";
import { useSiteStore } from "@/lib/stores";

import { fetchLibraryJson, libraryDataPath } from "../../data";
import { closePlayer, usePlayer } from "../../music/player-store";
import { THEME_FADE, THEME_VOLUME, themeLabel, themeMove, type ThemeTrackData } from "./plan";

/**
 * The theme music of the Animation room. One song at a time, through the site's audio engine
 * (`lib/audio`): its two music slots cross fade, its master obeys the sound switch, and its
 * elements are the ones the first press of the visit unlocked. The record in the top bar shows the
 * song (`lib/now-playing`), and a press on it pauses the song.
 *
 * - A song is loaded whole before it plays (`lib/media-store`): the room's loading list waits for
 *   the first character's song, the songs beside it warm in the background, and a song the visitor
 *   turns to plays once its bytes are in, while the song before goes on meanwhile.
 * - The sound switch off means silence: the song pauses, and comes back where it was when the
 *   sound is turned on (that press is what lets the browser play it).
 * - A browser plays sound only after the visitor has pressed something on the site. Until then the
 *   song waits, and the first press starts it. Nothing pretends to play.
 * - The Music room's player and the theme never play together: the theme stops the player when it
 *   starts, and leaving the room does not bring the player back.
 */

/** The songs, by id, read once per visit from `music.json`. */
let catalog: Promise<Map<string, ThemeTrackData>> | null = null;

function songs(): Promise<Map<string, ThemeTrackData>> {
  catalog ??= untilItArrives(() =>
    fetchLibraryJson<{ items: ThemeTrackData[] }>(libraryDataPath("music")),
  )
    .then((file) => new Map(file.items.map((t) => [t.id, t])))
    .catch(() => {
      catalog = null;
      return new Map<string, ThemeTrackData>();
    });
  return catalog;
}

interface Song {
  id: string;
  /** The library address of the file (the media store's key). */
  url: string;
  track: Track;
}

/** A song of `music.json` by id, or null when the data has no such track (no theme: silence). */
export async function themeSong(id: string): Promise<Song | null> {
  const data = (await songs()).get(id);
  if (!data) return null;
  const { title, artist } = themeLabel(data);
  const url = libUrl(data.src);
  return {
    id,
    url,
    track: { title, artist, cover: data.disc ? libUrl(data.disc) : "", src: url },
  };
}

const levelBuffer = new Float32Array(1024);

/** The loudness on the music bus, from the engine's analyser. */
function musicLevel(): number | null {
  const analyser = audio.getMusicAnalyser();
  if (!analyser) return null;
  const data = levelBuffer.subarray(0, analyser.fftSize);
  analyser.getFloatTimeDomainData(data);
  let sum = 0;
  for (const v of data) sum += v * v;
  return Math.sqrt(sum / data.length);
}

/** Every file of the room's songs is under this address, so leaving the room frees them at once. */
const SONGS_PREFIX = libUrl("music/");
const GESTURES = ["pointerdown", "pointerup", "keydown", "touchend"] as const;

/** What a probe reads: the wish, the song, and the state of its element. */
export interface ThemeSnapshot {
  wanted: string | null;
  current: string | null;
  /** The song was handed to the audio engine. */
  live: boolean;
  /** Its element has really played (the browser allowed it). */
  started: boolean;
  /** A press is awaited before it can play. */
  awaitingPress: boolean;
  paused: boolean | null;
  time: number | null;
  loop: boolean | null;
  /** The element of the song before, while it fades out. */
  previous: { paused: boolean; time: number } | null;
  /** The address of the element is the song's bytes in memory. */
  fromMemory: boolean;
  muted: boolean;
  nav: string | null;
  /** The loudness on the site's music bus now (RMS, 0 to 1), or null before the audio is unlocked. */
  level: number | null;
}

class ThemePlayer {
  private wanted: string | null = null;
  private current: Song | null = null;
  private src: string | null = null;
  private fadeMs: number = THEME_FADE.in;
  private live = false;
  private started = false;
  private mutedPause = false;
  private el: HTMLAudioElement | null = null;
  private previous: HTMLAudioElement | null = null;
  private token = 0;
  private timer = 0;
  private leaveTimer = 0;
  private offEl: (() => void) | null = null;
  private offStores: (() => void) | null = null;
  private offGesture: (() => void) | null = null;

  /** The song the room wants now (a track id), or null for silence. */
  want(id: string | null): void {
    window.clearTimeout(this.leaveTimer);
    this.attachStores();
    this.wanted = id;
    const move = themeMove(this.current?.id ?? null, id);
    window.clearTimeout(this.timer);
    const token = (this.token += 1);
    if (move.kind === "keep") return;
    const run = () => {
      void this.go(token, id, move.kind === "cross" ? move.fadeMs : THEME_FADE.in);
    };
    if (move.delayMs > 0) this.timer = window.setTimeout(run, move.delayMs);
    else run();
  }

  /** Load the songs of the characters beside the one on show, behind everything else. */
  warm(ids: readonly string[]): void {
    for (const id of ids) {
      void themeSong(id).then((song) => {
        if (song) void loadMedia(song.url, { type: "audio/mp4", background: true });
      });
    }
  }

  /** The visitor leaves the room: the song fades away and everything is let go. */
  leave(): void {
    window.clearTimeout(this.leaveTimer);
    // A short grace: a remount (or a page that hands the room on to itself) wants the song again.
    this.leaveTimer = window.setTimeout(() => {
      this.token += 1;
      window.clearTimeout(this.timer);
      this.wanted = null;
      this.stop(THEME_FADE.out);
      this.disarmGesture();
      this.offStores?.();
      this.offStores = null;
      const el = this.previous;
      window.setTimeout(() => {
        if (this.wanted !== null) return;
        // The element lets go of the song's bytes, and the bytes leave memory (a saved copy stays
        // in the browser, so the next visit reads it at once).
        if (el?.paused && el.src.startsWith("blob:")) {
          el.removeAttribute("src");
          el.load();
        }
        releaseMedia(SONGS_PREFIX);
      }, THEME_FADE.out + 250);
    }, 80);
  }

  snapshot(): ThemeSnapshot {
    const el = this.el;
    const prev = this.previous !== el ? this.previous : null;
    return {
      wanted: this.wanted,
      current: this.current?.id ?? null,
      live: this.live,
      started: this.started,
      awaitingPress: this.offGesture !== null,
      paused: el ? el.paused : null,
      time: el ? el.currentTime : null,
      loop: el ? el.loop : null,
      previous: prev ? { paused: prev.paused, time: prev.currentTime } : null,
      fromMemory: !!el?.src.startsWith("blob:"),
      muted: useSiteStore.getState().muted,
      nav: useNowPlaying.getState().track?.title ?? null,
      level: musicLevel(),
    };
  }

  /** Specs: the element of the song (to follow it after the room is left). */
  element(): HTMLAudioElement | null {
    return this.el ?? this.previous;
  }

  // Inside --------------------------------------------------------------------------------------------

  private async go(token: number, id: string | null, fadeMs: number): Promise<void> {
    if (id === null) {
      this.stop(THEME_FADE.out);
      return;
    }
    const song = await themeSong(id);
    if (token !== this.token) return;
    if (!song) {
      this.stop(THEME_FADE.out);
      return;
    }
    // The bytes first (at once if the loading list or the warming brought them); the song before
    // plays on meanwhile.
    const src = await loadMedia(song.url, { type: "audio/mp4" });
    if (token !== this.token) return;
    this.current = song;
    this.src = src;
    this.fadeMs = fadeMs;
    this.live = false;
    this.started = false;
    this.mutedPause = false;
    this.tryStart();
  }

  private tryStart(): void {
    if (!this.current || !this.src || this.live) return;
    if (useSiteStore.getState().muted) return;
    // Inside a press (the one that turned the sound on, say) the browser lets it play at once.
    const pressing = navigator.userActivation?.isActive ?? false;
    if (!audio.unlocked && !pressing) {
      this.armGesture();
      return;
    }
    if (!audio.unlocked) audio.unlock();
    this.startNow();
  }

  private startNow(): void {
    const song = this.current;
    const src = this.src;
    if (!song || !src) return;
    // One music at a time: the Music room's player stops, for good.
    if (usePlayer.getState().track) closePlayer();
    this.unbindElement();
    audio.playMusic(src, { loop: true, volume: THEME_VOLUME, fadeMs: this.fadeMs });
    const el = audio.getMusicElement();
    this.live = true;
    if (!el) return;
    // The engine reuses a slot that may still be fading out the song before last; its fade can
    // refuse the new level and the engine then never calls play (lib/audio, playMusic). The element
    // is then still paused on our song: resuming clears the old fade and plays it.
    if (el.paused && el.src === src) audio.resumeMusic(this.fadeMs);
    if (this.el && this.el !== el) this.previous = this.el;
    this.el = el;
    const onPlay = () => {
      useNowPlaying.setState({ playing: true });
    };
    const onPause = () => {
      useNowPlaying.setState({ playing: false });
    };
    const onPlaying = () => {
      this.started = true;
      this.disarmGesture();
    };
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("playing", onPlaying);
    this.offEl = () => {
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("playing", onPlaying);
    };
    useNowPlaying.setState({ track: song.track, playing: !el.paused });
    // Until the element really plays, the next press of the visitor starts it.
    if (!this.started) this.armGesture();
  }

  /** Fade the song out and forget it. */
  private stop(fadeMs: number): void {
    const el = this.el;
    if (this.live && el && audio.getMusicElement() === el) audio.stopMusic(fadeMs);
    this.unbindElement();
    const nav = useNowPlaying.getState().track;
    if (nav && nav === this.current?.track) useNowPlaying.setState({ track: null, playing: false });
    this.previous = el;
    this.el = null;
    this.current = null;
    this.src = null;
    this.live = false;
    this.started = false;
    this.mutedPause = false;
  }

  private unbindElement(): void {
    this.offEl?.();
    this.offEl = null;
  }

  /** The sound switch: off pauses the song, on brings it back (inside the press that turned it on). */
  private attachStores(): void {
    if (this.offStores) return;
    this.offStores = useSiteStore.subscribe((state, before) => {
      if (state.muted === before.muted) return;
      if (state.muted) {
        if (this.live && this.el && audio.getMusicElement() === this.el && !this.el.paused) {
          this.mutedPause = true;
          audio.pauseMusic(300);
        }
        return;
      }
      if (this.live && this.mutedPause && this.el && audio.getMusicElement() === this.el) {
        this.mutedPause = false;
        audio.resumeMusic(900);
      } else this.tryStart();
    });
  }

  private armGesture(): void {
    if (this.offGesture) return;
    const onPress = () => {
      audio.unlock();
      if (!this.current || useSiteStore.getState().muted) return;
      if (!this.live) this.startNow();
      else if (this.el?.paused && !this.started && audio.getMusicElement() === this.el)
        audio.resumeMusic(this.fadeMs);
    };
    for (const type of GESTURES) window.addEventListener(type, onPress, { capture: true });
    this.offGesture = () => {
      for (const type of GESTURES) window.removeEventListener(type, onPress, { capture: true });
    };
  }

  private disarmGesture(): void {
    this.offGesture?.();
    this.offGesture = null;
  }
}

/** The one theme player of the visit. */
export const themePlayer = new ThemePlayer();
