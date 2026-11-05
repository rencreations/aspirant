"use client";

import { useRef, type KeyboardEvent } from "react";

import { audio } from "@/lib/audio";

import styles from "./arts.module.css";
import { Odometer } from "./odometer";

export type ArtsTab = "official" | "scenes";

interface Props {
  tab: ArtsTab;
  onTab: (next: ArtsTab) => void;
  /** Pictures in the official tab, or null while the data loads. */
  official: number | null;
  /** Stills in the scenes tab, or null when that file is missing or has not arrived. */
  scenes: number | null;
}

export const TAB_IDS = {
  official: { tab: "arts-tab-official", panel: "arts-panel" },
  scenes: { tab: "arts-tab-scenes", panel: "arts-panel" },
} as const;

/** The two tabs of the room. The count of each shows in its label when it is known. */
export function TabBar({ tab, onTab, official, scenes }: Props) {
  const refs = useRef<Record<ArtsTab, HTMLButtonElement | null>>({ official: null, scenes: null });

  const choose = (next: ArtsTab, focus = false) => {
    if (next !== tab) {
      audio.blip("click");
      onTab(next);
    }
    if (focus) refs.current[next]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft" || e.key === "Home" || e.key === "End") {
      e.preventDefault();
      const next: ArtsTab =
        e.key === "Home"
          ? "official"
          : e.key === "End"
            ? "scenes"
            : tab === "official"
              ? "scenes"
              : "official";
      choose(next, true);
    }
  };

  const entries: Array<{ id: ArtsTab; name: string; count: number | null }> = [
    { id: "official", name: "Official art", count: official },
    { id: "scenes", name: "Scene stills", count: scenes },
  ];

  return (
    <div className={styles.tabs}>
      <div className="shell">
        <div className={styles.tablist} role="tablist" aria-label="Arts" onKeyDown={onKeyDown}>
          {entries.map((e) => (
            <button
              key={e.id}
              ref={(el) => {
                refs.current[e.id] = el;
              }}
              type="button"
              role="tab"
              id={TAB_IDS[e.id].tab}
              aria-selected={tab === e.id}
              aria-controls={TAB_IDS[e.id].panel}
              tabIndex={tab === e.id ? 0 : -1}
              className={styles.tab}
              onClick={() => {
                choose(e.id);
              }}
            >
              <span className={`${styles.tabName} display`}>{e.name}</span>
              {e.count === null ? null : (
                <span className={`${styles.tabCount} hud-label`}>
                  <Odometer value={e.count} />
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
