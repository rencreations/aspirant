"use client";

import { useRef, useState, type CSSProperties, type PointerEvent } from "react";

import { Frame } from "@/components/frame/frame";
import { FrameImage } from "@/components/frame/frame-image";
import { getPair } from "@/content/pairs";
import { asset } from "@/lib/asset";
import { audio } from "@/lib/audio";
import { clamp } from "@/lib/math";

import styles from "./cards.module.css";
import { formatDuration, pad2, spokenDuration } from "./format";
import { pairAccent, pickShape } from "./frames";
import type { FilmItem } from "./types";

interface FilmCardProps {
  film: FilmItem;
  /** Position in the full list, so the shape of a card never changes while filtering. */
  index: number;
  onOpen: (film: FilmItem, opener: HTMLElement) => void;
}

/**
 * One film in its own frame. Mouse: hover loads a muted copy and the pointer scrubs through
 * it. Touch and keyboard: tap or press Enter to open the cinema. The video is only created
 * on hover, so nothing heavy loads until a visitor asks for it.
 */
export function FilmCard({ film, index, onOpen }: FilmCardProps) {
  const shape = pickShape(film.vertical ? "tall" : "wide", index);
  const ratio = film.vertical ? 0.72 : 16 / 9;
  const [hover, setHover] = useState(false);
  const [ready, setReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLSpanElement>(null);
  const pending = useRef<number | null>(null);

  const seek = (fraction: number) => {
    const v = videoRef.current;
    if (!v || !Number.isFinite(v.duration) || v.duration <= 0) return;
    const t = fraction * v.duration;
    if (v.seeking) pending.current = t;
    else v.currentTime = t;
  };

  const onMove = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType !== "mouse") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const fraction = clamp((e.clientX - rect.left) / Math.max(1, rect.width), 0, 1);
    frameRef.current?.style.setProperty("--scrub", fraction.toFixed(4));
    seek(fraction);
  };

  const accent = pairAccent(film.pair);
  const pairName = film.pair ? getPair(film.pair).names : "";

  return (
    <button
      type="button"
      className={styles.card}
      data-kind="film"
      data-vertical={film.vertical}
      data-shape={shape}
      data-tall={shape === "arch" || shape === "star"}
      data-cursor="WATCH"
      aria-label={`Watch ${film.title}, ${pairName}, ${film.category.toLowerCase()}, ${spokenDuration(film.durationSec)}`}
      onClick={(e) => {
        audio.blip("click");
        onOpen(film, e.currentTarget);
      }}
      onPointerEnter={(e) => {
        if (e.pointerType !== "mouse") return;
        audio.blip("hover");
        setHover(true);
      }}
      onPointerLeave={() => {
        setHover(false);
        setReady(false);
        pending.current = null;
      }}
      onPointerMove={onMove}
    >
      <Frame
        as="span"
        shape={shape}
        accent={accent}
        maxTilt={5}
        className={styles.frame}
        style={{ aspectRatio: ratio }}
      >
        <span
          ref={frameRef}
          className={styles.media}
          style={{ "--scrub": "0.25" } as CSSProperties}
        >
          <FrameImage
            src={film.poster}
            alt=""
            width={film.vertical ? 540 : 1280}
            height={film.vertical ? 960 : 720}
            sizes="(min-width: 900px) 30vw, 90vw"
          />
          {hover && (
            <video
              ref={videoRef}
              className={styles.scrub}
              src={asset(film.src)}
              muted
              playsInline
              preload="metadata"
              tabIndex={-1}
              aria-hidden="true"
              data-ready={ready}
              onLoadedMetadata={() => seek(0.25)}
              onLoadedData={() => setReady(true)}
              onSeeked={() => {
                const next = pending.current;
                pending.current = null;
                if (next !== null && videoRef.current) videoRef.current.currentTime = next;
              }}
            />
          )}
          <span className={styles.scrim} aria-hidden="true" />
          <span className={styles.chip} data-pos="tl">
            {film.category}
          </span>
          <span className={styles.chip} data-pos="br" data-mono>
            {formatDuration(film.durationSec)}
          </span>
          <span className={styles.play} aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              <path d="M8 5l12 7-12 7z" fill="currentColor" />
            </svg>
          </span>
          <span className={styles.scrubBar} aria-hidden="true" />
        </span>
      </Frame>
      <span className={styles.meta} aria-hidden="true">
        <span className={`${styles.code} hud-label`}>
          Film {pad2(index + 1)}
          {film.captions ? " / Captions" : ""}
        </span>
        <span className={styles.title}>{film.title}</span>
        <span className={styles.sub}>{pairName}</span>
      </span>
    </button>
  );
}
