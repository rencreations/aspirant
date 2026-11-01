"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { useTransitionRouter } from "@/components/transition/transition-provider";
import { audio } from "@/lib/audio";
import { useMounted } from "@/lib/hooks";
import { loadingNote } from "@/lib/loading-note";
import { isOffline } from "@/lib/offline";
import { runPreload, type PreloadProgress } from "@/lib/preload";
import { onRetries, retriesWaiting } from "@/lib/retry";
import { routeItems } from "@/lib/route-preloads";
import { readEntered, useSiteStore } from "@/lib/stores";

declare global {
  interface Window {
    /** Set when the gate mounts, so the boot script's failsafe leaves the cover alone. */
    __aspirantsGate?: boolean;
  }
}

/** Element id of the wrapper around nav, HUD and <main>. It is made inert while loading. */
export const SHELL_ID = "site-shell";

/**
 * After this long the loading screen says the connection is slow and shows the real progress.
 * Nobody is let in before everything is loaded: there is no button to go in early and no time
 * after which the page opens without its files (owner decision, 1 Nov 2026).
 */
const SLOW_AFTER_MS = 15_000;

/**
 * The first visit of a browser session: shows the logo loading screen, loads everything the
 * landing page needs through `lib/preload.ts` (the bar reports real work), then opens the page
 * through the letters of the logo. There is nothing to click, and it waits for as long as the
 * connection needs: one version of the site only. The server always renders the
 * full site underneath, so crawlers and no-JS visitors get the content; a boot script paints a
 * light cover first (html[data-gate="on"]) to avoid a flash.
 *
 * Browsers only start audio after a gesture, so the first touch, click or key press anywhere
 * unlocks it.
 */
export function LoaderGate() {
  const mounted = useMounted();
  const pathname = usePathname();
  const entered = useSiteStore((s) => s.entered);
  const setEntered = useSiteStore((s) => s.setEntered);
  const { boot } = useTransitionRouter();
  const started = useRef(false);
  const noteRef = useRef<HTMLParagraphElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const say = (text: string) => {
    if (statusRef.current) statusRef.current.textContent = text;
  };

  useEffect(() => {
    const unlock = () => {
      audio.unlock();
    };
    const opts = { once: true, passive: true } as const;
    window.addEventListener("pointerdown", unlock, opts);
    window.addEventListener("keydown", unlock, opts);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    if (!mounted || started.current) return;
    const root = document.documentElement;
    const shell = document.getElementById(SHELL_ID);
    // The boot script's cover stays until this is set (the scripts have started).
    window.__aspirantsGate = true;
    if (entered || readEntered()) {
      delete root.dataset.gate;
      if (shell) shell.inert = false;
      started.current = true;
      return;
    }
    started.current = true;
    if (shell) shell.inert = true;
    say("Loading the site");
    // The note under the bar: shown when the connection is slow (15 s) or gone, and it carries the
    // same real progress as the bar. Written straight into the element, not through state.
    let latest: PreloadProgress | null = null;
    let slow = false;
    let finished = false;
    const paint = () => {
      const el = noteRef.current;
      if (!el) return;
      const offline = isOffline();
      el.hidden = finished || !(slow || offline);
      if (!el.hidden) {
        el.textContent = loadingNote(latest, { offline, retrying: retriesWaiting() > 0 });
      }
    };
    const warn = window.setTimeout(() => {
      slow = true;
      paint();
    }, SLOW_AFTER_MS);
    window.addEventListener("offline", paint);
    window.addEventListener("online", paint);
    const stopRetries = onRetries(paint);
    paint();
    const run = boot((report) =>
      // Everything the page needs, however long it takes. Once the page is on its way open, the
      // files that are still arriving (the deferred ones) must not move the curtain's bar any
      // more: runPreload has ended by then, so nothing can.
      runPreload(routeItems(pathname), (p) => {
        latest = p;
        report(p);
        if (slow || isOffline()) paint();
      }),
    );
    // The curtain is drawn now; the plain cover can go.
    requestAnimationFrame(() => {
      delete root.dataset.gate;
    });
    void run.finally(() => {
      finished = true;
      window.clearTimeout(warn);
      window.removeEventListener("offline", paint);
      window.removeEventListener("online", paint);
      stopRetries();
      paint();
      delete root.dataset.gate;
      if (shell) shell.inert = false;
      setEntered(true);
      say("Loaded");
      document.getElementById("main")?.focus({ preventScroll: true });
    });
  }, [boot, entered, mounted, pathname, setEntered]);

  return (
    <>
      <p ref={statusRef} role="status" aria-live="polite" className="sr-only" />
      <p
        ref={noteRef}
        hidden
        className="pointer-events-none fixed bottom-[max(5.5rem,calc(env(safe-area-inset-bottom)+4.5rem))] left-1/2 z-[2000] w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2 text-center text-[0.75rem] leading-relaxed tracking-[0.04em] text-[#140e26]"
      />
    </>
  );
}
