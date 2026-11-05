"use client";

import { useId, type ReactNode } from "react";

import { audio } from "@/lib/audio";
import { CHARACTER_NAMES, CHARACTER_SLUGS } from "@/lib/slugs";

import styles from "./controls.module.css";

export interface ChipOption {
  value: string;
  label: string;
  /** How many items match. Hidden when undefined. */
  count?: number;
}

interface ChipsProps {
  /** Spoken name of the group, for example "Character". */
  label: string;
  options: readonly ChipOption[];
  /** The chosen value. An empty string means "all". */
  value: string;
  onChange: (next: string) => void;
  /** Text of the "show everything" chip. Pass null to leave it out. */
  all?: string | null;
}

/** A row of toggle chips: one value at a time, pressing the chosen one again clears it. */
export function Chips({ label, options, value, onChange, all = "All" }: ChipsProps) {
  const pick = (next: string) => {
    audio.blip("click");
    onChange(next === value ? "" : next);
  };
  return (
    <div className={styles.chips} role="group" aria-label={label}>
      <span className={`${styles.chipsLabel} hud-label`}>{label}</span>
      {all === null ? null : (
        <button
          type="button"
          className={styles.chip}
          aria-pressed={value === ""}
          onClick={() => {
            audio.blip("click");
            onChange("");
          }}
        >
          {all}
        </button>
      )}
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={styles.chip}
          aria-pressed={value === o.value}
          disabled={o.count === 0}
          onClick={() => {
            pick(o.value);
          }}
        >
          {o.label}
          {o.count === undefined ? null : <span className={styles.chipCount}>{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** The ten Aspirants as chip options (without counts). */
export function characterOptions(counts?: Readonly<Record<string, number>>): ChipOption[] {
  return CHARACTER_SLUGS.map((slug) => ({
    value: slug,
    label: CHARACTER_NAMES[slug],
    ...(counts ? { count: counts[slug] ?? 0 } : {}),
  }));
}

interface ControlBarProps {
  query: string;
  onQuery: (next: string) => void;
  placeholder?: string;
  /** One line that says what the filters leave, read out by screen readers. */
  summary: string;
  /** The filter chips and toggles. */
  children?: ReactNode;
  /** Shown at the right of the search field, for example a sort menu. */
  trailing?: ReactNode;
}

/** The sticky bar under the header: a search field, the page's filters and a live summary. */
export function ControlBar({
  query,
  onQuery,
  placeholder = "Search by name, character or word",
  summary,
  children,
  trailing,
}: ControlBarProps) {
  const id = useId();
  return (
    <div className={styles.bar}>
      <div className="shell">
        <div className={styles.top}>
          <label className={styles.search} htmlFor={id}>
            <span className="hud-label">Search</span>
            <input
              id={id}
              type="search"
              value={query}
              placeholder={placeholder}
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
          {trailing}
        </div>
        {children ? <div className={styles.filters}>{children}</div> : null}
      </div>
    </div>
  );
}
