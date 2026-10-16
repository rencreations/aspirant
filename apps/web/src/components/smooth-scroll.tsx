"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";

import { useReducedMotion } from "@/lib/hooks";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger);

/** @public */
export interface ScrollToOptions {
  /** Pixels added to the target position (negative to stop above it). */
  offset?: number;
  /** Jump without animating. Always true under reduced motion. */
  immediate?: boolean;
  /** Duration in seconds for the smooth scroll. */
  duration?: number;
}

export interface SmoothScrollApi {
  /** Scroll the page to a y position, an element or a selector. */
  scrollTo: (target: number | HTMLElement | string, options?: ScrollToOptions) => void;
  /** Stop page scrolling (for modals and transitions). Calls are counted; pair with resume. */
  pause: () => void;
  /** Undo one `pause()`. */
  resume: () => void;
  /** The Lenis instance, or null under reduced motion. */
  getLenis: () => Lenis | null;
}

const noop = () => undefined;
const SmoothScrollContext = createContext<SmoothScrollApi>({
  scrollTo: noop,
  pause: noop,
  resume: noop,
  getLenis: () => null,
});

/**
 * Lenis smooth scrolling on the GSAP ticker, with ScrollTrigger registered once and kept in
 * sync. Native scrolling under reduced motion. Mounted once in the root layout.
 */
export function SmoothScrollProvider({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  const lenisRef = useRef<Lenis | null>(null);
  const pauses = useRef(0);

  useEffect(() => {
    if (reduced) {
      ScrollTrigger.refresh();
      return;
    }
    const lenis = new Lenis({
      autoRaf: false,
      lerp: 0.12,
      wheelMultiplier: 1,
      touchMultiplier: 1.2,
      syncTouch: false,
    });
    lenisRef.current = lenis;
    if (pauses.current > 0) lenis.stop();
    const onScroll = () => ScrollTrigger.update();
    lenis.on("scroll", onScroll);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    ScrollTrigger.refresh();
    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, [reduced]);

  const api = useMemo<SmoothScrollApi>(
    () => ({
      scrollTo: (target, options = {}) => {
        const lenis = lenisRef.current;
        const immediate = options.immediate ?? false;
        if (lenis) {
          lenis.scrollTo(target, {
            offset: options.offset ?? 0,
            immediate,
            force: true,
            ...(options.duration ? { duration: options.duration } : {}),
          });
          return;
        }
        let y: number | null = null;
        if (typeof target === "number") y = target;
        else {
          const el = typeof target === "string" ? document.querySelector(target) : target;
          if (el) y = el.getBoundingClientRect().top + window.scrollY;
        }
        if (y == null) return;
        window.scrollTo({ top: y + (options.offset ?? 0), behavior: "auto" });
      },
      pause: () => {
        pauses.current += 1;
        lenisRef.current?.stop();
      },
      resume: () => {
        pauses.current = Math.max(0, pauses.current - 1);
        if (pauses.current === 0) lenisRef.current?.start();
      },
      getLenis: () => lenisRef.current,
    }),
    [],
  );

  return <SmoothScrollContext.Provider value={api}>{children}</SmoothScrollContext.Provider>;
}

/** Access smooth scrolling: `const { scrollTo, pause, resume } = useLenis()`. */
export function useLenis(): SmoothScrollApi {
  return useContext(SmoothScrollContext);
}
