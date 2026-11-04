"use client";

import { useRef, type CSSProperties } from "react";

import type { ClipMedia } from "@/content/story-types";
import { asset } from "@/lib/asset";

import s from "./reader.module.css";
import { useAutoplay } from "./use-autoplay";

/**
 * The card that introduces an Aspirant when her picture is a film: a muted loop, wide, with the
 * information over a gradient that rises from the foot of the picture and fades out toward the
 * top (it never covers the whole picture).
 */
export function PortraitVideo({
  media,
  name,
  aka,
  line,
  accent,
}: {
  media: ClipMedia;
  name: string;
  aka: string;
  line: string;
  accent: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useAutoplay(ref);
  return (
    <figure
      className={s.portraitVideo}
      aria-label={`Meet ${name}`}
      style={
        {
          "--ar": `${media.w} / ${media.h}`,
          "--ratio": (media.w / media.h).toFixed(3),
          "--tint": media.color,
          "--accent": accent,
        } as CSSProperties
      }
    >
      <div className={s.frame}>
        <video
          ref={ref}
          className={s.frameVideo}
          muted
          loop
          playsInline
          preload="none"
          poster={asset(`/${media.poster}`)}
          width={media.w}
          height={media.h}
          aria-label={media.alt}
        >
          <source src={asset(`/${media.src}`)} type="video/mp4" />
        </video>
        <div className={s.portraitVideoShade} aria-hidden="true" />
        <div className={s.portraitVideoText}>
          <p className={s.portraitVideoKicker}>Meet</p>
          <p className={s.portraitVideoName}>{name}</p>
          <p className={s.portraitVideoAka}>{aka}</p>
          <p className={s.portraitVideoLine}>{line}</p>
        </div>
      </div>
    </figure>
  );
}
