"use client";

import { useEffect, useId, useRef, useState } from "react";

import type { LiveFacet } from "./filter";
import styles from "./flow.module.css";

/**
 * The search field. The text is the visitor's own while they type; the address (and so the
 * filtering) follows 150 ms after the last key. A change from outside (Back, Clear) is shown.
 * The slash key belongs to the library's own search, so this field has no key of its own.
 */
export function SearchField({
  value,
  onCommit,
  label,
}: {
  value: string;
  onCommit: (next: string) => void;
  label: string;
}) {
  // `draft` is what the visitor has typed and the address does not have yet; null follows the address.
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? value;

  useEffect(() => {
    if (draft === null) return;
    const timer = window.setTimeout(() => {
      onCommit(draft);
      setDraft(null);
    }, 150);
    return () => {
      window.clearTimeout(timer);
    };
  }, [draft, onCommit]);

  const clear = () => {
    setDraft(null);
    onCommit("");
  };

  return (
    <label className={styles.search} data-flow-search="">
      <svg
        viewBox="0 0 16 16"
        width="14"
        height="14"
        aria-hidden="true"
        className={styles.searchIcon}
      >
        <circle cx="7" cy="7" r="4.6" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <path d="m10.6 10.6 3.4 3.4" fill="none" stroke="currentColor" strokeWidth="1.4" />
      </svg>
      <input
        type="search"
        className={styles.input}
        value={shown}
        placeholder={label}
        aria-label={label}
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="search"
        onChange={(e) => {
          setDraft(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape" && shown) {
            e.preventDefault();
            e.stopPropagation();
            clear();
          }
        }}
      />
      {shown ? (
        <button
          type="button"
          className={styles.clear}
          aria-label="Clear the search"
          onClick={clear}
        >
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
            <path d="m3.5 3.5 9 9m0-9-9 9" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
      ) : null}
    </label>
  );
}

function Chip({
  facet,
  chosen,
  onPick,
}: {
  facet: LiveFacet;
  chosen: boolean;
  onPick: (id: string) => void;
}) {
  return (
    <button
      type="button"
      className={styles.chip}
      aria-pressed={chosen}
      data-facet={facet.id}
      onClick={() => {
        onPick(chosen ? "" : facet.id);
      }}
    >
      <span>{facet.name}</span>
      <span className={styles.num}>{facet.live.toLocaleString("en-US")}</span>
    </button>
  );
}

/**
 * The filter: "All", the facets with the most pictures, and "See more", which opens the rest in a
 * sheet under the chips (a sheet floats, so it never moves the rows). A press on the chosen chip
 * clears it. Esc or a press outside closes the sheet.
 */
export function FilterChips({
  total,
  chips,
  more,
  chosen,
  onPick,
  label,
}: {
  total: number;
  chips: readonly LiveFacet[];
  more: readonly LiveFacet[];
  chosen: string;
  onPick: (id: string) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const sheetId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        rootRef.current?.querySelector<HTMLElement>("[data-flow-more]")?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (e.target instanceof Node && !rootRef.current?.contains(e.target)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  const pick = (id: string) => {
    setOpen(false);
    onPick(id);
  };

  return (
    <div
      ref={rootRef}
      className={styles.filter}
      role="group"
      aria-label={label}
      data-flow-filter=""
    >
      {/* On a wide page the chips wrap (this box has no layout of its own). On a narrow one they are one row that slides sideways, and "See more" stays at its end. */}
      <div className={styles.chips} data-flow-chips="">
        <button
          type="button"
          className={styles.chip}
          aria-pressed={chosen === ""}
          data-facet=""
          onClick={() => {
            pick("");
          }}
        >
          <span>All</span>
          <span className={styles.num}>{total.toLocaleString("en-US")}</span>
        </button>
        {chips.map((facet) => (
          <Chip key={facet.id} facet={facet} chosen={facet.id === chosen} onPick={pick} />
        ))}
      </div>
      {more.length > 0 ? (
        <button
          type="button"
          className={`${styles.chip} ${styles.more}`}
          aria-expanded={open}
          aria-controls={sheetId}
          data-flow-more=""
          onClick={() => {
            setOpen((v) => !v);
          }}
        >
          <span>{open ? "Fewer" : "See more"}</span>
          <span className={styles.num}>{more.length}</span>
        </button>
      ) : null}
      {open ? (
        <div id={sheetId} className={styles.sheet} data-lenis-prevent="" data-flow-sheet="">
          {more.map((facet) => (
            <Chip key={facet.id} facet={facet} chosen={facet.id === chosen} onPick={pick} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
