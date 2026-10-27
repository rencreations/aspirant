"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useTransitionRouter } from "@/components/transition/transition-provider";
import { audio } from "@/lib/audio";
import { useMounted } from "@/lib/hooks";
import { capWait, runPreload } from "@/lib/preload";
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

/** After this long a visitor who is still waiting is offered a way in (a slow connection). */
const SKIP_AFTER_MS = 12_000;
/** The longest the first visit waits. What is still arriving then arrives late, and the page copes. */
const BOOT_MAX_WAIT_MS = 60_000;

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
  const [canSkip, setCanSkip] = useState(false);
  const skip = useRef<() => void>(() => undefined);
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
    // The visitor can open the page early: the files that are still on their way go on arriving.
    const early = new Promise<void>((resolve) => {
      skip.current = resolve;
    });
    const offer = window.setTimeout(() => {
      setCanSkip(true);
    }, SKIP_AFTER_MS);
    const run = boot((report) => {
      // Once the page is on its way open (the visitor's choice, or the cap), the files that are
      // still arriving must not move the curtain's bar any more: the curtain is already running
      // its own animations, and a late bar update would disturb them.
      let open = false;
      const loading = capWait(
        runPreload(routeItems(pathname), (p) => {
          if (!open) report(p);
        }),
        BOOT_MAX_WAIT_MS,
      );
      return Promise.race([loading, early]).finally(() => {
        open = true;
      });
    });
    // The curtain is drawn now; the plain cover can go.
    requestAnimationFrame(() => {
      delete root.dataset.gate;
    });
    void run.finally(() => {
      window.clearTimeout(offer);
      setCanSkip(false);
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
      {canSkip ? (
        <button
          type="button"
          onClick={() => {
            skip.current();
          }}
          className="fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-1/2 z-[2000] min-h-11 -translate-x-1/2 cursor-pointer rounded-full border border-[rgb(20_14_38/0.55)] bg-[rgb(244_246_249/0.92)] px-6 py-3 text-[0.8125rem] font-semibold tracking-[0.04em] text-[#140e26]"
        >
          Enter now
          <span className="ml-2 font-normal opacity-70">The rest keeps loading</span>
        </button>
      ) : null}
    </>
  );
}
