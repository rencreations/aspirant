"use client";

import gsap from "gsap";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FocusEvent,
  type PointerEvent,
  type RefObject,
} from "react";

import { asset } from "@/lib/asset";
import { audio } from "@/lib/audio";
import { useReducedMotion } from "@/lib/hooks";

import { CHIBI, comicPage, videoPoster } from "../media";
import { registerComic } from "../seams/comic-link";
import { comicsGate } from "../seams/gates";
import { put } from "../seams/scroll-kit";
import { COMIC_COUNT, videoInfo } from "../shared/info";
import { PlayerButton, videoFor } from "../shared/player-button";
import { ComicReader } from "./comic-reader";
import styles from "./comics.module.css";
import { useParallax } from "./use-parallax";

/** The pages that make the fan on the Read half. */
const FAN = [1, 2, 4] as const;

type Hot = "none" | "watch" | "read" | "disc";

/** The time, in ms, the entrance takes: the words, the disc and the sticker (see `--d-*` in the CSS). */
const ENTER_MS = 1800;
/** The time, in ms, the halves, the words and the disc take to go back to neutral when the pointer lets go. */
const CALM_MS = 220;

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
 * The disc on the seam, with its orbit and the chibi sitting on it. It is ONE whole disc and it lives
 * in the Watch door: when the doors open it goes with the Watch half to the left, whole, and when
 * they close it comes in with it. (The door of the Read half is under it in the stack, so the part of
 * the disc that lies over the Read half is drawn over it, as before.)
 */
function Hub({
  hop,
  onSpin,
  hubRef,
}: {
  hop: { n: number; kind: string };
  onSpin: () => void;
  hubRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className={`${styles.layer} ${styles.hubLayer}`} data-depth="12">
      <div ref={hubRef} className={styles.hub}>
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
 * The disc and its words are never hidden by a pointer state: they come in once, when the doors of the
 * interlude open on this section, and from then on only move.
 *
 * The section is one screen. The two halves are two doors (the Watch door holds its half, its picture,
 * its word and the WHOLE disc; the Read door its half, its fan of pages and its word). The join with
 * the livestream (`seams/comic-link.ts`) pins the stage to the screen, and the Watch door slides out
 * to the left with the whole disc while the Read door slides out to the right, or the other way
 * round when the visitor comes back up. The pointer's choice is let go of first (`calm`), so the
 * doors always move from the neutral picture, wherever the pointer was.
 */
export function Comics() {
  const [reading, setReading] = useState(false);
  const [hot, setHot] = useState<Hot>("none");
  const [hop, setHop] = useState({ n: 0, kind: "hop" });
  const [leaving, setLeaving] = useState(false);
  /** The disc is already there (it came in with its half), whatever else has not arrived yet. */
  const [disc, setDisc] = useState(false);
  const root = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const doorA = useRef<HTMLDivElement>(null);
  const doorB = useRef<HTMLDivElement>(null);
  const hub = useRef<HTMLDivElement>(null);
  const sparks = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  useParallax(stage, !reduced);

  const film = videoInfo("comic-jp");

  // The words, the disc and the chibi arrive once the doors in front of the section open.
  const gate = useSyncExternalStore(comicsGate.subscribe, comicsGate.get, () => false);
  const seen = gate || reduced;

  // What the joins around the comic ask of it (`seams/comic-link.ts`).
  useEffect(() => {
    if (reduced) return;
    const el = root.current;
    if (!el) return;
    const move = { v: 0 };
    let tween: gsap.core.Tween | null = null;
    let calmTimer = 0;
    let enterTimer = 0;
    const pending = new Set<() => void>();

    /** How far a door has to go to be out of sight, with the disc (and its orbit and sticker) on it. */
    const travel = () => {
      const st = stage.current;
      const h = hub.current;
      if (!st) return 0;
      const vertical = window.matchMedia("(max-width: 760px)").matches;
      const r = st.getBoundingClientRect();
      return (vertical ? r.height : r.width) / 2 + (h?.offsetWidth ?? 0) * 0.85;
    };
    /**
     * 0 is the doors shut (the picture at rest), 1 is both out of sight. A little below 0 the two halves
     * lie over each other by a few pixels: the doors close to there and then settle at 0, so no hairline
     * of what is under them shows at the seam in the last frames of closing.
     */
    const slide = (v: number) => {
      move.v = v;
      const vertical = window.matchMedia("(max-width: 760px)").matches;
      const d = v * travel();
      const axis = (n: number) =>
        vertical ? `translate3d(0,${n.toFixed(1)}px,0)` : `translate3d(${n.toFixed(1)}px,0,0)`;
      // No transform at all while the doors are shut: the picture at rest is what the page lays out.
      const shut = Math.abs(v) <= 0.0005;
      put(doorA.current, "transform", shut ? "none" : axis(-d));
      put(doorB.current, "transform", shut ? "none" : axis(d));
      put(sparks.current, "opacity", Math.min(1, 1 - v).toFixed(3));
    };
    const to = (v: number, seconds: number) =>
      new Promise<void>((resolve) => {
        tween?.kill();
        if (seconds <= 0) {
          slide(v);
          resolve();
          return;
        }
        pending.add(resolve);
        tween = gsap.to(move, {
          v,
          duration: seconds,
          ease: "power2.inOut",
          onUpdate: () => {
            slide(move.v);
          },
          onComplete: () => {
            pending.delete(resolve);
            resolve();
          },
        });
      });
    const wait = (ms: number, slot: "calm" | "enter") =>
      new Promise<void>((resolve) => {
        pending.add(resolve);
        const done = () => {
          pending.delete(resolve);
          resolve();
        };
        if (slot === "calm") {
          window.clearTimeout(calmTimer);
          calmTimer = window.setTimeout(done, ms);
        } else {
          window.clearTimeout(enterTimer);
          enterTimer = window.setTimeout(done, ms);
        }
      });
    const warm = () => {
      const urls = [CHIBI, videoPoster("comic-jp"), ...FAN.map((n) => comicPage(n))];
      return Promise.all(
        urls.map((u) => {
          const img = new Image();
          img.src = asset(u);
          return img.decode().catch(() => undefined);
        }),
      ).then(() => undefined);
    };
    const pin = (on: boolean) => {
      el.dataset.pinned = on ? "true" : "false";
    };

    const unregister = registerComic({
      calm: (waitFor = true) => {
        setHot("none");
        setLeaving(true);
        return waitFor ? wait(CALM_MS, "calm") : Promise.resolve();
      },
      release: () => {
        setLeaving(false);
      },
      pin,
      show: (what) => {
        comicsGate.set(what === "all");
        if (what !== "all") setDisc(what === "disc");
      },
      slideOut: (seconds) => to(1, seconds),
      slideIn: async (seconds) => {
        await to(-0.006, seconds);
        slide(0);
      },
      enter: () => {
        comicsGate.set(true);
        return wait(ENTER_MS, "enter");
      },
      rest: () => {
        tween?.kill();
        slide(0);
        pin(false);
        setLeaving(false);
      },
      decoded: warm,
    });
    // The pictures are fetched while the page is idle, so they are there when the doors open.
    const idle = window.setTimeout(() => {
      void warm();
    }, 1500);

    return () => {
      unregister();
      window.clearTimeout(idle);
      window.clearTimeout(calmTimer);
      window.clearTimeout(enterTimer);
      tween?.kill();
      for (const resolve of pending) resolve();
      pending.clear();
      slide(0);
      pin(false);
    };
  }, [reduced]);

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
      data-disc={disc}
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
          {/* The Watch door: its half (a button), its picture, its word and the whole disc. */}
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
            <Hub hop={hop} onSpin={onSpin} hubRef={hub} />
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
