"use client";

import { useEffect, useRef, type RefObject } from "react";

import { useReducedMotion } from "@/lib/hooks";
import { mediaUrl } from "@/lib/media-store";

import { mayPlay } from "./autoplay";

interface Options {
  /** Let it play by itself while it is on screen (muted). Off, the caller starts it. */
  auto: boolean;
  /** The visitor stopped it: it does not start again by itself until they start it. */
  stopped: RefObject<boolean>;
  /** Whether the sound is off right now (read when it is about to play). */
  muted: () => boolean;
  /** Called when the browser refuses to play with sound and plays it muted instead. */
  onSoundBlocked?: () => void;
}

/** The distance from the screen (a share of its height) where a source is given to the frame. */
const NEAR = "80%";
/** Beyond this the source is taken away again (the decoder is freed, the poster shows). */
const FAR = "260%";
/** A started video that shows no frame in this long is loaded again. */
const WATCHDOG_MS = 3500;

/**
 * The life of a video that sits far down a long page. A browser only keeps so many video decoders
 * alive: when the earlier sections of the page leave theirs open, the later videos can come up
 * black or never start. So this gives the source to the frame when it is near the screen, takes it
 * away again when it is far (remembering where it was), plays it while it is on screen, and
 * loads it again if it says it plays but shows no frame.
 */
export function useVideoSlot(
  video: RefObject<HTMLVideoElement | null>,
  frame: RefObject<HTMLElement | null>,
  file: string,
  { auto, stopped, muted, onSoundBlocked }: Options,
) {
  const reduced = useReducedMotion();
  // The latest callbacks, so the observers below are not rebuilt on every render.
  const mutedNow = useRef(muted);
  const blocked = useRef(onSoundBlocked);
  useEffect(() => {
    mutedNow.current = muted;
    blocked.current = onSoundBlocked;
  }, [muted, onSoundBlocked]);
  useEffect(() => {
    const v = video.current;
    const f = frame.current;
    if (!v || !f) return;
    let near = false;
    let seen = false;
    let at = 0;
    let watch = 0;
    let retries = 0;
    let alive = true;

    const attach = () => {
      if (v.getAttribute("src")) return;
      v.preload = "metadata";
      v.src = mediaUrl(file);
      if (at > 0) {
        const back = at;
        v.addEventListener(
          "loadedmetadata",
          () => {
            try {
              v.currentTime = back;
            } catch {
              /* not seekable yet */
            }
          },
          { once: true },
        );
      }
      v.load();
    };

    const release = () => {
      if (!v.getAttribute("src")) return;
      at = v.currentTime;
      window.clearTimeout(watch);
      v.pause();
      v.removeAttribute("src");
      v.load();
    };

    const frames = () => {
      window.clearTimeout(watch);
      const el = v as HTMLVideoElement & {
        requestVideoFrameCallback?: (cb: () => void) => number;
      };
      if (typeof el.requestVideoFrameCallback !== "function") return;
      let drawn = false;
      el.requestVideoFrameCallback(() => {
        drawn = true;
      });
      watch = window.setTimeout(() => {
        if (!alive || drawn || v.paused || retries >= 2) return;
        // It says it plays, but no frame was shown: take the source and give it again.
        retries += 1;
        at = v.currentTime;
        v.removeAttribute("src");
        v.load();
        attach();
        void play();
      }, WATCHDOG_MS);
    };

    const play = async () => {
      attach();
      v.defaultMuted = mutedNow.current();
      v.muted = mutedNow.current();
      try {
        await v.play();
        frames();
      } catch {
        if (!v.muted) {
          // The browser wants a gesture for sound: play it muted and tell the caller.
          v.muted = true;
          blocked.current?.();
          try {
            await v.play();
            frames();
          } catch {
            /* the visitor can start it */
          }
        }
      }
    };

    const apply = () => {
      const visible = seen && document.visibilityState === "visible";
      // Off screen it always stops. On screen it starts by itself only when it is allowed to; one
      // the visitor started (or stopped) is theirs, and is not touched here.
      if (!visible) {
        if (!v.paused) v.pause();
        return;
      }
      const allowed = auto && !stopped.current && !reduced && mayPlay();
      if (near && allowed && v.paused) void play();
    };

    const warm = new IntersectionObserver(
      (entries) => {
        // The last entry is how it is now (several queue up when the page is busy).
        const e = entries[entries.length - 1];
        near = e?.isIntersecting ?? false;
        if (near) attach();
        apply();
      },
      { rootMargin: `${NEAR} 0px ${NEAR} 0px` },
    );
    const far = new IntersectionObserver(
      (entries) => {
        // The last entry is how it is now (several queue up when the page is busy).
        const e = entries[entries.length - 1];
        if (e && !e.isIntersecting) release();
      },
      { rootMargin: `${FAR} 0px ${FAR} 0px` },
    );
    const view = new IntersectionObserver(
      (entries) => {
        // The last entry is how it is now (several queue up when the page is busy).
        const e = entries[entries.length - 1];
        seen = e?.isIntersecting ?? false;
        apply();
      },
      { threshold: 0.3 },
    );
    warm.observe(f);
    far.observe(f);
    view.observe(f);
    const onVisibility = () => {
      apply();
    };
    document.addEventListener("visibilitychange", onVisibility);
    // A source that failed (a dropped connection) is given again once, when it is wanted.
    const onError = () => {
      if (retries >= 2 || !seen) return;
      retries += 1;
      at = v.currentTime;
      v.removeAttribute("src");
      attach();
      apply();
    };
    v.addEventListener("error", onError);
    return () => {
      alive = false;
      window.clearTimeout(watch);
      warm.disconnect();
      far.disconnect();
      view.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      v.removeEventListener("error", onError);
    };
  }, [video, frame, file, auto, stopped, reduced]);
}
