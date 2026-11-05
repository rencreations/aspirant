"use client";

import { useEffect, useId, useRef, useState } from "react";

import { pairs } from "@/content/pairs";
import { audio } from "@/lib/audio";
import { CHARACTER_NAMES, CHARACTER_SLUGS } from "@/lib/slugs";

import { Chips, type ChipOption } from "../shell/controls";
import { activeCount, type FacetKey, type Filters } from "./model";
import styles from "./controls.module.css";
import type { DesignTopic } from "./types";
import type { View } from "./wall";

export type Counts = Record<FacetKey, Record<string, number>>;

interface Props {
  filters: Filters;
  onFilter: (key: keyof Filters, value: string) => void;
  onClear: () => void;
  view: View;
  onView: (v: View) => void;
  newestFirst: boolean;
  onSort: (newest: boolean) => void;
  summary: string;
  counts: Counts;
  years: string[];
  topics: readonly DesignTopic[];
}

const FORMATS: ChipOption[] = [
  { value: "poster", label: "Poster" },
  { value: "carousel", label: "Carousel" },
  { value: "reel", label: "Reel" },
];

const CANON: ChipOption[] = [
  { value: "official", label: "Official" },
  { value: "fan", label: "Fan work" },
];

function withCounts(options: readonly ChipOption[], counts: Record<string, number>): ChipOption[] {
  return options.map((o) => ({ ...o, count: counts[o.value] ?? 0 }));
}

/** The sticky bar: search, the view, a Filters button that opens the groups, and what is active. */
export function DesignControls({
  filters,
  onFilter,
  onClear,
  view,
  onView,
  newestFirst,
  onSort,
  summary,
  counts,
  years,
  topics,
}: Props) {
  const [open, setOpen] = useState(false);
  const searchId = useId();
  const panelId = useId();
  const barRef = useRef<HTMLDivElement>(null);
  const n = activeCount(filters);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && barRef.current?.contains(document.activeElement)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pairOptions: ChipOption[] = withCounts(
    pairs.map((p) => ({ value: p.id, label: p.names })),
    counts.pair,
  );
  const whoOptions: ChipOption[] = withCounts(
    CHARACTER_SLUGS.map((s) => ({ value: s, label: CHARACTER_NAMES[s] })),
    counts.who,
  );
  const yearOptions: ChipOption[] = withCounts(
    years.map((y) => ({ value: y, label: y })),
    counts.year,
  );
  const topicOptions: ChipOption[] = withCounts(
    topics.map((t) => ({ value: t.tag, label: t.label })),
    counts.topic,
  );

  const labelOf = (key: FacetKey, value: string): string => {
    switch (key) {
      case "pair":
        return pairs.find((p) => p.id === value)?.names ?? value;
      case "who":
        return CHARACTER_NAMES[value as keyof typeof CHARACTER_NAMES] ?? value;
      case "fmt":
        return FORMATS.find((o) => o.value === value)?.label ?? value;
      case "canon":
        return CANON.find((o) => o.value === value)?.label ?? value;
      case "topic":
        return topics.find((t) => t.tag === value)?.label ?? value;
      default:
        return value;
    }
  };
  const activeKeys = (["pair", "who", "year", "fmt", "canon", "topic"] as FacetKey[]).filter(
    (k) => filters[k],
  );

  return (
    <div className={styles.bar} ref={barRef}>
      <div className="shell">
        <div className={styles.top}>
          <label className={styles.search} htmlFor={searchId}>
            <span className="hud-label">Search</span>
            <input
              id={searchId}
              type="search"
              value={filters.q}
              placeholder="Search titles and captions"
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => {
                onFilter("q", e.target.value);
              }}
            />
          </label>

          <button
            type="button"
            className={styles.filterButton}
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => {
              audio.blip("click");
              setOpen((v) => !v);
            }}
          >
            <span className="hud-label">Filters</span>
            {n > 0 ? <span className={styles.badge}>{n}</span> : null}
            <svg viewBox="0 0 12 8" width="12" height="8" aria-hidden="true" data-open={open}>
              <path d="M1 1.5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>

          <div className={styles.seg} role="group" aria-label="View">
            {(
              [
                ["posted", "As posted"],
                ["details", "Details"],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => {
                  audio.blip("click");
                  onView(v);
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <p className={`${styles.summary} hud-label`} role="status" aria-live="polite">
            {summary}
          </p>
        </div>

        {activeKeys.length > 0 ? (
          <div className={styles.active} aria-label="Active filters">
            {activeKeys.map((k) => (
              <button
                key={k}
                type="button"
                className={styles.pill}
                onClick={() => {
                  audio.blip("click");
                  onFilter(k, "");
                }}
                aria-label={`Remove filter ${labelOf(k, filters[k])}`}
              >
                {labelOf(k, filters[k])}
                <span aria-hidden="true">x</span>
              </button>
            ))}
            <button type="button" className={styles.clear} onClick={onClear}>
              Clear all
            </button>
          </div>
        ) : null}
      </div>

      {open ? (
        <div id={panelId} className={styles.panel}>
          <div className="shell">
            <div className={styles.groups}>
              <Chips
                label="Pair"
                options={pairOptions}
                value={filters.pair}
                onChange={(v) => {
                  onFilter("pair", v);
                }}
              />
              <Chips
                label="Character"
                options={whoOptions}
                value={filters.who}
                onChange={(v) => {
                  onFilter("who", v);
                }}
              />
              <Chips
                label="Year"
                options={yearOptions}
                value={filters.year}
                onChange={(v) => {
                  onFilter("year", v);
                }}
              />
              <Chips
                label="Format"
                options={withCounts(FORMATS, counts.fmt)}
                value={filters.fmt}
                onChange={(v) => {
                  onFilter("fmt", v);
                }}
              />
              <Chips
                label="Canon"
                options={withCounts(CANON, counts.canon)}
                value={filters.canon}
                onChange={(v) => {
                  onFilter("canon", v);
                }}
              />
              <Chips
                label="Topic"
                options={topicOptions}
                value={filters.topic}
                onChange={(v) => {
                  onFilter("topic", v);
                }}
              />
              <Chips
                label="Order"
                all="Oldest first"
                options={[{ value: "new", label: "Newest first" }]}
                value={newestFirst ? "new" : ""}
                onChange={(v) => {
                  onSort(v === "new");
                }}
              />
            </div>
            <div className={styles.panelFoot}>
              <button
                type="button"
                className={styles.done}
                onClick={() => {
                  setOpen(false);
                }}
              >
                Done
              </button>
              {n > 0 ? (
                <button type="button" className={styles.clear} onClick={onClear}>
                  Clear all
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
