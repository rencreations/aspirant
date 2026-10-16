"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

import { FADE_MS, FLASH_MS, LIVE_READY, READY_LINE, SETTLE_MS, STATUS_LINES } from "./constants";
import { useReducedMotion, useWebGLSupport } from "./environment";
import styles from "./loader.module.css";
import { ParticleTitle, type ParticleTitleHandle } from "./ParticleTitle";
import { statusIndex } from "./progress";
import { useLoadProgress } from "./useLoadProgress";
import { useMagnet } from "./useMagnet";

export interface LoaderProps {
  /** Called once, when the light fully covers the screen. The parent unmounts the loader after. */
  onEnter: () => void;
  /** Called synchronously inside the click or key press that starts the exit. Unlock audio here. */
  onActivate?: () => void;
  /** Critical images to decode before the title forms. Paths go through asset() for the base path. */
  preload?: readonly string[];
}

type Phase = "loading" | "formed" | "leaving";

const NO_PRELOAD: readonly string[] = [];
const STAR_PATH = "M0 -50Q7 -7 50 0Q7 7 0 50Q-7 7 -50 0Q-7 -7 0 -50Z";

function StarMark() {
  return (
    <span className={styles.star} aria-hidden="true">
      <svg viewBox="-80 -80 160 160" focusable="false">
        <defs>
          <linearGradient id="aspirants-star-fill" x1="-50" y1="-50" x2="50" y2="50">
            <stop offset="0" stopColor="#7fe6ff" />
            <stop offset="0.5" stopColor="#f4fbff" />
            <stop offset="1" stopColor="#ffc45c" />
          </linearGradient>
        </defs>
        <path className={styles.starRing} d={STAR_PATH} />
        <path className={styles.starRing} d={STAR_PATH} />
        <path className={styles.starFocus} d={STAR_PATH} />
        <g className={styles.starPulse}>
          <path className={styles.starCore} d={STAR_PATH} />
        </g>
      </svg>
    </span>
  );
}

/**
 * The first screen: real loading progress, a glyph field that condenses into the
 * interactive wordmark, and the way in. The static title is used for reduced motion and
 * when WebGL is unavailable.
 */
export default function Loader({ onEnter, onActivate, preload = NO_PRELOAD }: LoaderProps) {
  const reduced = useReducedMotion();
  const webgl = useWebGLSupport();
  const [engineFailed, setEngineFailed] = useState(false);
  const [phase, setPhase] = useState<Phase>("loading");
  const renderer =
    webgl === null ? "pending" : reduced || !webgl || engineFailed ? "static" : "webgl";
  const coverMs = renderer === "webgl" ? FLASH_MS : FADE_MS;

  const rootRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<ParticleTitleHandle>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const magnetRef = useRef<HTMLSpanElement>(null);
  const meterRef = useRef<HTMLDivElement>(null);
  const digitsRef = useRef<HTMLSpanElement>(null);
  const statusRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const statusShown = useRef(0);
  const leaving = useRef(false);
  const timers = useRef<number[]>([]);

  const handleProgress = useCallback((p: number) => {
    const pct = p >= 1 ? 100 : Math.min(99, Math.floor(p * 100));
    if (digitsRef.current) digitsRef.current.textContent = String(pct).padStart(3, "0");
    meterRef.current?.setAttribute("aria-valuenow", String(pct));
    if (barRef.current) barRef.current.style.transform = `scaleX(${p})`;
    const idx = statusIndex(p, STATUS_LINES.length);
    if (idx !== statusShown.current && statusRef.current) {
      statusShown.current = idx;
      statusRef.current.textContent = STATUS_LINES[idx] ?? "";
    }
    titleRef.current?.setProgress(p);
  }, []);

  const { complete, fontsReady } = useLoadProgress({ preload, onProgress: handleProgress });

  useEffect(() => {
    if (!complete || phase !== "loading") return;
    const id = window.setTimeout(() => setPhase("formed"), renderer === "webgl" ? SETTLE_MS : 0);
    return () => window.clearTimeout(id);
  }, [complete, phase, renderer]);

  useEffect(() => {
    if (phase !== "formed") return;
    titleRef.current?.setInteractive();
    if (statusRef.current) statusRef.current.textContent = READY_LINE;
    // Take focus unless the visitor already moved it to a control in the loader.
    const active = document.activeElement;
    if (!active || !rootRef.current?.contains(active)) {
      buttonRef.current?.focus({ preventScroll: true });
    }
  }, [phase]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((id) => window.clearTimeout(id));
  }, []);

  useMagnet(rootRef, magnetRef, phase === "formed" && !reduced);

  const leave = () => {
    if (leaving.current) return;
    leaving.current = true;
    onActivate?.();
    // The light blooms from the middle of the wordmark, wherever the layout put it.
    const root = rootRef.current;
    const box = boxRef.current?.getBoundingClientRect();
    if (root && box) {
      root.style.setProperty("--bloom-x", `${box.left + box.width / 2}px`);
      root.style.setProperty("--bloom-y", `${box.top + box.height / 2}px`);
    }
    setPhase("leaving");
    titleRef.current?.burst();
    timers.current.push(window.setTimeout(() => onEnter(), coverMs));
  };

  return (
    <div
      ref={rootRef}
      className={styles.root}
      data-renderer={renderer}
      data-phase={phase}
      data-motion={reduced ? "reduced" : "full"}
      style={{ "--cover": `${coverMs}ms` } as CSSProperties}
    >
      <div className={styles.scene}>
        {renderer === "webgl" && (
          <ParticleTitle
            ref={titleRef}
            boxRef={boxRef}
            surfaceRef={rootRef}
            fontsReady={fontsReady}
            onFail={() => setEngineFailed(true)}
            className={styles.canvas}
          />
        )}
        <div className={styles.atmosphere} aria-hidden="true" />
        <div className={styles.hud} aria-hidden="true">
          <span className={styles.corner} data-corner="tl" />
          <span className={styles.corner} data-corner="tr" />
          <span className={styles.corner} data-corner="bl" />
          <span className={styles.corner} data-corner="br" />
          <p className={styles.hudLabel} data-pos="tl">
            Selrick Academy
            <br />
            Resonance terminal
          </p>
          <p className={styles.hudLabel} data-pos="tr">
            Archive A5-01
            <br />
            Access: newcomer
          </p>
        </div>

        <div className={styles.stage}>
          <h1 className={styles.srOnly}>The Aspirants</h1>
          <div className={styles.composition}>
            <div ref={boxRef} className={styles.wordBox}>
              <p className={styles.staticWord} aria-hidden="true">
                <span className={styles.staticSmall}>The</span>
                <span className={styles.staticMain}>Aspirants</span>
              </p>
            </div>
            <div className={styles.cta}>
              <p className={styles.tagline}>Someone is always waiting.</p>
              <button ref={buttonRef} type="button" className={styles.enter} onClick={leave}>
                <span ref={magnetRef} className={styles.enterInner}>
                  <StarMark />
                  <span className={styles.enterLabel}>Enter the archive</span>
                </span>
              </button>
            </div>
          </div>
        </div>

        <div className={styles.bottom}>
          <div
            ref={meterRef}
            className={styles.meter}
            role="progressbar"
            aria-label="Loading the archive"
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <p className={styles.count} aria-hidden="true">
              <span ref={digitsRef}>000</span>
              <span className={styles.pct}>%</span>
            </p>
            <span className={styles.bar} aria-hidden="true">
              <span ref={barRef} />
            </span>
            <p className={styles.status} aria-hidden="true">
              <span ref={statusRef}>{STATUS_LINES[0]}</span>
            </p>
          </div>
          <p className={styles.hint}>Sound plays once you enter. You can mute it at any time.</p>
          <button type="button" className={styles.skip} onClick={leave}>
            Skip
          </button>
        </div>
      </div>
      <div className={styles.flash} aria-hidden="true" />
      <p className={styles.srOnly} aria-live="polite">
        {phase === "loading" ? "" : LIVE_READY}
      </p>
    </div>
  );
}
