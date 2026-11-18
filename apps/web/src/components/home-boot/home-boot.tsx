"use client";

import { useEffect, useRef } from "react";

import {
  bytesWords,
  phaseAtLeast,
  pickPending,
  shownPercent,
  stepShown,
  tapToContinue,
  useHomeFlow,
} from "@/lib/home-flow";

import styles from "./home-boot.module.css";

/** A new real label every this many milliseconds (the labels are the downloads that are running). */
const LABEL_EVERY_MS = 2400;

/**
 * THE SLOT for the home page's loading screen and intro. This file is the skeleton's placeholder:
 * the drone loader replaces what it draws and keeps the contract below. The host is
 * `components/loader-gate.tsx`, which owns everything that must not depend on this file: it runs
 * the preload and shows the real progress here, makes the page behind it inert, holds the scroll,
 * claims the page router, listens for the press (any click or tap, Enter, Space), sets `entered`
 * at the end and opens the page. It renders this component from the first frame of a home arrival
 * until the phase is `open`, outside `#site-shell`, at `--z-transition` (90, above the page, under
 * the lantern cursor). If this component throws, the host opens the page at once.
 *
 * The contract (phases are in `lib/home-flow.ts`):
 *  - The root element carries `data-home-boot` and `data-phase` (the probes read them).
 *  - `cover`: the plain cover of the boot script is still up over this. Draw the loading screen and,
 *    once its first frame has been painted, call `useHomeFlow.getState().advance("boot")`. The cover
 *    goes then, never on a timer.
 *  - `boot`: show the real progress. Read `useHomeFlow.getState().progress` in your own frame loop
 *    (it is a plain object, updated about ten times a second); the number you show lags it and never
 *    leads it (`stepShown`, `shownPercent`), and 100 is shown only from `tap` on. Cycle the labels of
 *    the running downloads (`pickPending`), they are real. Do not add a timer that moves the bar.
 *  - `tap`: everything is in. Show a focusable control named "Touch anywhere to continue" whose
 *    click calls `tapToContinue()` (it unlocks the sound inside the press). The host also answers
 *    a click or tap anywhere and Enter and Space, so the control is for the screen reader and the
 *    keyboard as much as for the eye.
 *  - `intro`: play the intro (the carried logo). The scroll is held. Call
 *    `useHomeFlow.getState().finishIntro()` once, when it ends. It cannot be skipped.
 *  - The slow-connection and offline notes are drawn by the host (a fixed paragraph at the bottom,
 *    `z-index: 2000`); `useHomeFlow.getState().notes` has the same facts for your own copy.
 */
export function HomeBoot() {
  const phase = useHomeFlow((s) => s.phase);
  const barRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLSpanElement>(null);
  const percentRef = useRef<HTMLSpanElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const bytesRef = useRef<HTMLParagraphElement>(null);
  const tapRef = useRef<HTMLButtonElement>(null);

  // `cover` to `boot`: once a frame of this screen has been painted, the plain cover can go.
  useEffect(() => {
    let first = 0;
    let second = 0;
    first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        useHomeFlow.getState().advance("boot");
      });
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, []);

  // The shown progress: written straight into the elements, not through state.
  useEffect(() => {
    let raf = 0;
    let shown = 0;
    let shownPct = -1;
    let label = "";
    let bytes = "";
    const t0 = performance.now();
    let last = t0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.25, (now - last) / 1000);
      last = now;
      const s = useHomeFlow.getState();
      const real = s.progress?.progress ?? 0;
      const done = phaseAtLeast(s.phase, "tap");
      shown = done ? 1 : stepShown(shown, real, dt);
      const pct = shownPercent(shown, real, done);
      if (fillRef.current) fillRef.current.style.transform = `scaleX(${shown.toFixed(4)})`;
      if (pct !== shownPct) {
        shownPct = pct;
        if (percentRef.current) percentRef.current.textContent = `${pct}%`;
        barRef.current?.setAttribute("aria-valuenow", String(pct));
      }
      const nextLabel = done
        ? "Ready"
        : pickPending(
            s.progress?.pending ?? [],
            s.progress?.label ?? "Loading the site",
            Math.floor((now - t0) / LABEL_EVERY_MS),
          );
      if (nextLabel !== label) {
        label = nextLabel;
        if (labelRef.current) labelRef.current.textContent = label;
      }
      const nextBytes = bytesWords(s.progress?.bytes);
      if (nextBytes !== bytes) {
        bytes = nextBytes;
        if (bytesRef.current) bytesRef.current.textContent = bytes;
      }
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
    };
  }, []);

  // The tap gate takes the focus, so Enter and Space work without a Tab.
  useEffect(() => {
    if (phase === "tap") tapRef.current?.focus({ preventScroll: true });
  }, [phase]);

  // The skeleton has no intro: it ends at once. The drone loader plays the real one here.
  useEffect(() => {
    if (phase === "intro") useHomeFlow.getState().finishIntro();
  }, [phase]);

  return (
    <div className={styles.root} data-home-boot data-phase={phase}>
      <div className={styles.inner}>
        <p className={styles.mark} aria-hidden="true">
          The Aspirants
        </p>
        <div
          ref={barRef}
          className={styles.bar}
          role="progressbar"
          aria-label="Loading the site"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={0}
        >
          <span ref={fillRef} className={styles.fill} />
        </div>
        <p className={styles.line} aria-hidden="true">
          <span ref={percentRef} className={styles.percent}>
            0%
          </span>
          <span ref={labelRef}>Loading the site</span>
        </p>
        <p ref={bytesRef} className={styles.bytes} aria-hidden="true" />
      </div>
      {phase === "tap" ? (
        <button ref={tapRef} type="button" className={styles.tap} onClick={tapToContinue}>
          <span className={styles.tapText}>Touch anywhere to continue</span>
        </button>
      ) : null}
    </div>
  );
}
