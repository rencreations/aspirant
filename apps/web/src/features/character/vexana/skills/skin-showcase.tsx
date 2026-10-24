"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { PlayerOverlay, type PlayerVideo } from "@/components/video-player/player-overlay";
import { asset } from "@/lib/asset";
import { useReducedMotion } from "@/lib/hooks";
import { perfLevel } from "@/lib/perf";

import { videoFile, videoPoster } from "../media";
import { VIDEOS } from "../media.generated";
import styles from "./skills.module.css";

const FILM: PlayerVideo = {
  title: "Vexana, skin showcase",
  poster: videoPoster("skin-showcase"),
  sources: [{ label: "1080p", height: 1080, src: videoFile("skin-showcase") }],
};

/** A muted picture may run by itself, but not on the light level or with data saving on. */
function mayPlay() {
  const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
  return perfLevel() !== "lite" && nav.connection?.saveData !== true;
}

/**
 * The skin showcase: the film (cut to Vexana only) in a frame that takes the shape of the
 * picture, muted and looping while it is on screen, with a button that opens it in the site's
 * player with the sound.
 */
export function SkinShowcase() {
  const reduced = useReducedMotion();
  const frameRef = useRef<HTMLButtonElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ratio, setRatio] = useState(
    VIDEOS["skin-showcase"].width / VIDEOS["skin-showcase"].height,
  );
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    const frame = frameRef.current;
    if (!video || !frame) return;
    let near = false;
    let seen = false;
    const apply = () => {
      if (near && seen && !open && !reduced && mayPlay()) {
        if (video.paused) void video.play().catch(() => undefined);
      } else if (!video.paused) {
        video.pause();
      }
    };
    const warm = new IntersectionObserver(
      ([e]) => {
        near = e?.isIntersecting ?? false;
        if (near && video.preload !== "auto") video.preload = "auto";
        apply();
      },
      { rootMargin: "60% 0px 60% 0px" },
    );
    const view = new IntersectionObserver(
      ([e]) => {
        seen = e?.isIntersecting ?? false;
        apply();
      },
      { threshold: 0.25 },
    );
    warm.observe(frame);
    view.observe(frame);
    document.addEventListener("visibilitychange", apply);
    return () => {
      warm.disconnect();
      view.disconnect();
      document.removeEventListener("visibilitychange", apply);
    };
  }, [open, reduced]);

  const getOrigin = useCallback(() => frameRef.current?.getBoundingClientRect() ?? null, []);

  return (
    <div className={styles.skins}>
      <div className={styles.skinsCopy}>
        <p className={styles.eyebrow}>
          <span>Skins</span>
          <span className={styles.eyebrowBar} aria-hidden="true" />
        </p>
        <h3 className={styles.skinsTitle}>
          Dressed for <em>the stage</em>
        </h3>
        <p className={styles.skinsText}>
          Her looks, one after another, as they move. The preview is silent. Press the frame to
          watch it in the full player, with the sound.
        </p>
        <span className={styles.skinsHint}>Opens the player</span>
      </div>
      <div className={styles.skinsStage}>
        <span className={styles.skinsBack} aria-hidden="true" />
        <button
          ref={frameRef}
          type="button"
          className={styles.skinsFrame}
          style={{ aspectRatio: String(ratio), ["--ratio" as string]: ratio }}
          aria-label="Play the skin showcase"
          aria-haspopup="dialog"
          data-cursor="PLAY"
          onClick={() => {
            setOpen(true);
          }}
        >
          <video
            ref={videoRef}
            className={styles.skinsVideo}
            src={asset(videoFile("skin-showcase"))}
            poster={asset(videoPoster("skin-showcase"))}
            muted
            loop
            playsInline
            preload="none"
            disablePictureInPicture
            tabIndex={-1}
            onLoadedMetadata={(e) => {
              const v = e.currentTarget;
              if (v.videoWidth && v.videoHeight) setRatio(v.videoWidth / v.videoHeight);
            }}
          />
          <span className={styles.skinsPlay} aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" focusable="false">
              <path d="M8 5v14l11-7z" fill="currentColor" />
            </svg>
          </span>
        </button>
      </div>
      {open
        ? createPortal(
            <PlayerOverlay
              video={FILM}
              getOrigin={getOrigin}
              onClosed={() => {
                setOpen(false);
              }}
            />,
            document.body,
          )
        : null}
    </div>
  );
}
