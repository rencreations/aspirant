"use client";

import { useId, useMemo, useRef, useState } from "react";

import { ThemeZone } from "@/components/theme-zone";
import { Tag } from "@/components/ui/tag";
import { audio } from "@/lib/audio";
import { useHotkey } from "@/lib/hooks";

import { ChapterLink } from "../chapter-link";
import { SectionHead } from "../section-head";
import type { GlossaryEntry, GlossaryKind } from "./glossary-data";
import styles from "./glossary.module.css";

type Filter = "all" | "listed" | GlossaryKind;

const FILTERS: ReadonlyArray<{ id: Filter; label: string }> = [
  { id: "all", label: "All" },
  { id: "listed", label: "Words to know" },
  { id: "place", label: "Places" },
  { id: "term", label: "Terms" },
  { id: "org", label: "Groups" },
];

const KIND_LABEL: Readonly<Record<GlossaryKind, string>> = {
  place: "Place",
  term: "Term",
  org: "Group",
};

function matches(entry: GlossaryEntry, filter: Filter, query: string): boolean {
  if (filter === "listed" && !entry.listed) return false;
  if (filter !== "all" && filter !== "listed" && entry.kind !== filter) return false;
  if (!query) return true;
  return `${entry.label} ${entry.text}`.toLowerCase().includes(query);
}

/**
 * Words to know: the story's own list plus every term, place and group the reader meets.
 * Search as you type, filter by kind, and a polite live region says how many entries match.
 * Press "/" to jump to the search box.
 */
export function Glossary({ entries: all }: { entries: readonly GlossaryEntry[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const inputId = useId();

  useHotkey("/", (e) => {
    e.preventDefault();
    input.current?.focus();
  });

  const q = query.trim().toLowerCase();
  const shown = useMemo(() => all.filter((e) => matches(e, filter, q)), [all, filter, q]);

  return (
    <ThemeZone theme="daybreak" aria-labelledby="words-title" className={styles.section}>
      <section className="shell">
        <SectionHead
          id="words-title"
          code="09 / Words to know"
          title="Words to know"
          lead="Names, places and terms from the story. Search, or filter by kind."
        />

        <div className={styles.tools}>
          <div className={styles.search}>
            <label htmlFor={inputId} className={`${styles.searchLabel} hud-label`}>
              Search the glossary
            </label>
            <input
              ref={input}
              id={inputId}
              type="search"
              className={styles.input}
              value={query}
              placeholder="Try Embers, Sphere or Oro"
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setQuery(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape" && query) {
                  e.preventDefault();
                  setQuery("");
                }
              }}
            />
            <span className={styles.slash} aria-hidden="true">
              /
            </span>
          </div>

          <div role="group" aria-label="Filter by kind" className={styles.chips}>
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={styles.chip}
                aria-pressed={filter === f.id}
                onClick={() => {
                  setFilter(f.id);
                  audio.blip("click");
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          <p className={`${styles.count} hud-label`} role="status" aria-live="polite">
            {shown.length === all.length
              ? `${all.length} entries`
              : `${shown.length} of ${all.length} entries`}
          </p>
        </div>

        {shown.length === 0 ? (
          <p className={styles.empty}>
            Nothing matches that. Try another word, or clear the filter.
          </p>
        ) : (
          <ul className={styles.grid}>
            {shown.map((e) => (
              <li key={e.id} className={styles.entry}>
                <div className={styles.entryHead}>
                  <h3 className={`${styles.label} display`}>{e.label}</h3>
                  <Tag>{KIND_LABEL[e.kind]}</Tag>
                </div>
                <p className={styles.text}>{e.text}</p>
                {e.chapterId && (
                  <p className={styles.first}>
                    <span className="hud-label">First seen</span>
                    <ChapterLink id={e.chapterId} />
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </ThemeZone>
  );
}
