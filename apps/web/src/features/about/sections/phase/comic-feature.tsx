"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

import { TLink } from "@/components/transition/t-link";

import { asset } from "@/lib/asset";

import styles from "./comic-feature.module.css";
import { comicBoard, pagesLabel, share } from "./comic-layout";
import { approach } from "./disc-math";
import { usePreview } from "./music-preview";
import { pauseForVideo } from "./music-store";
import { clock } from "./music-time";
import type { PhaseComic, PhaseVideo } from "./types";
import { PhasePlayer } from "./phase-player";

interface ComicFeatureProps {
  phase: number;
  comic: PhaseComic;
  flip: boolean;
}

/** What each webtoon is, in the words of the collection: whose story it tells. */
const ABOUT: Readonly<Record<string, string>> = {
  "the-aspirant": "The official webtoon of Layla and Fanny.",
  "guinevere-and-vexana": "The official webtoon of Guinevere and Vexana.",
};

/** How far the nearest piece follows the pointer, in pixels. */
const DRIFT = 18;

const i = (n: number) => ({ "--i": n }) as CSSProperties;

function Arrow() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        d="M5 12h13M12.5 6.5 18 12l-5.5 5.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

/**
 * The pieces of the board follow the pointer, the near ones further than the far ones, so the
 * board has depth. The pointer is read on the feature, eased in a frame loop that runs only while
 * something still moves, and written as a transform on a wrapper of each piece that has no
 * transition of its own (the arrival and the hover are on other wrappers).
 */
function useDrift(depths: readonly number[]) {
  const root = useRef<HTMLElement>(null);
  const parts = useRef<Array<HTMLElement | null>>([]);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let raf = 0;
    let last = 0;
    const at = { x: 0, y: 0 };
    const to = { x: 0, y: 0 };
    const frame = (now: number) => {
      raf = 0;
      const dt = last ? Math.min(64, now - last) : 16;
      last = now;
      at.x = approach(at.x, to.x, dt, 140);
      at.y = approach(at.y, to.y, dt, 140);
      parts.current.forEach((part, k) => {
        if (!part) return;
        const d = (depths[k] ?? 0) * DRIFT;
        part.style.transform = `translate3d(${(at.x * d).toFixed(2)}px, ${(at.y * d).toFixed(2)}px, 0)`;
      });
      if (Math.abs(at.x - to.x) > 0.002 || Math.abs(at.y - to.y) > 0.002)
        raf = requestAnimationFrame(frame);
      else last = 0;
    };
    const ask = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const r = el.getBoundingClientRect();
      to.x = Math.min(1, Math.max(-1, (e.clientX - (r.left + r.width / 2)) / (r.width / 2)));
      to.y = Math.min(1, Math.max(-1, (e.clientY - (r.top + r.height / 2)) / (r.height / 2)));
      ask();
    };
    const onLeave = () => {
      to.x = 0;
      to.y = 0;
      ask();
    };
    el.addEventListener("pointermove", onMove, { passive: true });
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [depths]);

  return { root, parts };
}

interface VoicedProps {
  film: PhaseVideo;
  /** The title of the comic. */
  title: string;
  /** The site's player is showing the film: the preview waits. */
  hold: boolean;
  /** The upright window the film plays in, for the player to open out of. */
  frame: RefObject<HTMLSpanElement | null>;
  onWatch: () => void;
}

/**
 * The comic as a film with voices: a small upright window in which the film plays by itself,
 * without sound, and beside it what it is. A press opens it with its voices in the site's player.
 */
function Voiced({ film, title, hold, frame, onWatch }: VoicedProps) {
  const preview = useRef<HTMLVideoElement>(null);
  const drawn = usePreview(preview, frame, film.player.sources[0]?.src ?? "", hold);
  return (
    <button
      type="button"
      className={`${styles.voiced} ${styles.rise}`}
      style={i(5)}
      data-cursor="WATCH"
      aria-label={`Watch it voiced: ${title} as a film with voices, ${clock(film.duration)}`}
      onClick={onWatch}
    >
      <span ref={frame} className={styles.reel}>
        {/* eslint-disable-next-line @next/next/no-img-element -- the poster of the film, a file of the collection */}
        <img
          src={asset(film.thumb)}
          width={90}
          height={160}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
        />
        <video
          ref={preview}
          className={styles.reelFilm}
          data-drawn={drawn}
          muted
          playsInline
          preload="none"
          disablePictureInPicture
          tabIndex={-1}
          aria-hidden="true"
        />
        <span className={styles.reelMark} aria-hidden="true">
          <svg viewBox="0 0 16 16" width="10" height="10" focusable="false">
            <path
              d="M4.2 2.3v11.4c0 .6.7 1 1.2.6l8.4-5.7c.5-.3.5-1 0-1.3L5.4 1.7c-.5-.4-1.2 0-1.2.6Z"
              fill="currentColor"
            />
          </svg>
        </span>
      </span>
      <span className={styles.voicedText}>
        <span className={styles.voicedName}>Watch it voiced</span>
        <span className={styles.voicedNote}>
          The comic as a film, with voices. {clock(film.duration)}
        </span>
      </span>
    </button>
  );
}

/**
 * The official webtoon of a phase, as a board of its own pictures: the cover and a few panels cut
 * from its pages, none of them cropped. The first phase's comic hangs as four strips at different
 * heights, which unroll from above and from below; the fourth phase's is one page of panels that
 * assembles from its four sides, with the cover laid on its corner. The pieces follow the pointer
 * by their depth and part a little under it. The board is one link to the comic, and so is the
 * pill beside it. A comic that is also a film with voices has a second control for it, which
 * shows the film playing without sound and opens the site's player out of that picture.
 */
export function ComicFeature({ phase, comic, flip }: ComicFeatureProps) {
  const titleId = useId();
  const thumb = useRef<HTMLSpanElement>(null);
  const [watching, setWatching] = useState(false);

  const board = useMemo(
    () =>
      comicBoard(phase === 1 ? "strips" : "page", [
        { id: "cover", ratio: comic.cover.w / comic.cover.h },
        ...comic.panels.map((panel) => ({ id: panel.id, ratio: panel.w / panel.h })),
      ]),
    [phase, comic],
  );
  const depths = useMemo(() => board.pieces.map((piece) => piece.depth), [board]);
  const { root, parts } = useDrift(depths);

  const getOrigin = useCallback(() => thumb.current?.getBoundingClientRect() ?? null, []);
  const onClosed = useCallback(() => {
    setWatching(false);
  }, []);

  const film = comic.film;
  const read = `Read the comic, ${comic.title}`;

  return (
    <section
      ref={root}
      className={styles.comic}
      data-phase-part="comic"
      data-phase={phase}
      data-flip={flip}
      data-board={board.kind}
      aria-labelledby={titleId}
    >
      <div className={styles.inner}>
        <TLink
          href={comic.href}
          className={styles.figure}
          data-in="false"
          data-in-at="16"
          tabIndex={-1}
          aria-label={read}
          transitionLabel={comic.title}
          data-cursor="READ"
        >
          <span
            className={styles.board}
            style={{ aspectRatio: `${board.width} / ${board.height.toFixed(1)}` }}
          >
            {board.pieces.map((piece, k) => {
              const isCover = piece.id === "cover";
              const art = isCover ? null : comic.panels.find((panel) => panel.id === piece.id);
              const cx = (piece.x + piece.w / 2) / board.width - 0.5;
              const cy = (piece.y + piece.h / 2) / board.height - 0.5;
              return (
                <span
                  key={piece.id}
                  className={styles.piece}
                  data-cover={isCover}
                  style={
                    {
                      left: share(piece.x, board.width),
                      top: share(piece.y, board.height),
                      width: share(piece.w, board.width),
                      aspectRatio: `${piece.w.toFixed(1)} / ${piece.h.toFixed(1)}`,
                      "--o": piece.order,
                      "--fx": `${piece.from.x * 100}%`,
                      "--fy": `${piece.from.y * 100}%`,
                      "--turn": `${piece.turn}deg`,
                      // Under the pointer the pieces part: each moves away from the middle.
                      "--hx": `${(cx * 22).toFixed(1)}px`,
                      "--hy": `${(cy * 22).toFixed(1)}px`,
                    } as CSSProperties
                  }
                >
                  <span
                    ref={(el) => {
                      parts.current[k] = el;
                    }}
                    className={styles.drift}
                  >
                    <span className={styles.lift}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- a picture of the collection, shown whole */}
                      <img
                        className={styles.picture}
                        src={asset(isCover ? comic.cover.large : (art?.src ?? ""))}
                        width={isCover ? comic.cover.w : (art?.w ?? 1)}
                        height={isCover ? comic.cover.h : (art?.h ?? 1)}
                        alt={isCover ? `The cover of ${comic.title}` : (art?.alt ?? "")}
                        loading="lazy"
                        decoding="async"
                        draggable={false}
                        style={isCover ? { backgroundColor: comic.cover.colour } : undefined}
                      />
                    </span>
                  </span>
                </span>
              );
            })}
          </span>
        </TLink>

        <div className={styles.say} data-in="false">
          <p className={styles.eyebrow}>
            <b>Comic</b>
            <span className={styles.eyebrowRule} aria-hidden="true" />
            <span>Official webtoon</span>
          </p>
          <h4 id={titleId} className={`display ${styles.title}`}>
            <span className={styles.titleIn}>{comic.title}</span>
          </h4>
          <p className={`serif ${styles.lead} ${styles.rise}`} style={i(2)}>
            {ABOUT[comic.slug] ?? "The official webtoon."}
          </p>
          <p className={`${styles.count} ${styles.rise}`} style={i(3)}>
            <span className="display">{comic.pages}</span>
            <span>{pagesLabel(comic.pages)}</span>
          </p>
          <div className={styles.ways}>
            <TLink
              href={comic.href}
              className={`${styles.pill} ${styles.rise}`}
              style={i(4)}
              transitionLabel={comic.title}
              data-cursor="READ"
              aria-label={read}
            >
              Read the comic
              <Arrow />
            </TLink>
            {film ? (
              <Voiced
                film={film}
                title={comic.title}
                hold={watching}
                frame={thumb}
                onWatch={() => {
                  // One sound at a time: a track of the decks stops for the film.
                  pauseForVideo();
                  setWatching(true);
                }}
              />
            ) : null}
          </div>
        </div>
      </div>

      {watching && film
        ? createPortal(
            <PhasePlayer video={film.player} getOrigin={getOrigin} onClosed={onClosed} />,
            document.body,
          )
        : null}
    </section>
  );
}
