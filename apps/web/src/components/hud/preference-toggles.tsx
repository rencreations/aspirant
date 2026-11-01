"use client";

import { cn } from "@aspirant/ui/lib/utils";

import { audio } from "@/lib/audio";
import { useMounted } from "@/lib/hooks";
import { useSiteStore } from "@/lib/stores";

import styles from "./toggle.module.css";

interface ToggleProps {
  /** Show the text label next to the icon (menus). Icon only by default. */
  labeled?: boolean;
  className?: string;
}

/**
 * Sound on/off. A toggle button (aria-pressed means "sound is on"); the M key does the same
 * (wired once in <HudFrame>).
 */
export function SoundToggle({ labeled = false, className }: ToggleProps) {
  const muted = useSiteStore((s) => s.muted);
  const toggleMute = useSiteStore((s) => s.toggleMute);
  const mounted = useMounted();
  const on = mounted && !muted;
  return (
    <button
      type="button"
      className={cn(styles.toggle, labeled && styles.labeled, className)}
      aria-pressed={on}
      aria-keyshortcuts="M"
      data-on={on}
      data-cursor="SOUND"
      title="Sound (M)"
      onClick={() => {
        audio.unlock();
        toggleMute();
        if (muted) window.setTimeout(() => audio.blip("click"), 30);
      }}
    >
      <svg className={styles.icon} viewBox="0 0 18 18" aria-hidden="true" focusable="false">
        <path d="M2 6.5h3l4-3.5v12l-4-3.5H2z" fill="currentColor" />
        {on ? (
          <g className={styles.bars} fill="currentColor">
            <rect x="11" y="6" width="1.6" height="6" />
            <rect x="13.6" y="4" width="1.6" height="10" />
            <rect x="16.2" y="7" width="1.6" height="4" />
          </g>
        ) : (
          <path d="M11.5 6.5l5 5m0-5l-5 5" stroke="currentColor" strokeWidth="1.6" fill="none" />
        )}
      </svg>
      <span className={labeled ? undefined : "sr-only"}>
        {labeled ? (on ? "Sound on" : "Sound off") : "Sound"}
      </span>
    </button>
  );
}
