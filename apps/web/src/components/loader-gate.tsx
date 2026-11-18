"use client";

import { usePathname } from "next/navigation";
import { Component, useEffect, useRef, type ReactNode } from "react";

import { hasWebGL } from "@/components/gl/use-gl-ready";
import { HomeBoot } from "@/components/home-boot/home-boot";
import { useTransitionRouter } from "@/components/transition/transition-provider";
import { useScrollLock } from "@/features/character/vexana/seams/scroll-lock";
import { audio } from "@/lib/audio";
import { runHomeFlow, selectHomeActive, useHomeFlow } from "@/lib/home-flow";
import { useMounted } from "@/lib/hooks";
import { loadingNote } from "@/lib/loading-note";
import { useNavLock } from "@/lib/nav-lock";
import { isOffline } from "@/lib/offline";
import { whenPageReady } from "@/lib/page-ready";
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
 * How long the home opening may hold the scroll. This is only a guard against a hold nobody gave
 * back, never a time to wait for: the opening ends when the intro ends, however long that takes.
 */
const HOME_HOLD_LIMIT_MS = 2 * 60 * 60 * 1000;

/** If the home loading screen throws, the page opens at once (a failure handled, not a version). */
class HomeBootBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: unknown) {
    console.warn("The home loading screen failed; opening the page.", error);
    useHomeFlow.getState().abort();
  }

  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * The first visit of a browser session: shows the logo loading screen, loads everything the
 * landing page needs through `lib/preload.ts` (the bar reports real work), then opens the page
 * through the letters of the logo. There is nothing to click, and it waits for as long as the
 * connection needs: one version of the site only. The server always renders the
 * full site underneath, so crawlers and no-JS visitors get the content; a boot script paints a
 * light cover first (html[data-gate="on"]) to avoid a flash.
 *
 * The one exception is a document load of the home page (a visit from outside, or a reload: see
 * `lib/home-arrival.ts`, decided by the boot script before first paint). That runs the home's own
 * opening instead of the curtain, whether or not this tab has entered: a loading screen under the
 * plain cover (`components/home-boot/`), the same real preload of the home's list, then one press
 * ("Touch anywhere to continue", which is also the browser's gesture for the sound), then the intro.
 * The press is only asked for at 100 percent, when nothing is skipped, so it is not an "Enter now".
 * This component is the stable host of that opening and owns what must not depend on how it looks:
 * the inert page, the router claim, the scroll hold, the listeners for the press, `entered` (set at
 * the end of the intro, not at the press) and the notes for a slow connection and for no connection.
 *
 * Browsers only start audio after a gesture, so the first touch, click or key press anywhere
 * unlocks it.
 */
export function LoaderGate() {
  const mounted = useMounted();
  const pathname = usePathname();
  const entered = useSiteStore((s) => s.entered);
  const setEntered = useSiteStore((s) => s.setEntered);
  const homeActive = useHomeFlow(selectHomeActive);
  const { boot, claim } = useTransitionRouter();
  const { lock } = useScrollLock();
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
    const flow = useHomeFlow.getState();
    // A home arrival that is already open means its loading screen failed before this ran
    // (`abort`): the page is open, so there is nothing left to load behind a cover.
    const home = flow.arrival === "document" && flow.phase !== "open";
    const aborted = flow.arrival === "document" && flow.phase === "open";
    if (!home && (aborted || entered || readEntered())) {
      delete root.dataset.gate;
      delete root.dataset.gateKind;
      if (shell) shell.inert = false;
      if (aborted) setEntered(true);
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
      const offline = isOffline();
      const retrying = retriesWaiting() > 0;
      if (home) useHomeFlow.getState().setNotes({ slow, offline, retrying });
      if (!el) return;
      el.hidden = finished || !(slow || offline);
      if (!el.hidden) {
        // On the home the screen's number is floored and never 100 before the list is done: the
        // note says the same number as the bar, not a rounded one.
        const said =
          home && latest
            ? { ...latest, progress: Math.min(0.99, Math.floor(latest.progress * 100) / 100) }
            : latest;
        el.textContent = loadingNote(said, { offline, retrying });
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

    let releaseRouter: (() => void) | null = null;
    let releaseScroll: (() => void) | null = null;
    let run: Promise<void>;
    if (home) {
      // The home's own opening: no curtain. The tab counts as not entered until the intro has
      // ended (the consent plate, the menu art and the About drone wait for it), also on a reload.
      setEntered(false);
      releaseRouter = claim();
      releaseScroll = lock(HOME_HOLD_LIMIT_MS);
      window.scrollTo(0, 0);
      // The bar is empty for the whole opening: the menu and the sound button come at its end, and
      // the logo is not shown (the page's own big logo morphs into it). With no WebGL there is no
      // big logo, so the bar keeps its own.
      useNavLock.setState({ hideControls: true, hideLogo: hasWebGL() });
      run = runHomeFlow({
        // The same real preload as any page: the home's list, however long it takes.
        load: (report) =>
          runPreload(routeItems("/"), (p) => {
            latest = p;
            report(p);
            if (slow || isOffline()) paint();
          }),
        ready: () => whenPageReady(),
        // The loading screen has drawn its first frame: the plain cover can go.
        dropCover: () => {
          delete root.dataset.gate;
          delete root.dataset.gateKind;
        },
        loaded: () => {
          finished = true;
          paint();
        },
      });
    } else {
      run = boot((report) =>
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
    }
    void run.finally(() => {
      finished = true;
      window.clearTimeout(warn);
      window.removeEventListener("offline", paint);
      window.removeEventListener("online", paint);
      stopRetries();
      paint();
      delete root.dataset.gate;
      delete root.dataset.gateKind;
      if (shell) shell.inert = false;
      if (home) {
        // The page opens at its top. Giving the scroll back makes the smooth scroller start again
        // from where the page is.
        window.scrollTo(0, 0);
        releaseScroll?.();
        releaseRouter?.();
        // However the opening ended (the intro, a skip, no WebGL, a failure): the menu and the sound
        // button fade in. The logo is the page's to give back.
        useNavLock.setState({ hideControls: false });
      }
      setEntered(true);
      say("Loaded");
      document.getElementById("main")?.focus({ preventScroll: true });
    });
  }, [boot, claim, entered, lock, mounted, pathname, setEntered]);

  return (
    <>
      <p ref={statusRef} role="status" aria-live="polite" className="sr-only" />
      <p
        ref={noteRef}
        hidden
        className="pointer-events-none fixed bottom-[max(5.5rem,calc(env(safe-area-inset-bottom)+4.5rem))] left-1/2 z-[2000] w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2 text-center text-[0.75rem] leading-relaxed tracking-[0.04em] text-[#140e26]"
      />
      {homeActive ? (
        <HomeBootBoundary>
          <HomeBoot />
        </HomeBootBoundary>
      ) : null}
    </>
  );
}
