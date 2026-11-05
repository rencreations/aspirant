"use client";

import { useEffect, useRef, type CSSProperties } from "react";

import { VideoCard } from "@/components/video-player/video-card";
import { libUrl } from "@/lib/library";

import { CanonBadge, CreditLine } from "../shell/credit";
import { clock, stickerTilt } from "./filters";
import styles from "./sections.module.css";
import type { EmoteItem } from "./types";

/**
 * The sticker board. Each sticker is a short muted loop that plays only while it is on screen:
 * one observer starts the ones in view and stops the rest, and everything stops while the tab is
 * hidden. The preview film of the whole set has sound, so it is a card that opens in the player.
 */
export function EmoteWall({ items }: { items: readonly EmoteItem[] }) {
  const stickers = items.filter((i) => !i.preview);
  const preview = items.find((i) => i.preview);
  const refs = useRef(new Map<string, HTMLVideoElement>());
  const credit = (preview ?? stickers[0])?.credit;

  useEffect(() => {
    const inView = new Set<HTMLVideoElement>();
    const play = (v: HTMLVideoElement) => {
      void v.play().catch(() => undefined);
    };
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const v = e.target as HTMLVideoElement;
          if (e.isIntersecting) {
            inView.add(v);
            if (!document.hidden) play(v);
          } else {
            inView.delete(v);
            v.pause();
          }
        }
      },
      { threshold: 0.35 },
    );
    refs.current.forEach((v) => {
      io.observe(v);
    });
    const onVisibility = () => {
      inView.forEach((v) => {
        if (document.hidden) v.pause();
        else play(v);
      });
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [stickers.length]);

  return (
    <>
      {credit ? (
        <div className={styles.credit}>
          <CanonBadge canon="fan" />
          <CreditLine credit={credit} canon="fan" />
          {credit.note ? <span>{credit.note}</span> : null}
        </div>
      ) : null}
      <ul className={styles.wall} aria-label="Emote stickers">
        {preview ? (
          <li
            className={`${styles.item} ${styles.stickerPreview}`}
            style={{ "--i": 0 } as CSSProperties}
            id={preview.id}
          >
            <VideoCard
              video={{
                sources: [{ label: "640p", height: 640, src: libUrl(preview.video.src) }],
                poster: libUrl(preview.video.poster),
                title: preview.title,
              }}
              duration={preview.video.dur}
              tag="Preview, with sound"
            />
          </li>
        ) : null}
        {stickers.map((s, i) => (
          <li
            key={s.id}
            id={s.id}
            className={styles.item}
            style={{ "--i": i + 1 } as CSSProperties}
          >
            <figure
              className={styles.sticker}
              style={{ "--tilt": `${stickerTilt(i)}deg` } as CSSProperties}
            >
              <div className={styles.cut}>
                <span className={styles.cutInner}>
                  <video
                    ref={(el) => {
                      if (el) refs.current.set(s.id, el);
                      else refs.current.delete(s.id);
                    }}
                    src={libUrl(s.video.src)}
                    poster={libUrl(s.video.poster)}
                    width={s.video.w}
                    height={s.video.h}
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    aria-label={`${s.title}, a looping sticker`}
                  />
                </span>
              </div>
              <figcaption className={styles.stickerLabel}>
                <span>{s.title}</span>
                <span className={styles.stickerFan}>{clock(s.video.dur)}</span>
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </>
  );
}
