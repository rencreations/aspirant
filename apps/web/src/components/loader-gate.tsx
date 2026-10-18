"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { useTransitionRouter } from "@/components/transition/transition-provider";
import { audio } from "@/lib/audio";
import { useMounted } from "@/lib/hooks";
import { runPreload } from "@/lib/preload";
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
 * The first visit of a browser session: shows the logo loading screen, loads everything the
 * landing page needs through `lib/preload.ts` (the bar reports real work), then opens the page
 * through the letters of the logo. There is nothing to click. The server always renders the
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
    if (entered || readEntered()) {
      delete root.dataset.gate;
      if (shell) shell.inert = false;
      started.current = true;
      return;
    }
    started.current = true;
    window.__aspirantsGate = true;
    if (shell) shell.inert = true;
    say("Loading the site");
    const run = boot((report) => runPreload(routeItems(pathname), report));
    // The curtain is drawn now; the plain cover can go.
    requestAnimationFrame(() => {
      delete root.dataset.gate;
    });
    void run.finally(() => {
      delete root.dataset.gate;
      if (shell) shell.inert = false;
      setEntered(true);
      say("Loaded");
      document.getElementById("main")?.focus({ preventScroll: true });
    });
  }, [boot, entered, mounted, pathname, setEntered]);

  return <p ref={statusRef} role="status" aria-live="polite" className="sr-only" />;
}
