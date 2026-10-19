"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

import { useTransitionRouter } from "@/components/transition/transition-provider";
import { asset } from "@/lib/asset";
import { useReducedMotion } from "@/lib/hooks";
import { mediaUrl, releaseMedia } from "@/lib/media-store";
import { expectReady } from "@/lib/page-ready";

import {
  SelenaDirector,
  VIDEO_KEYS,
  videoFile,
  type SceneName,
  type StageElements,
  type StageState,
  type VideoKey,
} from "./director";
import { SELENA_DIR, selenaPath, selenaTier } from "./media";
import styles from "./selena.module.css";

const STILL = `${SELENA_DIR}/still.webp`;

/** Freed a moment after the page is left, so a quick remount (React's dev double mount) keeps it. */
let releaseTimer = 0;

/** The videos that loop by themselves. The others play once. */
const LOOPING = (key: VideoKey) => key === "idle" || key.endsWith("-loop");

export interface StageApi {
  request: (scene: SceneName) => void;
  warm: (scene: SceneName) => void;
  cancel: () => void;
  leave: () => void;
  /** Straight to the idle loop. The caller covers the screen while it happens. */
  jumpToIdle: () => Promise<void>;
  /** The time of the idle loop, so touch points can follow its picture. Null until it can play. */
  idleTime: () => number | null;
}

interface Props {
  onState: (state: StageState) => void;
}

/**
 * The picture. A still frame sits underneath so the page is never empty, and on top of it one
 * video per piece. `SelenaDirector` decides which one shows. The videos are already in memory
 * (the loading bar fetched them), so each one only gets its source when it is first needed. The
 * curtain waits for this stage (page-ready), and the welcome starts once the page transition has
 * finished, so it always plays on a fully visible page.
 */
export const SelenaStage = forwardRef<StageApi, Props>(function SelenaStage({ onState }, ref) {
  const reduced = useReducedMotion();
  const router = useTransitionRouter();
  const refs = useRef<Partial<Record<VideoKey, HTMLVideoElement | null>>>({});
  const director = useRef<SelenaDirector | null>(null);
  const onStateRef = useRef(onState);

  useEffect(() => {
    onStateRef.current = onState;
  }, [onState]);

  useImperativeHandle(
    ref,
    (): StageApi => ({
      request: (scene) => director.current?.request(scene),
      warm: (scene) => director.current?.warm(scene),
      cancel: () => director.current?.cancel(),
      leave: () => director.current?.leave(),
      jumpToIdle: () => director.current?.jumpToIdle() ?? Promise.resolve(),
      idleTime: () => director.current?.idleTime() ?? null,
    }),
    [],
  );

  useEffect(() => {
    const els = Object.fromEntries(VIDEO_KEYS.map((k) => [k, refs.current[k]])) as Partial<
      Record<VideoKey, HTMLVideoElement>
    >;
    if (VIDEO_KEYS.some((k) => !els[k])) return;
    window.clearTimeout(releaseTimer);
    const tier = selenaTier();
    const d = new SelenaDirector(els as StageElements, {
      reduced,
      onState: (s) => {
        onStateRef.current(s);
      },
      attach: (key, el) => {
        if (el.dataset.attached) return;
        el.dataset.attached = "1";
        // No video has sound, so every one is muted for good and the browser lets it autoplay.
        el.defaultMuted = true;
        el.muted = true;
        el.src = mediaUrl(selenaPath(tier, videoFile(key)));
        if (LOOPING(key)) el.loop = true;
      },
    });
    director.current = d;
    const welcome = els.welcome!;
    const idle = els.idle!;

    // The curtain waits until there is something to show: the welcome can play and so can the loop.
    const mark = expectReady("selena-stage");
    let started = false;
    let alive = true;
    // A video that fails to load (no codec) counts as playable: the still picture stays.
    const canPlay = (v: HTMLVideoElement) => v.readyState >= 3 || v.error !== null;
    const check = () => {
      if (!reduced && !canPlay(welcome)) return;
      if (!canPlay(idle)) return;
      mark();
    };
    const targets = reduced ? [idle] : [welcome, idle];
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
        releaseMedia(`${SELENA_DIR}/`);
      }, 1500);
    };
    // The stage is built once per mount; `reduced` is read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={styles.stage} aria-hidden="true">
      {/* Plain <img>: static export. It shows until the first video frame. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={styles.still} src={asset(STILL)} alt="" draggable={false} />
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
