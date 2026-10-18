"use client";

import { useRef } from "react";

import { audio } from "@/lib/audio";
import { useHotkey, useScrollProgress, useThemeAt } from "@/lib/hooks";
import { useSiteStore } from "@/lib/stores";

import styles from "./hud.module.css";
import { MotionToggle } from "./preference-toggles";

function Corner({ pos }: { pos: "tl" | "tr" | "bl" | "br" }) {
  return (
    <svg className={styles.corner} data-pos={pos} viewBox="0 0 22 22" aria-hidden="true">
      <path d="M1 21V1h20" fill="none" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

/**
 * The persistent frame: four thin corner brackets, a hairline scroll progress bar along the top
 * edge, and the reduce-motion toggle. Fixed and click-through except for the toggle. The sound
 * button lives in the nav. The M key toggles sound.
 */
export function HudFrame() {
  const barRef = useRef<HTMLDivElement>(null);
  const toggleMute = useSiteStore((s) => s.toggleMute);
  // Fixed chrome follows the world underneath it.
  const theme = useThemeAt((w, h) => ({ x: w / 2, y: h * 0.28 }));
  const bottomTheme = useThemeAt((w, h) => ({ x: w / 2, y: h - 24 }));

  useScrollProgress((p) => {
    if (barRef.current) barRef.current.style.transform = `scaleX(${p})`;
  });

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
        aria-label="Page controls"
      >
        <Corner pos="tl" />
        <Corner pos="tr" />
        <div className={styles.bottom} data-theme={bottomTheme}>
          <Corner pos="bl" />
          <Corner pos="br" />
          <div className={styles.controls}>
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
