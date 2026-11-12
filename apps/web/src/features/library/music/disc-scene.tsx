"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { TLink } from "@/components/transition/t-link";
import { audio } from "@/lib/audio";
import { libUrl } from "@/lib/library";
import { expectReady } from "@/lib/page-ready";

import { TAKEDOWN_URL } from "../shell/library-shell";
import { videoHref } from "../video/links";
import { downloadFile } from "../voicelines/download";
import { Icon } from "../voicelines/icons";
import { whenCurtainOpen } from "./curtain";
import { drawFace, groundOf, loadDiscFonts } from "./disc-art";
import { DiscField, type Playback } from "./engine";
import { getFaceBitmap, holdFaceBitmaps } from "./faces";
import { clock, counter, downloadName, infoRows, KIND_LABEL } from "./logic";
import styles from "./music.module.css";
import { writePlace } from "./place";
import { PlatformLinks } from "./platform-links";
import { playAt, playTrack, togglePlayback, usePlayer } from "./player-store";
import { PopMenu } from "./pop-menu";
import { hideWords, showWords } from "./reveal";
import { parseWave } from "./trace";
import type { MusicItem } from "./types";

/** Keys that are for typing, or for the control that has the focus. */
function typing(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
    !!target.closest('[role="dialog"]')
  );
}

function onControl(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && !!target.closest("a, button, summary, input");
}

/** A control that rises into place as it fades in, with nothing clipping it (see `reveal.ts`). */
function Rise({ children }: { children: ReactNode }) {
  return (
    <span data-rise="" className={styles.rise}>
      {children}
    </span>
  );
}

/** A line of words that rises into place (see `reveal.ts`). */
function Line({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={`${styles.mask} ${className ?? ""}`}>
      <span data-line="" className={styles.line}>
        {children}
      </span>
    </span>
  );
}

/**
 * The films a track links to. A link carries `from=music`, so closing the video (or its back
 * button) comes back here, and the room opens on this track again (`place.ts`).
 */
function WatchMenu({ item, below }: { item: MusicItem; below?: boolean }) {
  return (
    <PopMenu
      label={item.films.length > 1 ? `Watch, ${item.films.length}` : "Watch"}
      short={item.films.length > 1 ? String(item.films.length) : ""}
      icon={<Icon name="film" />}
      below={below}
    >
      <p className={styles.popHead}>Watch</p>
      <ul className={styles.popItems}>
        {item.films.map((f) => (
          <li key={`${f.id}-${f.t ?? 0}`}>
            <TLink
              href={videoHref(f.id, f.t, "music")}
              transitionLabel="Video"
              className={styles.popItem}
              onClick={() => {
                writePlace(item.id);
              }}
            >
              <Icon name="film" />
              <span>{f.label}</span>
              {f.t ? <span className={styles.popTime}>{clock(f.t)}</span> : null}
            </TLink>
          </li>
        ))}
      </ul>
    </PopMenu>
  );
}

interface Props {
  items: MusicItem[];
  /** The track in front at the start (from `?i=`). */
  start: number;
  /** The scene could not start: the page shows the plain list instead. */
  onFail: () => void;
  /** The field moved to another track (for the address). */
  onSettle: (index: number) => void;
}

/**
 * The Music room: a field of discs in one WebGL scene (`engine.ts`), the words of the disc in
 * front laid over it as real HTML (title, credits, the way to play, download and watch), and the
 * keys. It tells the loading curtain to wait (`expectReady`) until the first frame is drawn, and
 * the discs come in when the curtain opens.
 */
export default function DiscScene({ items, start, onFail, onSettle }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const infoRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<DiscField | null>(null);
  const count = items.length;

  const [front, setFront] = useState(start);
  const [shown, setShown] = useState(start);
  const [entered, setEntered] = useState(false);
  const [row, setRow] = useState(false);
  const [hoverFront, setHoverFront] = useState(false);
  const current = usePlayer((s) => s.track?.id ?? null);
  const playing = usePlayer((s) => s.playing);

  const frontRef = useRef(start);
  const shownRef = useRef(start);
  const words = useRef<{
    phase: "shown" | "out" | "hidden" | "in";
    changedAt: number;
    timer: number;
  }>({ phase: "hidden", changedAt: 0, timer: 0 });

  const press = useCallback(
    (index: number) => {
      const item = items[index];
      if (!item) return;
      audio.unlock();
      playTrack(item, items);
    },
    [items],
  );

  // The scene ------------------------------------------------------------------------------------
  useEffect(() => {
    const host = hostRef.current;
    const stage = stageRef.current;
    if (!host || !stage) return;
    const mark = expectReady("library-music-scene");
    const release = holdFaceBitmaps();
    let cancelled = false;
    let engine: DiscField | null = null;
    let curtain: ReturnType<typeof whenCurtainOpen> | null = null;
    let enterTimer = 0;
    const samples = new Uint8Array(256);

    const playback = (): Playback => {
      const s = usePlayer.getState();
      if (!s.track) return { track: null, playing: false, progress: 0, level: 0 };
      const index = items.findIndex((t) => t.id === s.track?.id);
      const el = audio.getMusicElement();
      const dur = el && Number.isFinite(el.duration) && el.duration > 0 ? el.duration : s.track.dur;
      const progress = el && dur > 0 ? Math.min(1, Math.max(0, el.currentTime / dur)) : 0;
      const live = s.playing && !!el && !el.paused;
      let level = 0;
      if (live) {
        const an = audio.getMusicAnalyser();
        if (an) {
          an.getByteTimeDomainData(samples);
          let sum = 0;
          for (const v of samples) {
            const x = (v - 128) / 128;
            sum += x * x;
          }
          level = Math.min(1, Math.sqrt(sum / samples.length) * 3.2);
        }
      }
      return { track: index >= 0 ? index : null, playing: live, progress, level };
    };

    void (async () => {
      try {
        await loadDiscFonts();
        const tracks = await Promise.all(
          items.map(async (item) => ({
            face: drawFace(item, await getFaceBitmap(item.disc), groundOf(item)),
            wave: parseWave(item.wave),
          })),
        );
        if (cancelled) return;
        engine = new DiscField({
          host,
          surface: stage,
          tracks,
          start,
          fog: getComputedStyle(stage).getPropertyValue("--bg").trim() || "#f4f6f9",
          onFront: (index) => {
            frontRef.current = index;
            setFront(index);
          },
          onPress: (index) => {
            press(index);
          },
          onHoverFront: (on) => {
            setHoverFront(on);
          },
          playback,
        });
        engineRef.current = engine;
        if (process.env.NODE_ENV !== "production")
          (window as unknown as { __musicField?: DiscField }).__musicField = engine;
        // A read-only look at the discs for the probes and the specs (like `__filmsRoom`).
        const made = engine;
        (window as Window & { __musicRoom?: unknown }).__musicRoom = {
          snapshot: () => made.snapshot(),
        };
        setRow(engine.isRow);
        // The first frame is drawn (the discs wait, hidden): the curtain may open.
        mark();
        curtain = whenCurtainOpen();
        await curtain.promise;
        if (cancelled) return;
        engine.playEntrance();
        enterTimer = window.setTimeout(() => {
          setEntered(true);
        }, 760);
      } catch (error) {
        console.warn("The disc field could not start, showing the list.", error);
        mark();
        if (!cancelled) onFail();
      }
    })();

    const ro = new ResizeObserver(() => {
      if (engineRef.current) setRow(engineRef.current.isRow);
    });
    ro.observe(stage);
    const offPlayer = usePlayer.subscribe(() => {
      engineRef.current?.wake(3);
    });

    return () => {
      cancelled = true;
      window.clearTimeout(enterTimer);
      curtain?.cancel();
      ro.disconnect();
      offPlayer();
      engine?.dispose();
      engineRef.current = null;
      delete (window as Window & { __musicRoom?: unknown }).__musicRoom;
      release();
      mark();
    };
    // The scene is built once; the callbacks read the latest values through refs and the store.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // On narrow screens Watch sits at the top, just right of the Collection button (which belongs to
  // the shared room chrome): its right edge is measured, on resize only, into `--back-right`.
  useEffect(() => {
    const stage = stageRef.current;
    const back = document.querySelector<HTMLElement>("[data-room-back]");
    if (!stage || !back) return;
    const measure = () => {
      const r = back.getBoundingClientRect();
      stage.style.setProperty("--back-right", `${Math.round(r.right)}px`);
      stage.style.setProperty("--back-h", `${Math.round(r.height)}px`);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(back);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  // When the player moves to another track by itself (the end of a track, N or P), the field
  // follows it.
  useEffect(
    () =>
      usePlayer.subscribe((s, prev) => {
        const id = s.track?.id;
        if (!id || id === prev.track?.id) return;
        const index = items.findIndex((t) => t.id === id);
        if (index >= 0 && index !== frontRef.current) engineRef.current?.goTo(index, "key");
      }),
    [items],
  );

  // The words: out when the front changes, in once the field has settled on a disc. ---------------
  const onSettleRef = useRef(onSettle);
  useEffect(() => {
    onSettleRef.current = onSettle;
  });

  const reveal = useCallback(() => {
    showWords(infoRef.current);
    showWords(actionsRef.current);
    words.current.phase = "shown";
    onSettleRef.current(shownRef.current);
  }, []);

  /** Bring the words of the disc in front in, once the front has not changed for a moment. */
  const settle = useCallback(() => {
    const w = words.current;
    window.clearTimeout(w.timer);
    const check = () => {
      if (performance.now() - w.changedAt < 140) {
        w.timer = window.setTimeout(check, 50);
        return;
      }
      const next = frontRef.current;
      if (next === shownRef.current) {
        reveal();
        return;
      }
      w.phase = "in";
      shownRef.current = next;
      setShown(next);
    };
    w.timer = window.setTimeout(check, 50);
  }, [reveal]);

  useEffect(() => {
    if (!entered) return;
    const w = words.current;
    w.changedAt = performance.now();
    if (w.phase === "shown") {
      if (front === shownRef.current) return;
      w.phase = "out";
      void Promise.all([hideWords(infoRef.current), hideWords(actionsRef.current)]).then(() => {
        if (words.current.phase !== "out") return;
        words.current.phase = "hidden";
        settle();
      });
    } else if (w.phase === "hidden") {
      settle();
    }
    // While the words go out, the end of that brings them back (`settle`).
  }, [front, entered, settle]);

  // A new track to show: its words rise in before the frame is painted.
  useLayoutEffect(() => {
    if (words.current.phase === "in") reveal();
  }, [shown, reveal]);

  // The entrance brings the first words in.
  useLayoutEffect(() => {
    if (entered && words.current.phase === "hidden" && frontRef.current === shownRef.current)
      reveal();
  }, [entered, reveal]);

  useEffect(() => {
    const w = words.current;
    return () => {
      window.clearTimeout(w.timer);
    };
  }, []);

  // Keys ------------------------------------------------------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return;
      const engine = engineRef.current;
      if (!engine) return;
      switch (e.key) {
        case "ArrowRight":
        case "ArrowDown":
          e.preventDefault();
          engine.step(1, "key");
          break;
        case "ArrowLeft":
        case "ArrowUp":
          e.preventDefault();
          engine.step(-1, "key");
          break;
        case "Home":
          e.preventDefault();
          engine.goTo(0, "key");
          break;
        case "End":
          e.preventDefault();
          engine.goTo(count - 1, "key");
          break;
        case "Enter":
          if (onControl(e.target)) return;
          e.preventDefault();
          engine.pressFront();
          press(frontRef.current);
          break;
        case " ":
          if (onControl(e.target)) return;
          e.preventDefault();
          if (usePlayer.getState().track) togglePlayback();
          else {
            engine.pressFront();
            press(frontRef.current);
          }
          break;
        default:
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [count, press]);

  const item = items[shown];
  const isCurrent = item ? current === item.id : false;
  const isPlaying = isCurrent && playing;

  return (
    <div
      ref={stageRef}
      className={styles.stage}
      data-row={row ? "true" : undefined}
      data-entered={entered ? "true" : undefined}
      data-hover-front={hoverFront ? "true" : undefined}
      tabIndex={0}
      role="group"
      aria-roledescription="carousel"
      aria-label="Music discs. Use the arrow keys to turn the field and Enter to play the disc in front."
      onFocus={(e) => {
        if (e.target === e.currentTarget && e.currentTarget.matches(":focus-visible"))
          engineRef.current?.setFocused(true);
      }}
      onBlur={(e) => {
        if (e.target === e.currentTarget) engineRef.current?.setFocused(false);
      }}
    >
      <h1 className="sr-only">Music</h1>
      <div ref={hostRef} className={styles.gl} aria-hidden="true" />

      <p className="sr-only" aria-live="polite">
        {item ? `${item.title}, ${shown + 1} of ${count}` : ""}
      </p>

      {item ? (
        <div ref={infoRef} className={styles.info}>
          {/* Narrow screens only: Watch at the top, beside the Collection button (first in the
              tab order, where it is seen). */}
          {item.films.length > 0 ? (
            <div className={styles.watchTop} data-group="">
              <Rise>
                <WatchMenu key={`watch-top-${item.id}`} item={item} below />
              </Rise>
            </div>
          ) : null}
          <p className={styles.kicker} data-group="">
            <Line>{[item.ep, KIND_LABEL[item.kind]].filter(Boolean).join("  ·  ")}</Line>
            <Line className={styles.count}>{counter(shown, count)}</Line>
          </p>
          <h2 className={styles.title}>
            <Line>{item.title}</Line>
          </h2>
          <dl className={styles.rows} data-group="">
            {infoRows(item).map((r, i) => (
              <div
                key={`${r.label}-${r.value}`}
                className={styles.row}
                data-extra={i > 0 && r.label !== "Released" ? "true" : undefined}
              >
                <span data-rule="" className={styles.rule} />
                <dt>
                  <Line>{r.label}</Line>
                </dt>
                <dd>
                  <Line>{r.value}</Line>
                </dd>
              </div>
            ))}
            <span data-rule="" className={styles.rule} />
          </dl>
          <PlatformLinks
            key={`links-${item.id}`}
            links={item.links}
            wrap={(node) => <Rise>{node}</Rise>}
          />
        </div>
      ) : null}

      {item ? (
        <div ref={actionsRef} className={styles.actions}>
          <div className={styles.actionRow} data-group="">
            <Rise>
              <button
                type="button"
                className={styles.navBtn}
                aria-label="Previous disc"
                onClick={() => {
                  engineRef.current?.step(-1, "key");
                }}
              >
                <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                  <path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              </button>
            </Rise>
            <Rise>
              <button
                type="button"
                className={`${styles.pill} ${styles.primary}`}
                aria-pressed={isPlaying}
                onClick={() => {
                  engineRef.current?.pressFront();
                  press(shown);
                }}
              >
                <Icon name={isPlaying ? "pause" : "play"} />
                <span>{isPlaying ? "Pause" : isCurrent ? "Resume" : "Play"}</span>
                <span className={styles.pillTime}>{clock(item.dur)}</span>
              </button>
            </Rise>
            <Rise>
              <a
                className={styles.pill}
                href={libUrl(item.orig ?? item.src)}
                download={downloadName(item)}
                aria-label={`Download ${item.title}`}
                onClick={(e) => {
                  e.preventDefault();
                  void downloadFile(libUrl(item.orig ?? item.src), downloadName(item));
                }}
              >
                <Icon name="download" />
                <span className={styles.pillLabel}>{item.orig ? "Original" : "Download"}</span>
              </a>
            </Rise>
            {item.films.length > 0 ? (
              <span className={styles.watchRow}>
                <Rise>
                  <WatchMenu key={`watch-${item.id}`} item={item} />
                </Rise>
              </span>
            ) : null}
            {item.chapters ? (
              <Rise>
                <PopMenu
                  key={`chapters-${item.id}`}
                  label="Chapters"
                  short={String(item.chapters.length)}
                  icon={<Icon name="queue" />}
                >
                  <p className={styles.popHead}>Tracks in this listen</p>
                  <ol className={styles.popItems}>
                    {item.chapters.map((c) => (
                      <li key={c.t}>
                        <button
                          type="button"
                          className={styles.popItem}
                          onClick={() => {
                            audio.unlock();
                            playAt(item, c.t, items);
                          }}
                        >
                          <span className={styles.popTime}>{clock(c.t)}</span>
                          <span>{c.title}</span>
                        </button>
                      </li>
                    ))}
                  </ol>
                </PopMenu>
              </Rise>
            ) : null}
            <Rise>
              <button
                type="button"
                className={styles.navBtn}
                aria-label="Next disc"
                onClick={() => {
                  engineRef.current?.step(1, "key");
                }}
              >
                <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                  <path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              </button>
            </Rise>
          </div>
        </div>
      ) : null}
      <p className={styles.takedown}>
        A fan made archive. The tracks belong to Moonton and the people who made them. To ask for a
        takedown, use the <TLink href={TAKEDOWN_URL}>takedown page</TLink>.
      </p>
    </div>
  );
}
