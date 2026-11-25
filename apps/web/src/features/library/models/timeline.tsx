"use client";

import { useCallback, useEffect, useRef, type KeyboardEvent, type PointerEvent } from "react";

import type { ClipView } from "./behaviours";
import { nearestKey, seconds } from "./logic";
import styles from "./models.module.css";
import type { TickSink } from "./use-stage";

interface TimelineProps {
  view: ClipView;
  /** The stage writes the time here every frame. */
  tickRef: TickSink;
  onPlay: (playing: boolean) => void;
  onSeek: (time: number) => void;
  onStep: (direction: 1 | -1) => void;
}

const pad3 = (n: number) => String(n).padStart(3, "0");

/**
 * The clip's timeline, as in a 3D program: a tick for every key the clip has, a playhead that
 * follows the clip, the key and the time. Drag the playhead (or anywhere on the track) to scrub, use
 * the wheel over it or the arrow keys to step key by key. Space plays and pauses anywhere in the
 * room. The playhead and the readouts are written by the stage every frame, not by React.
 */
export function Timeline({ view, tickRef, onPlay, onSeek, onStep }: TimelineProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLSpanElement>(null);
  const fillRef = useRef<HTMLSpanElement>(null);
  const keyRef = useRef<HTMLSpanElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const scrub = useRef<{ resume: boolean } | null>(null);
  const keys = view.keys;
  const duration = view.duration;
  const locked = view.changing;
  const lastKey = useRef(-1);

  const paint = useCallback(
    (time: number, length: number) => {
      const track = trackRef.current;
      if (!track) return;
      const f = length > 0 ? Math.min(1, Math.max(0, time / length)) : 0;
      const w = track.clientWidth;
      if (headRef.current) headRef.current.style.transform = `translateX(${(f * w).toFixed(2)}px)`;
      if (fillRef.current) fillRef.current.style.transform = `scaleX(${f.toFixed(4)})`;
      const k = nearestKey(keys, time);
      if (k !== lastKey.current) {
        lastKey.current = k;
        if (keyRef.current) keyRef.current.textContent = pad3(k + 1);
        track.setAttribute("aria-valuenow", String(k));
        track.setAttribute("aria-valuetext", `Key ${k + 1} of ${keys.length}, ${seconds(time)}`);
      }
      if (timeRef.current) timeRef.current.textContent = seconds(time);
    },
    [keys],
  );

  useEffect(() => {
    lastKey.current = -1;
    tickRef.current = paint;
    return () => {
      if (tickRef.current === paint) tickRef.current = null;
    };
  }, [paint, tickRef]);

  const timeAt = (clientX: number): number => {
    const track = trackRef.current;
    if (!track || duration <= 0) return 0;
    const r = track.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (clientX - r.left) / Math.max(1, r.width)));
    // The playhead lands on a key, as in a 3D program.
    return keys.length > 0 ? (keys[nearestKey(keys, f * duration)] ?? 0) : f * duration;
  };

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (locked || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    scrub.current = { resume: view.playing };
    onPlay(false);
    onSeek(timeAt(e.clientX));
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!scrub.current) return;
    onSeek(timeAt(e.clientX));
  };
  const onUp = () => {
    const s = scrub.current;
    scrub.current = null;
    if (s?.resume) onPlay(true);
  };

  // The wheel over the track steps key by key (and pauses), as the owner asked to scroll through them.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let acc = 0;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (locked) return;
      acc += Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      while (Math.abs(acc) >= 40) {
        onStep(acc > 0 ? 1 : -1);
        acc -= Math.sign(acc) * 40;
      }
    };
    track.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      track.removeEventListener("wheel", onWheel);
    };
  }, [locked, onStep]);

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (locked) return;
    let handled = true;
    switch (e.key) {
      case "ArrowLeft":
      case "ArrowDown":
        onStep(-1);
        break;
      case "ArrowRight":
      case "ArrowUp":
        onStep(1);
        break;
      case "Home":
        onPlay(false);
        onSeek(0);
        break;
      case "End":
        onPlay(false);
        onSeek(keys[keys.length - 1] ?? duration);
        break;
      default:
        handled = false;
    }
    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  // The ticks: one a key, as thin lines. Long clips draw every other one so they stay readable.
  const every = keys.length > 240 ? Math.ceil(keys.length / 240) : 1;
  const ticks = duration > 0 ? keys.filter((_, i) => i % every === 0) : [];

  return (
    <div className={styles.timeline} data-models-timeline="" data-locked={locked ? "" : undefined}>
      <button
        type="button"
        className={styles.play}
        aria-label={view.playing ? "Pause" : "Play"}
        aria-keyshortcuts="Space"
        disabled={locked}
        data-model-play={view.playing ? "playing" : "paused"}
        onClick={() => {
          onPlay(!view.playing);
        }}
      >
        {view.playing ? (
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <path d="M4.5 3h2.4v10H4.5zM9.1 3h2.4v10H9.1z" fill="currentColor" />
          </svg>
        ) : (
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <path d="M5 3l8 5-8 5z" fill="currentColor" />
          </svg>
        )}
      </button>
      <span className={`${styles.readout} hud-label`} aria-hidden="true">
        <span ref={keyRef}>001</span>
        <span className={styles.of}> / {pad3(Math.max(1, keys.length))}</span>
      </span>
      <div
        ref={trackRef}
        className={styles.track}
        role="slider"
        tabIndex={locked ? -1 : 0}
        aria-label="Timeline"
        aria-valuemin={0}
        aria-valuemax={Math.max(0, keys.length - 1)}
        aria-valuenow={0}
        aria-disabled={locked || undefined}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onKeyDown={onKey}
      >
        <svg
          className={styles.ticks}
          aria-hidden="true"
          preserveAspectRatio="none"
          viewBox="0 0 1000 10"
        >
          {ticks.map((t, i) => (
            <line
              key={i}
              x1={(t / duration) * 1000}
              x2={(t / duration) * 1000}
              y1={i % 5 === 0 ? 0 : 4}
              y2={10}
            />
          ))}
        </svg>
        <span className={styles.fill} ref={fillRef} aria-hidden="true" />
        <span className={styles.head} ref={headRef} aria-hidden="true" />
      </div>
      <span className={`${styles.readout} hud-label`} aria-hidden="true">
        <span ref={timeRef}>0.00 s</span>
        <span className={styles.of}> / {seconds(duration)}</span>
      </span>
    </div>
  );
}
