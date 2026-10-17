"use client";

import { Dialog } from "radix-ui";
import { useEffect, useRef, type CSSProperties, type KeyboardEvent } from "react";

import { Frame } from "@/components/frame/frame";
import { getPair } from "@/content/pairs";
import { asset } from "@/lib/asset";
import { audio } from "@/lib/audio";
import { wrap } from "@/lib/math";

import styles from "./dialogs.module.css";
import { formatDuration, pad2 } from "./format";
import { pairAccent } from "./frames";
import { restoreFocusTo, shieldNextHotkey, useModalScrollLock } from "./modal-utils";
import { pauseForFilm } from "./player-store";
import type { FilmItem } from "./types";

interface WebkitVideo {
  webkitEnterFullscreen?: () => void;
}

interface CinemaDialogProps {
  /** The films in the order the visitor sees them (after filtering). */
  films: readonly FilmItem[];
  /** Index of the open film, or null when closed. */
  index: number | null;
  onIndexChange: (index: number | null) => void;
  /** The card that opened the dialog, so focus can go back to it. */
  opener: HTMLElement | null;
}

/**
 * The cinema: a modal player. The poster shows first and the video is requested only when the
 * dialog opens (`preload="none"`). Space or K plays and pauses, F toggles fullscreen, Page
 * Down and Page Up move through the collection, Esc closes and focus goes back to the card.
 * English captions load when a .vtt exists.
 */
export default function CinemaDialog({ films, index, onIndexChange, opener }: CinemaDialogProps) {
  const open = index !== null && films.length > 0;
  const position = index === null ? 0 : wrap(index, films.length);
  const film = open ? films[position] : undefined;
  const next = films.length > 1 ? films[wrap(position + 1, films.length)] : undefined;
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  useModalScrollLock(open);

  // Start playing when a film opens. A refusal (autoplay rules, codecs) leaves the poster up.
  const filmId = film?.id;
  useEffect(() => {
    if (!filmId) return;
    const video = videoRef.current;
    video?.play().catch(() => undefined);
  }, [filmId]);

  const go = (step: number) => {
    if (index === null) return;
    audio.blip("click");
    onIndexChange(wrap(position + step, films.length));
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => undefined);
    else video.pause();
  };

  const toggleFullscreen = () => {
    const video = videoRef.current;
    if (!video) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
    } else if (typeof video.requestFullscreen === "function") {
      void video.requestFullscreen().catch(() => undefined);
    } else {
      // iOS Safari only offers the prefixed call.
      (video as WebkitVideo).webkitEnterFullscreen?.();
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    shieldNextHotkey(e);
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const target = e.target as HTMLElement;
    const onControl = target.closest("button, a, input, select") !== null;
    const key = e.key.toLowerCase();
    if ((key === " " || key === "k") && !onControl) {
      e.preventDefault();
      togglePlay();
    } else if (key === "f" && !onControl) {
      e.preventDefault();
      toggleFullscreen();
    } else if (e.key === "PageDown") {
      e.preventDefault();
      go(1);
    } else if (e.key === "PageUp") {
      e.preventDefault();
      go(-1);
    }
  };

  const ratio = film ? film.width / film.height : 16 / 9;
  const cinemaStyle = {
    aspectRatio: ratio,
    width: `min(100%, calc((100dvh - var(--chrome)) * ${ratio.toFixed(4)}))`,
  } as CSSProperties;
  const accent = film ? pairAccent(film.pair) : undefined;

  return (
    <Dialog.Root open={open} onOpenChange={(value) => !value && onIndexChange(null)}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} data-theme="storm" />
        <Dialog.Content
          className={styles.content}
          data-theme="storm"
          onKeyDown={onKeyDown}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            stageRef.current?.focus({ preventScroll: true });
          }}
          onCloseAutoFocus={restoreFocusTo(opener)}
        >
          <Dialog.Description className="sr-only">
            Film player. Space or K plays and pauses. F toggles fullscreen. Page Down opens the next
            film and Page Up the previous one. Escape closes.
          </Dialog.Description>
          <div className={styles.head}>
            <div className={styles.headText}>
              <p className={styles.kicker}>
                Film <strong>{pad2(position + 1)}</strong> / {pad2(films.length)}
                {film ? ` / ${film.category}` : ""}
                {film?.pair ? ` / ${getPair(film.pair).names}` : ""}
              </p>
              <Dialog.Title className={styles.title}>{film?.title ?? "Film"}</Dialog.Title>
            </div>
            <Dialog.Close className={styles.btn} data-square aria-label="Close the cinema">
              <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                <path
                  d="M3 3l10 10M13 3L3 13"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  fill="none"
                />
              </svg>
            </Dialog.Close>
          </div>

          <div ref={stageRef} className={styles.stage} tabIndex={-1}>
            {film && (
              <div className={styles.cinema} style={cinemaStyle} data-vertical={film.vertical}>
                <Frame
                  shape="chamfer"
                  tilt={false}
                  accent={accent}
                  className="h-full w-full"
                  data-vertical={film.vertical}
                >
                  <div className={styles.plate}>
                    <video
                      key={film.id}
                      ref={videoRef}
                      className={styles.video}
                      src={asset(film.src)}
                      poster={asset(film.poster)}
                      controls
                      playsInline
                      preload="none"
                      aria-label={`${film.title}, ${film.category}`}
                      onPlay={pauseForFilm}
                    >
                      {film.captions && (
                        <track
                          kind="captions"
                          srcLang="en"
                          label="English"
                          src={asset(film.captions)}
                          default
                        />
                      )}
                    </video>
                  </div>
                </Frame>
              </div>
            )}
          </div>

          <div className={styles.foot}>
            <p className={styles.hint}>
              Space plays. F fullscreen. Page Down next.{" "}
              {film ? `Runs ${formatDuration(film.durationSec)}.` : ""}
              {film?.captions ? " English captions on." : ""}
            </p>
            <div className={styles.tools}>
              <button type="button" className={styles.btn} onClick={toggleFullscreen}>
                <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                  <path
                    d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    fill="none"
                  />
                </svg>
                Fullscreen
              </button>
              {films.length > 1 && (
                <>
                  <button
                    type="button"
                    className={styles.btn}
                    data-square
                    onClick={() => go(-1)}
                    aria-label="Previous film"
                  >
                    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                      <path d="M10 2L4 8l6 6" stroke="currentColor" strokeWidth="1.6" fill="none" />
                    </svg>
                  </button>
                  <button type="button" className={styles.btn} onClick={() => go(1)}>
                    Next in collection
                    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                      <path d="M6 2l6 6-6 6" stroke="currentColor" strokeWidth="1.6" fill="none" />
                    </svg>
                    {next && <span className="sr-only">: {next.title}</span>}
                  </button>
                </>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
