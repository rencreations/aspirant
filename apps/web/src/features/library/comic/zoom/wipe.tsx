"use client";

/**
 * The change of page into a fan comic: a wipe of halftone dots, the print dots of a comic. From the
 * press, two grids of round dots (ink, then the colour of the comic's cover) swell until they close
 * over the screen; the page changes under them; then they shrink away from the middle and the reader
 * is there. Every dot is an element animated on transform only. Any failure removes the layer and
 * opens the page the plain way.
 */
import type { Route } from "next";
import { useEffect, useRef } from "react";

import { useLenis } from "@/components/smooth-scroll";
import { useTransitionRouter } from "@/components/transition/transition-provider";
import { audio } from "@/lib/audio";
import { whenPageReady } from "@/lib/page-ready";
import { runPreload } from "@/lib/preload";
import { routeItems } from "@/lib/route-preloads";

import { arrive, holdScroll, pathOf, readerFirst, sleep, useGoto } from "./kit";
import { vividColour } from "./math";
import { endComicJob, type ComicJob } from "./store";
import styles from "./zoom.module.css";

type WipeJob = Extract<ComicJob, { kind: "wipe" }>;

const started = new Set<number>();

/** The dots: about this many across the longer side of the screen. */
const ACROSS = 20;
/** How long a dot takes, how long the wave takes to cross the screen, and how far the colour trails the ink. */
const DOT_MS = 380;
const WAVE_MS = 300;
const TRAIL_MS = 70;
/** Big enough that dots on a grid overlap into a flat cover (the corner of a cell is 1.42 away). */
const FULL = 1.55;
const INK = "#14121a";

interface Dot {
  el: HTMLElement;
  x: number;
  y: number;
}

/** Fill `layer` with a grid of dots of one colour, the grid shifted by `shift` of a cell. */
function grid(layer: HTMLElement, colour: string, cell: number, shift: number): Dot[] {
  const cols = Math.ceil(window.innerWidth / cell) + 2;
  const rows = Math.ceil(window.innerHeight / cell) + 2;
  const dots: Dot[] = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const el = document.createElement("i");
      const x = (c - 1 + shift) * cell;
      const y = (r - 1 + shift) * cell;
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      el.style.width = `${cell}px`;
      el.style.height = `${cell}px`;
      el.style.background = colour;
      layer.appendChild(el);
      dots.push({ el, x: x + cell / 2, y: y + cell / 2 });
    }
  }
  return dots;
}

/** Swell or shrink every dot of a grid, the nearest to (`ox`, `oy`) first. Resolves when the last one is done. */
function wave(dots: Dot[], ox: number, oy: number, from: number, to: number, lag: number) {
  const far = Math.hypot(window.innerWidth, window.innerHeight);
  const animations = dots.map((d) => {
    const near = Math.hypot(d.x - ox, d.y - oy) / far;
    return d.el.animate([{ transform: `scale(${from})` }, { transform: `scale(${to})` }], {
      duration: DOT_MS,
      delay: lag + near * WAVE_MS,
      easing: "cubic-bezier(0.4, 0, 0.2, 1)",
      fill: "both",
    });
  });
  return animations;
}

export function Wipe({ job }: { job: WipeJob }) {
  const transition = useTransitionRouter();
  const { scrollTo } = useLenis();
  const goto = useGoto();
  const ink = useRef<HTMLDivElement>(null);
  const colour = useRef<HTMLDivElement>(null);
  const wait = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (started.has(job.id)) return;
    const inkLayer = ink.current;
    const colourLayer = colour.current;
    if (!inkLayer || !colourLayer) return;
    started.add(job.id);
    const release = transition.claim();
    if (!release) {
      started.delete(job.id);
      endComicJob(job.id);
      return;
    }
    const letGo = holdScroll();
    const animations: Animation[] = [];
    let over = false;

    const finish = (ok: boolean) => {
      if (over) return;
      over = true;
      for (const a of animations) a.cancel();
      endComicJob(job.id);
      started.delete(job.id);
      release();
      void letGo();
      if (!ok && pathOf(window.location.pathname) !== pathOf(job.href)) {
        transition.push(job.href as Route, { label: job.comic.title });
      }
    };

    const say = (text: string | null) => {
      const el = wait.current;
      if (!el) return;
      el.textContent = text ?? "";
      el.dataset.on = text ? "true" : "false";
    };

    void (async () => {
      try {
        audio.blip("whoosh");
        let waiting = false;
        const assets = runPreload(routeItems(job.href), (p) => {
          if (waiting) say(`Loading ${job.comic.title} ${Math.round(p.progress * 100)}%`);
        });

        const cell = Math.round(Math.max(window.innerWidth, window.innerHeight) / ACROSS);
        const inkDots = grid(inkLayer, INK, cell, 0.5);
        const colourDots = grid(colourLayer, vividColour(job.comic.cover.c), cell, 0);

        // Close: the ink first, the colour on its heels, from the press.
        const closing = [
          ...wave(inkDots, job.x, job.y, 0, FULL, 0),
          ...wave(colourDots, job.x, job.y, 0, FULL, TRAIL_MS),
        ];
        animations.push(...closing);
        await Promise.all(closing.map((a) => a.finished));
        if (over) return;

        // The page changes under the cover. If it is slow to arrive the cover says so, with the real
        // percentage, and waits.
        await goto(job.href);
        arrive(scrollTo);
        let loaded = false;
        void assets.then(() => {
          loaded = true;
        });
        await Promise.race([assets, sleep(500)]);
        if (!loaded) {
          waiting = true;
          say(`Loading ${job.comic.title}`);
        }
        await assets;
        waiting = false;
        say(null);
        await whenPageReady();
        await readerFirst(job.comic.pages[0]?.n ?? 1);
        audio.blip("star");

        // Open: the colour shrinks away from the middle, then the ink behind it.
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        const opening = [
          ...wave(colourDots, cx, cy, FULL, 0, 0),
          ...wave(inkDots, cx, cy, FULL, 0, TRAIL_MS),
        ];
        animations.push(...opening);
        await Promise.all(opening.map((a) => a.finished));
        finish(true);
      } catch (error) {
        if (!over)
          console.warn("The wipe into the comic stopped; opening it the plain way.", error);
        finish(false);
      }
    })();
    // No cleanup: strict mode's second mount must not stop the run; the run ends the job itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={styles.wipe} aria-hidden="true" data-comic-wipe="true">
      <div ref={ink} className={styles.dots} />
      <div ref={colour} className={styles.dots} />
      <p ref={wait} className={`${styles.wait} ${styles.waitOnColour} hud-label`} data-on="false" />
    </div>
  );
}
