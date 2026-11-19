"use client";

import { useEffect, useRef, useState } from "react";

import { bootBus } from "@/features/home/boot/bus";
import { TAP_WORDS, companyLine, groupStates, type GroupState } from "@/features/home/boot/copy";
import { dropStage } from "@/features/home/boot/lift";
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
/** The quarters of the bar that carry a notch. */
const NOTCHES = [25, 50, 75] as const;

/**
 * THE LOADING SCREEN AND THE TAP GATE of the home page's opening. The drone, the pair and
 * the logo are not here: they are drawn on the home's one canvas (`features/home/boot/runtime.ts`,
 * lifted above this screen's ground while the opening runs), and this component shares only
 * `features/home/boot/bus.ts` with them. The host is `components/loader-gate.tsx`, which owns
 * everything that must not depend on how this looks: it runs the preload and reports the real
 * progress, makes the page behind inert, holds the scroll, claims the page router, listens for the
 * press (any click or tap, Enter, Space), sets `entered` at the end and opens the page. It renders
 * this component from the first frame of a home arrival until the phase is `open`, outside
 * `#site-shell`, at `--z-transition`. If this throws, the host opens the page at once.
 *
 * The contract (phases are in `lib/home-flow.ts`):
 *  - The root carries `data-home-boot` and `data-phase` (the probes read them).
 *  - `cover`: the plain cover of the boot script is still up over this. Once a frame of this screen
 *    has been painted, `advance("boot")` lets it go (never on a timer).
 *  - `boot`: the real progress. Read in this file's own frame loop; the number lags the truth and
 *    never leads it (`stepShown`, `shownPercent`), and 100 is written only from `tap`. The labels
 *    are the real running downloads. Groups (the drone, the art, 3D, films) tick off when none of
 *    their downloads is left. Lines of company rotate while the wait is long and never claim a state.
 *  - `tap`: everything is in: "Touch anywhere to continue" (a real button; the host also answers any
 *    press away from the drone, Enter and Space).
 *  - `intro`: the canvas plays the intro; this shows nothing. If no scene owns
 *    the intro (no WebGL, a failure) it ends at once, so the plain page follows the tap.
 */
export function HomeBoot() {
  const phase = useHomeFlow((s) => s.phase);
  const rootRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLSpanElement>(null);
  const percentRef = useRef<HTMLSpanElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const bytesRef = useRef<HTMLParagraphElement>(null);
  const companyRef = useRef<HTMLParagraphElement>(null);
  const notchRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const tapRef = useRef<HTMLButtonElement>(null);
  const [groups, setGroups] = useState<GroupState[]>([]);

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

  // The shown progress and the words: written straight into the elements, not through state.
  useEffect(() => {
    let raf = 0;
    let shown = 0;
    let shownPct = -1;
    let label = "";
    let bytes = "";
    let company = "";
    let allLabels: string[] | null = null;
    let groupKey = "";
    let groupAt = 0;
    let droneSeen = false;
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
        NOTCHES.forEach((n, i) => {
          const el = notchRefs.current[i];
          if (!el) return;
          const hit = pct >= n ? "1" : "0";
          if (el.dataset.hit !== hit) el.dataset.hit = hit;
        });
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
      const nextCompany = companyLine({
        elapsed: (now - t0) / 1000,
        progress: real,
        offline: s.notes.offline,
        retrying: s.notes.retrying,
        done,
      });
      if (nextCompany !== company) {
        company = nextCompany;
        if (companyRef.current) companyRef.current.textContent = company;
      }
      // The groups come from the first report (every waited download is running then) and tick off
      // as the real list says nothing of them is left.
      if (s.progress && !allLabels) allLabels = [...s.progress.pending];
      if (allLabels && now - groupAt > 250) {
        groupAt = now;
        const states = groupStates(allLabels, done ? [] : (s.progress?.pending ?? []));
        const key = states.map((g) => `${g.id}${g.done ? 1 : 0}`).join();
        if (key !== groupKey) {
          groupKey = key;
          setGroups(states);
        }
      }
      // The plain mark makes room once the drone is really on the stage.
      if (!droneSeen && bootBus.droneShown) {
        droneSeen = true;
        rootRef.current?.setAttribute("data-drone", "1");
      }
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
    };
  }, []);

  // The tap gate takes the focus, so Enter and Space work without a Tab.
  useEffect(() => {
    if (phase === "tap") {
      // A pointer visitor gets no ring round the words: the keys work from anywhere (the host listens).
      tapRef.current?.focus({ preventScroll: true, focusVisible: false });
    }
  }, [phase]);

  // The intro belongs to the scene. With no scene (no WebGL, a failure) it ends at once and the
  // plain page follows the press. The intro is never skipped: the owner wants it watched whole.
  useEffect(() => {
    if (phase !== "intro") return;
    if (bootBus.stage !== "ready") {
      useHomeFlow.getState().finishIntro();
      return;
    }
  }, [phase]);

  // The stage is lifted above this screen while it is up and given back when it goes, so the
  // canvas never drops behind this ground for a frame.
  useEffect(() => {
    return () => {
      dropStage();
    };
  }, []);

  return (
    <div ref={rootRef} className={styles.root} data-home-boot data-phase={phase} data-drone="0">
      <div className={styles.dots} aria-hidden="true" />
      <p className={styles.mark} aria-hidden="true">
        The Aspirants
      </p>
      <div className={styles.stack}>
        <div className={styles.barWrap}>
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
          <div className={styles.notches} aria-hidden="true">
            {NOTCHES.map((n, i) => (
              <span
                key={n}
                ref={(el) => {
                  notchRefs.current[i] = el;
                }}
                className={styles.notch}
                style={{ left: `${n}%` }}
                data-hit="0"
              />
            ))}
          </div>
        </div>
        <div className={styles.status}>
          <p className={styles.line} aria-hidden="true">
            <span ref={percentRef} className={styles.percent}>
              0%
            </span>
            <span ref={labelRef}>Loading the site</span>
          </p>
          {phase === "tap" || phase === "intro" ? (
            <button
              ref={tapRef}
              type="button"
              className={styles.tap}
              onClick={tapToContinue}
              disabled={phase === "intro"}
              aria-hidden={phase === "intro" ? true : undefined}
            >
              <span className={styles.tapText}>{TAP_WORDS}</span>
            </button>
          ) : null}
        </div>
        <div className={styles.under} aria-hidden="true">
          <p ref={bytesRef} className={styles.bytes} />
          {groups.length > 0 ? (
            <ul className={styles.groups}>
              {groups.map((g) => (
                <li key={g.id} className={styles.group} data-done={g.done ? "1" : "0"}>
                  <span className={styles.groupDot} />
                  {g.name}
                </li>
              ))}
            </ul>
          ) : null}
          <p ref={companyRef} className={styles.company} />
        </div>
      </div>
    </div>
  );
}
