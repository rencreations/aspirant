"use client";

import { useEffect, type KeyboardEvent } from "react";

import { useLenis } from "@/components/smooth-scroll";
import { isTypingTarget } from "@/lib/hooks";

/** Pause the page's smooth scrolling while a modal is open. */
export function useModalScrollLock(open: boolean): void {
  const { pause, resume } = useLenis();
  useEffect(() => {
    if (!open) return;
    pause();
    return resume;
  }, [open, pause, resume]);
}

/**
 * The next-page footer listens for "n" on the whole window. Inside a modal that key must not
 * leave the page, so the modal marks it as handled. Typing in a field is left alone.
 */
export function shieldNextHotkey(e: KeyboardEvent): void {
  if (e.key.toLowerCase() === "n" && !isTypingTarget(e.target)) e.preventDefault();
}

/** Returns focus to the control that opened the modal (Safari does not focus buttons on click). */
export function restoreFocusTo(opener: HTMLElement | null) {
  return (event: Event) => {
    if (!opener?.isConnected) return;
    event.preventDefault();
    opener.focus({ preventScroll: true });
  };
}
