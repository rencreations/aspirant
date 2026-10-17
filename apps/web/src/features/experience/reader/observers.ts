"use client";

/**
 * Shared IntersectionObservers for the reader (one each, not one per element):
 * - placeholders: start loading a Part when its skeleton comes within a viewport and a half;
 * - key lines: light the words when a key line reaches the reading line, and pulse the scenes.
 */
import gsap from "gsap";

import { prefersReducedMotion } from "@/lib/hooks";

import { useExperience } from "../contract";
import { ensurePart } from "./book-store";
import s from "./reader.module.css";

/** The reading line, as a fraction of the viewport height from the top. */
export const READING_LINE = 0.46;

let placeholderIO: IntersectionObserver | null = null;

export function observePlaceholder(el: HTMLElement, part: number): () => void {
  if (typeof IntersectionObserver === "undefined") {
    void ensurePart(part);
    return () => undefined;
  }
  placeholderIO ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const n = Number((entry.target as HTMLElement).dataset.part);
        if (n) void ensurePart(n);
      }
    },
    { rootMargin: "150% 0px 150% 0px" },
  );
  const io = placeholderIO;
  io.observe(el);
  return () => io.unobserve(el);
}

// The beat: raised to 1 when a key line lands, then eased back to 0 so the next pulse is new.
let beatRaf = 0;
function pulseBeat(): void {
  useExperience.getState().pulse();
  cancelAnimationFrame(beatRaf);
  let last = performance.now();
  const decay = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const beat = Math.max(0, useExperience.getState().beat - dt / 1.2);
    useExperience.setState({ beat });
    beatRaf = beat > 0 ? requestAnimationFrame(decay) : 0;
  };
  beatRaf = requestAnimationFrame(decay);
}

function reveal(el: HTMLElement, animate: boolean) {
  if (el.dataset.state !== "idle") return;
  if (!animate || prefersReducedMotion()) {
    el.dataset.state = "shown";
    return;
  }
  el.dataset.state = "lighting";
  const words = Array.from(el.querySelectorAll<HTMLElement>("[data-w]"));
  const css = getComputedStyle(el);
  const ink = css.getPropertyValue("--text").trim() || "#eef3fa";
  const accent = css.getPropertyValue("--accent").trim() || ink;
  const hi = `.${s.hi}`;
  gsap.to(words, {
    color: (_i: number, word: HTMLElement) => (word.closest(hi) ? accent : ink),
    opacity: 1,
    duration: 0.9,
    stagger: Math.min(0.09, 1.4 / Math.max(1, words.length)),
    ease: "expo.out",
    onComplete: () => {
      el.dataset.state = "shown";
      gsap.set(words, { clearProps: "color,transform,opacity" });
    },
  });
  pulseBeat();
}

let keyIO: IntersectionObserver | null = null;

/** Watch every unlit key line under `root`. Returns a cleanup. */
export function observeKeyLines(root: HTMLElement): () => void {
  if (typeof IntersectionObserver === "undefined") return () => undefined;
  keyIO ??= new IntersectionObserver(
    (entries) => {
      const vh = window.innerHeight;
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target as HTMLElement;
        keyIO?.unobserve(el);
        // Crossing the reading line from below: animate. Already passed (a jump, or scrolling
        // back up): show it at once.
        const top = entry.boundingClientRect.top;
        reveal(el, top > vh * (READING_LINE - 0.3));
      }
    },
    { rootMargin: `0px 0px -${Math.round((1 - READING_LINE) * 100)}% 0px` },
  );
  const io = keyIO;
  const els = Array.from(root.querySelectorAll<HTMLElement>('[data-key][data-state="idle"]'));
  for (const el of els) io.observe(el);
  return () => {
    for (const el of els) io.unobserve(el);
  };
}
