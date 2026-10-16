"use client";

import gsap from "gsap";
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

import { useLenis } from "@/components/smooth-scroll";
import { StarGlyph } from "@/components/star-glyph";
import { audio } from "@/lib/audio";
import { NAVIGATED_EVENT, prefersReducedMotion } from "@/lib/hooks";

import styles from "./transition.module.css";

export interface PushOptions {
  /** Viewport point the iris opens from (defaults to the centre). */
  origin?: { x: number; y: number };
  /** Short label shown while covered, for example "Experience". */
  label?: string;
}

export interface TransitionRouter {
  /** Navigate with the hexagon iris (a 150 ms crossfade under reduced motion). */
  push: (href: Route, options?: PushOptions) => void;
  /** Prefetch a route. */
  prefetch: (href: Route) => void;
  /** True while a transition is running. */
  isTransitioning: () => boolean;
  /**
   * Start fully covered and open the hexagon iris onto the current page. Used by the loader
   * gate after its light flash ("light" tiles) and available for other full-screen exits.
   */
  reveal: (options?: { tone?: "light" | "dark" }) => Promise<void>;
}

const TransitionContext = createContext<TransitionRouter | null>(null);

const SQRT3 = Math.sqrt(3);

function normalisePath(href: string): string {
  const path = href.split(/[?#]/)[0] ?? "/";
  return path.replace(/\/+$/, "") || "/";
}

function nextFrame(): Promise<void> {
  return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
}

/**
 * Page transitions. Covers the screen with a grid of hexagon tiles (GSAP, staggered from the
 * click point), navigates, then reveals the new page from the centre. Moves focus to <main>
 * afterwards. Use `useTransitionRouter().push()` or <TLink> for every internal navigation.
 */
export function TransitionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { pause, resume, scrollTo } = useLenis();
  const overlayRef = useRef<HTMLDivElement>(null);
  const tilesRef = useRef<HTMLDivElement>(null);
  const centerRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const fadeRef = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const grid = useRef({ key: "", rows: 0, cols: 0 });
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
      }, 6000);
      waiter.current = {
        target,
        resolve: () => {
          window.clearTimeout(timer);
          resolve();
        },
      };
    });
  }, []);

  const buildTiles = useCallback(() => {
    const host = tilesRef.current;
    if (!host) return { rows: 0, cols: 0 };
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const size = Math.round(Math.min(168, Math.max(64, vw / 12)));
    const height = (size * 2) / SQRT3;
    const cols = Math.ceil(vw / size) + 1;
    const rows = Math.ceil(vh / (height * 0.75)) + 1;
    const key = `${cols}x${rows}x${size}`;
    if (grid.current.key === key) return grid.current;
    const frag = document.createDocumentFragment();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const tile = document.createElement("div");
        tile.className = styles.tile ?? "";
        const x = c * size - (r % 2 ? 0 : size / 2);
        const y = r * height * 0.75 - height / 2;
        tile.style.cssText = `left:${x}px;top:${y}px;width:${size + 1}px;height:${height + 1}px`;
        frag.appendChild(tile);
      }
    }
    host.replaceChildren(frag);
    grid.current = { key, rows, cols };
    return grid.current;
  }, []);

  const focusMain = useCallback(() => {
    const main = document.getElementById("main");
    main?.focus({ preventScroll: true });
  }, []);

  const push = useCallback(
    (href: Route, options: PushOptions = {}) => {
      const target = normalisePath(href);
      if (busy.current) return;
      if (target === normalisePath(pathRef.current) && !href.includes("#")) {
        scrollTo(0);
        return;
      }
      const overlay = overlayRef.current;
      if (!overlay) {
        router.push(href);
        return;
      }
      busy.current = true;
      overlay.dataset.active = "true";
      pause();

      const finish = () => {
        overlay.dataset.active = "false";
        busy.current = false;
        resume();
      };

      if (prefersReducedMotion()) {
        const fade = fadeRef.current;
        void (async () => {
          if (fade) await gsap.to(fade, { opacity: 1, duration: 0.075, ease: "none" });
          router.push(href, { scroll: false });
          await waitForPath(target);
          window.scrollTo(0, 0);
          await nextFrame();
          focusMain();
          if (fade) await gsap.to(fade, { opacity: 0, duration: 0.075, ease: "none" });
          finish();
        })();
        return;
      }

      const { rows, cols } = buildTiles();
      const tiles = tilesRef.current ? Array.from(tilesRef.current.children) : [];
      const ox = options.origin ? options.origin.x / window.innerWidth : 0.5;
      const oy = options.origin ? options.origin.y / window.innerHeight : 0.5;
      if (labelRef.current) labelRef.current.textContent = options.label ?? "Loading";
      audio.blip("whoosh");

      void (async () => {
        gsap.set(tiles, { scale: 0, rotate: -30 });
        await gsap
          .timeline()
          .to(tiles, {
            scale: 1.04,
            rotate: 0,
            duration: 0.42,
            ease: "power3.out",
            stagger: { grid: [rows, cols], from: [ox, oy], amount: 0.38 },
          })
          .to(centerRef.current, { opacity: 1, duration: 0.2, ease: "none" }, "-=0.25");
        router.push(href, { scroll: false });
        await waitForPath(target);
        scrollTo(0, { immediate: true });
        window.scrollTo(0, 0);
        await nextFrame();
        focusMain();
        audio.blip("star");
        await gsap
          .timeline()
          .to(centerRef.current, { opacity: 0, duration: 0.18, ease: "none" })
          .to(tiles, {
            scale: 0,
            rotate: 30,
            duration: 0.36,
            ease: "power3.in",
            stagger: { grid: [rows, cols], from: "center", amount: 0.34 },
          });
        finish();
      })();
    },
    [buildTiles, focusMain, pause, resume, router, scrollTo, waitForPath],
  );

  const reveal = useCallback(
    async ({ tone = "dark" }: { tone?: "light" | "dark" } = {}) => {
      const overlay = overlayRef.current;
      if (!overlay || busy.current) return;
      busy.current = true;
      overlay.dataset.active = "true";
      overlay.dataset.tone = tone;
      if (prefersReducedMotion()) {
        const fade = fadeRef.current;
        if (fade) {
          gsap.set(fade, { opacity: 1 });
          await gsap.to(fade, { opacity: 0, duration: 0.15, ease: "none" });
        }
      } else {
        buildTiles();
        const tiles = tilesRef.current ? Array.from(tilesRef.current.children) : [];
        const { rows, cols } = grid.current;
        gsap.set(tiles, { scale: 1.04, rotate: 0 });
        await nextFrame();
        await gsap.to(tiles, {
          scale: 0,
          rotate: 30,
          duration: 0.5,
          ease: "power3.in",
          stagger: { grid: [rows, cols], from: "center", amount: 0.55 },
        });
      }
      overlay.dataset.active = "false";
      overlay.dataset.tone = "dark";
      busy.current = false;
    },
    [buildTiles],
  );

  const api = useMemo<TransitionRouter>(
    () => ({
      push,
      prefetch: (href) => router.prefetch(href),
      isTransitioning: () => busy.current,
      reveal,
    }),
    [push, reveal, router],
  );

  return (
    <TransitionContext.Provider value={api}>
      {children}
      <div
        ref={overlayRef}
        className={styles.overlay}
        data-active="false"
        data-tone="dark"
        aria-hidden="true"
        data-overlay="transition"
      >
        <div ref={fadeRef} className={styles.fade} />
        <div ref={tilesRef} className={styles.tiles} />
        <div ref={centerRef} className={styles.center}>
          <StarGlyph className={styles.star} />
          <span ref={labelRef} className={styles.label} />
        </div>
      </div>
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
        reveal: () => Promise.resolve(),
      },
    [ctx, router],
  );
}
