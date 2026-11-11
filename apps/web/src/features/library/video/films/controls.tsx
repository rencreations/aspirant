"use client";

import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from "react";

import type { DeckView } from "./deck";
import { clock, percent, scrubFraction, spokenTime, two } from "./film-math";
import styles from "./films.module.css";
import { Timeline } from "./timeline";
import type { FilmWork } from "./types";

interface ControlsProps {
  film: FilmWork | undefined;
  index: number;
  count: number;
  view: DeckView;
  video: HTMLVideoElement | null;
  fill: boolean;
  captions: boolean;
  /** The room is full screen (or the film is, in the browser's own player). */
  fullscreen: boolean;
  /** This browser can go full screen one way or another. */
  canFullscreen: boolean;
  onStep: (dir: 1 | -1) => void;
  onPlay: () => void;
  onSound: (on: boolean) => void;
  onFill: () => void;
  onCaptions: () => void;
  onFullscreen: () => void;
  /** A press or drag on the full screen time line began or ended. */
  onScrubbing: (on: boolean) => void;
  onSeek: (seconds: number) => void;
  onRetry: () => void;
}

type IconName =
  | "up"
  | "down"
  | "list"
  | "sound"
  | "mute"
  | "fit"
  | "fill"
  | "play"
  | "pause"
  | "expand"
  | "shrink";

const PATHS: Record<IconName, string> = {
  play: "M5 3.5v9l7.5-4.5z",
  pause: "M5 3.5v9M11 3.5v9",
  up: "M4 10l4-4 4 4",
  down: "M4 6l4 4 4-4",
  list: "M3 4h10M3 8h10M3 12h6",
  sound: "M3 6h2.5L9 3v10L5.5 10H3zM11.5 5.5a3.5 3.5 0 0 1 0 5M13 3.5a6 6 0 0 1 0 9",
  mute: "M3 6h2.5L9 3v10L5.5 10H3zM11 6l4 4M15 6l-4 4",
  fit: "M2 5h12v6H2zM5 2h6M5 14h6",
  fill: "M2 2h12v12H2zM5 5h6v6H5z",
  expand: "M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4",
  shrink: "M6 2v4H2M10 2v4h4M14 10h-4v4M2 10h4v4",
};

export function Icon({ name }: { name: IconName }) {
  return (
    <svg viewBox="0 0 16 16" className={styles.icon} aria-hidden="true">
      <path
        d={PATHS[name]}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** What the pointer handlers need from the clock effect. */
interface Clock {
  length: () => number;
  /** Show `t` on the line and in the time at once (during a drag), without waiting for the film. */
  preview: (t: number) => void;
}

interface Drag {
  id: number;
  left: number;
  width: number;
  /** The share of the film under the pointer now. */
  f: number;
}

/**
 * The controls at the foot of the room, in one panel that owns its whole area: a press that misses
 * a button lands on the panel and does nothing (it never reaches the film behind and pauses it),
 * and a drag that starts there still moves the strip. The bar: play, previous, next, the counter
 * and the time on the left, the loading percentage in the middle (as the reference's loader writes
 * it), captions, the frame, full screen and the sound on the right. The Index button sits in the
 * bar's first place on a wide screen; it lives with the back button (`stage.tsx`) so a phone can
 * show it at the top.
 *
 * Under the bar, along the very foot of the screen, the time line: one thin line (in full screen
 * a plain row above the bar takes its place, `timeline.tsx`), a Web Animation
 * of `scaleX` whose clock is set from the film's own when it plays, pauses or jumps (no frame
 * loop). Press or drag on it to move in the film (one seek at a time, and one more where the press
 * ends); the arrow, Page, Home and End keys too. The bar stands clear above it, so moving from the
 * line to a button never stays on the line.
 */
export function FilmControls(props: ControlsProps) {
  const { film, index, count, view, video, fill, captions, fullscreen } = props;
  const fillRef = useRef<HTMLSpanElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const seekRef = useRef(props.onSeek);
  const clockRef = useRef<Clock | null>(null);
  const drag = useRef<Drag | null>(null);
  const pending = useRef<number | null>(null);
  const dur = film?.video.dur ?? 0;

  useEffect(() => {
    seekRef.current = props.onSeek;
  });

  useEffect(() => {
    const el = video;
    const bar = fillRef.current;
    const track = trackRef.current;
    const time = timeRef.current;
    if (!bar || !track || !time) return;
    const length = () =>
      el && Number.isFinite(el.duration) && el.duration > 0 ? el.duration : dur;
    const anim = bar.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], {
      duration: Math.max(1, length() * 1000),
      fill: "both",
      easing: "linear",
    });
    anim.pause();
    let shown = -1;
    const say = (t: number) => {
      const s = Math.floor(t);
      if (s === shown) return;
      shown = s;
      time.textContent = clock(t);
      track.setAttribute("aria-valuenow", String(s));
      track.setAttribute("aria-valuetext", `${spokenTime(t)} of ${spokenTime(length())}`);
    };
    const sync = () => {
      if (drag.current || !el) return;
      const t = el.currentTime;
      const at = Number(anim.currentTime ?? 0);
      const running =
        !el.paused && !el.seeking && el.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA;
      if (!running || Math.abs(at - t * 1000) > 120) anim.currentTime = t * 1000;
      if (running) {
        anim.playbackRate = el.playbackRate || 1;
        if (anim.playState !== "running") anim.play();
      } else if (anim.playState === "running") {
        anim.pause();
      }
      say(t);
    };
    const onLength = () => {
      anim.effect?.updateTiming({ duration: Math.max(1, length() * 1000) });
      track.setAttribute("aria-valuemax", String(Math.floor(length())));
      shown = -1;
      sync();
    };
    // A drag asks for one seek at a time: the next goes once this one has landed.
    const onSeeked = () => {
      const t = pending.current;
      if (t === null) return;
      pending.current = null;
      seekRef.current(t);
    };
    clockRef.current = {
      length,
      preview: (t) => {
        anim.pause();
        anim.currentTime = t * 1000;
        say(t);
      },
    };
    const names = [
      "play",
      "playing",
      "pause",
      "waiting",
      "seeking",
      "seeked",
      "timeupdate",
      "ratechange",
      "canplay",
    ];
    if (el) {
      for (const n of names) el.addEventListener(n, sync);
      el.addEventListener("durationchange", onLength);
      el.addEventListener("seeked", onSeeked);
    } else {
      say(0);
    }
    onLength();
    return () => {
      if (el) {
        for (const n of names) el.removeEventListener(n, sync);
        el.removeEventListener("durationchange", onLength);
        el.removeEventListener("seeked", onSeeked);
      }
      anim.cancel();
      clockRef.current = null;
      pending.current = null;
    };
  }, [video, dur]);

  const requestSeek = (t: number) => {
    if (video?.seeking) {
      pending.current = t;
      return;
    }
    pending.current = null;
    seekRef.current(t);
  };

  const scrubTo = (clientX: number) => {
    const d = drag.current;
    const c = clockRef.current;
    if (!d || !c) return;
    d.f = scrubFraction(clientX, d.left, d.width);
    const t = d.f * c.length();
    c.preview(t);
    requestSeek(t);
  };

  const onTrackDown = (e: PointerEvent<HTMLDivElement>) => {
    if ((e.pointerType === "mouse" && e.button !== 0) || !e.isPrimary) return;
    const box = e.currentTarget.getBoundingClientRect();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, left: box.left, width: box.width, f: 0 };
    scrubTo(e.clientX);
  };
  const onTrackMove = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.id === e.pointerId) scrubTo(e.clientX);
  };
  // Up, cancel or a lost capture: the press ends where it is, with one last seek.
  const onTrackEnd = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (d?.id !== e.pointerId) return;
    drag.current = null;
    pending.current = null;
    seekRef.current(d.f * (clockRef.current?.length() ?? dur));
  };
  const onTrackKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const t = video?.currentTime ?? 0;
    const length = clockRef.current?.length() ?? dur;
    const moves: Record<string, number> = {
      ArrowRight: t + 5,
      ArrowLeft: t - 5,
      ArrowUp: t + 5,
      ArrowDown: t - 5,
      PageUp: t + 30,
      PageDown: t - 30,
      Home: 0,
      End: length - 1,
    };
    const to = moves[e.key];
    if (to === undefined) return;
    e.preventDefault();
    e.stopPropagation();
    seekRef.current(Math.max(0, Math.min(length, to)));
  };

  const hasCaptions = !!film?.video.captions;
  const soundOn = view.audible;
  // The time is written by the effect above (no render per second) and is hidden from assistive
  // technology, which reads the time line instead. The middle of the bar is kept for the loading
  // percentage, so a film's own words at the foot of the picture are never covered.
  const loading =
    view.state === "failed" ? (
      "Not loaded"
    ) : view.state === "loading" ? (
      <>
        <small>Loading</small>
        {percent(view.progress)}
      </>
    ) : null;

  return (
    <>
      <div className={styles.controls} data-films-controls="">
        {/* Full screen has the plain time line: a row of its own, with the time at its ends. */}
        {fullscreen ? (
          <Timeline video={video} dur={dur} onSeek={props.onSeek} onScrubbing={props.onScrubbing} />
        ) : null}
        <div className={styles.bar}>
          <div className={styles.group} data-side="start">
            <button
              type="button"
              className={`${styles.pill} ${styles.round}`}
              aria-label={view.state === "playing" ? "Pause" : "Play"}
              onClick={props.onPlay}
            >
              <Icon name={view.state === "playing" ? "pause" : "play"} />
            </button>
            <button
              type="button"
              className={`${styles.pill} ${styles.round} ${styles.wide}`}
              aria-label="Previous film"
              onClick={() => {
                props.onStep(-1);
              }}
            >
              <Icon name="up" />
            </button>
            <button
              type="button"
              className={`${styles.pill} ${styles.round} ${styles.wide}`}
              aria-label="Next film"
              onClick={() => {
                props.onStep(1);
              }}
            >
              <Icon name="down" />
            </button>
            <span className={styles.readout}>
              <span className={styles.counter} aria-live="polite">
                <span className="sr-only">Film </span>
                {two(index + 1)} / {two(count)}
                {film ? <span className="sr-only">, {film.title}</span> : null}
              </span>
              <span className={styles.time} aria-hidden="true">
                <span ref={timeRef}>00:00</span> / {clock(dur)}
              </span>
            </span>
          </div>

          <p className={styles.status} data-state={view.state} role="status">
            {loading}
          </p>

          <div className={styles.group} data-side="end">
            {hasCaptions ? (
              <button
                type="button"
                className={styles.pill}
                aria-pressed={captions}
                onClick={props.onCaptions}
              >
                CC<span className="sr-only"> English subtitles</span>
              </button>
            ) : null}
            {/* Full screen always shows the whole frame: no switch there. */}
            {fullscreen ? null : (
              <button
                type="button"
                className={styles.pill}
                aria-pressed={!fill}
                onClick={props.onFill}
              >
                <Icon name={fill ? "fit" : "fill"} />
                <span className={styles.pillText}>Whole frame</span>
              </button>
            )}
            {props.canFullscreen ? (
              <button
                type="button"
                className={`${styles.pill} ${styles.round}`}
                aria-label="Full screen"
                aria-pressed={fullscreen}
                onClick={props.onFullscreen}
              >
                <Icon name={fullscreen ? "shrink" : "expand"} />
              </button>
            ) : null}
            <button
              type="button"
              className={styles.pill}
              aria-pressed={soundOn}
              data-hint={view.blocked ? "true" : undefined}
              onClick={() => {
                props.onSound(!soundOn);
              }}
            >
              <Icon name={soundOn ? "sound" : "mute"} />
              <span className={styles.pillText}>{soundOn ? "Sound on" : "Sound off"}</span>
            </button>
          </div>
        </div>

        <div
          ref={trackRef}
          className={styles.track}
          role="slider"
          tabIndex={0}
          aria-label="Time in the film"
          aria-valuemin={0}
          aria-valuemax={Math.floor(dur)}
          aria-valuenow={0}
          onPointerDown={onTrackDown}
          onPointerMove={onTrackMove}
          onPointerUp={onTrackEnd}
          onPointerCancel={onTrackEnd}
          onLostPointerCapture={onTrackEnd}
          onKeyDown={onTrackKey}
        >
          <span className={styles.fillWrap}>
            <span ref={fillRef} className={styles.fill} />
          </span>
        </div>
      </div>

      {view.state === "failed" ? (
        <div className={styles.notice} role="alert">
          <p>This film did not load. Check the connection and try again.</p>
          <button type="button" className={styles.pill} onClick={props.onRetry}>
            Try again
          </button>
        </div>
      ) : null}
    </>
  );
}
