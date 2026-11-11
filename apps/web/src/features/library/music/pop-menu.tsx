"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import styles from "./music.module.css";

interface Props {
  /** The words of the button. */
  label: string;
  /** What the button says on a narrow screen (the icon stays). */
  short?: string;
  icon: ReactNode;
  /** Open the list under the pill (a pill at the top of the screen). By default it opens above. */
  below?: boolean;
  /** The items of the list, each a link or a button. A press on any of them closes the list. */
  children: ReactNode;
}

/**
 * A pill that opens a short list above itself, or under itself with `below` (the films of a track,
 * the chapters of the long listen). Esc, a press outside or a choice closes it. Opacity and
 * transform only.
 */
export function PopMenu({ label, short, icon, below = false, children }: Props) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      setOpen(false);
      button.current?.focus();
    };
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  return (
    <div
      ref={root}
      className={styles.pop}
      data-open={open ? "true" : undefined}
      data-below={below ? "true" : undefined}
    >
      <button
        ref={button}
        type="button"
        className={styles.pill}
        aria-expanded={open}
        aria-controls={id}
        aria-label={label}
        onClick={() => {
          setOpen((v) => !v);
        }}
      >
        {icon}
        <span className={styles.pillLabel}>{label}</span>
        {short ? (
          <span className={styles.pillShort} aria-hidden="true">
            {short}
          </span>
        ) : null}
        <svg
          className={styles.popCaret}
          viewBox="0 0 10 10"
          width="10"
          height="10"
          aria-hidden="true"
        >
          <path d="M2 6.5 5 3.5l3 3" fill="none" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      </button>
      <div
        id={id}
        className={styles.popList}
        hidden={!open}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a, button")) setOpen(false);
        }}
      >
        {children}
      </div>
    </div>
  );
}
