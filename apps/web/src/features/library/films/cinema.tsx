"use client";

import type { Route } from "next";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";

import { useLenis } from "@/components/smooth-scroll";
import { TLink } from "@/components/transition/t-link";
import { VideoCard } from "@/components/video-player/video-card";
import { audio } from "@/lib/audio";

import { CanonBadge, CreditLine } from "../shell/credit";
import { getCollection } from "../registry";
import styles from "./cinema.module.css";
import {
  KIND_LABEL,
  aspectOf,
  captionsUrl,
  chapterAt,
  clock,
  dateWords,
  pairName,
  posterUrl,
  runtimeWords,
  sizeWords,
  videoUrlAt,
} from "./film-data";
import { TickRule } from "./tick-rule";
import type { Film } from "./types";
import { useCaptionsBlob } from "./use-captions-blob";

interface CinemaProps {
  film: Film;
  /** Where the visitor is in the list, and how long it is, for the small counter. */
  position: number;
  total: number;
  /** Where playback starts, in seconds (from the address, or a scene that was chosen). */
  start: number;
  /** Press play at once. Only ever set by a press (the play button of the featured film). */
  press: boolean;
  onStart: (seconds: number) => void;
  onClose: () => void;
  onStep: (direction: 1 | -1) => void;
}

/**
 * The cinema view of one film: the site's player card (a big poster and a play button), the
 * runtime ruler with a tick for each scene, the words about the film and the list of scenes.
 * The player itself is the site's `VideoCard`: it opens over the page when the visitor presses
 * play. A scene starts the player at that second. Nothing plays by itself.
 */
export function Cinema({
  film,
  position,
  total,
  start,
  press,
  onStart,
  onClose,
  onStep,
}: CinemaProps) {
  const meta = getCollection("films");
  const { pause, resume } = useLenis();
  const panel = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const playerOpen = useRef(false);
  const wantPress = useRef(press);
  const [cardKey, setCardKey] = useState(0);
  const captions = useCaptionsBlob(captionsUrl(film));

  const playFrom = Math.min(start, Math.max(0, film.video.dur - 1));
  const current = chapterAt(film.chapters, playFrom);

  const video = useMemo(
    () => ({
      sources: [{ label: "Original", height: film.video.h, src: videoUrlAt(film, playFrom) }],
      poster: posterUrl(film),
      title: film.title,
      captions,
    }),
    [film, playFrom, captions],
  );

  const pressPlay = useCallback(() => {
    stage.current?.querySelector<HTMLButtonElement>("button[data-cursor='PLAY']")?.click();
  }, []);

  // A press that asked for playback (the featured film, or a scene) opens the player once the card is there.
  useEffect(() => {
    if (!wantPress.current) return;
    // Cleared when the press is made, not before: a dev build runs this effect twice.
    const id = window.requestAnimationFrame(() => {
      wantPress.current = false;
      pressPlay();
    });
    return () => {
      window.cancelAnimationFrame(id);
    };
  }, [cardKey, film.id, pressPlay]);

  // The player is a second layer over this one. Know when it is open: Esc and the arrow keys are its own then.
  useEffect(() => {
    const host = stage.current;
    if (!host) return;
    const read = () => {
      const btn = host.querySelector<HTMLElement>("button[data-cursor='PLAY']");
      const open = btn?.getAttribute("data-open") === "true";
      if (open !== playerOpen.current) {
        playerOpen.current = open;
        // The player gives the page back when it closes. This view still covers it.
        const shell = document.getElementById("site-shell");
        if (shell && !open) shell.inert = true;
      }
    };
    const mo = new MutationObserver(read);
    mo.observe(host, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["data-open"],
    });
    return () => {
      mo.disconnect();
    };
  }, [cardKey, film.id]);

  // Page chrome: still page behind, focus kept here and given back on the way out.
  useEffect(() => {
    pause();
    const shell = document.getElementById("site-shell");
    if (shell) shell.inert = true;
    const back = document.activeElement;
    panel.current?.focus({ preventScroll: true });
    return () => {
      resume();
      if (shell) shell.inert = false;
      if (back instanceof HTMLElement && back.isConnected) back.focus({ preventScroll: true });
    };
  }, [pause, resume]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (playerOpen.current) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        const t = e.target as HTMLElement | null;
        if (t?.closest("input, [role='slider']")) return;
        e.preventDefault();
        onStep(e.key === "ArrowRight" ? 1 : -1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, onStep]);

  const trap = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab" || playerOpen.current) return;
    const items = Array.from(
      panel.current?.querySelectorAll<HTMLElement>(
        "a[href], button:not([disabled]):not([tabindex='-1'])",
      ) ?? [],
    );
    if (items.length === 0) return;
    const first = items[0]!;
    const last = items[items.length - 1]!;
    if (
      e.shiftKey &&
      (document.activeElement === first || document.activeElement === panel.current)
    ) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const go = (index: number) => {
    const chapter = film.chapters[index];
    if (!chapter) return;
    audio.blip("click");
    wantPress.current = true;
    onStart(chapter.t);
    setCardKey((k) => k + 1);
  };

  const vars = {
    "--lib-colour": meta.colour,
    "--lib-ink": meta.ink,
    "--ar": aspectOf(film),
    "--field": film.c,
  } as CSSProperties;
  const date = dateWords(film.date);
  const titleId = `cinema-title-${film.id}`;

  return createPortal(
    <div
      className={styles.backdrop}
      style={vars}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panel}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        data-lenis-prevent
        onKeyDown={trap}
      >
        <header className={styles.top}>
          <p className={`${styles.crumb} hud-label`}>
            <span>{meta.index} Films</span>
            <span aria-hidden="true">/</span>
            <span>{KIND_LABEL[film.kind]}</span>
            <span className={styles.counter} aria-label={`Film ${position} of ${total}`}>
              {String(position).padStart(2, "0")} / {String(total).padStart(2, "0")}
            </span>
          </p>
          <div className={styles.buttons}>
            <button
              type="button"
              className={styles.square}
              aria-label="Previous film"
              onClick={() => {
                onStep(-1);
              }}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="1.8" />
              </svg>
            </button>
            <button
              type="button"
              className={styles.square}
              aria-label="Next film"
              onClick={() => {
                onStep(1);
              }}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="1.8" />
              </svg>
            </button>
            <button type="button" className={styles.square} aria-label="Close" onClick={onClose}>
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path
                  d="M5 5l14 14M19 5L5 19"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
              </svg>
            </button>
          </div>
        </header>

        <div className={styles.stageWrap}>
          <div ref={stage} className={styles.stage} data-film={film.id}>
            <VideoCard
              key={`${film.id}:${cardKey}`}
              video={video}
              duration={film.video.dur}
              tag={KIND_LABEL[film.kind]}
              className={styles.card}
            />
          </div>
          <div className={styles.ruleBox}>
            <TickRule film={film} variant="line" current={current} onSeek={go} />
          </div>
          {playFrom > 0 ? (
            <p className={`${styles.startNote} hud-label`} role="status">
              <span>Plays from {clock(playFrom)}</span>
              <button
                type="button"
                onClick={() => {
                  wantPress.current = false;
                  onStart(0);
                  setCardKey((k) => k + 1);
                }}
              >
                From the beginning
              </button>
            </p>
          ) : null}
        </div>

        <div className={styles.cols}>
          <div className={styles.info}>
            <h2 id={titleId} className={`${styles.title} display`}>
              {film.title}
            </h2>
            <p className={styles.lead}>{film.desc}</p>
            {film.canon === "official" ? null : (
              <div className={styles.notice} role="note">
                <CanonBadge canon={film.canon} />
                <p>A live-action parody made outside the story. Nothing in it counts as canon.</p>
              </div>
            )}
            <CreditLine credit={film.credit} canon={film.canon} />
            <dl className={`${styles.facts} hud-label`}>
              <div>
                <dt>Runs</dt>
                <dd>{runtimeWords(film.video.dur)}</dd>
              </div>
              <div>
                <dt>Picture</dt>
                <dd>
                  {film.video.w} x {film.video.h}
                </dd>
              </div>
              <div>
                <dt>File</dt>
                <dd>{sizeWords(film.bytes)}</dd>
              </div>
              {film.pair ? (
                <div>
                  <dt>Pair</dt>
                  <dd>{pairName(film.pair)}</dd>
                </div>
              ) : null}
              {date ? (
                <div>
                  <dt>Posted</dt>
                  <dd>{date}</dd>
                </div>
              ) : null}
              <div>
                <dt>Captions</dt>
                <dd>{film.video.captions ? "English" : "None"}</dd>
              </div>
            </dl>
            {film.link ? (
              <TLink
                href={film.link.href as Route}
                transitionLabel="Vexana"
                className={styles.moreLink}
              >
                <span className="hud-label">{film.link.label}</span>
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path
                    d="M5 12h14M13 6l6 6-6 6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  />
                </svg>
              </TLink>
            ) : null}
          </div>

          <div className={styles.scenes}>
            <h3 className={`${styles.scenesTitle} hud-label`}>
              {film.chapters.length > 0 ? `Scenes, ${film.chapters.length}` : "Scenes"}
            </h3>
            {film.chapters.length > 0 ? (
              <ol className={styles.sceneList}>
                {film.chapters.map((c, i) => (
                  <li key={c.t}>
                    <button
                      type="button"
                      className={styles.scene}
                      aria-current={current === i ? "true" : undefined}
                      onClick={() => {
                        go(i);
                      }}
                    >
                      <span className={styles.sceneTime}>{clock(c.t)}</span>
                      <span className={styles.sceneLabel}>{c.l}</span>
                    </button>
                  </li>
                ))}
              </ol>
            ) : (
              <p className={styles.noScenes}>
                This film has no scene list. Press play to watch it from the start.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
