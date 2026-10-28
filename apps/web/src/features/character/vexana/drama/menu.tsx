"use client";

import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";

import styles from "./menus.module.css";

interface MenuProps {
  /** The label of the group, read out by a screen reader. */
  label: string;
  /** Focus the first item that can be pressed when the menu appears. */
  autoFocus?: boolean;
  children: ReactNode;
}

/**
 * A vertical list of buttons. Up and Down move between the ones that can be pressed (Home and End
 * go to the first and the last); Enter and Space press the focused one, as for any button.
 */
export function Menu({ label, autoFocus = true, children }: MenuProps) {
  const root = useRef<HTMLDivElement>(null);
  // Only when the menu appears: a later change of the prop must not move the focus.
  const focusFirst = useRef(autoFocus);

  useEffect(() => {
    if (!focusFirst.current) return;
    root.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus({
      preventScroll: true,
    });
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const keys = ["ArrowDown", "ArrowUp", "Home", "End"];
    if (!keys.includes(e.key)) return;
    const items = Array.from(
      root.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [],
    );
    if (items.length === 0) return;
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    let next = at;
    if (e.key === "ArrowDown") next = (at + 1) % items.length;
    else if (e.key === "ArrowUp") next = (at - 1 + items.length) % items.length;
    else if (e.key === "Home") next = 0;
    else next = items.length - 1;
    items[next]?.focus({ preventScroll: true });
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div ref={root} className={styles.menu} role="group" aria-label={label} onKeyDown={onKeyDown}>
      {children}
    </div>
  );
}

interface MenuButtonProps {
  onPress: () => void;
  disabled?: boolean;
  /** A short line under the label (where "Continue" would go to). */
  hint?: string;
  children: ReactNode;
}

export function MenuButton({ onPress, disabled = false, hint, children }: MenuButtonProps) {
  return (
    <button type="button" className={styles.item} disabled={disabled} onClick={onPress}>
      <i className={styles.caret} aria-hidden="true" />
      <span>{children}</span>
      {hint ? <em>{hint}</em> : null}
    </button>
  );
}
