"use client";

import { useEffect, useId, useRef, useState, type RefObject } from "react";

import { pairs } from "@/content/pairs";
import { audio } from "@/lib/audio";

import { Chips, characterOptions } from "../../shell/controls";
import styles from "./finder.module.css";
import {
  CANON_OPTIONS,
  GROUP_MODES,
  LENGTH_BANDS,
  SHELVES,
  filterCount,
  type Facets,
  type Group,
  type GroupMode,
  type VideoFilters,
} from "./video-data";

interface FinderProps {
  rootRef: RefObject<HTMLDivElement | null>;
  filters: VideoFilters;
  onFilter: (key: keyof VideoFilters, value: string) => void;
  onClear: () => void;
  facets: Facets;
  mode: GroupMode;
  onMode: (mode: GroupMode) => void;
  /** The groups on the wall now, for the index. */
  groups: readonly Group[];
  /** The group under the finder, from the scroll. */
  active: string;
  onJump: (id: string) => void;
  /** What the filters leave, for example "12 of 92 videos". */
  summary: string;
}

function GroupControl({ mode, onMode }: { mode: GroupMode; onMode: (m: GroupMode) => void }) {
  return (
    <div className={styles.group} role="group" aria-label="Group the wall by">
      <span className={`${styles.groupLabel} hud-label`}>Group</span>
      {GROUP_MODES.map((m) => (
        <button
          key={m.id}
          type="button"
          className={styles.groupButton}
          aria-pressed={mode === m.id}
          onClick={() => {
            if (mode === m.id) return;
            audio.blip("click");
            onMode(m.id);
          }}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

/**
 * The sticky bar of the room: a search field, how the wall is grouped, the filters (in a sheet that
 * opens under the bar) and the index of the shelves, which follows the scroll and jumps to a shelf.
 */
export function Finder({
  rootRef,
  filters,
  onFilter,
  onClear,
  facets,
  mode,
  onMode,
  groups,
  active,
  onJump,
  summary,
}: FinderProps) {
  const searchId = useId();
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const indexRef = useRef<HTMLElement>(null);
  const on = filterCount(filters);

  // Keep the shelf that is current in view inside the index (it scrolls sideways when it is long).
  useEffect(() => {
    const index = indexRef.current;
    const chip = index?.querySelector<HTMLElement>(`[data-chip="${CSS.escape(active)}"]`);
    if (!index || !chip) return;
    const left = chip.offsetLeft - (index.clientWidth - chip.offsetWidth) / 2;
    index.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }, [active]);

  // Esc and a press outside close the sheet.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [open, rootRef]);

  return (
    <div ref={rootRef} className={styles.finder} role="search" aria-label="Find a video">
      <div className="shell">
        <div className={styles.top}>
          <label className={styles.search} htmlFor={searchId}>
            <span className="hud-label">Search</span>
            <input
              id={searchId}
              type="search"
              value={filters.q}
              placeholder="A title, a character, a word"
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => {
                onFilter("q", e.target.value);
              }}
            />
          </label>
          <div className={styles.groupInline}>
            <GroupControl mode={mode} onMode={onMode} />
          </div>
          <p className={`${styles.summary} hud-label`} role="status" aria-live="polite">
            {summary}
          </p>
          <button
            type="button"
            className={styles.filtersButton}
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => {
              audio.blip("click");
              setOpen((o) => !o);
            }}
          >
            <span>Filters</span>
            {on > 0 ? <span className={styles.on}>{on}</span> : null}
          </button>
        </div>

        <nav ref={indexRef} className={styles.index} aria-label="Shelves of the wall">
          {groups.map((g) => (
            <button
              key={g.id}
              type="button"
              className={styles.chip}
              data-chip={g.id}
              aria-current={active === g.id ? "true" : undefined}
              onClick={() => {
                audio.blip("click");
                onJump(g.id);
              }}
            >
              <span>{g.chip}</span>
              <span className={styles.chipCount}>{g.items.length}</span>
            </button>
          ))}
        </nav>
      </div>

      {open ? (
        <div id={panelId} className={styles.sheet} data-lenis-prevent>
          <div className="shell">
            <div className={styles.sheetGroup}>
              <GroupControl mode={mode} onMode={onMode} />
            </div>
            <Chips
              label="Character"
              options={characterOptions(facets.who)}
              value={filters.who}
              onChange={(v) => {
                onFilter("who", v);
              }}
            />
            <Chips
              label="Pair"
              options={pairs.map((p) => ({
                value: p.id,
                label: p.names,
                count: facets.pair[p.id] ?? 0,
              }))}
              value={filters.pair}
              onChange={(v) => {
                onFilter("pair", v);
              }}
            />
            <Chips
              label="Kind"
              options={SHELVES.map((s) => ({
                value: s.id,
                label: s.chip,
                count: facets.kind[s.id] ?? 0,
              }))}
              value={filters.kind}
              onChange={(v) => {
                onFilter("kind", v);
              }}
            />
            <Chips
              label="Canon"
              options={CANON_OPTIONS.map((c) => ({
                value: c.value,
                label: c.label,
                count: facets.canon[c.value] ?? 0,
              }))}
              value={filters.canon}
              onChange={(v) => {
                onFilter("canon", v);
              }}
            />
            <Chips
              label="Length"
              options={LENGTH_BANDS.map((b) => ({
                value: b.id,
                label: b.chip,
                count: facets.length[b.id] ?? 0,
              }))}
              value={filters.length}
              onChange={(v) => {
                onFilter("length", v);
              }}
            />
            <div className={styles.sheetFoot}>
              <button
                type="button"
                className={styles.textButton}
                disabled={on === 0}
                onClick={onClear}
              >
                Clear all
              </button>
              <button
                type="button"
                className={styles.textButton}
                onClick={() => {
                  setOpen(false);
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
