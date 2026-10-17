"use client";

import { useEffect, useRef } from "react";

import { NAVIGATED_EVENT } from "@/lib/hooks";

import styles from "./scenes.module.css";
import { scrimState, type TextTheme, type ThemeZone } from "./scrim";

const POOL = 6;

function themeOf(el: Element | null): TextTheme {
  return (el as HTMLElement | null)?.dataset.theme === "daybreak" ? "daybreak" : "storm";
}

/** Top-level themed sections of the page content (not nested, not inside the scenes layer). */
function findZones(): HTMLElement[] {
  const main = document.getElementById("main") ?? document.body;
  const out: HTMLElement[] = [];
  for (const el of main.querySelectorAll<HTMLElement>("[data-theme]")) {
    if (el.closest("[data-scenes-layer]")) continue;
    const ancestor = el.parentElement?.closest("[data-theme]");
    if (ancestor && main.contains(ancestor)) continue;
    out.push(el);
  }
  return out;
}

/** Merge themed rects into viewport segments; gaps take the page theme. */
function segments(elements: HTMLElement[], vh: number): ThemeZone[] {
  const base = themeOf(document.documentElement);
  const spans: ThemeZone[] = [];
  for (const el of elements) {
    const r = el.getBoundingClientRect();
    if (r.bottom <= 0 || r.top >= vh || r.height <= 0) continue;
    spans.push({ y0: Math.max(0, r.top), y1: Math.min(vh, r.bottom), theme: themeOf(el) });
  }
  spans.sort((a, b) => a.y0 - b.y0);
  const out: ThemeZone[] = [];
  let cursor = 0;
  const push = (z: ThemeZone) => {
    if (z.y1 - z.y0 < 0.5) return;
    const last = out[out.length - 1];
    if (last && last.theme === z.theme && Math.abs(last.y1 - z.y0) < 1) last.y1 = z.y1;
    else out.push({ ...z });
  };
  for (const s of spans) {
    if (s.y0 > cursor) push({ y0: cursor, y1: s.y0, theme: base });
    push({ y0: Math.max(cursor, s.y0), y1: s.y1, theme: s.theme });
    cursor = Math.max(cursor, s.y1);
  }
  if (cursor < vh) push({ y0: cursor, y1: vh, theme: base });
  return out;
}

/**
 * The legibility veil: a band behind the text column whose colour follows the theme of the
 * text actually on screen (light under daybreak text, dark under storm text), split exactly at
 * theme boundaries. `strong` is used when no shader clamp runs (still art, Calm mode).
 */
export function ThemeScrim({ strong }: { strong: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const measure = measureRef.current;
    if (!root || !measure) return;
    const pool = Array.from(root.querySelectorAll<HTMLElement>("[data-zone]"));
    let zones = findZones();
    let raf = 0;
    let dirty = true;

    const paint = () => {
      raf = 0;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      scrimState.vw = vw;
      scrimState.vh = vh;
      scrimState.bandHalf = Math.min(vw / 2, measure.offsetWidth / 2);
      const segs = segments(zones, vh).slice(0, POOL);
      scrimState.zones = segs;
      pool.forEach((el, i) => {
        const z = segs[i];
        if (!z) {
          el.style.display = "none";
          return;
        }
        el.style.display = "block";
        el.style.top = `${z.y0}px`;
        el.style.height = `${z.y1 - z.y0}px`;
        el.dataset.zone = z.theme;
      });
      root.style.setProperty("--band-half", `${scrimState.bandHalf}px`);
      dirty = false;
    };
    const schedule = () => {
      dirty = true;
      if (!raf) raf = requestAnimationFrame(paint);
    };
    let refreshTimer = 0;
    const refresh = () => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        zones = findZones();
        schedule();
      }, 120);
    };

    const main = document.getElementById("main") ?? document.body;
    const observer = new MutationObserver(refresh);
    observer.observe(main, { childList: true, subtree: true, attributeFilter: ["data-theme"] });
    const rootObserver = new MutationObserver(schedule);
    rootObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    window.addEventListener(NAVIGATED_EVENT, refresh);
    if (dirty) paint();
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(refreshTimer);
      observer.disconnect();
      rootObserver.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener(NAVIGATED_EVENT, refresh);
    };
  }, []);

  return (
    <div ref={rootRef} className={styles.scrim} data-strong={strong ? "" : undefined}>
      <div ref={measureRef} className={styles.measure} />
      {Array.from({ length: POOL }, (_, i) => (
        <div key={i} data-zone="storm" className={styles.zone} style={{ display: "none" }} />
      ))}
    </div>
  );
}
