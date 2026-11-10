"use client";

import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from "react";

import type { DeckView } from "./deck";
import { clock, percent, spokenTime, two } from "./film-math";
import styles from "./films.module.css";
import type { FilmWork } from "./types";

interface ControlsProps {
  film: FilmWork | undefined;
  index: number;
  count: number;
  view: DeckView;
  video: HTMLVideoElement | null;
  fill: boolean;
  captions: boolean;
  onContents: () => void;
  onStep: (dir: 1 | -1) => void;
  onPlay: () => void;
  onSound: (on: boolean) => void;
  onFill: () => void;
  onCaptions: () => void;
  onSeek: (seconds: number) => void;
  onRetry: () => void;
}

function Icon({
  name,
}: {
  name: "up" | "down" | "list" | "sound" | "mute" | "fit" | "fill" | "play" | "pause";
}) {
  const paths: Record<typeof name, string> = {
    play: "M5 3.5v9l7.5-4.5z",
    pause: "M5 3.5v9M11 3.5v9",
    up: "M4 10l4-4 4 4",
    down: "M4 6l4 4 4-4",
    list: "M3 4h10M3 8h10M3 12h6",
    sound: "M3 6h2.5L9 3v10L5.5 10H3zM11.5 5.5a3.5 3.5 0 0 1 0 5M13 3.5a6 6 0 0 1 0 9",
    mute: "M3 6h2.5L9 3v10L5.5 10H3zM11 6l4 4M15 6l-4 4",
    fit: "M2 5h12v6H2zM5 2h6M5 14h6",
    fill: "M2 2h12v12H2zM5 5h6v6H5z",
  };
  return (
    <svg viewBox="0 0 16 16" className={styles.icon} aria-hidden="true">
      <path
        d={paths[name]}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * The bar at the foot of the room: the contents and the counter on the left, the time (or the
 * loading percentage, as the reference's loader writes it) in the middle, captions, the frame and
 * the sound on the right. Under it, the time line: a Web Animation of `scaleX` whose clock is set
 * from the film's own when it plays, pauses or jumps (no frame loop). Press or drag it to move.
 */
export function FilmControls(props: ControlsProps) {
  const { film, index, count, view, video, fill, captions } = props;
  const fillRef = useRef<HTMLSpanElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const dur = film?.video.dur ?? 0;
  const onSeek = props.onSeek;

  useEffect(() => {
    const el = video;
    const bar = fillRef.current;
    const track = trackRef.current;
    if (!el || !bar || !track) return;
    const length = () => (Number.isFinite(el.duration) && el.duration > 0 ? el.duration : dur);
    const anim = bar.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], {
      duration: Math.max(1, length() * 1000),
      fill: "both",
      easing: "linear",
    });
    anim.pause();
    let shown = -1;
    const sync = () => {
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
      const s = Math.floor(t);
      if (s !== shown) {
        shown = s;
        if (timeRef.current) timeRef.current.textContent = clock(t);
        track.setAttribute("aria-valuenow", String(s));
        track.setAttribute("aria-valuetext", `${spokenTime(t)} of ${spokenTime(length())}`);
      }
    };
    const onLength = () => {
      anim.effect?.updateTiming({ duration: Math.max(1, length() * 1000) });
      track.setAttribute("aria-valuemax", String(Math.floor(length())));
      sync();
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
    for (const n of names) el.addEventListener(n, sync);
    el.addEventListener("durationchange", onLength);
    onLength();
    return () => {
      for (const n of names) el.removeEventListener(n, sync);
      el.removeEventListener("durationchange", onLength);
      anim.cancel();
    };
  }, [video, dur]);

  const seekAt = (clientX: number) => {
    const track = trackRef.current;
    if (!track || !dur) return;
    const box = track.getBoundingClientRect();
    const f = Math.max(0, Math.min(1, (clientX - box.left) / Math.max(1, box.width)));
    onSeek(f * dur);
  };

  const onTrackDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    seekAt(e.clientX);
  };
  const onTrackMove = (e: PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) seekAt(e.clientX);
  };
  const onTrackKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const t = video?.currentTime ?? 0;
    const moves: Record<string, number> = {
      ArrowRight: t + 5,
      ArrowLeft: t - 5,
      ArrowUp: t + 5,
      ArrowDown: t - 5,
      PageUp: t + 30,
      PageDown: t - 30,
      Home: 0,
      End: dur - 1,
    };
    const to = moves[e.key];
    if (to === undefined) return;
    e.preventDefault();
    e.stopPropagation();
    onSeek(Math.max(0, Math.min(dur, to)));
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
      <div className={styles.bar}>
        <div className={styles.group} data-side="start">
          <button
            type="button"
            className={styles.pill}
            onClick={props.onContents}
            aria-haspopup="dialog"
          >
            <Icon name="list" />
            <span className={styles.pillText}>Index</span>
          </button>
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
              {view.state === "paused" ? <small>Paused </small> : null}
              <span ref={timeRef} /> / {clock(dur)}
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
          <button type="button" className={styles.pill} aria-pressed={!fill} onClick={props.onFill}>
            <Icon name={fill ? "fit" : "fill"} />
            <span className={styles.pillText}>Whole frame</span>
          </button>
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

      {view.state === "failed" ? (
        <div className={styles.notice} role="alert">
          <p>This film did not load. Check the connection and try again.</p>
          <button type="button" className={styles.pill} onClick={props.onRetry}>
            Try again
          </button>
        </div>
      ) : null}

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
        onKeyDown={onTrackKey}
      >
        <span className={styles.fillWrap}>
          <span ref={fillRef} className={styles.fill} />
        </span>
      </div>
    </>
  );
}
