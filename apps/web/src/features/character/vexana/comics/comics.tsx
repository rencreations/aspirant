"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FocusEvent,
  type PointerEvent,
} from "react";

import { asset } from "@/lib/asset";
import { audio } from "@/lib/audio";
import { useReducedMotion } from "@/lib/hooks";

import { CHIBI, comicPage, videoPoster } from "../media";
import { comicsGate } from "../seams/gates";
import { easeInOut, lvh, put } from "../seams/scroll-kit";
import { useScrollSnap, type SnapRange } from "../seams/snap";
import { COMIC_COUNT, videoInfo } from "../shared/info";
import { PlayerButton, videoFor } from "../shared/player-button";
import { ComicReader } from "./comic-reader";
import styles from "./comics.module.css";
import { useParallax } from "./use-parallax";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger);

/** The pages that make the fan on the Read half. */
const FAN = [1, 2, 4] as const;

type Hot = "none" | "watch" | "read" | "disc";
type Part = "a" | "b";

/**
 * Screens of scrolling. The comic is already in place when the interlude's doors have closed (it
 * waits under the interlude and the doors then open by themselves: see `cover.tsx`), is held for
 * `HOLD` more screens (the visitor can play with it), and in the last `LEAVE` of those its two
 * halves open like doors on the livestream, which waits under it (`Under open={LEAVE}` in
 * vexana-page.tsx).
 */
const OPEN = 0.9;
const HOLD = 2;
const LEAVE = 1;

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
 * The disc on the seam, with its orbit and the chibi sitting on it. It is drawn twice, once in each
 * door: the first copy shows the half on the Watch side of the middle line and the second the half
 * on the Read side, so the disc comes apart when the doors open. Both copies hold exactly the same
 * state, so together they look like one disc.
 */
function Hub({
  part,
  hop,
  onSpin,
}: {
  part: Part;
  hop: { n: number; kind: string };
  onSpin: () => void;
}) {
  return (
    <div className={`${styles.layer} ${styles.hubLayer}`} data-part={part} data-depth="12">
      <div className={styles.hub}>
        <span className={styles.orbit} aria-hidden="true" />
        <div className={styles.pop}>
          <div className={styles.disc} aria-hidden="true" onClick={onSpin}>
            <span className={styles.ring} />
            <span className={styles.discText}>
              <Letters text="Comic" />
            </span>
          </div>
        </div>
        <div className={styles.chibiPos} aria-hidden="true">
          <div className={styles.lean}>
            <div className={styles.bob}>
              <div key={hop.n} className={styles.jump} data-kind={hop.kind} data-live={hop.n > 0}>
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
  );
}

/**
 * "Watch or read?": the comic of Guinevere and Vexana, in two ways. The section is split in two
 * halves with a disc on the seam. Pointing at a half widens it, slides the disc toward it, lifts
 * the word and brings in a picture of what is behind it (the film's poster, a fan of pages). The
 * chibi sitting on the disc leans toward the half, hops when the disc is pointed at, and spins
 * when it is pressed. Every motion is a transform or an opacity, set by `data-hot` in the CSS.
 *
 * The disc and its words are never hidden by a state: they come in once, when the doors of the
 * interlude open on this section, and from then on only move.
 *
 * The section is a tall box with a sticky screen in it. The two halves are two doors (each holds its
 * half, its picture, its word and its half of the disc). They open on the livestream at the end:
 * the Watch door slides out to the left, the Read door to the right.
 */
export function Comics() {
  const [reading, setReading] = useState(false);
  const [hot, setHot] = useState<Hot>("none");
  const [hop, setHop] = useState({ n: 0, kind: "hop" });
  const [leaving, setLeaving] = useState(false);
  const root = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const doorA = useRef<HTMLDivElement>(null);
  const doorB = useRef<HTMLDivElement>(null);
  const sparks = useRef<HTMLDivElement>(null);
  /** The stretch of the page the doors open over, in scroll pixels. */
  const leave = useRef<SnapRange | null>(null);
  const reduced = useReducedMotion();
  useParallax(stage, !reduced);

  const film = videoInfo("comic-jp");

  // The words, the disc and the chibi arrive once the doors in front of the section open.
  const gate = useSyncExternalStore(comicsGate.subscribe, comicsGate.get, () => false);
  const seen = gate || reduced;

  // At the end of the hold the two halves open like doors on the livestream under them.
  useEffect(() => {
    const el = root.current;
    if (!el || reduced) return;
    const doors = [doorA.current, doorB.current];
    const st = ScrollTrigger.create({
      trigger: el,
      start: () => `top top-=${((OPEN + HOLD - LEAVE) * lvh()).toFixed(0)}`,
      end: () => `top top-=${((OPEN + HOLD) * lvh()).toFixed(0)}`,
      invalidateOnRefresh: true,
      onRefresh: (self) => {
        leave.current = { start: self.start, end: self.end };
      },
      onUpdate: (self) => {
        const e = easeInOut(self.progress);
        const vertical = window.matchMedia("(max-width: 760px)").matches;
        const a = (-e * 52).toFixed(3);
        const b = (e * 52).toFixed(3);
        // No transform at all while the doors are shut: a transform would make each door its own
        // layer, and the right door would then paint over the left half of the disc.
        put(
          doorA.current,
          "transform",
          e <= 0.0005 ? "none" : vertical ? `translate3d(0,${a}%,0)` : `translate3d(${a}%,0,0)`,
        );
        put(
          doorB.current,
          "transform",
          e <= 0.0005 ? "none" : vertical ? `translate3d(0,${b}%,0)` : `translate3d(${b}%,0,0)`,
        );
        put(sparks.current, "opacity", (1 - e).toFixed(3));
        setLeaving(self.progress > 0.001);
      },
    });
    return () => {
      st.kill();
      for (const d of doors) if (d) d.style.transform = "";
    };
  }, [reduced]);

  // The doors can never be left half way open on the livestream: from half on they open and the
  // page goes on, before it they shut again and the comic is as it was.
  useScrollSnap("comic-doors", () => leave.current, { enabled: !reduced });

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
    if (e.pointerType === "touch" || leaving) return;
    choose(partOf(e.target));
  };
  const onFocus = (e: FocusEvent) => {
    if (e.target instanceof Element && e.target.matches(":focus-visible")) {
      choose(partOf(e.target));
    }
  };
  const onSpin = () => {
    setHop((h) => ({ n: h.n + 1, kind: "spin" }));
    audio.blip("click");
  };

  return (
    <section
      ref={root}
      id="comics"
      className={styles.comics}
      data-plain={reduced}
      data-theme="storm"
      data-seen={seen}
      data-hot={leaving ? "none" : hot}
      data-leaving={leaving}
      aria-labelledby="comics-title"
    >
      <h2 id="comics-title" className="sr-only">
        The comic: watch it, or read it
      </h2>

      <div className={styles.sticky}>
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
          {/* The Watch door: its half (a button), its picture, its word and its half of the disc. */}
          <div ref={doorA} className={styles.door}>
            <PlayerButton
              className={`${styles.half} ${styles.watch}`}
              label={`Watch the comic, voiced in Japanese, ${lengthText(film.duration)}`}
              video={videoFor("comic-jp", "Guinevere and Vexana, the comic")}
            >
              <span className="sr-only">Watch</span>
            </PlayerButton>
            <div className={styles.scene} aria-hidden="true">
              <div className={styles.layer} data-depth="16">
                <div className={styles.poster}>
                  {/* Plain <img>: static export. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={asset(videoPoster("comic-jp"))}
                    alt=""
                    loading="lazy"
                    draggable={false}
                  />
                  <span className={styles.playDot}>
                    <svg viewBox="0 0 24 24" width="22" height="22">
                      <path d="M8 5v14l11-7z" fill="currentColor" />
                    </svg>
                  </span>
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
            </div>
            <Hub part="a" hop={hop} onSpin={onSpin} />
          </div>

          {/* The Read door. */}
          <div ref={doorB} className={styles.door}>
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
            <div className={styles.scene} aria-hidden="true">
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
            <Hub part="b" hop={hop} onSpin={onSpin} />
          </div>

          <div ref={sparks} className={styles.sparks} aria-hidden="true">
            {Array.from({ length: 10 }, (_, i) => (
              <i key={i} className={styles.spark} style={{ ["--i" as string]: i }} />
            ))}
          </div>
        </div>
      </div>

      <ComicReader open={reading} onOpenChange={setReading} />
    </section>
  );
}
