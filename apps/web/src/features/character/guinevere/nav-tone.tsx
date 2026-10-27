"use client";

import { useEffect } from "react";

import { toneHint } from "../vexana/seams/gates";

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
  friend: "light",
  art: "dark",
  fanart: "light",
  music: "dark",
  room: "auto",
};

/** The least time between two looks under the corner while the page scrolls. */
const SAMPLE_GAP_MS = 100;

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

let probe: CanvasRenderingContext2D | null | undefined;
/** The last picture sampled, so a scroll does not read pixels back on every frame. */
let lastMedia: { el: Element; at: number; tone: "light" | "dark" | null } | null = null;

/**
 * The tone of the picture that is painted under a point, read from its own pixels. The corner of
 * the film is covered by a dark video while its section is named light, so the name alone is not
 * enough there. The picture is laid out with `object-fit: cover` (or `contain`) in a box, so the
 * point is mapped back onto the source and a patch about the size of the text is averaged.
 * Returns null when it cannot be read (not loaded yet, or not a picture).
 */
function mediaTone(el: Element, x: number, y: number): "light" | "dark" | "skip" | null {
  const isVideo = el instanceof HTMLVideoElement;
  if (!isVideo && !(el instanceof HTMLImageElement)) return null;
  // A layer that is not showing (the stage keeps several videos stacked, only one is on) paints nothing.
  const style = getComputedStyle(el);
  if (style.visibility === "hidden" || Number(style.opacity) < 0.5) return "skip";
  const now = performance.now();
  if (lastMedia?.el === el && now - lastMedia.at < 200) return lastMedia.tone;
  let tone: "light" | "dark" | null = null;
  const w = isVideo ? el.videoWidth : el.naturalWidth;
  const h = isVideo ? el.videoHeight : el.naturalHeight;
  const box = el.getBoundingClientRect();
  if (w > 0 && h > 0 && box.width > 1 && box.height > 1 && (!isVideo || el.readyState >= 2)) {
    if (probe === undefined) {
      const c = document.createElement("canvas");
      c.width = 8;
      c.height = 8;
      probe = c.getContext("2d", { willReadFrequently: true });
    }
    if (probe) {
      const fit = style.objectFit;
      const k =
        fit === "contain"
          ? Math.min(box.width / w, box.height / h)
          : Math.max(box.width / w, box.height / h);
      // Where the picture's top left lands in the box, and the patch (about the text) in source pixels.
      const left = box.left + (box.width - w * k) / 2;
      const top = box.top + (box.height - h * k) / 2;
      const pw = Math.min(w, 120 / k);
      const ph = Math.min(h, 24 / k);
      const sx = Math.min(Math.max((x - left) / k - pw / 2, 0), w - pw);
      const sy = Math.min(Math.max((y - top) / k - ph / 2, 0), h - ph);
      try {
        probe.drawImage(el, sx, sy, pw, ph, 0, 0, 8, 8);
        const d = probe.getImageData(0, 0, 8, 8).data;
        let sum = 0;
        for (let i = 0; i < d.length; i += 4) {
          const lin = (n: number) => {
            const c = n / 255;
            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
          };
          sum += 0.2126 * lin(d[i]!) + 0.7152 * lin(d[i + 1]!) + 0.0722 * lin(d[i + 2]!);
        }
        // White and dark ink read equally well on a surface of relative luminance about 0.19.
        tone = sum / (d.length / 4) > 0.19 ? "light" : "dark";
      } catch {
        tone = null;
      }
    }
  }
  lastMedia = { el, at: now, tone };
  return tone;
}

/** The tone behind a point, from the elements stacked there, topmost first. */
function toneAt(x: number, y: number): "light" | "dark" {
  const stack = document.elementsFromPoint(x, y).filter((el) => !el.closest("[data-overlay]"));
  for (const el of stack) {
    const picture = mediaTone(el, x, y);
    if (picture === "skip") continue;
    if (picture) return picture;
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
    let wait = 0;
    let lastAt = -1e9;
    let last = "";
    const sample = () => {
      raf = 0;
      lastAt = performance.now();
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
    // Looking under the corner (a hit test of the whole stack) costs a couple of milliseconds on
    // this page, and the answer only changes at the edge of a section, so a scroll asks for it at
    // most ten times a second: the first ask after a quiet moment is answered at once.
    const schedule = () => {
      if (raf || wait) return;
      const rest = SAMPLE_GAP_MS - (performance.now() - lastAt);
      if (rest <= 0) {
        raf = requestAnimationFrame(sample);
        return;
      }
      wait = window.setTimeout(() => {
        wait = 0;
        raf = requestAnimationFrame(sample);
      }, rest);
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
      window.clearTimeout(wait);
      if (raf) cancelAnimationFrame(raf);
      nav.removeAttribute("data-vx-tone");
    };
  }, []);
  return null;
}
