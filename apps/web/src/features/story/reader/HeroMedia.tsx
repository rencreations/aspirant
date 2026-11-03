"use client";

import { useEffect, useRef } from "react";

import type { Media } from "@/content/story-types";
import { asset } from "@/lib/asset";
import { mediaUrl } from "@/lib/media-store";
import { expectReady } from "@/lib/page-ready";

import s from "./reader.module.css";
import { useAutoplay } from "./use-autoplay";

/**
 * The picture of a chapter's title card: a still, or a muted loop that plays while the card is on
 * screen. The loop is held in memory by the loading list, so it starts at once; it holds the page
 * curtain until it can show a frame.
 */
export function HeroMedia({ media, focus }: { media: Media; focus: string }) {
  const video = useRef<HTMLVideoElement>(null);
  useAutoplay(video, { threshold: 0.15 });
  const isClip = media.kind === "clip";
  const src = media.src;

  useEffect(() => {
    const el = video.current;
    if (!el || !isClip) return;
    el.defaultMuted = true;
    el.muted = true;
    el.src = mediaUrl(`/${src}`);
    const mark = expectReady("story-card");
    const done = () => mark();
    if (el.readyState >= 2) done();
    el.addEventListener("loadeddata", done);
    el.addEventListener("error", done);
    return () => {
      el.removeEventListener("loadeddata", done);
      el.removeEventListener("error", done);
      mark();
    };
  }, [isClip, src]);

  if (media.kind === "clip") {
    return (
      <video
        ref={video}
        className={s.cardMedia}
        style={{ objectPosition: focus }}
        muted
        loop
        playsInline
        preload="auto"
        poster={asset(`/${media.poster}`)}
        aria-label={media.alt}
      />
    );
  }
  return (
    <>
      {/* Plain <img>: static export, art already sized. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className={s.cardMedia}
        style={{ objectPosition: focus }}
        src={asset(`/${media.src}`)}
        alt={media.alt}
        width={media.w}
        height={media.h}
        loading="eager"
        decoding="async"
        draggable={false}
      />
    </>
  );
}
