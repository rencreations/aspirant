"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { PlayerOverlay, type PlayerVideo } from "@/components/video-player/player-overlay";
import { useLenis } from "@/components/smooth-scroll";
import { asset } from "@/lib/asset";
import { useReducedMotion } from "@/lib/hooks";
import { perfLevel } from "@/lib/perf";

import { FINAL_SOURCES, videoFile, videoPoster } from "../media";
import { ReelController } from "./reel-controller";
import { REEL_COPY } from "./reel-copy";
import styles from "./reel.module.css";

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

const cx = (...names: Array<string | false | undefined>) => names.filter(Boolean).join(" ");

/** The small picture streams the 1920 size by itself; the player offers both. */
const PREVIEW = videoFile("final-1080");
const FILM: PlayerVideo = {
  title: "Vexana, Twilight Star",
  poster: videoPoster("final"),
  sources: FINAL_SOURCES,
};

/** The five marks the frame's corners and quarters cycle through. */
function MarkShapes() {
  return (
    <svg className={styles.mark} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <g className={styles.kindPlus}>
        <rect x="0" y="7" width="16" height="2" fill="currentColor" />
        <rect x="7" y="0" width="2" height="16" fill="currentColor" />
      </g>
      <g className={styles.kindX} transform="rotate(45 8 8)">
        <rect x="-0.5" y="7" width="17" height="2.2" style={{ fill: "var(--reel-magenta)" }} />
        <rect x="6.9" y="-0.5" width="2.2" height="17" style={{ fill: "var(--reel-magenta)" }} />
      </g>
      <g className={styles.kindCircle}>
        <circle cx="8" cy="8" r="7" style={{ fill: "var(--reel-gold)" }} />
      </g>
      <g className={styles.kindTriangle}>
        <path d="M8 1.2 15.2 14.4H.8Z" style={{ fill: "var(--reel-violet)" }} />
      </g>
      <g className={styles.kindHalf}>
        <path d="M.8 11.5a7.2 7.2 0 0 1 14.4 0Z" style={{ fill: "var(--reel-sky)" }} />
      </g>
    </svg>
  );
}

function Band({
  position,
  firstLine,
  longestLine,
}: {
  position: "top" | "bottom";
  firstLine: string;
  longestLine: string;
}) {
  return (
    <div className={styles.band} data-reel-band={position}>
      <div className={styles.marks}>
        {Array.from({ length: 5 }, (_, index) => (
          <span key={index} className={styles.markSlot} data-reel="mark-slot">
            <span className={styles.markEmerge} data-reel="mark-emerge">
              <span className={styles.markSwap} data-reel="mark-swap" data-kind="plus">
                <MarkShapes />
              </span>
            </span>
          </span>
        ))}
      </div>
      <div className={styles.strip} data-reel="strip">
        {Array.from({ length: 8 }, (_, index) => (
          <span key={index} className={styles.stripItem} data-reel="strip-item">
            <svg
              className={styles.stripArrows}
              viewBox="0 0 26 8"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M0 0 7 4 0 8ZM9.5 0l7 4-7 4ZM19 0l7 4-7 4Z" fill="currentColor" />
            </svg>
            <span className={styles.stripMask}>
              <span className={styles.stripSizer}>{longestLine}</span>
              <span className={styles.stripText} data-reel="strip-text">
                {firstLine}
              </span>
              <span className={styles.stripText} data-reel="strip-text" />
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

function PlayWord({ text }: { text: string }) {
  return (
    <span className={styles.playWord} data-reel="play-word">
      {Array.from(text.toUpperCase()).map((char, index) => (
        <span key={index} className={styles.char} data-reel="char">
          <span className={styles.charMask}>
            <span className={styles.charTrack} data-reel="char-track">
              <span className={styles.glyph}>{char}</span>
              <span className={styles.glyph}>{char}</span>
            </span>
          </span>
        </span>
      ))}
    </span>
  );
}

/** The device may run a picture by itself: not on the light level, not with data saving. */
function mayPlay() {
  const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
  return perfLevel() !== "lite" && nav.connection?.saveData !== true;
}

/**
 * The film. A small picture that is already moving sits under the title and stretches into the
 * big frame as the page scrolls (pulled into place like cloth), holds there, and a play button
 * opens the site's player out of it. A ribbon draws itself through the section as you go.
 * Phones stack the section and skip the morph and the pin. Reduced motion shows the finished
 * state, still. This is a port of the lab website's reel, without its WebGL layer.
 */
export function Reel() {
  const rootRef = useRef<HTMLElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const controller = useRef<ReelController | null>(null);
  const timeRef = useRef(0);
  const lenisApi = useLenis();
  const lenisRef = useRef(lenisApi);
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const copy = REEL_COPY;

  useEffect(() => {
    lenisRef.current = lenisApi;
  }, [lenisApi]);

  useIsomorphicLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const c = new ReelController(root, {
      reduced,
      stripLines: copy.stripLines,
      coordinates: copy.readout,
      mayPlay,
      isLocked: () => lenisRef.current.getLenis()?.isStopped ?? false,
      scrollTo: (y) => {
        const lenis = lenisRef.current.getLenis();
        if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
        else window.scrollTo({ top: y, behavior: "instant" });
      },
      onPlay: (_origin, startTime) => {
        timeRef.current = startTime;
        setOpen(true);
      },
    });
    controller.current = c;
    return () => {
      controller.current = null;
      c.dispose();
    };
    // The controller is built once per mount.
  }, []);

  const getOrigin = useCallback(() => frameRef.current?.getBoundingClientRect() ?? null, []);
  const onClosed = useCallback(() => {
    setOpen(false);
    controller.current?.playerClosed(timeRef.current, false);
  }, []);

  const descWords = copy.description.split(" ");
  const firstStrip = copy.stripLines[0] ?? "";
  const longestLine = copy.stripLines.reduce((a, b) => (b.length > a.length ? b : a), "");

  return (
    <section ref={rootRef} id="reel" aria-labelledby="reel-title" className={cx(styles.section)}>
      <svg className={styles.lineSvg} data-reel="line-svg" aria-hidden="true" focusable="false">
        <path className={styles.linePath} data-reel="line-path" pathLength={1} />
      </svg>

      <p className={styles.chapter} data-reel="chapter">
        <span className={styles.chapterNo}>{copy.chapter.number}</span>
        <span className={styles.chapterBar} aria-hidden="true" />
        <span>{copy.chapter.label}</span>
      </p>

      <h2 id="reel-title" className={styles.title} data-reel="title">
        <span className={styles.titleInner} data-reel="title-inner">
          {copy.titleLines.map((line, lineIndex) => (
            <span
              key={lineIndex}
              className={cx(styles.titleLine, lineIndex === 0 && styles.titleLineFirst)}
              data-reel="title-line"
            >
              {line.map((word, wordIndex) => (
                <span key={wordIndex}>
                  <span className={styles.word} data-reel="title-word">
                    {word}
                  </span>
                  {wordIndex < line.length - 1 ? " " : null}
                </span>
              ))}
              {lineIndex < copy.titleLines.length - 1 ? " " : null}
            </span>
          ))}
        </span>
      </h2>

      <div className={styles.content} data-reel="content">
        <p className={styles.desc} data-reel="desc">
          {descWords.map((word, index) => (
            <span key={index}>
              <span className={styles.descWord} data-reel="desc-word">
                {word}
              </span>
              {index < descWords.length - 1 ? " " : null}
            </span>
          ))}
        </p>
        <div className={styles.ctaLift} data-reel="cta-lift">
          <span className={styles.ctaMagnet}>
            <a
              href={copy.cta.href}
              className={styles.cta}
              onClick={(e) => {
                // It only scrolls down to the story (the two halves below); it opens nothing.
                e.preventDefault();
                lenisApi.scrollTo(copy.cta.href, { duration: 2.4 });
              }}
            >
              <span className={styles.ctaDot} aria-hidden="true" />
              <span className={styles.ctaText}>{copy.cta.label}</span>
              <svg
                className={styles.ctaArrow}
                viewBox="0 0 16 16"
                aria-hidden="true"
                focusable="false"
              >
                <path
                  d="M2.3 8h11.4m0 0L8.7 3M13.7 8l-5 5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </a>
          </span>
        </div>
      </div>

      <div className={styles.thumbWrap} aria-hidden="true">
        <div className={styles.thumb} data-reel="thumb" />
      </div>

      <div className={styles.container}>
        <div className={styles.videoContainer} data-reel="pin">
          <div className={styles.deco} aria-hidden="true">
            <Band position="top" firstLine={firstStrip} longestLine={longestLine} />
            <Band position="bottom" firstLine={firstStrip} longestLine={longestLine} />
          </div>

          <div ref={frameRef} className={styles.frame} data-reel="frame">
            <div className={styles.visual} data-reel="visual" aria-hidden="true">
              <div className={styles.media} data-reel="media">
                <video
                  className={styles.video}
                  data-reel="video"
                  src={asset(PREVIEW)}
                  poster={asset(videoPoster("final"))}
                  muted
                  loop
                  playsInline
                  preload="none"
                  disablePictureInPicture
                  disableRemotePlayback
                  tabIndex={-1}
                />
              </div>
              <div className={styles.tint} data-reel="tint" />
            </div>

            <div className={styles.readout} data-reel="readout" aria-hidden="true">
              <span className={styles.readoutDot} />
              <span className={styles.readoutMask}>
                <span className={styles.readoutLine} data-reel="readout-line">
                  {copy.readout}
                </span>
                <span className={styles.readoutLine} data-reel="readout-line" />
              </span>
            </div>

            <div className={styles.words} aria-hidden="true">
              <PlayWord text={copy.playWords[0]} />
              <PlayWord text={copy.playWords[1]} />
            </div>
            <div className={styles.watchMagnet} data-reel="watch-magnet">
              <span className={styles.watchRing} data-reel="watch-ring" aria-hidden="true" />
              <button
                type="button"
                className={styles.watch}
                data-reel="watch"
                aria-label={copy.watchLabel}
                aria-haspopup="dialog"
              >
                <span className={styles.watchFill} aria-hidden="true" />
                <svg
                  className={styles.watchIcon}
                  data-reel="watch-icon"
                  viewBox="0 0 36 36"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path
                    d="M12 9.6v16.8c0 1.3 1.4 2.1 2.5 1.4l13.3-8.4c1-.6 1-2.1 0-2.8L14.5 8.2c-1.1-.7-2.5.1-2.5 1.4Z"
                    fill="currentColor"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {open
        ? createPortal(
            <PlayerOverlay video={FILM} getOrigin={getOrigin} onClosed={onClosed} />,
            document.body,
          )
        : null}
    </section>
  );
}
