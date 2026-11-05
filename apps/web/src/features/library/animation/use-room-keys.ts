"use client";

import { useEffect } from "react";

import type { CharacterSlug } from "@/lib/slugs";

import { buttonForDigit, stepIndex, type RoomButton } from "./room-math";
import type { Room } from "./use-room";

/** True when the key is meant for something else on the page: a field, or an open dialog. */
function ignored(e: KeyboardEvent): boolean {
  if (e.ctrlKey || e.metaKey || e.altKey) return true;
  const t = e.target;
  if (t instanceof HTMLElement) {
    if (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return true;
  }
  return document.querySelector("[role='dialog']") !== null;
}

/**
 * The keyboard of the room. 1 to 9 press the buttons in the order they are drawn (1 is Idle), Space
 * plays the welcome again, the arrows change the character and Esc goes back to idle.
 */
export function useRoomKeys(
  room: Room,
  order: readonly CharacterSlug[],
  buttons: readonly RoomButton[],
): void {
  const { welcome, idle, play, pick, selected, isLoaded } = room;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (ignored(e)) return;
      if (e.key === " " || e.code === "Space") {
        // A focused button would also act on Space: the room takes it for the welcome instead.
        e.preventDefault();
        if (!e.repeat) welcome();
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        if (!selected) return;
        e.preventDefault();
        const next =
          order[stepIndex(order.indexOf(selected), e.key === "ArrowRight" ? 1 : -1, order.length)];
        if (next) pick(next);
        return;
      }
      if (e.key === "Escape") {
        idle();
        return;
      }
      if (/^[1-9]$/.test(e.key)) {
        const b = buttonForDigit(buttons, Number(e.key));
        if (!b || b.files.some((f) => !isLoaded(f))) return;
        e.preventDefault();
        if (b.clip.kind === "idle") idle();
        else if (b.clip.scene) play(b.clip.scene);
      }
    };
    // Space on a button acts when the key comes up: stop that too.
    const onUp = (e: KeyboardEvent) => {
      if ((e.key === " " || e.code === "Space") && !ignored(e)) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onUp);
    };
  }, [welcome, idle, play, pick, selected, isLoaded, order, buttons]);
}
