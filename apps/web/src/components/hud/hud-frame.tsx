"use client";

import { useEffect, useRef } from "react";

import { audio } from "@/lib/audio";
import { useHotkey, useScrollProgress, useThemeAt } from "@/lib/hooks";
import { useSiteStore } from "@/lib/stores";

import styles from "./hud.module.css";
import { MotionToggle, SoundToggle } from "./preference-toggles";

function Corner({ pos }: { pos: "tl" | "tr" | "bl" | "br" }) {
  return (
    <svg className={styles.corner} data-pos={pos} viewBox="0 0 26 26" aria-hidden="true">
      <path d="M1 25V1h24" fill="none" stroke="currentColor" strokeWidth="1.25" />
      <path d="M1 8h3M8 1v3M1 16h2M16 1v2" stroke="currentColor" strokeWidth="1" />
      <rect className={styles.dot} x="4" y="4" width="3" height="3" />
    </svg>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * The persistent HUD: corner brackets, the left "COUPLING" scroll meter, the right ruler,
 * Terrinia local time, and the sound and reduce-motion toggles. Fixed and click-through
 * except for the toggles. It lives in the side rails (inside --gutter) on desktop and
 * collapses to a top progress bar on screens up to 900 px wide, where the toggles move into
 * the nav. The M key toggles sound.
 */
export function HudFrame() {
  const fillRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const clockRef = useRef<HTMLSpanElement>(null);
  const toggleMute = useSiteStore((s) => s.toggleMute);
  // Fixed chrome follows the world underneath it: the rails sample where their labels sit
  // (upper third), the bottom readouts sample the bottom edge.
  const theme = useThemeAt((w, h) => ({ x: w / 2, y: h * 0.28 }));
  const bottomTheme = useThemeAt((w, h) => ({ x: w / 2, y: h - 24 }));

  useScrollProgress((p) => {
    if (fillRef.current) fillRef.current.style.transform = `scaleY(${p})`;
    if (markerRef.current) markerRef.current.style.top = `${p * 100}%`;
    if (barRef.current) barRef.current.style.transform = `scaleX(${p})`;
    if (valueRef.current) valueRef.current.textContent = p.toFixed(2);
  });

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      if (clockRef.current) {
        clockRef.current.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  useHotkey("m", () => {
    const wasMuted = useSiteStore.getState().muted;
    audio.unlock();
    toggleMute();
    if (wasMuted) window.setTimeout(() => audio.blip("click"), 30);
  });

  return (
    <>
      <aside
        className={styles.hud}
        data-theme={theme}
        data-overlay="hud"
        aria-label="Terminal status"
      >
        <Corner pos="tl" />
        <Corner pos="tr" />

        <div className={styles.meter} aria-hidden="true">
          <span className={styles.meterLabel}>
            Coupling
            <span ref={valueRef} className={styles.meterValue}>
              0.00
            </span>
          </span>
          <div className={styles.track}>
            <div ref={fillRef} className={styles.fill} />
            <div ref={markerRef} className={styles.marker} />
          </div>
          <div className={styles.ticks} />
        </div>

        <div className={styles.ruler} aria-hidden="true" />
        <span className={styles.rulerLabel} aria-hidden="true">
          Resonance terminal
        </span>

        <div className={styles.bottom} data-theme={bottomTheme}>
          <Corner pos="bl" />
          <Corner pos="br" />
          <p className={styles.clock}>
            <span>Terrinia</span>
            <span className={styles.clockTime}>
              <span className="sr-only">Local time </span>
              <span ref={clockRef}>--:--:--</span>
            </span>
          </p>

          <div className={styles.controls}>
            <SoundToggle />
            <MotionToggle />
          </div>
        </div>
      </aside>
      <div className={styles.bar} data-theme={theme} aria-hidden="true">
        <div ref={barRef} className={styles.barFill} />
      </div>
    </>
  );
}
