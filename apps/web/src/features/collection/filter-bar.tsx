"use client";

import { useId, useRef, useState, type CSSProperties } from "react";

import { pairs } from "@/content/pairs";
import type { Slug } from "@/content/types";
import { audio } from "@/lib/audio";
import { useHotkey } from "@/lib/hooks";
import { CHARACTER_NAMES, CHARACTER_SLUGS } from "@/lib/slugs";

import styles from "./filter-bar.module.css";
import { sameWho, whoLabel } from "./filter";
import { SECTIONS, type SectionId, type WhoFilter } from "./types";

export type SectionFilter = "all" | SectionId;

interface FilterBarProps {
  section: SectionFilter;
  onSection: (section: SectionFilter) => void;
  /** Matching items per section, after the character and search filters. */
  counts: Record<SectionId, number>;
  query: string;
  onQuery: (query: string) => void;
  who: WhoFilter;
  onWho: (who: WhoFilter) => void;
  /** Spoken and shown summary of the results. */
  summary: string;
  onClear: () => void;
}

const ALL: WhoFilter = { type: "all" };

/**
 * The sticky filter bar: type toggles (with live counts), a search field and a character or
 * pair filter. The summary line is an aria-live region, so a screen reader hears how many
 * results each change leaves.
 */
export function FilterBar({
  section,
  onSection,
  counts,
  query,
  onQuery,
  who,
  onWho,
  summary,
  onClear,
}: FilterBarProps) {
  const [whoOpen, setWhoOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const panelId = useId();
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const filtered = section !== "all" || query !== "" || who.type !== "all";

  useHotkey("/", (e) => {
    e.preventDefault();
    searchRef.current?.focus();
  });

  const pickSection = (next: SectionFilter) => {
    audio.blip("click");
    onSection(next);
  };

  const pickWho = (next: WhoFilter) => {
    audio.blip("click");
    onWho(next);
  };

  return (
    <div className={styles.bar} data-theme="storm" data-collection-bar>
      <div className={styles.surface} aria-hidden="true" />
      <div className="shell">
        <div className={styles.row}>
          <div role="group" aria-label="Filter by type" className={styles.types}>
            <button
              type="button"
              className={styles.toggle}
              aria-pressed={section === "all"}
              onClick={() => pickSection("all")}
            >
              <span>All</span>
              <span className={styles.n}>{total}</span>
            </button>
            {SECTIONS.map((meta) => (
              <button
                key={meta.id}
                type="button"
                className={styles.toggle}
                aria-pressed={section === meta.id}
                data-empty={counts[meta.id] === 0}
                onClick={() => pickSection(meta.id)}
              >
                <span>{meta.filterLabel}</span>
                <span className={styles.n}>{counts[meta.id]}</span>
              </button>
            ))}
          </div>
        </div>

        <div className={styles.row}>
          <label className={styles.search}>
            <span className="sr-only">Search the collection</span>
            <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
              <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
              <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <input
              ref={searchRef}
              type="search"
              value={query}
              placeholder="Search a name, a film, a word"
              autoComplete="off"
              spellCheck={false}
              aria-keyshortcuts="/"
              onChange={(e) => onQuery(e.target.value)}
            />
          </label>

          <button
            type="button"
            className={styles.whoButton}
            aria-expanded={whoOpen}
            aria-controls={panelId}
            onClick={() => {
              audio.blip("click");
              setWhoOpen((v) => !v);
            }}
          >
            <span className="hud-label">Who</span>
            <span className={styles.whoValue}>{whoLabel(who)}</span>
            <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false" data-open={whoOpen}>
              <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" />
            </svg>
          </button>

          {filtered && (
            <button type="button" className={styles.clear} onClick={onClear}>
              Clear filters
            </button>
          )}
        </div>

        {whoOpen && (
          <div id={panelId} className={styles.panel}>
            <div role="group" aria-label="Filter by character or pair" className={styles.chips}>
              <button
                type="button"
                className={styles.chip}
                aria-pressed={sameWho(who, ALL)}
                onClick={() => pickWho(ALL)}
              >
                Everyone
              </button>
            </div>
            <p className={`${styles.groupLabel} hud-label`}>Pairs</p>
            <div role="group" aria-label="Pairs" className={styles.chips}>
              {pairs.map((pair) => {
                const next: WhoFilter = { type: "pair", id: pair.id };
                return (
                  <button
                    key={pair.id}
                    type="button"
                    className={styles.chip}
                    aria-pressed={sameWho(who, next)}
                    style={
                      {
                        "--a": pair.colours[0],
                        "--b": pair.colours[1],
                      } as CSSProperties
                    }
                    onClick={() => pickWho(next)}
                  >
                    <i className={styles.dots} aria-hidden="true" />
                    {pair.names}
                  </button>
                );
              })}
            </div>
            <p className={`${styles.groupLabel} hud-label`}>Characters</p>
            <div role="group" aria-label="Characters" className={styles.chips}>
              {CHARACTER_SLUGS.map((slug: Slug) => {
                const next: WhoFilter = { type: "char", slug };
                return (
                  <button
                    key={slug}
                    type="button"
                    className={styles.chip}
                    aria-pressed={sameWho(who, next)}
                    onClick={() => pickWho(next)}
                  >
                    {CHARACTER_NAMES[slug]}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <p className={`${styles.summary} hud-label`} role="status" aria-live="polite">
          {summary}
        </p>
      </div>
    </div>
  );
}
