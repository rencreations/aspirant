"use client";

import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from "react";

import { bufferedSpan, clock, scrubFraction, spokenTime, tipCentre } from "./film-math";
import styles from "./films.module.css";

interface TimelineProps {
  /** The film on screen, or null while it has no element. */
  video: HTMLVideoElement | null;
  /** Seconds, from the data (the element knows it once its header has arrived). */
  dur: number;
  onSeek: (seconds: number) => void;
  /** A press or drag on the line began (true) or ended (false): the controls stay shown meanwhile. */
  onScrubbing?: (on: boolean) => void;
}

/** What the pointer handlers need from the clock effect. */
interface Clock {
  length: () => number;
  /** Show `t` on the line at once (during a drag), without waiting for the film. */
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
 * The time line of full screen, a row of its own above the buttons (outside full screen the room
 * has the thin line at the foot, in `controls.tsx`): the time on the left, the length on the
 * right, and between them the line itself (the buffered part, the played part and a handle). Its
 * hit area is the line and a small margin, a little taller while the pointer is on it, and it never
 * reaches the buttons. A mouse shows the time under the pointer; a press or a drag (mouse, pen or
 * finger) moves the film there; the arrow, Page, Home and End keys too.
 *
 * Nothing runs per frame: the played part and the handle are two Web Animations whose clock is set
 * from the film's own when it plays, pauses or jumps. A drag sets them directly and asks the film
 * to seek at most once per finished seek, then once more where the press ends.
 */
export function Timeline({ video, dur, onSeek, onScrubbing }: TimelineProps) {
  const scrubRef = useRef<HTMLDivElement>(null);
  const playedRef = useRef<HTMLSpanElement>(null);
  const runRef = useRef<HTMLSpanElement>(null);
  const bufferedRef = useRef<HTMLSpanElement>(null);
  const hoverRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const nowRef = useRef<HTMLSpanElement>(null);
  const endRef = useRef<HTMLSpanElement>(null);
  const seekRef = useRef(onSeek);
  const scrubbingRef = useRef(onScrubbing);
  const clockRef = useRef<Clock | null>(null);
  const drag = useRef<Drag | null>(null);
  const pending = useRef<number | null>(null);
  const box = useRef<{ left: number; width: number } | null>(null);
  const tipWidth = useRef(0);

  useEffect(() => {
    seekRef.current = onSeek;
    scrubbingRef.current = onScrubbing;
  });

  useEffect(() => {
    const el = video;
    const scrub = scrubRef.current;
    const played = playedRef.current;
    const run = runRef.current;
    const buffered = bufferedRef.current;
    const now = nowRef.current;
    const end = endRef.current;
    if (!scrub || !played || !run || !buffered || !now || !end) return;
    const length = () =>
      el && Number.isFinite(el.duration) && el.duration > 0 ? el.duration : dur;
    const timing = () => ({ duration: Math.max(1, length() * 1000) });
    const anims = [
      played.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], {
        ...timing(),
        fill: "both",
        easing: "linear",
      }),
      run.animate([{ transform: "translateX(-100%)" }, { transform: "translateX(0%)" }], {
        ...timing(),
        fill: "both",
        easing: "linear",
      }),
    ];
    for (const a of anims) a.pause();

    let shown = -1;
    const say = (t: number) => {
      const s = Math.floor(t);
      if (s === shown) return;
      shown = s;
      now.textContent = clock(t);
      scrub.setAttribute("aria-valuenow", String(s));
      scrub.setAttribute("aria-valuetext", `${spokenTime(t)} of ${spokenTime(length())}`);
    };

    let span: [number, number] = [-1, -1];
    const drawBuffered = () => {
      const next: [number, number] = el
        ? bufferedSpan(el.buffered, el.currentTime, length())
        : [0, 0];
      if (Math.abs(next[0] - span[0]) < 0.002 && Math.abs(next[1] - span[1]) < 0.002) return;
      span = next;
      buffered.style.transform = `translateX(${(next[0] * 100).toFixed(3)}%) scaleX(${(next[1] - next[0]).toFixed(4)})`;
    };

    const sync = () => {
      drawBuffered();
      if (drag.current || !el) return;
      const t = el.currentTime;
      const running =
        !el.paused && !el.seeking && el.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA;
      for (const a of anims) {
        if (!running || Math.abs(Number(a.currentTime ?? 0) - t * 1000) > 120) {
          a.currentTime = t * 1000;
        }
        if (running) {
          a.playbackRate = el.playbackRate || 1;
          if (a.playState !== "running") a.play();
        } else if (a.playState === "running") {
          a.pause();
        }
      }
      say(t);
    };

    const onLength = () => {
      for (const a of anims) a.effect?.updateTiming(timing());
      scrub.setAttribute("aria-valuemax", String(Math.floor(length())));
      end.textContent = clock(length());
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
        for (const a of anims) {
          a.pause();
          a.currentTime = t * 1000;
        }
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
      "progress",
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
      for (const a of anims) a.cancel();
      clockRef.current = null;
      pending.current = null;
    };
  }, [video, dur]);

  // A drag that is cut short by the line leaving the page still lets the controls hide again.
  useEffect(
    () => () => {
      if (drag.current) scrubbingRef.current?.(false);
    },
    [],
  );

  const placeTip = (x: number, width: number, t: number) => {
    const tip = tipRef.current;
    const hover = hoverRef.current;
    if (hover) hover.style.transform = `scaleX(${(width > 0 ? x / width : 0).toFixed(4)})`;
    if (!tip) return;
    const text = clock(t);
    if (tip.textContent !== text) tip.textContent = text;
    if (!tipWidth.current) tipWidth.current = tip.offsetWidth;
    tip.style.transform = `translateX(${tipCentre(x, width, tipWidth.current).toFixed(1)}px) translateX(-50%)`;
  };

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
    placeTip(clientX - d.left, d.width, t);
    requestSeek(t);
  };

  const measure = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    box.current = { left: r.left, width: r.width };
    return box.current;
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if ((e.pointerType === "mouse" && e.button !== 0) || !e.isPrimary) return;
    const el = e.currentTarget;
    const { left, width } = measure(el);
    el.setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, left, width, f: 0 };
    el.dataset.scrubbing = "true";
    scrubbingRef.current?.(true);
    scrubTo(e.clientX);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current) {
      if (drag.current.id === e.pointerId) scrubTo(e.clientX);
      return;
    }
    if (e.pointerType === "touch") return;
    const c = clockRef.current;
    const b = box.current ?? measure(e.currentTarget);
    const f = scrubFraction(e.clientX, b.left, b.width);
    placeTip(e.clientX - b.left, b.width, f * (c?.length() ?? dur));
  };

  // Up, cancel or a lost capture: the press ends where it is, with one last seek.
  const finish = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (d?.id !== e.pointerId) return;
    drag.current = null;
    delete e.currentTarget.dataset.scrubbing;
    scrubbingRef.current?.(false);
    pending.current = null;
    seekRef.current(d.f * (clockRef.current?.length() ?? dur));
  };

  const onPointerEnter = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch") return;
    measure(e.currentTarget);
    e.currentTarget.dataset.hover = "true";
  };

  const onPointerLeave = (e: PointerEvent<HTMLDivElement>) => {
    delete e.currentTarget.dataset.hover;
    box.current = null;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
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

  return (
    <div className={styles.timeline} data-films-timeline="">
      <span ref={nowRef} className={styles.timeNow} aria-hidden="true">
        00:00
      </span>
      <div
        ref={scrubRef}
        className={styles.scrub}
        role="slider"
        tabIndex={0}
        aria-label="Time in the film"
        aria-valuemin={0}
        aria-valuemax={Math.floor(dur)}
        aria-valuenow={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
        onLostPointerCapture={finish}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        onKeyDown={onKeyDown}
      >
        <span className={styles.rail}>
          <span ref={bufferedRef} className={styles.buffered} />
          <span ref={hoverRef} className={styles.hovered} />
          <span ref={playedRef} className={styles.played} />
        </span>
        <span ref={runRef} className={styles.run}>
          <span className={styles.knob} data-films-knob="" />
        </span>
        <span ref={tipRef} className={styles.tip} aria-hidden="true">
          00:00
        </span>
      </div>
      <span ref={endRef} className={styles.timeEnd} aria-hidden="true">
        {clock(dur)}
      </span>
    </div>
  );
}
