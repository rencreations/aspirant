"use client";

import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";

import { LogoCurtain, type CurtainHandle } from "@/components/curtain/logo-curtain";
import { useLenis } from "@/components/smooth-scroll";
import { audio } from "@/lib/audio";
import { NAVIGATED_EVENT, prefersReducedMotion } from "@/lib/hooks";
import { whenPageReady } from "@/lib/page-ready";
import { runPreload, type PreloadProgress } from "@/lib/preload";
import { routeItems } from "@/lib/route-preloads";

/** A page that is not ready this long after the click gets the loading state. */
const LOADING_STATE_AFTER_MS = 500;

/** The shortest the first loading screen stays up, so the logo is seen. */
const BOOT_MIN_MS = 1500;

export interface PushOptions {
  /** Short name of the destination, for example "Experience". Shown in the loading state. */
  label?: string;
}

export interface TransitionRouter {
  /**
   * Navigate with the logo transition: the logo zooms out (its letters are windows onto the
   * page you are leaving), the route changes, then the logo zooms in and opens the new page.
   * If the new page is not ready after 500 ms a loading state shows. Reduced motion: a fade.
   */
  push: (href: Route, options?: PushOptions) => void;
  /** Prefetch a route. */
  prefetch: (href: Route) => void;
  /** True while a transition is running. */
  isTransitioning: () => boolean;
  /**
   * The first loading screen. Shows the logo and a real loading bar, runs `load` (which reports
   * progress), then opens the page through the letters of the logo. Resolves when the page is
   * fully visible.
   */
  boot: (load: (report: (p: PreloadProgress) => void) => Promise<void>) => Promise<void>;
}

const TransitionContext = createContext<TransitionRouter | null>(null);

function normalisePath(href: string): string {
  const path = href.split(/[?#]/)[0] ?? "/";
  return path.replace(/\/+$/, "") || "/";
}

function nextFrame(): Promise<void> {
  return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => window.setTimeout(r, ms));
}

/**
 * Page transitions and the first loading screen, both drawn by the logo curtain. Moves focus
 * to <main> afterwards. Use `useTransitionRouter().push()` or <TLink> for every internal
 * navigation.
 */
export function TransitionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { pause, resume, scrollTo } = useLenis();
  const curtain = useRef<CurtainHandle>(null);
  const busy = useRef(false);
  const waiter = useRef<{ target: string; resolve: () => void } | null>(null);
  const pathRef = useRef(pathname);

  useEffect(() => {
    pathRef.current = pathname;
    const w = waiter.current;
    if (w?.target === normalisePath(pathname)) {
      waiter.current = null;
      w.resolve();
    }
    // Let fixed UI re-sample the page (theme under the nav, scroll progress).
    const raf = requestAnimationFrame(() => window.dispatchEvent(new Event(NAVIGATED_EVENT)));
    return () => cancelAnimationFrame(raf);
  }, [pathname]);

  const waitForPath = useCallback((target: string) => {
    return new Promise<void>((resolve) => {
      if (normalisePath(pathRef.current) === target) {
        resolve();
        return;
      }
      const timer = window.setTimeout(() => {
        waiter.current = null;
        resolve();
      }, 8000);
      waiter.current = {
        target,
        resolve: () => {
          window.clearTimeout(timer);
          resolve();
        },
      };
    });
  }, []);

  const focusMain = useCallback(() => {
    document.getElementById("main")?.focus({ preventScroll: true });
  }, []);

  const push = useCallback(
    (href: Route, options: PushOptions = {}) => {
      const target = normalisePath(href);
      if (busy.current) return;
      const sameRoute = target === normalisePath(pathRef.current);
      if (sameRoute) {
        if (href.includes("#")) router.push(href);
        else scrollTo(0);
        return;
      }
      const c = curtain.current;
      if (!c) {
        router.push(href);
        return;
      }
      busy.current = true;
      pause();
      const startedAt = performance.now();
      router.prefetch(href);
      const assets = runPreload(routeItems(target));
      const label = options.label ? `Loading ${options.label}` : "Loading";

      const finish = () => {
        c.hide();
        busy.current = false;
        resume();
      };

      if (prefersReducedMotion()) {
        void (async () => {
          c.setMode("transition");
          c.setZoom(1);
          c.setFill(0);
          c.show();
          await c.fade(1, 0.09);
          router.push(href, { scroll: false });
          await Promise.all([waitForPath(target), assets]);
          window.scrollTo(0, 0);
          await nextFrame();
          focusMain();
          await c.fade(0, 0.09);
          finish();
        })();
        return;
      }

      void (async () => {
        c.setMode("transition");
        c.setFill(0);
        c.setZoom(1);
        c.show();
        audio.blip("whoosh");
        // Zoom out: the logo appears, its letters showing the page that is leaving.
        await c.tweenZoom(0, 0.85, "power3.inOut");
        router.push(href, { scroll: false });
        let ready = false;
        const arrived = Promise.all([waitForPath(target), assets])
          .then(() => whenPageReady(3500))
          .then(() => nextFrame())
          .then(() => {
            ready = true;
          });
        const left = LOADING_STATE_AFTER_MS - (performance.now() - startedAt);
        if (left > 0) await Promise.race([arrived, sleep(left)]);
        let waiting = false;
        if (!ready) {
          // Still loading after 500 ms: cover the windows and show the loading state.
          waiting = true;
          void c.tweenFill(1, 0.3);
          c.startWaiting(label);
          await arrived;
        }
        if (waiting) {
          c.stopLoops();
          await c.tweenFill(0, 0.4);
        }
        scrollTo(0, { immediate: true });
        window.scrollTo(0, 0);
        focusMain();
        audio.blip("star");
        // Zoom in: a letter window grows until it fills the screen with the new page.
        await c.tweenZoom(1, 1.05, "power3.inOut");
        finish();
      })();
    },
    [focusMain, pause, resume, router, scrollTo, waitForPath],
  );

  const boot = useCallback(
    async (load: (report: (p: PreloadProgress) => void) => Promise<void>) => {
      const c = curtain.current;
      if (!c) {
        await load(() => undefined);
        return;
      }
      busy.current = true;
      const reduced = prefersReducedMotion();
      c.setMode("boot");
      c.setZoom(0);
      c.setFill(1);
      c.showBoot(true);
      c.show();
      if (!reduced) c.startIdle();

      const report = (p: PreloadProgress) => {
        c.setBoot(p.progress, p.label);
      };
      await Promise.all([load(report), sleep(reduced ? 300 : BOOT_MIN_MS)]);
      c.setBoot(1, "Drawing the page");
      await whenPageReady(5000);
      c.setBoot(1, "Ready");
      await sleep(reduced ? 80 : 380);
      c.showBoot(false);
      await nextFrame();

      if (reduced) {
        await c.fadeOut(0.2);
      } else {
        // The white of the letters drains away, then the logo zooms in through a letter.
        await c.tweenFill(0, 0.75);
        c.stopLoops();
        audio.blip("star");
        await c.tweenZoom(1, 1.5, "power3.inOut");
      }
      c.hide();
      c.setMode("transition");
      busy.current = false;
    },
    [],
  );

  const api = useMemo<TransitionRouter>(
    () => ({
      push,
      prefetch: (href) => router.prefetch(href),
      isTransitioning: () => busy.current,
      boot,
    }),
    [boot, push, router],
  );

  return (
    <TransitionContext.Provider value={api}>
      {children}
      <LogoCurtain ref={curtain} />
    </TransitionContext.Provider>
  );
}

/** The transition-aware router. Falls back to plain navigation outside the provider. */
export function useTransitionRouter(): TransitionRouter {
  const ctx = useContext(TransitionContext);
  const router = useRouter();
  return useMemo(
    () =>
      ctx ?? {
        push: (href: Route) => router.push(href),
        prefetch: (href: Route) => router.prefetch(href),
        isTransitioning: () => false,
        boot: (load) => load(() => undefined),
      },
    [ctx, router],
  );
}
