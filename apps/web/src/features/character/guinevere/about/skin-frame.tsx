"use client";

import { useEffect, useRef, useState } from "react";

import { asset } from "@/lib/asset";
import { useReducedMotion } from "@/lib/hooks";

import { giveSource, mayPlay } from "../../vexana/shared/autoplay";
import { videoFile, videoPoster } from "../media";
import { VIDEOS } from "../videos";
import styles from "./about.module.css";

const FILE = videoFile("skin-showcase");
const INFO = VIDEOS["skin-showcase"];

/**
 * Her skin showcase, cut to Guinevere only, where her picture used to be: muted, looping, and
 * running only while it is on screen. The poster stays under reduced motion and on the light level.
 */
export function SkinFrame() {
  const reduced = useReducedMotion();
  const frameRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ratio, setRatio] = useState(INFO.width / INFO.height);

  useEffect(() => {
    const video = videoRef.current;
    const frame = frameRef.current;
    if (!video || !frame) return;
    let near = false;
    let seen = false;
    const apply = () => {
      if (near && seen && !reduced && mayPlay() && document.visibilityState === "visible") {
        if (video.paused) void video.play().catch(() => undefined);
      } else if (!video.paused) {
        video.pause();
      }
    };
    // The loading bar may already hold the file in memory: use that copy, or stream the file.
    const warm = new IntersectionObserver(
      ([e]) => {
        near = e?.isIntersecting ?? false;
        if (near && !video.getAttribute("src") && !reduced && mayPlay()) {
          giveSource(video, FILE);
          video.preload = "auto";
        }
        apply();
      },
      { rootMargin: "60% 0px 60% 0px" },
    );
    const view = new IntersectionObserver(
      ([e]) => {
        seen = e?.isIntersecting ?? false;
        apply();
      },
      { threshold: 0.2 },
    );
    warm.observe(frame);
    view.observe(frame);
    document.addEventListener("visibilitychange", apply);
    return () => {
      warm.disconnect();
      view.disconnect();
      document.removeEventListener("visibilitychange", apply);
    };
  }, [reduced]);

  return (
    <figure className={styles.framewrap}>
      <div ref={frameRef} className={styles.frame} style={{ aspectRatio: String(ratio) }}>
        <video
          ref={videoRef}
          className={styles.video}
          poster={asset(videoPoster("skin-showcase"))}
          muted
          loop
          playsInline
          preload="none"
          disablePictureInPicture
          aria-label="Guinevere, her skins as they move. A silent loop."
          onLoadedMetadata={(e) => {
            const v = e.currentTarget;
            if (v.videoWidth && v.videoHeight) setRatio(v.videoWidth / v.videoHeight);
          }}
        />
        <span className={styles.frameSheen} aria-hidden="true" />
      </div>
      <span className={styles.frameBack} aria-hidden="true" />
      <figcaption className={styles.cap}>
        <span className={styles.capDot} aria-hidden="true" />
        Daybreak Halo, in motion
      </figcaption>
    </figure>
  );
}
