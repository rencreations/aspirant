"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { useLenis } from "@/components/smooth-scroll";
import { asset } from "@/lib/asset";
import { audio } from "@/lib/audio";
import { useReducedMotion } from "@/lib/hooks";
import { useSiteStore } from "@/lib/stores";

import { cursorShape, formatTime, fractionAt, inLeaveZone, type CursorShape } from "./player-math";
import styles from "./video-player.module.css";

export interface PlayerVideo {
  /** Public path of the video (passed through asset()). */
  src: string;
  /** Public path of the poster. */
  poster: string;
  title: string;
  /** Public path of a WebVTT track, if there is one. */
  captions?: string;
}

interface Props {
  video: PlayerVideo;
  /** Where the thumbnail was. The player grows out of it and shrinks back into it. */
  getOrigin: () => DOMRect | null;
  onClosed: () => void;
}

const STORE_KEY = "aspirants:player";
const RATES = [0.75, 1, 1.25, 1.5, 2] as const;
const EASE = "cubic-bezier(0.83, 0, 0.17, 1)";
const ENTER_MS = 760;
const EXIT_MS = 560;

interface Saved {
  volume: number;
  muted: boolean;
}

function readSaved(): Saved {
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (raw) {
      const v = JSON.parse(raw) as Partial<Saved>;
      return {
        volume: typeof v.volume === "number" ? Math.min(1, Math.max(0, v.volume)) : 0.9,
        muted: v.muted === true,
      };
    }
  } catch {
    /* ignore */
  }
  return { volume: 0.9, muted: false };
}

function writeSaved(value: Saved): void {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

/** The shape a rect makes as a clip-path inset on a viewport sized box. */
function insetFor(rect: DOMRect, vw: number, vh: number): string {
  const top = Math.max(0, rect.top);
  const left = Math.max(0, rect.left);
  const right = Math.max(0, vw - rect.right);
  const bottom = Math.max(0, vh - rect.bottom);
  return `inset(${top}px ${right}px ${bottom}px ${left}px round 6px)`;
}

function Icon({
  name,
}: {
  name: "play" | "pause" | "back" | "forward" | "volume" | "mute" | "cc" | "close" | "replay";
}) {
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    "aria-hidden": true,
    focusable: false,
  } as const;
  switch (name) {
    case "play":
      return (
        <svg {...common}>
          <path d="M7 4.5v15l12-7.5z" fill="currentColor" />
        </svg>
      );
    case "pause":
      return (
        <svg {...common}>
          <path d="M6.5 4.5h4v15h-4zM13.5 4.5h4v15h-4z" fill="currentColor" />
        </svg>
      );
    case "back":
      return (
        <svg {...common}>
          <path
            d="M12 5a7 7 0 1 1-6.6 4.7M12 2v6L7.5 5z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <text
            x="12"
            y="16"
            fontSize="6.5"
            textAnchor="middle"
            fill="currentColor"
            fontFamily="monospace"
          >
            10
          </text>
        </svg>
      );
    case "forward":
      return (
        <svg {...common}>
          <path
            d="M12 5a7 7 0 1 0 6.6 4.7M12 2v6l4.5-3z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <text
            x="12"
            y="16"
            fontSize="6.5"
            textAnchor="middle"
            fill="currentColor"
            fontFamily="monospace"
          >
            10
          </text>
        </svg>
      );
    case "volume":
      return (
        <svg {...common}>
          <path d="M3 9.5h3.5L11 5.5v13l-4.5-4H3z" fill="currentColor" />
          <path
            d="M14.5 9a4.2 4.2 0 0 1 0 6M17 6.5a8 8 0 0 1 0 11"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          />
        </svg>
      );
    case "mute":
      return (
        <svg {...common}>
          <path d="M3 9.5h3.5L11 5.5v13l-4.5-4H3z" fill="currentColor" />
          <path d="M15 9.5l5 5m0-5l-5 5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      );
    case "cc":
      return (
        <svg {...common}>
          <rect
            x="3"
            y="5"
            width="18"
            height="14"
            rx="1.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <path
            d="M10 10.2a2.2 2.2 0 1 0 0 3.6M17 10.2a2.2 2.2 0 1 0 0 3.6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
      );
    case "close":
      return (
        <svg {...common}>
          <path d="M5 5l14 14M19 5L5 19" fill="none" stroke="currentColor" strokeWidth="1.7" />
        </svg>
      );
    case "replay":
      return (
        <svg {...common}>
          <path
            d="M5 12a7 7 0 1 0 2.3-5.2M5 4v4.5h4.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
          />
        </svg>
      );
  }
}

/**
 * The custom player. It grows out of the thumbnail to fill the page (not the display), plays
 * the video, and has its own controls, loading state and a cursor that changes shape with the
 * place it is over: Play or Pause in the middle, Leave along the top and sides, the time over the
 * timeline. Esc, the Leave cursor and the close button shrink it back into the thumbnail.
 */
export function PlayerOverlay({ video, getOrigin, onClosed }: Props) {
  const reduced = useReducedMotion();
  const { pause: pauseScroll, resume: resumeScroll } = useLenis();
  const rootRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<Element | null>(null);
  const pointer = useRef({ x: -100, y: -100, sx: -100, sy: -100, raf: 0, inside: false });
  const hideTimer = useRef(0);
  const closing = useRef(false);

  const [ready, setReady] = useState(false); // enter animation finished
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(true);
  const [ended, setEnded] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(() => readSaved().volume);
  const [muted, setMuted] = useState(() => readSaved().muted || useSiteStore.getState().muted);
  const [rate, setRate] = useState<number>(1);
  const [captions, setCaptions] = useState(false);
  const [controls, setControls] = useState(true);
  const [shape, setShape] = useState<CursorShape>("dot");
  const [cursorOn, setCursorOn] = useState(false);
  const [hoverFraction, setHoverFraction] = useState<number | null>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const [flash, setFlash] = useState<{ id: number; icon: "play" | "pause" } | null>(null);
  const [speedOpen, setSpeedOpen] = useState(false);
  const speedRef = useRef(false);
  useEffect(() => {
    speedRef.current = speedOpen;
  }, [speedOpen]);

  const v = () => videoRef.current;

  // Close ------------------------------------------------------------------------------------
  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    setControls(false);
    const el = v();
    el?.pause();
    audio.blip("hover");
    const root = rootRef.current;
    const frame = frameRef.current;
    const finish = () => {
      onClosed();
    };
    if (!root || !frame) {
      finish();
      return;
    }
    const rect = getOrigin();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const visible = rect && rect.bottom > 0 && rect.top < vh && rect.right > 0 && rect.left < vw;
    if (reduced || !visible) {
      root
        .animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: 180,
          easing: "ease-out",
          fill: "forwards",
        })
        .finished.then(finish, finish);
      return;
    }
    const sx = rect.width / vw;
    const dx = rect.left + rect.width / 2 - vw / 2;
    const dy = rect.top + rect.height / 2 - vh / 2;
    const opts = { duration: EXIT_MS, easing: EASE, fill: "forwards" } as const;
    frame.animate(
      [
        { transform: "translate(0,0) scale(1)" },
        { transform: `translate(${dx}px, ${dy}px) scale(${sx})` },
      ],
      opts,
    );
    root
      .animate(
        [{ clipPath: "inset(0 0 0 0 round 0px)" }, { clipPath: insetFor(rect, vw, vh) }],
        opts,
      )
      .finished.then(finish, finish);
  }, [getOrigin, onClosed, reduced]);

  // Open: grow out of the thumbnail, then play ----------------------------------------------
  useLayoutEffect(() => {
    const root = rootRef.current;
    const frame = frameRef.current;
    if (!root || !frame) return;
    returnFocus.current = document.activeElement;
    root.focus({ preventScroll: true });
    const rect = getOrigin();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let finished: Promise<unknown>;
    if (reduced || !rect) {
      finished = root.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 160,
        fill: "both",
      }).finished;
    } else {
      const sx = rect.width / vw;
      const dx = rect.left + rect.width / 2 - vw / 2;
      const dy = rect.top + rect.height / 2 - vh / 2;
      const opts = { duration: ENTER_MS, easing: EASE, fill: "both" } as const;
      frame.animate(
        [
          { transform: `translate(${dx}px, ${dy}px) scale(${sx})` },
          { transform: "translate(0,0) scale(1)" },
        ],
        opts,
      );
      finished = root.animate(
        [{ clipPath: insetFor(rect, vw, vh) }, { clipPath: "inset(0 0 0 0 round 0px)" }],
        opts,
      ).finished;
    }
    let alive = true;
    void finished.then(() => {
      if (!alive) return;
      setReady(true);
      root.focus({ preventScroll: true });
      const el = videoRef.current;
      if (el) {
        el.volume = volume;
        el.muted = muted;
        void el.play().catch(() => {
          el.muted = true;
          setMuted(true);
          void el.play().catch(() => undefined);
        });
      }
    });
    audio.blip("click");
    return () => {
      alive = false;
    };
    // Runs once on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Page chrome: freeze the page behind, make it inert, give focus back on the way out ------
  useEffect(() => {
    pauseScroll();
    const shell = document.getElementById("site-shell");
    if (shell) shell.inert = true;
    return () => {
      resumeScroll();
      if (shell) shell.inert = false;
      const back = returnFocus.current;
      if (back instanceof HTMLElement) back.focus({ preventScroll: true });
    };
  }, [pauseScroll, resumeScroll]);

  // Escape works from the first moment, even before the opening animation has finished.
  useEffect(() => {
    const onEscape = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      if (speedRef.current) setSpeedOpen(false);
      else close();
    };
    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("keydown", onEscape);
    };
  }, [close]);

  // Captions track on or off ----------------------------------------------------------------
  useEffect(() => {
    const el = v();
    if (!el) return;
    for (const t of Array.from(el.textTracks)) t.mode = captions ? "showing" : "disabled";
  }, [captions, ready]);

  // Video events ----------------------------------------------------------------------------
  useEffect(() => {
    const el = v();
    if (!el) return;
    const on = <K extends keyof HTMLMediaElementEventMap>(
      type: K,
      fn: (e: HTMLMediaElementEventMap[K]) => void,
    ) => {
      el.addEventListener(type, fn);
      return () => {
        el.removeEventListener(type, fn);
      };
    };
    const syncBuffered = () => {
      const d = el.duration;
      if (!Number.isFinite(d) || d <= 0 || el.buffered.length === 0) return;
      let end = 0;
      for (let i = 0; i < el.buffered.length; i++) {
        if (el.buffered.start(i) <= el.currentTime + 0.25) end = Math.max(end, el.buffered.end(i));
      }
      setBuffered(end / d);
    };
    const offs = [
      on("play", () => {
        setPlaying(true);
        setEnded(false);
      }),
      on("pause", () => {
        setPlaying(false);
      }),
      on("playing", () => {
        setBusy(false);
      }),
      on("canplay", () => {
        setBusy(false);
      }),
      on("waiting", () => {
        setBusy(true);
      }),
      on("seeking", () => {
        setBusy(true);
      }),
      on("seeked", () => {
        setBusy(false);
      }),
      on("durationchange", () => {
        setDuration(Number.isFinite(el.duration) ? el.duration : 0);
      }),
      on("loadedmetadata", () => {
        setDuration(Number.isFinite(el.duration) ? el.duration : 0);
      }),
      on("timeupdate", () => {
        setTime(el.currentTime);
        syncBuffered();
      }),
      on("progress", syncBuffered),
      on("ended", () => {
        setEnded(true);
        setPlaying(false);
        setControls(true);
      }),
    ];
    return () => {
      offs.forEach((off) => {
        off();
      });
    };
  }, []);

  useEffect(() => {
    const el = v();
    if (!el) return;
    el.volume = volume;
    el.muted = muted;
    writeSaved({ volume, muted });
  }, [volume, muted]);

  useEffect(() => {
    const el = v();
    if (el) el.playbackRate = rate;
  }, [rate]);

  // Actions ---------------------------------------------------------------------------------
  const toggle = useCallback((withFlash = true) => {
    const el = v();
    if (!el) return;
    if (el.ended) el.currentTime = 0;
    if (el.paused) {
      void el.play().catch(() => undefined);
      if (withFlash) setFlash({ id: Math.random(), icon: "play" });
    } else {
      el.pause();
      if (withFlash) setFlash({ id: Math.random(), icon: "pause" });
    }
    audio.blip("hover");
  }, []);

  const seekBy = useCallback((seconds: number) => {
    const el = v();
    if (!el || !Number.isFinite(el.duration)) return;
    el.currentTime = Math.min(el.duration, Math.max(0, el.currentTime + seconds));
    setTime(el.currentTime);
  }, []);

  const seekTo = useCallback((fraction: number) => {
    const el = v();
    if (!el || !Number.isFinite(el.duration)) return;
    el.currentTime = fraction * el.duration;
    setTime(el.currentTime);
  }, []);

  const changeVolume = useCallback((next: number) => {
    const clamped = Math.min(1, Math.max(0, next));
    setVolume(clamped);
    setMuted(clamped === 0);
  }, []);

  // Controls hide while playing and the pointer rests ----------------------------------------
  const scheduleHide = useCallback(() => {
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      const el = v();
      if (el && !el.paused && !speedOpen) setControls(false);
    }, 2600);
  }, [speedOpen]);

  const wake = useCallback(() => {
    setControls(true);
    scheduleHide();
  }, [scheduleHide]);

  useEffect(() => {
    if (playing) scheduleHide();
    return () => {
      window.clearTimeout(hideTimer.current);
    };
  }, [playing, scheduleHide]);

  // Cursor ----------------------------------------------------------------------------------
  const pickShape = useCallback(
    (target: EventTarget | null, x: number, y: number) => {
      const el = target instanceof Element ? target : null;
      const zoneEl = el?.closest("[data-zone]");
      const zone = (zoneEl?.getAttribute("data-zone") ?? "stage") as
        "controls" | "timeline" | "button" | "stage";
      const leave = inLeaveZone(x, y, window.innerWidth, window.innerHeight);
      setShape(cursorShape({ zone, leave, playing, busy: busy && !playing }));
    },
    [busy, playing],
  );

  useEffect(() => {
    const p = pointer.current;
    const tick = () => {
      p.sx += (p.x - p.sx) * 0.24;
      p.sy += (p.y - p.sy) * 0.24;
      const c = cursorRef.current;
      if (c) c.style.transform = `translate3d(${p.sx.toFixed(1)}px, ${p.sy.toFixed(1)}px, 0)`;
      p.raf = requestAnimationFrame(tick);
    };
    p.raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(p.raf);
    };
  }, []);

  const onPointerMove = (e: ReactPointerEvent) => {
    if (e.pointerType === "touch") return;
    const p = pointer.current;
    if (!p.inside) {
      p.sx = e.clientX;
      p.sy = e.clientY;
      p.inside = true;
      setCursorOn(true);
    }
    p.x = e.clientX;
    p.y = e.clientY;
    pickShape(e.target, e.clientX, e.clientY);
    wake();
  };

  const onStageClick = (e: React.MouseEvent) => {
    if (inLeaveZone(e.clientX, e.clientY, window.innerWidth, window.innerHeight)) {
      close();
      return;
    }
    toggle();
    wake();
  };

  // Timeline --------------------------------------------------------------------------------
  const fractionFromEvent = (e: { clientX: number }) => {
    const r = trackRef.current?.getBoundingClientRect();
    return r ? fractionAt(e.clientX, r.left, r.width) : 0;
  };

  const onTrackDown = (e: ReactPointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setScrubbing(true);
    seekTo(fractionFromEvent(e));
  };
  const onTrackMove = (e: ReactPointerEvent) => {
    const f = fractionFromEvent(e);
    setHoverFraction(f);
    if (scrubbing) seekTo(f);
  };
  const onTrackUp = (e: ReactPointerEvent) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
    setScrubbing(false);
  };

  // Keyboard --------------------------------------------------------------------------------
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const onControl = target.matches("button, [role='slider'], input");
    switch (e.key) {
      case " ":
      case "k":
        if (target.matches("button")) return;
        e.preventDefault();
        toggle();
        break;
      case "ArrowLeft":
        if (target.getAttribute("role") === "slider" && onControl) break;
        e.preventDefault();
        seekBy(-5);
        break;
      case "ArrowRight":
        e.preventDefault();
        seekBy(5);
        break;
      case "j":
        seekBy(-10);
        break;
      case "l":
        seekBy(10);
        break;
      case "ArrowUp":
        e.preventDefault();
        changeVolume(volume + 0.05);
        break;
      case "ArrowDown":
        e.preventDefault();
        changeVolume(volume - 0.05);
        break;
      case "m":
        setMuted((m) => !m);
        break;
      case "c":
        if (video.captions) setCaptions((c) => !c);
        break;
      case "Home":
        if (!onControl) seekTo(0);
        break;
      case "End":
        if (!onControl) seekTo(0.999);
        break;
      case "Tab": {
        // Keep focus inside the player.
        const focusable = Array.from(
          rootRef.current?.querySelectorAll<HTMLElement>(
            "button:not([disabled]), [tabindex='0']",
          ) ?? [],
        );
        if (focusable.length === 0) return;
        const first = focusable[0]!;
        const last = focusable[focusable.length - 1]!;
        if (
          e.shiftKey &&
          (document.activeElement === first || document.activeElement === rootRef.current)
        ) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
        return;
      }
      default:
        if (/^[0-9]$/.test(e.key) && !onControl) seekTo(Number(e.key) / 10);
        return;
    }
    wake();
  };

  const progress = duration > 0 ? time / duration : 0;
  const previewTime = hoverFraction === null ? 0 : hoverFraction * duration;
  const label =
    shape === "play"
      ? ended
        ? "Replay"
        : "Play"
      : shape === "pause"
        ? "Pause"
        : shape === "leave"
          ? "Leave"
          : shape === "busy"
            ? "Wait"
            : shape === "scrub"
              ? formatTime(previewTime)
              : "";

  return (
    <div
      ref={rootRef}
      className={styles.root}
      role="dialog"
      aria-modal="true"
      aria-label={video.title}
      tabIndex={-1}
      data-playing={playing}
      data-controls={controls || !playing || !ready}
      data-ready={ready}
      data-busy={busy}
      data-shape={shape}
      onKeyDown={onKeyDown}
      onPointerMove={onPointerMove}
      onPointerLeave={() => {
        pointer.current.inside = false;
        setCursorOn(false);
        setShape("dot");
      }}
    >
      <div ref={frameRef} className={styles.frame}>
        {/* The stage: the video and the whole area around it. A click here plays, pauses or leaves. */}
        <div className={styles.stage} onClick={onStageClick} data-zone="stage">
          <video
            ref={videoRef}
            className={styles.video}
            src={asset(video.src)}
            poster={asset(video.poster)}
            playsInline
            preload="auto"
          >
            {video.captions ? (
              <track kind="captions" src={asset(video.captions)} srcLang="en" label="English" />
            ) : null}
          </video>
        </div>
        <div className={styles.scrim} aria-hidden="true" />
      </div>

      {/* Big feedback pulse for play and pause. */}
      {flash ? (
        <span key={flash.id} className={styles.flash} aria-hidden="true">
          <Icon name={flash.icon} />
        </span>
      ) : null}

      {/* Loading state: a plate that draws itself while the video buffers. */}
      <div className={styles.loader} data-on={busy && ready} aria-hidden="true">
        <svg viewBox="0 0 80 80" width="80" height="80">
          <path className={styles.loaderOuter} d="M40 6 L70 23 L70 57 L40 74 L10 57 L10 23 Z" />
          <path className={styles.loaderInner} d="M40 22 L56 31 L56 49 L40 58 L24 49 L24 31 Z" />
        </svg>
        <span>Loading</span>
      </div>

      {ended ? (
        <button
          type="button"
          className={styles.replay}
          onClick={() => {
            toggle(false);
          }}
          data-zone="button"
        >
          <Icon name="replay" />
          <span>Replay</span>
        </button>
      ) : null}

      <div className={styles.top} data-zone="controls">
        <p className={styles.title}>{video.title}</p>
        <button
          type="button"
          className={styles.iconButton}
          onClick={close}
          aria-label="Close video"
          data-zone="button"
        >
          <Icon name="close" />
        </button>
      </div>

      <div className={styles.bar} data-zone="controls">
        <div
          ref={trackRef}
          className={styles.timeline}
          data-zone="timeline"
          data-scrubbing={scrubbing}
          role="slider"
          tabIndex={0}
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(time)}
          aria-valuetext={`${formatTime(time)} of ${formatTime(duration)}`}
          onPointerDown={onTrackDown}
          onPointerMove={onTrackMove}
          onPointerUp={onTrackUp}
          onPointerCancel={onTrackUp}
          onPointerLeave={() => {
            if (!scrubbing) setHoverFraction(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") {
              e.preventDefault();
              e.stopPropagation();
              seekBy(-5);
            } else if (e.key === "ArrowRight") {
              e.preventDefault();
              e.stopPropagation();
              seekBy(5);
            }
          }}
        >
          <span className={styles.trackBase} />
          <span className={styles.trackBuffered} style={{ transform: `scaleX(${buffered})` }} />
          <span className={styles.trackFill} style={{ transform: `scaleX(${progress})` }} />
          <span className={styles.thumb} style={{ left: `${progress * 100}%` }} />
          {hoverFraction !== null ? (
            <span className={styles.preview} style={{ left: `${hoverFraction * 100}%` }}>
              {formatTime(previewTime)}
            </span>
          ) : null}
        </div>

        <div className={styles.row}>
          <div className={styles.group}>
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => {
                toggle(false);
              }}
              aria-label={playing ? "Pause" : "Play"}
              data-zone="button"
            >
              <Icon name={playing ? "pause" : "play"} />
            </button>
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => {
                seekBy(-10);
              }}
              aria-label="Back 10 seconds"
              data-zone="button"
            >
              <Icon name="back" />
            </button>
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => {
                seekBy(10);
              }}
              aria-label="Forward 10 seconds"
              data-zone="button"
            >
              <Icon name="forward" />
            </button>
            <div className={styles.volume} data-zone="button">
              <button
                type="button"
                className={styles.iconButton}
                onClick={() => {
                  setMuted((m) => !m);
                }}
                aria-label={muted || volume === 0 ? "Unmute" : "Mute"}
                aria-pressed={muted || volume === 0}
              >
                <Icon name={muted || volume === 0 ? "mute" : "volume"} />
              </button>
              <input
                className={styles.volumeRange}
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={muted ? 0 : volume}
                aria-label="Volume"
                onChange={(e) => {
                  changeVolume(Number(e.target.value));
                }}
                style={{ ["--v" as string]: `${(muted ? 0 : volume) * 100}%` }}
              />
            </div>
            <span className={styles.time} aria-hidden="true">
              {formatTime(time)} <i>/</i> {formatTime(duration)}
            </span>
          </div>
          <div className={styles.group}>
            <div className={styles.speed} data-zone="button">
              <button
                type="button"
                className={styles.textButton}
                aria-haspopup="true"
                aria-expanded={speedOpen}
                onClick={() => {
                  setSpeedOpen((o) => !o);
                }}
              >
                {rate}x
              </button>
              {speedOpen ? (
                <ul className={styles.speedMenu} aria-label="Speed">
                  {RATES.map((r) => (
                    <li key={r}>
                      <button
                        type="button"
                        aria-pressed={r === rate}
                        onClick={() => {
                          setRate(r);
                          setSpeedOpen(false);
                        }}
                      >
                        {r}x
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            {video.captions ? (
              <button
                type="button"
                className={styles.iconButton}
                aria-pressed={captions}
                aria-label="Captions"
                onClick={() => {
                  setCaptions((c) => !c);
                }}
                data-zone="button"
              >
                <Icon name="cc" />
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div
        ref={cursorRef}
        className={styles.cursor}
        data-shape={shape}
        data-on={cursorOn}
        aria-hidden="true"
      >
        <span className={styles.blob}>
          <span className={styles.glyph} data-for="play">
            <Icon name="play" />
          </span>
          <span className={styles.glyph} data-for="pause">
            <Icon name="pause" />
          </span>
          <span className={styles.glyph} data-for="leave">
            <Icon name="close" />
          </span>
          <span className={styles.glyph} data-for="busy">
            <span className={styles.dots}>
              <i />
              <i />
              <i />
            </span>
          </span>
        </span>
        <span className={styles.label}>{label}</span>
      </div>
    </div>
  );
}
