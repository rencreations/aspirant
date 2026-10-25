"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

import { useTransitionRouter } from "@/components/transition/transition-provider";
import { asset } from "@/lib/asset";
import { useReducedMotion } from "@/lib/hooks";
import { mediaUrl, promoteMedia, releaseMedia } from "@/lib/media-store";
import { cancelDeferred } from "@/lib/preload";
import { expectReady } from "@/lib/page-ready";

import { StageDirector, videoFile, type StageElements, type StageState } from "./director";
import type { SkipOptions } from "./phase";
import type { StageMedia } from "./media";
import styles from "./stage.module.css";
import { VIDEO_KEYS, type SceneName, type Timeline, type VideoKey } from "./timeline";

/** Freed a moment after the page is left, so a quick remount (React's dev double mount) keeps it. */
let releaseTimer = 0;

/** The music plays this long on its own before the welcome video starts. */
const WELCOME_DELAY_MS = 400;

/** The videos that loop by themselves. The others play once. */
const LOOPING = (key: VideoKey) => key === "idle" || key.endsWith("-loop");

export interface StageApi {
  request: (scene: SceneName) => void;
  warm: (scene: SceneName) => void;
  cancel: () => void;
  leave: () => void;
  /** Straight to the idle loop. The caller covers the screen while it happens. */
  jumpToIdle: () => Promise<void>;
  /** The clock of the idle loop, so touch points can follow its picture. Null until it can play. */
  idleClock: () => { time: number; playing: boolean; rate: number } | null;
  /** Video frames dropped and shown so far by the picture on top (counters), for the governor. */
  videoQuality: () => { dropped: number; total: number } | null;
  /** Give the idle loop the size the device asks for now. The caller covers the screen. */
  retier: () => Promise<void>;
  /** Pause the picture (the stage is off screen) or carry on. Hidden tabs are handled already. */
  setHidden: (hidden: boolean) => void;
}

interface Props {
  /** Her videos: the frame numbers every hand-over is cut on. */
  timeline: Timeline;
  /** Speed the picture up while it waits for a frame (see the director's `skip`). */
  skip?: () => SkipOptions | null;
  /** Where her videos are and which size is used. */
  media: StageMedia;
  onState: (state: StageState) => void;
  /** Play the welcome first. False when the visitor came straight to one of her pages. */
  welcome: boolean;
  /** The stage begins: the music starts now, half a second before the welcome video. */
  onBegin: () => void;
}

/**
 * The picture. A still frame sits underneath so the page is never empty, and on top of it one
 * video per piece. `StageDirector` decides which one shows. The videos are already in memory
 * (the loading bar fetched them), so each one only gets its source when it is first needed. The
 * curtain waits for this stage (page-ready), and the welcome starts once the page transition has
 * finished, so it always plays on a fully visible page.
 */
export const CharacterStage = forwardRef<StageApi, Props>(function CharacterStage(
  { timeline, media, skip, onState, welcome: playWelcome, onBegin },
  ref,
) {
  const reduced = useReducedMotion();
  const router = useTransitionRouter();
  const refs = useRef<Partial<Record<VideoKey, HTMLVideoElement | null>>>({});
  const director = useRef<StageDirector | null>(null);
  const onStateRef = useRef(onState);

  const onBeginRef = useRef(onBegin);
  const skipRef = useRef(skip);

  useEffect(() => {
    onStateRef.current = onState;
    onBeginRef.current = onBegin;
    skipRef.current = skip;
  }, [onState, onBegin, skip]);

  useImperativeHandle(
    ref,
    (): StageApi => ({
      request: (scene) => director.current?.request(scene),
      warm: (scene) => director.current?.warm(scene),
      cancel: () => director.current?.cancel(),
      leave: () => director.current?.leave(),
      jumpToIdle: () => director.current?.jumpToIdle() ?? Promise.resolve(),
      idleClock: () => director.current?.idleClock() ?? null,
      videoQuality: () => director.current?.videoQuality() ?? null,
      retier: () => director.current?.retier() ?? Promise.resolve(),
      setHidden: (hidden) => director.current?.setHidden(hidden),
    }),
    [],
  );

  useEffect(() => {
    const els = Object.fromEntries(VIDEO_KEYS.map((k) => [k, refs.current[k]])) as Partial<
      Record<VideoKey, HTMLVideoElement>
    >;
    if (VIDEO_KEYS.some((k) => !els[k])) return;
    window.clearTimeout(releaseTimer);
    const d = new StageDirector(els as StageElements, {
      timeline,
      skip: () => skipRef.current?.() ?? null,
      reduced,
      skipWelcome: !playWelcome,
      welcomeDelayMs: WELCOME_DELAY_MS,
      onBegin: () => {
        onBeginRef.current();
      },
      onState: (s) => {
        onStateRef.current(s);
      },
      detach: (_key, el) => {
        if (!el.dataset.attached) return;
        el.pause();
        el.removeAttribute("src");
        el.load();
        delete el.dataset.attached;
        el.dataset.layer = "off";
      },
      attach: (key, el) => {
        const tier = media.tier();
        if (el.dataset.attached === tier) return;
        // What is on screen keeps its size. It gets the new one the next time it is attached, which
        // is when it is out of sight (the performance level can step down while the page plays).
        if (el.dataset.attached && (el.dataset.layer === "front" || el.dataset.layer === "back")) {
          return;
        }
        el.dataset.attached = tier;
        // No video has sound, so every one is muted for good and the browser lets it autoplay.
        el.defaultMuted = true;
        el.muted = true;
        const file = media.path(tier, videoFile(timeline, key));
        // Wanted now: if its background download has not started, it goes first.
        promoteMedia(file);
        el.src = mediaUrl(file);
        if (LOOPING(key)) el.loop = true;
      },
    });
    director.current = d;
    const welcome = els.welcome!;
    const idle = els.idle!;

    // The curtain waits until there is something to show: the welcome can play and so can the loop.
    const mark = expectReady("stage");
    let started = false;
    let alive = true;
    // A video that fails to load (no codec) counts as playable: the still picture stays.
    const canPlay = (v: HTMLVideoElement) => v.readyState >= 3 || v.error !== null;
    const check = () => {
      if (!reduced && playWelcome && !canPlay(welcome)) return;
      if (!canPlay(idle)) return;
      mark();
    };
    const targets = reduced || !playWelcome ? [idle] : [welcome, idle];
    for (const v of targets) {
      v.addEventListener("canplay", check);
      v.addEventListener("loadeddata", check);
      v.addEventListener("error", check);
    }
    check();

    // Start once the page is fully in view: the curtain has opened and the tab is visible.
    const mounted = performance.now();
    const waitAndStart = () => {
      if (!alive || started) return;
      const slow = performance.now() - mounted > 10_000;
      if (
        router.isTransitioning() ||
        document.visibilityState !== "visible" ||
        (!canPlay(idle) && !slow)
      ) {
        window.setTimeout(waitAndStart, 80);
        return;
      }
      started = true;
      void d.start();
    };
    waitAndStart();

    const onVisibility = () => {
      d.setHidden(document.visibilityState === "hidden");
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      alive = false;
      mark();
      document.removeEventListener("visibilitychange", onVisibility);
      for (const v of targets) {
        v.removeEventListener("canplay", check);
        v.removeEventListener("loadeddata", check);
        v.removeEventListener("error", check);
      }
      d.destroy();
      director.current = null;
      // Let go of the videos held in memory.
      for (const v of Object.values(els)) {
        v.removeAttribute("src");
        v.load();
        delete v.dataset.attached;
      }
      releaseTimer = window.setTimeout(() => {
        releaseMedia(`${media.dir}/`);
        // What was still waiting in the background for this page is not wanted any more.
        cancelDeferred(media.dir.split("/").pop() ?? "");
      }, 1500);
    };
    // The stage is built once per mount; `reduced` is read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={styles.stage} aria-hidden="true">
      {/* Plain <img>: static export. It shows until the first video frame. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className={styles.still}
        src={asset(`${media.dir}/still.webp`)}
        alt=""
        draggable={false}
      />
      {VIDEO_KEYS.map((key) => (
        <video
          key={key}
          ref={(el) => {
            refs.current[key] = el;
          }}
          className={styles.video}
          playsInline
          muted
          preload="auto"
          tabIndex={-1}
        />
      ))}
    </div>
  );
});
