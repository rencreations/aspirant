"use client";

import { useCallback, useEffect, useState, useSyncExternalStore, type RefObject } from "react";

/** `screen.orientation.lock` is not in every browser, nor in the DOM types. */
interface Lockable {
  lock?: (orientation: "landscape") => Promise<void>;
  unlock?: () => void;
}

const subscribeNever = (): (() => void) => () => undefined;

/** The browser can take an element full screen. Not so on an iPhone. False until the page is up. */
function useSupported(): boolean {
  return useSyncExternalStore(
    subscribeNever,
    () =>
      document.fullscreenEnabled && typeof HTMLElement.prototype.requestFullscreen === "function",
    () => false,
  );
}

/** A phone: a touch screen whose short side is under 600 CSS pixels. A tablet is not turned. */
function isPhone(): boolean {
  return (
    window.matchMedia("(pointer: coarse)").matches &&
    Math.min(window.screen.width, window.screen.height) < 600
  );
}

function unlock() {
  try {
    (window.screen.orientation as ScreenOrientation & Lockable).unlock?.();
  } catch {
    /* Nothing was locked. */
  }
}

/** Take an element full screen, and turn a phone to landscape. */
async function enter(el: HTMLElement) {
  try {
    await el.requestFullscreen({ navigationUI: "hide" });
  } catch {
    return;
  }
  if (!isPhone()) return;
  try {
    await (window.screen.orientation as ScreenOrientation & Lockable).lock?.("landscape");
  } catch {
    /* The browser keeps the shape it has: the layout follows it. */
  }
}

export interface Fullscreen {
  supported: boolean;
  on: boolean;
  toggle: () => void;
  /** Leave full screen, and resolve once the browser has. */
  exit: () => Promise<void>;
}

/**
 * Full screen for the room's element. On a phone it also turns the screen to landscape; when the
 * browser refuses the lock the view stays full screen in the shape it has and its layout follows.
 * The state follows `fullscreenchange`, so leaving with the browser's own control counts too.
 */
export function useFullscreen(target: RefObject<HTMLElement | null>): Fullscreen {
  const supported = useSupported();
  const [on, setOn] = useState(false);

  useEffect(() => {
    const el = target.current;
    const onChange = () => {
      const now = el !== null && document.fullscreenElement === el;
      setOn(now);
      if (!now) unlock();
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      // The room goes: it does not leave the visitor in full screen.
      if (el !== null && document.fullscreenElement === el) {
        void document.exitFullscreen().catch(() => undefined);
      }
      unlock();
    };
  }, [target]);

  const exit = useCallback(async () => {
    unlock();
    if (!document.fullscreenElement) return;
    await document.exitFullscreen().catch(() => undefined);
  }, []);

  const toggle = () => {
    if (document.fullscreenElement) {
      void exit();
      return;
    }
    if (supported && target.current) void enter(target.current);
  };

  return { supported, on, toggle, exit };
}
