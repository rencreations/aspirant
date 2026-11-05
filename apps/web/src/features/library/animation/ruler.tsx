"use client";

import { useEffect, useRef, type CSSProperties } from "react";

import styles from "./ruler.module.css";

interface Props {
  /** Changes when a new clip starts, so the playhead starts again. Null: nothing plays. */
  clipKey: string | null;
  /** Length of the clip in milliseconds, or null when it is not known. */
  durMs: number | null;
  /** The clip repeats (the idle loop, a pose loop). */
  loop: boolean;
  /** Where in the clip it is now, read when the clip starts (the idle loop is already running). */
  offsetMs?: () => number;
}

/** A tick every this many seconds, so the ruler never gets crowded. */
function stepFor(seconds: number): number {
  if (seconds <= 12) return 1;
  if (seconds <= 24) return 2;
  return 5;
}

/**
 * The ruler under the stage: ticks for the seconds of the clip and a playhead that crosses them. The
 * playhead is one Web Animation of `transform`, started when the clip starts and run by the
 * compositor, so the page never reads the video's clock to move it.
 */
export function Ruler({ clipKey, durMs, loop, offsetMs }: Props) {
  const head = useRef<HTMLSpanElement>(null);
  const offset = useRef(offsetMs);
  useEffect(() => {
    offset.current = offsetMs;
  }, [offsetMs]);

  useEffect(() => {
    const el = head.current;
    if (!el || clipKey === null || durMs === null || durMs <= 0) return;
    const animation = el.animate(
      [{ transform: "translateX(-100%)" }, { transform: "translateX(0%)" }],
      { duration: durMs, iterations: loop ? Infinity : 1, easing: "linear", fill: "both" },
    );
    const from = offset.current?.() ?? 0;
    if (from > 0) animation.currentTime = from % durMs;
    return () => {
      animation.cancel();
    };
  }, [clipKey, durMs, loop]);

  const seconds = durMs === null ? 0 : durMs / 1000;
  const step = stepFor(seconds);
  const marks =
    seconds > 0 ? Array.from({ length: Math.floor(seconds / step) + 1 }, (_, i) => i * step) : [];

  return (
    <div
      className={styles.ruler}
      aria-hidden="true"
      data-idle={clipKey === null || durMs === null}
      style={{ "--minor": Math.max(1, Math.round(seconds * 10)) } as CSSProperties}
    >
      <div className={styles.scale}>
        {marks.map((m) => (
          <span key={m} className={styles.mark} style={{ left: `${(m / seconds) * 100}%` }}>
            {m}s
          </span>
        ))}
      </div>
      <div className={styles.track}>
        <span ref={head} className={styles.head} />
      </div>
    </div>
  );
}
