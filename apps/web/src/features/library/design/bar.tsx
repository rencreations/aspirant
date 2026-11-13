"use client";

import { useId } from "react";

import { pairs } from "@/content/pairs";
import { audio } from "@/lib/audio";

import styles from "./bar.module.css";
import { Dropdown, type DropdownOption } from "./dropdown";
import type { FacetKey, Filters } from "./model";

export type Counts = Record<FacetKey, Record<string, number>>;

interface BarProps {
  filters: Filters;
  onFilter: (key: keyof Filters, value: string) => void;
  onClear: () => void;
  newestFirst: boolean;
  onSort: (newest: boolean) => void;
  counts: Counts;
  years: readonly string[];
  /** Posts that pass the filters, and all of them. */
  shown: number;
  total: number;
}

const TYPES: ReadonlyArray<{ value: string; label: string }> = [
  { value: "poster", label: "Poster" },
  { value: "carousel", label: "Carousel" },
  { value: "reel", label: "Reel" },
];

const options = (
  list: ReadonlyArray<{ value: string; label: string }>,
  counts: Record<string, number>,
): DropdownOption[] => list.map((o) => ({ ...o, count: counts[o.value] ?? 0 }));

/**
 * The bar under the film: a search field and three choices (who, when, what kind), then the order.
 * It is the top of the page that rises over the film, and it docks under the top bar as the page
 * goes up. Nothing else: no summary, no row of what is chosen. The choices say what they hold, and
 * "Clear" appears only when there is something to clear.
 */
export function DesignBar({
  filters,
  onFilter,
  onClear,
  newestFirst,
  onSort,
  counts,
  years,
  shown,
  total,
}: BarProps) {
  const searchId = useId();
  const narrowed = shown !== total;
  const dirty = Boolean(filters.q.trim() || filters.pair || filters.year || filters.fmt);
  const status =
    shown === 0
      ? "No content matches"
      : narrowed
        ? `${shown} of ${total} contents`
        : `${total} contents`;

  return (
    <div className={styles.bar} data-design-bar="">
      <div className="shell">
        <div className={styles.inner}>
          <label className={styles.search} htmlFor={searchId}>
            <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
              <circle cx="7" cy="7" r="4.6" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <path d="M10.6 10.6 14 14" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <span className="sr-only">Search the contents</span>
            <input
              id={searchId}
              type="search"
              value={filters.q}
              placeholder="Search"
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => {
                onFilter("q", e.target.value);
              }}
            />
          </label>

          <div className={styles.group}>
            <Dropdown
              label="Characters"
              all="All characters"
              options={options(
                pairs.map((p) => ({ value: p.id, label: p.names })),
                counts.pair,
              )}
              value={filters.pair}
              onChange={(v) => {
                onFilter("pair", v);
              }}
            />
            <Dropdown
              label="Year"
              all="Every year"
              options={options(
                years.map((y) => ({ value: y, label: y })),
                counts.year,
              )}
              value={filters.year}
              onChange={(v) => {
                onFilter("year", v);
              }}
            />
            <Dropdown
              label="Type"
              all="Every type"
              options={options(TYPES, counts.fmt)}
              value={filters.fmt}
              onChange={(v) => {
                onFilter("fmt", v);
              }}
            />
          </div>

          <div className={styles.end}>
            <Dropdown
              label="Oldest first"
              all="Oldest first"
              plain
              options={[{ value: "new", label: "Newest first" }]}
              value={newestFirst ? "new" : ""}
              onChange={(v) => {
                onSort(v === "new");
              }}
            />
            {dirty ? (
              <button
                type="button"
                className={styles.clear}
                onClick={() => {
                  audio.blip("click");
                  onClear();
                }}
              >
                Clear
              </button>
            ) : null}
            <p
              className={`${styles.count} hud-label`}
              role="status"
              aria-live="polite"
              data-narrowed={narrowed || shown === 0 ? "true" : undefined}
            >
              {status}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
