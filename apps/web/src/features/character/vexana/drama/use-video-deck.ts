"use client";

import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from "react";

import { asset } from "@/lib/asset";
import { loadMedia, mediaUrl, promoteMedia, releaseMedia } from "@/lib/media-store";

import { dramaPoster, dramaVideo } from "./drama-media";
import { DRAMA_FILES, type DramaFileName } from "./drama.generated";

/** How long the picture of the new episode takes to replace the old one (see drama.module.css). */
const FADE_MS = 360;

/**
 * "failed" is a film that did not load: a retry button shows. "blocked" is a film that is ready but
 * the browser wants a tap before it plays with sound (a phone that lost the tap while the film
 * loaded): a play button shows.
 */
export type DeckStatus = "idle" | "loading" | "ready" | "failed" | "blocked";

type Slot = 0 | 1;

interface DeckOptions {
  /** The site's sound is off. */
  muted: boolean;
  /** The time of the film in front, with the film it is (a film that is leaving can still report). */
  onTime: (t: number, file: DramaFileName | null) => void;
  onEnded: (file: DramaFileName | null) => void;
  /** The film in front plays or stops (the page's music steps aside while it plays with sound). */
  onPlaying: (playing: boolean) => void;
}

const ALL_FILES = Object.keys(DRAMA_FILES) as DramaFileName[];

function free(el: HTMLVideoElement): void {
  el.pause();
  el.removeAttribute("src");
  el.removeAttribute("poster");
  el.load();
}

/**
 * Two stacked video elements. A new episode is loaded into the one at the back; when it is playing it
 * comes to the front and the old one fades out and is freed, so changing episodes never shows a
 * black frame and never leaves a decoder running. The picture of the new film is its poster until
 * its first frame. A spinner is asked for (`status` "loading") only when the film is not ready
 * quickly. Every call is safe to repeat: a newer `load` cancels the older one.
 */
export function useVideoDeck(options: DeckOptions) {
  const els = useRef<[HTMLVideoElement | null, HTMLVideoElement | null]>([null, null]);
  const [front, setFront] = useState<Slot>(0);
  const frontRef = useRef<Slot>(0);
  const [status, setStatus] = useState<DeckStatus>("idle");
  const token = useRef(0);
  const request = useRef<{ file: DramaFileName; at: number } | null>(null);
  /** The film that is in front, and whether another one is on its way. */
  const frontFile = useRef<DramaFileName | null>(null);
  const pending = useRef(false);
  /** The game is paused or covered: nothing may start playing. */
  const held = useRef(false);
  const spin = useRef(0);
  /** The film that is waiting for a tap. */
  const blocked = useRef<HTMLVideoElement | null>(null);
  const opts = useRef(options);

  useEffect(() => {
    opts.current = options;
    for (const el of els.current) if (el) el.muted = options.muted;
  });

  const later = useCallback((slow: boolean, t: number) => {
    window.clearTimeout(spin.current);
    if (slow) {
      spin.current = window.setTimeout(() => {
        if (token.current === t) setStatus("loading");
      }, 220);
    }
  }, []);

  /** A stall is over: drop the pending spinner and the spinner itself (a failed film keeps its message). */
  const clearSpinner = useCallback(() => {
    window.clearTimeout(spin.current);
    setStatus((s) => (s === "loading" ? "ready" : s));
  }, []);

  const swap = useCallback((back: Slot, t: number, file: DramaFileName) => {
    const old = els.current[frontRef.current];
    frontRef.current = back;
    frontFile.current = file;
    pending.current = false;
    setFront(back);
    setStatus("ready");
    old?.pause();
    if (held.current) els.current[back]?.pause();
    window.setTimeout(() => {
      if (token.current === t && old && old !== els.current[frontRef.current]) free(old);
    }, FADE_MS + 120);
    opts.current.onPlaying(true);
  }, []);

  const load = useCallback(
    (file: DramaFileName, at: number) => {
      const t = ++token.current;
      blocked.current = null;
      request.current = { file, at };
      const back = (1 - frontRef.current) as Slot;
      const el = els.current[back];
      if (!el) return;
      pending.current = true;
      // The film that is leaving stops where it is: it is the picture behind the spinner.
      els.current[frontRef.current]?.pause();
      later(true, t);
      free(el);
      const path = dramaVideo(file);
      promoteMedia(path);
      el.muted = opts.current.muted;
      el.volume = 0.9;
      el.preload = "auto";
      el.poster = asset(dramaPoster(file));
      const offs: Array<() => void> = [];
      const on = (type: string, fn: () => void) => {
        el.addEventListener(type, fn);
        offs.push(() => {
          el.removeEventListener(type, fn);
        });
      };
      const done = () => {
        for (const off of offs) off();
      };
      const fail = () => {
        if (token.current !== t) return;
        pending.current = false;
        done();
        window.clearTimeout(spin.current);
        setStatus("failed");
      };
      on("loadedmetadata", () => {
        if (token.current === t && at > 0) el.currentTime = at;
      });
      on("canplay", () => {
        if (token.current !== t) return;
        el.play().catch((e: unknown) => {
          if (token.current !== t) return;
          if (e instanceof DOMException && e.name === "NotAllowedError") {
            // Ready, but the browser wants a tap first: wait for it, keep the listeners.
            blocked.current = el;
            window.clearTimeout(spin.current);
            setStatus("blocked");
          } else fail();
        });
      });
      on("playing", () => {
        done();
        if (token.current !== t) return;
        window.clearTimeout(spin.current);
        swap(back, t, file);
      });
      on("error", fail);
      el.src = mediaUrl(path);
      el.load();
    },
    [later, swap],
  );

  const play = useCallback(() => {
    const el = els.current[frontRef.current];
    // Not a film that has ended (play would start it over) and not while another one is coming.
    if (el?.getAttribute("src") && !el.ended && !pending.current && !held.current) {
      void el.play().catch(() => undefined);
    }
  }, []);

  /** Hold the film (a menu is open, the section is off screen) or let it go on. */
  const setHeld = useCallback(
    (hold: boolean) => {
      held.current = hold;
      if (hold) els.current[frontRef.current]?.pause();
      else play();
    },
    [play],
  );

  const seek = useCallback((t: number) => {
    const el = els.current[frontRef.current];
    if (el?.getAttribute("src")) el.currentTime = Math.max(0, t);
  }, []);

  const time = useCallback(() => els.current[frontRef.current]?.currentTime ?? 0, []);

  /** A film is in front and no other one is on its way: what the player sees is the episode. */
  const ready = useCallback(() => frontFile.current !== null && !pending.current, []);

  const stop = useCallback(() => {
    token.current++;
    pending.current = false;
    blocked.current = null;
    frontFile.current = null;
    window.clearTimeout(spin.current);
    for (const el of els.current) if (el) free(el);
    setStatus("idle");
    opts.current.onPlaying(false);
  }, []);

  /** The tap the browser wanted: the film that was ready starts now. */
  const unblock = useCallback(() => {
    const el = blocked.current;
    blocked.current = null;
    if (!el) return;
    setStatus("ready");
    void el.play().catch(() => {
      setStatus("failed");
    });
  }, []);

  const retry = useCallback(() => {
    const r = request.current;
    if (!r) return;
    // The copy in memory may be what is wrong: ask for the file itself.
    releaseMedia(dramaVideo(r.file));
    load(r.file, r.at);
  }, [load]);

  useEffect(() => stop, [stop]);

  /** The props of the video in slot `i`. */
  const slot = (i: Slot) => ({
    ref: (el: HTMLVideoElement | null) => {
      els.current[i] = el;
    },
    onTimeUpdate: (e: SyntheticEvent<HTMLVideoElement>) => {
      if (i === frontRef.current)
        opts.current.onTime(e.currentTarget.currentTime, frontFile.current);
    },
    onEnded: () => {
      if (i === frontRef.current) opts.current.onEnded(frontFile.current);
    },
    onPlay: () => {
      if (i === frontRef.current) opts.current.onPlaying(true);
    },
    onPause: () => {
      if (i === frontRef.current) opts.current.onPlaying(false);
    },
    onWaiting: () => {
      if (i === frontRef.current) later(true, token.current);
    },
    // The film in front is running again (after a seek or a stall): the spinner it asked for goes.
    onPlaying: () => {
      if (i === frontRef.current && !pending.current) clearSpinner();
    },
    onCanPlay: () => {
      if (i === frontRef.current && !pending.current) clearSpinner();
    },
  });

  return { slot, front, status, load, play, setHeld, seek, time, ready, stop, retry, unblock };
}

/**
 * While an episode plays, the two films its answers lead to are loaded in the background (so the
 * next one starts at once), and the films that are no longer wanted are freed from memory.
 */
export function prefetchEpisodes(wanted: readonly DramaFileName[], keep: DramaFileName): void {
  const alive = new Set<DramaFileName>([keep, ...wanted]);
  for (const file of wanted) {
    void loadMedia(dramaVideo(file), {
      background: true,
      type: "video/mp4",
      expectedBytes: DRAMA_FILES[file].bytes,
    });
  }
  for (const file of ALL_FILES) if (!alive.has(file)) releaseMedia(dramaVideo(file));
}

/** Everything the game loaded, freed (the game is left). */
export function releaseEpisodes(): void {
  for (const file of ALL_FILES) releaseMedia(dramaVideo(file));
}
