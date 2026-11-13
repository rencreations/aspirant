"use client";

import { Popover } from "radix-ui";
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";

import { audio } from "@/lib/audio";

import { getCollection } from "../registry";
import styles from "./bar.module.css";

export interface DropdownOption {
  value: string;
  label: string;
  /** How many posts the choice leaves. An option that leaves none cannot be chosen. Hidden when undefined. */
  count?: number;
}

const ROOM = getCollection("design");

/**
 * A press outside an open list closes it and does nothing else: the click that follows is stopped
 * before it reaches what is under the pointer (a post, a link). A press on the bar's own controls
 * goes through, so moving from one choice to the next takes one press. (The list's own library
 * reports a press outside only after the click has gone through, so this reads the press itself.)
 */
function swallowNextClick(): void {
  const swallow = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
  };
  window.addEventListener("click", swallow, { capture: true, once: true });
  // A press that was a drag, or never became a click, must not leave the guard behind.
  window.setTimeout(() => {
    window.removeEventListener("click", swallow, { capture: true });
  }, 500);
}

interface DropdownProps {
  /** What the button says when nothing is chosen, and what the list is called. */
  label: string;
  /** The text of the "everything" row. */
  all: string;
  options: readonly DropdownOption[];
  /** The chosen value, or "" for everything. */
  value: string;
  onChange: (next: string) => void;
  /** A choice that is not a filter (the order): the button is not marked when it is set. */
  plain?: boolean;
}

/**
 * One choice out of a short list. The button names the group, or the choice when there is one. The
 * list opens under it, closes when the visitor presses outside it, presses Esc, or chooses, and
 * gives the focus back to the button. Up and down move through the rows.
 */
export function Dropdown({ label, all, options, value, onChange, plain }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const chosen = options.find((o) => o.value === value);

  // While the list is open, a press anywhere else is only a way to close it.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest("[data-design-bar], [data-design-menu]")) return;
      // The list closes now, not with the click that follows: that click is stopped here.
      setOpen(false);
      swallowNextClick();
    };
    window.addEventListener("pointerdown", onDown, { capture: true });
    return () => {
      window.removeEventListener("pointerdown", onDown, { capture: true });
    };
  }, [open]);

  const pick = (next: string) => {
    audio.blip("click");
    onChange(next);
    setOpen(false);
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const rows = Array.from(
      list.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [],
    );
    const at = rows.indexOf(document.activeElement as HTMLButtonElement);
    let next = -1;
    if (e.key === "ArrowDown") next = at < 0 ? 0 : Math.min(rows.length - 1, at + 1);
    else if (e.key === "ArrowUp") next = at < 0 ? rows.length - 1 : Math.max(0, at - 1);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = rows.length - 1;
    if (next < 0) return;
    e.preventDefault();
    rows[next]?.focus();
  };

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        if (next) audio.blip("click");
        setOpen(next);
      }}
    >
      <Popover.Trigger asChild>
        <button
          type="button"
          className={styles.trigger}
          data-set={chosen && !plain ? "true" : undefined}
          data-plain={plain ? "true" : undefined}
          aria-label={plain ? `Order: ${chosen ? chosen.label : label}` : undefined}
        >
          {plain ? (
            <svg
              viewBox="0 0 16 16"
              width="14"
              height="14"
              aria-hidden="true"
              className={styles.sortIcon}
            >
              <path
                d="M5 3v10M2.5 10.5 5 13l2.5-2.5M11 13V3M8.5 5.5 11 3l2.5 2.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              />
            </svg>
          ) : null}
          <span className={styles.triggerText}>{chosen ? chosen.label : label}</span>
          <svg
            viewBox="0 0 12 8"
            width="10"
            height="7"
            aria-hidden="true"
            data-open={open}
            className={styles.chevron}
          >
            <path d="M1 1.5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className={styles.menu}
          data-theme="daybreak"
          style={{ "--lib-colour": ROOM.colour, "--lib-ink": ROOM.ink } as CSSProperties}
          sideOffset={8}
          align="start"
          collisionPadding={12}
          onKeyDown={onKey}
          data-design-menu=""
          onOpenAutoFocus={(e) => {
            // Focus the chosen row (or the first), not the container.
            e.preventDefault();
            const rows = list.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
            const current = list.current?.querySelector<HTMLButtonElement>(
              'button[aria-checked="true"]',
            );
            (current ?? rows?.[0])?.focus({ preventScroll: true });
          }}
          data-lenis-prevent
        >
          <div ref={list} role="radiogroup" aria-label={label} className={styles.rows}>
            <button
              type="button"
              role="radio"
              aria-checked={value === ""}
              className={styles.row}
              onClick={() => {
                pick("");
              }}
            >
              <span>{all}</span>
            </button>
            {options.map((o) => (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={value === o.value}
                disabled={o.count === 0 && value !== o.value}
                className={styles.row}
                onClick={() => {
                  pick(o.value);
                }}
              >
                <span>{o.label}</span>
                {o.count === undefined ? null : <span className={styles.rowCount}>{o.count}</span>}
              </button>
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
