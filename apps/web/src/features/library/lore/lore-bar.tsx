"use client";

import { useId, useLayoutEffect, useRef, type KeyboardEvent } from "react";

import { audio } from "@/lib/audio";

import styles from "./lore-bar.module.css";
import { LORE_VIEWS, type LoreView } from "./types";

export interface LoreBarProps {
  view: LoreView;
  onView: (next: LoreView) => void;
  q: string;
  onQuery: (next: string) => void;
  /** One line that says what is on screen, read out by screen readers. */
  summary: string;
  /** Called with the height of the bar, so the reader can stick below it. */
  onHeight: (px: number) => void;
}

/** The sticky bar: the three views as tabs, the search field and a live summary. */
export function LoreBar({ view, onView, q, onQuery, summary, onHeight }: LoreBarProps) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const report = () => {
      onHeight(Math.ceil(el.getBoundingClientRect().height));
    };
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => {
      ro.disconnect();
    };
  }, [onHeight]);

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const next = LORE_VIEWS[(i + dir + LORE_VIEWS.length) % LORE_VIEWS.length];
    if (!next) return;
    onView(next.id);
    document.getElementById(`${id}-${next.id}`)?.focus();
  };

  return (
    <div ref={ref} className={styles.bar}>
      <div className="shell">
        <div className={styles.row}>
          <div className={styles.tabs} role="tablist" aria-label="Views of the lore room">
            {LORE_VIEWS.map((v, i) => (
              <button
                key={v.id}
                id={`${id}-${v.id}`}
                type="button"
                role="tab"
                aria-selected={view === v.id}
                aria-controls="lore-panel"
                tabIndex={view === v.id ? 0 : -1}
                className={styles.tab}
                onClick={() => {
                  if (view !== v.id) audio.blip("click");
                  onView(v.id);
                }}
                onKeyDown={(e) => {
                  onTabKey(e, i);
                }}
              >
                <span className={styles.tabIndex}>{String(i + 1).padStart(2, "0")}</span>
                {v.label}
              </button>
            ))}
          </div>

          <label className={styles.search}>
            <span className="hud-label">Search</span>
            <input
              type="search"
              value={q}
              placeholder="Titles and words in every text"
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => {
                onQuery(e.target.value);
              }}
            />
          </label>

          <p className={`${styles.summary} hud-label`} role="status" aria-live="polite">
            {summary}
          </p>
        </div>
      </div>
    </div>
  );
}
