"use client";

import { useCallback, useRef, useState, type FocusEvent, type PointerEvent } from "react";

import { asset } from "@/lib/asset";
import { audio } from "@/lib/audio";
import { useInView, useReducedMotion } from "@/lib/hooks";

import { CHIBI, comicPage, videoPoster } from "../media";
import { COMIC_COUNT, videoInfo } from "../shared/info";
import { PlayerButton, videoFor } from "../shared/player-button";
import { ComicReader } from "./comic-reader";
import styles from "./comics.module.css";
import { useParallax } from "./use-parallax";

/** The pages that make the fan on the Read half. */
const FAN = [1, 2, 4] as const;

type Hot = "none" | "watch" | "read" | "disc";

/** "2 min 12 s" from a length in seconds. */
function lengthText(seconds: number) {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)} min ${String(s % 60)} s`;
}

/** A word as letters, so each can rise on its own when its half is chosen. */
function Letters({ text }: { text: string }) {
  return (
    <>
      {Array.from(text).map((ch, i) => (
        <span key={i} className={styles.letter} style={{ ["--i" as string]: i }}>
          {ch}
        </span>
      ))}
    </>
  );
}

/**
 * "Watch or read?": the comic of Guinevere and Vexana, in two ways. The section is split in two
 * halves with a disc on the seam. Pointing at a half widens it, slides the disc toward it, lifts
 * the word and brings in a picture of what is behind it (the film's poster, a fan of pages). The
 * chibi sitting on the disc leans toward the half, hops when the disc is pointed at, and spins
 * when it is pressed. Every motion is a transform or an opacity, set by `data-hot` in the CSS.
 */
export function Comics() {
  const [reading, setReading] = useState(false);
  const [hot, setHot] = useState<Hot>("none");
  const [hop, setHop] = useState({ n: 0, kind: "hop" });
  const root = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const seen = useInView(root, { threshold: 0.25, once: true });
  const reduced = useReducedMotion();
  useParallax(stage, !reduced);

  const film = videoInfo("comic-jp");

  const choose = useCallback((next: Hot) => {
    setHot((prev) => {
      if (prev === next) return prev;
      if (next !== "none") audio.blip("hover");
      if (next === "disc") setHop((h) => ({ n: h.n + 1, kind: "hop" }));
      return next;
    });
  }, []);

  /** Which part of the section an event came from. */
  const partOf = (t: EventTarget): Hot => {
    const el = t instanceof Element ? t : null;
    if (el?.closest(`.${styles.disc}`)) return "disc";
    if (el?.closest(`.${styles.watch}`)) return "watch";
    if (el?.closest(`.${styles.read}`)) return "read";
    return "none";
  };

  const onOver = (e: PointerEvent) => {
    if (e.pointerType === "touch") return;
    choose(partOf(e.target));
  };
  const onFocus = (e: FocusEvent) => {
    if (e.target instanceof Element && e.target.matches(":focus-visible")) {
      choose(partOf(e.target));
    }
  };

  return (
    <section
      ref={root}
      id="comics"
      className={styles.comics}
      data-theme="storm"
      data-seen={seen}
      data-hot={hot}
      aria-labelledby="comics-title"
    >
      <h2 id="comics-title" className="sr-only">
        The comic: watch it, or read it
      </h2>

      <div
        ref={stage}
        className={styles.stage}
        onPointerOver={onOver}
        onPointerLeave={() => {
          choose("none");
        }}
        onFocus={onFocus}
        onBlur={() => {
          choose("none");
        }}
      >
        {/* The two halves are the buttons: they widen and narrow as one. */}
        <PlayerButton
          className={`${styles.half} ${styles.watch}`}
          label={`Watch the comic, voiced in Japanese, ${lengthText(film.duration)}`}
          video={videoFor("comic-jp", "Guinevere and Vexana, the comic")}
        >
          <span className="sr-only">Watch</span>
        </PlayerButton>
        <button
          type="button"
          className={`${styles.half} ${styles.read}`}
          aria-haspopup="dialog"
          aria-label={`Read the comic, ${String(COMIC_COUNT)} pages`}
          data-cursor="READ"
          onClick={() => {
            setReading(true);
          }}
        >
          <span className="sr-only">Read</span>
        </button>

        {/* Pictures and words on top of the halves. Nothing here takes the pointer. */}
        <div className={styles.scene} aria-hidden="true">
          <div className={styles.sparks}>
            {Array.from({ length: 10 }, (_, i) => (
              <i key={i} className={styles.spark} style={{ ["--i" as string]: i }} />
            ))}
          </div>

          <div className={styles.layer} data-depth="16">
            <div className={styles.poster}>
              {/* Plain <img>: static export. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={asset(videoPoster("comic-jp"))} alt="" loading="lazy" draggable={false} />
              <span className={styles.playDot}>
                <svg viewBox="0 0 24 24" width="22" height="22">
                  <path d="M8 5v14l11-7z" fill="currentColor" />
                </svg>
              </span>
            </div>
          </div>

          <div className={styles.layer} data-depth="16">
            <div className={styles.fan}>
              {FAN.map((n, i) => (
                <span key={n} className={styles.sheet} style={{ ["--i" as string]: i }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={asset(comicPage(n))}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                  />
                </span>
              ))}
            </div>
          </div>

          <div className={styles.layer} data-depth="-9">
            <div className={`${styles.word} ${styles.wordWatch}`}>
              <span className={styles.rise}>
                <b className={styles.big}>
                  <Letters text="Watch" />
                </b>
                <small className={styles.sub}>
                  {lengthText(film.duration)}, voiced in Japanese
                </small>
              </span>
            </div>
          </div>

          <div className={styles.layer} data-depth="-9">
            <div className={`${styles.word} ${styles.wordRead}`}>
              <span className={styles.rise}>
                <b className={styles.big}>
                  <Letters text="Read" />
                </b>
                <small className={styles.sub}>{COMIC_COUNT} pages, scroll or turn them</small>
              </span>
            </div>
          </div>
        </div>

        {/* The disc on the seam, and the chibi on the disc. The disc is the only part of the
            scene that takes the pointer: pointing at it makes the chibi hop, pressing it spins. */}
        <div className={styles.layer} data-depth="12">
          <div className={styles.hub}>
            <span className={styles.orbit} aria-hidden="true" />
            <div
              className={styles.disc}
              aria-hidden="true"
              onClick={() => {
                setHop((h) => ({ n: h.n + 1, kind: "spin" }));
                audio.blip("click");
              }}
            >
              <span className={styles.ring} />
              <span className={styles.discText}>
                <Letters text="Comic" />
              </span>
            </div>
            <div className={styles.chibiPos} aria-hidden="true">
              <div className={styles.lean}>
                <div className={styles.bob}>
                  <div
                    key={hop.n}
                    className={styles.jump}
                    data-kind={hop.kind}
                    data-live={hop.n > 0}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className={styles.chibi}
                      src={asset(CHIBI)}
                      alt=""
                      draggable={false}
                      decoding="async"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ComicReader open={reading} onOpenChange={setReading} />
    </section>
  );
}
