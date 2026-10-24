"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect, useRef, useSyncExternalStore, type RefObject } from "react";

import { useReducedMotion } from "@/lib/hooks";
import { onPerfLevel, perfLevel, type PerfLevel } from "@/lib/perf";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger);

/** Where the boundary sits on screen, as a share of the screen height, when a seam starts and ends. */
const FROM = 0.96;
const TO = 0.1;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
/** 0 before `a`, 1 after `b`, linear between. */
export const seg = (v: number, a: number, b: number) => clamp01((v - a) / (b - a));
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** What an effect knows about the screen while it draws. All lengths are pixels. */
export interface Frame {
  /** Screen width and height. */
  vw: number;
  vh: number;
  /** Height of the stage (one and a half screens, centred on the boundary). */
  sh: number;
  /** Where the boundary is on screen (y down) at this progress. */
  by: number;
}

/** A y on screen turned into a y in the stage, whose top is half a stage above the boundary. */
export const toStage = (f: Frame, screenY: number) => screenY - (f.by - f.sh / 2);

/** Writes a style only when it changed (most values rest most frames). */
const last = new WeakMap<HTMLElement | SVGElement, Map<string, string>>();
export function put(el: HTMLElement | SVGElement | null | undefined, prop: string, value: string) {
  if (!el) return;
  let m = last.get(el);
  if (!m) {
    m = new Map();
    last.set(el, m);
  }
  if (m.get(prop) === value) return;
  m.set(prop, value);
  el.style.setProperty(prop, value);
}

export type SeamTier = "off" | "balanced" | "full";

/**
 * A seam is a stage laid over the join of two sections, drawn from the scroll position alone (one
 * ScrollTrigger, no frame loop, nothing remembered), so scrolling back plays it backwards. The
 * hook gives the anchor element (zero height, at the join) and the tier: nothing under reduced
 * motion and on the `lite` level, a lighter version on `balanced`.
 */
export function useSeam(draw: (q: number, f: Frame) => void): {
  anchor: RefObject<HTMLDivElement | null>;
  tier: SeamTier;
} {
  const anchor = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const level = useSyncExternalStore<PerfLevel | null>(onPerfLevel, perfLevel, () => null);
  const drawRef = useRef(draw);

  useEffect(() => {
    drawRef.current = draw;
  });

  const tier: SeamTier = reduced || level === null || level === "lite" ? "off" : level;

  useEffect(() => {
    const el = anchor.current;
    const stage = el?.firstElementChild as HTMLElement | null | undefined;
    if (!el || !stage || tier === "off") return;
    const frame: Frame = { vw: 1, vh: 1, sh: 1, by: 0 };
    const measure = () => {
      frame.vw = window.innerWidth;
      frame.vh = window.innerHeight;
      frame.sh = stage.offsetHeight;
    };
    const run = (p: number) => {
      frame.by = frame.vh * (FROM - (FROM - TO) * p);
      put(stage, "visibility", p <= 0.001 || p >= 0.999 ? "hidden" : "visible");
      if (p > 0.001 && p < 0.999) drawRef.current(p, frame);
    };
    measure();
    const st = ScrollTrigger.create({
      trigger: el,
      start: () => `top ${FROM * 100}%`,
      end: () => `top ${TO * 100}%`,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        run(self.progress);
      },
      onRefresh: (self) => {
        measure();
        run(self.progress);
      },
    });
    run(st.progress);
    return () => {
      st.kill();
    };
  }, [tier]);

  return { anchor, tier };
}
