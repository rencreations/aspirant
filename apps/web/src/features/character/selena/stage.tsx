"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

import { useTransitionRouter } from "@/components/transition/transition-provider";
import { asset } from "@/lib/asset";
import { useReducedMotion } from "@/lib/hooks";
import { expectReady } from "@/lib/page-ready";
import { useSiteStore } from "@/lib/stores";

import {
  CLIP_NAMES,
  SelenaDirector,
  type ClipName,
  type StageElements,
  type StageState,
} from "./director";
import styles from "./selena.module.css";
import { SELENA_CLIPS } from "./timeline.generated";

const SELENA_VIDEO_DIR = "/video/selena";
const SELENA_STILL = `${SELENA_VIDEO_DIR}/still.webp`;
const SELENA_WELCOME = `${SELENA_VIDEO_DIR}/welcome.mp4`;
const SELENA_LOOP = `${SELENA_VIDEO_DIR}/loop.mp4`;

export interface StageApi {
  request: (name: ClipName) => void;
  warm: (name: ClipName) => void;
  cancel: () => void;
  skipWelcome: () => void;
}

interface Props {
  onState: (state: StageState) => void;
}

/**
 * The picture. A still frame sits underneath so the page is never empty, and on top of it the
 * welcome, the idle loop and one hidden video per clip. `SelenaDirector` decides which one shows.
 * The curtain waits for this stage (page-ready), and the welcome starts once the page transition
 * has finished, so it always plays on a fully visible page.
 */
export const SelenaStage = forwardRef<StageApi, Props>(function SelenaStage({ onState }, ref) {
  const reduced = useReducedMotion();
  const router = useTransitionRouter();
  const welcomeRef = useRef<HTMLVideoElement>(null);
  const loopRef = useRef<HTMLVideoElement>(null);
  const clipRefs = useRef<Partial<Record<ClipName, HTMLVideoElement | null>>>({});
  const director = useRef<SelenaDirector | null>(null);
  const onStateRef = useRef(onState);

  useEffect(() => {
    onStateRef.current = onState;
  }, [onState]);

  useImperativeHandle(
    ref,
    (): StageApi => ({
      request: (name) => director.current?.request(name),
      warm: (name) => director.current?.warm(name),
      cancel: () => director.current?.cancel(),
      skipWelcome: () => director.current?.skipWelcome(),
    }),
    [],
  );

  useEffect(() => {
    const welcome = welcomeRef.current;
    const loop = loopRef.current;
    const clips = Object.fromEntries(CLIP_NAMES.map((n) => [n, clipRefs.current[n]])) as Partial<
      Record<ClipName, HTMLVideoElement>
    >;
    if (!welcome || !loop || CLIP_NAMES.some((n) => !clips[n])) return;
    const els: StageElements = {
      welcome,
      loop,
      clips: clips as Record<ClipName, HTMLVideoElement>,
    };
    const d = new SelenaDirector(els, {
      muted: () => useSiteStore.getState().muted,
      reduced,
      onState: (s) => {
        onStateRef.current(s);
      },
    });
    director.current = d;

    // The curtain waits until there is something to show: the welcome can play and so can the loop.
    const mark = expectReady("selena-stage");
    let started = false;
    let alive = true;
    // A video that fails to load (no codec) counts as playable: the still picture stays.
    const canPlay = (v: HTMLVideoElement) => v.readyState >= 3 || v.error !== null;
    const check = () => {
      if (!reduced && !canPlay(welcome)) return;
      if (!canPlay(loop)) return;
      mark();
    };
    const targets = reduced ? [loop] : [welcome, loop];
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
        (!canPlay(loop) && !slow)
      ) {
        window.setTimeout(waitAndStart, 80);
        return;
      }
      started = true;
      void d.start();
    };
    waitAndStart();

    const unsub = useSiteStore.subscribe((s, prev) => {
      if (s.muted !== prev.muted) d.setMuted(s.muted);
    });
    const onVisibility = () => {
      d.setHidden(document.visibilityState === "hidden");
    };
    document.addEventListener("visibilitychange", onVisibility);
    // The first touch or key after a muted start gives the browser the permission it needs.
    const unmute = () => {
      d.setMuted(useSiteStore.getState().muted);
    };
    window.addEventListener("pointerdown", unmute, { once: true });
    window.addEventListener("keydown", unmute, { once: true });

    return () => {
      alive = false;
      mark();
      unsub();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointerdown", unmute);
      window.removeEventListener("keydown", unmute);
      for (const v of targets) {
        v.removeEventListener("canplay", check);
        v.removeEventListener("loadeddata", check);
        v.removeEventListener("error", check);
      }
      d.destroy();
      director.current = null;
    };
    // The stage is built once per mount; `reduced` is read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={styles.stage} aria-hidden="true">
      {/* Plain <img>: static export. It shows until the first video frame. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={styles.still} src={asset(SELENA_STILL)} alt="" draggable={false} />
      <video
        ref={welcomeRef}
        className={styles.video}
        src={asset(SELENA_WELCOME)}
        playsInline
        preload="auto"
        tabIndex={-1}
      />
      <video
        ref={loopRef}
        className={styles.video}
        src={asset(SELENA_LOOP)}
        playsInline
        muted
        loop
        preload="auto"
        tabIndex={-1}
      />
      {CLIP_NAMES.map((name) => (
        <video
          key={name}
          ref={(el) => {
            clipRefs.current[name] = el;
          }}
          className={styles.video}
          src={asset(`${SELENA_VIDEO_DIR}/${SELENA_CLIPS[name].file}`)}
          playsInline
          preload="none"
          tabIndex={-1}
        />
      ))}
    </div>
  );
});
