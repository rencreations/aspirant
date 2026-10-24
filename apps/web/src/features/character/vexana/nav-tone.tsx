"use client";

import { useEffect } from "react";

import { toneHint } from "./seams/gates";

/**
 * Which tone is behind the top-right corner of the screen: `light` (a pale page, so dark ink reads)
 * or `dark` (an ink page, so white reads). The nav on Vexana's page has no bar, so its text
 * ("04 Characters") sits straight on the picture and has to follow it. The answer is written to
 * the nav as `data-vx-tone`, and only when it changes.
 *
 * The sections do not all carry a `data-theme`, so each is named here by its id. A section that
 * changes while it is on screen (the opening goes from pale to ink) sets `data-vx-tone` on itself.
 * A section marked `auto` is read from the colour painted under the corner (the comic: two halves).
 */
const TONES: Record<string, "light" | "dark" | "auto"> = {
  about: "dark",
  reel: "light",
  skills: "dark",
  faces: "light",
  cover: "dark",
  comics: "auto",
  stream: "dark",
  drama: "dark",
  process: "dark",
  guinevere: "light",
  art: "dark",
  fanart: "light",
};

/** Relative luminance of a computed colour, with its alpha, or null when it is not a colour. */
function paint(css: string): { lum: number; alpha: number } | null {
  const nums = css.match(/-?\d*\.?\d+(?:e-?\d+)?/g);
  if (!nums || nums.length < 3) return null;
  const v = nums.map(Number);
  const unit = css.startsWith("color(");
  const ch = (n: number) => {
    const c = unit ? n : n / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const lum = 0.2126 * ch(v[0]!) + 0.7152 * ch(v[1]!) + 0.0722 * ch(v[2]!);
  return { lum, alpha: v.length > 3 ? (v[3] ?? 1) : 1 };
}

/** The tone behind a point, from the elements stacked there, topmost first. */
function toneAt(x: number, y: number): "light" | "dark" {
  const stack = document.elementsFromPoint(x, y).filter((el) => !el.closest("[data-overlay]"));
  for (const el of stack) {
    const marked = el.closest<HTMLElement>("[data-vx-tone]")?.dataset.vxTone;
    if (marked === "light" || marked === "dark") return marked;
    const id = el.closest<HTMLElement>("section[id]")?.id ?? "";
    const named = TONES[id];
    if (named === "light" || named === "dark") return named;
    // Not named (or `auto`): the first opaque paint under the point decides.
    const c = paint(getComputedStyle(el).backgroundColor);
    if (c && c.alpha > 0.6) return c.lum > 0.4 ? "light" : "dark";
  }
  return "light";
}

/** Mount once on Vexana's page. It renders nothing. */
export function NavTone() {
  useEffect(() => {
    const nav = document.querySelector<HTMLElement>('header[data-overlay="nav"]');
    if (!nav) return;
    let raf = 0;
    let last = "";
    const sample = () => {
      raf = 0;
      const here = nav.querySelector<HTMLElement>("p");
      const r = here?.getBoundingClientRect();
      // Over the text itself, so the colour is the one behind it and not behind the logo.
      const x = r && r.width > 0 ? r.left + r.width / 2 : window.innerWidth - 80;
      const y = r && r.height > 0 ? r.top + r.height / 2 : 28;
      const tone = toneHint.get() ?? toneAt(x, y);
      if (tone !== last) {
        last = tone;
        nav.setAttribute("data-vx-tone", tone);
      }
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(sample);
    };
    sample();
    const unhint = toneHint.subscribe(schedule);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    // A section can change under a still page (a pin, an entrance), so look again now and then.
    const timer = window.setInterval(schedule, 400);
    return () => {
      unhint();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.clearInterval(timer);
      if (raf) cancelAnimationFrame(raf);
      nav.removeAttribute("data-vx-tone");
    };
  }, []);
  return null;
}
