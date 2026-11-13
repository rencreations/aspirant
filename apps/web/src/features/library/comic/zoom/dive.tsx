"use client";

/**
 * The dive into an official comic. The stage of the section is the page's own, so it is zoomed as it
 * is, with Web Animations on transform and opacity: every part is scaled about one pivot, the first
 * panel exactly as far as it takes to fill the screen and the other parts by their depth (the
 * ones in front rush past and fade, the ones behind hang back). When the panel fills the screen, a
 * picture of the comic's own first page, laid exactly where the panel's picture is, takes over (an
 * opaque layer fades in over it), the page changes under it, and the page settles to where the
 * reader draws it (a move and a scale, measured on the reader once it is open) and fades away, so
 * nothing jumps. Any failure removes the layer and opens the page the plain way.
 */
import type { Route } from "next";
import { useEffect, useRef } from "react";

import { useLenis } from "@/components/smooth-scroll";
import { useTransitionRouter } from "@/components/transition/transition-provider";
import { audio } from "@/lib/audio";
import { libUrl } from "@/lib/library";
import { whenPageReady } from "@/lib/page-ready";
import { imageItem, runPreload } from "@/lib/preload";
import { routeItems } from "@/lib/route-preloads";

import { arrive, holdScroll, pathOf, readerFirst, sleep, useGoto, waitingWords } from "./kit";
import {
  centreOf,
  coverCamera,
  easeInOut,
  pageAfterZoom,
  partShift,
  settleMs,
  unturnedSize,
  zoomExponent,
  zoomSamples,
  type Box,
  type PanelFit,
} from "./math";
import { endComicJob, type ComicJob } from "./store";
import styles from "./zoom.module.css";

type DiveJob = Extract<ComicJob, { kind: "dive" }>;

/** Jobs whose run has started (React's strict mode mounts a component twice). */
const started = new Set<number>();

/** How long the dive lasts, and how many samples a part's zoom is cut into. */
const DIVE_MS = 1500;
const STEPS = 28;
/** The parts that are not the first panel fade out between these two moments of the dive. */
const FADE_FROM = 0.34;
const FADE_TO = 0.78;

function boxOf(r: DOMRect): Box {
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}

function fadeAt(t: number): number {
  if (t <= FADE_FROM) return 1;
  if (t >= FADE_TO) return 0;
  return 1 - (t - FADE_FROM) / (FADE_TO - FADE_FROM);
}

export function Dive({ job }: { job: DiveJob }) {
  const transition = useTransitionRouter();
  const { scrollTo } = useLenis();
  const goto = useGoto();
  const finale = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const wait = useRef<HTMLParagraphElement>(null);

  const at = job.panel.at;
  const page = at ? job.comic.pages.find((p) => p.n === at.n) : undefined;
  const pieces = page ? (page.s ?? [{ f: page.f, p: page.p, h: page.h, ph: 0 }]) : [];
  const tops = pieces.map((_, i) => pieces.slice(0, i).reduce((sum, s) => sum + s.h, 0));
  const sliced = page?.s !== undefined;

  useEffect(() => {
    if (started.has(job.id)) return;
    const layer = finale.current;
    const box = sheet.current;
    if (!layer || !box) return;
    if (!page || !at) {
      // The panel names no page, or one the comic does not have: the plain way.
      started.add(job.id);
      endComicJob(job.id);
      transition.push(job.href as Route, { label: job.comic.title });
      return;
    }
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
      window.removeEventListener("offline", words);
      window.removeEventListener("online", words);
      for (const a of animations) a.cancel();
      job.stage.removeAttribute("data-diving");
      job.section.removeAttribute("data-diving");
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

    // The connection may drop while the cover waits: say so, and say when it is back.
    let waitingNow = false;
    const words = () => {
      if (waitingNow) say(waitingWords(job.comic.title));
    };
    window.addEventListener("offline", words);
    window.addEventListener("online", words);

    void (async () => {
      try {
        const view: Box = { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight };
        // Stop the stage where it is (the drift, the pointer) so what is measured is what stays.
        job.section.setAttribute("data-diving", "true");
        job.stage.setAttribute("data-diving", "true");
        audio.blip("whoosh");
        // The panel is about to fill the screen: ask for its large file (the small one stays until it arrives).
        job.img.setAttribute("sizes", "100vw");

        // What the new page needs, warmed while the dive runs: its data, the reader and the picture
        // of the first page that takes over from the panel.
        let waiting = false;
        const assets = runPreload(
          [
            ...routeItems(job.href),
            ...pieces.map((s) => imageItem(libUrl(s.f), "Loading the first page")),
          ],
          (p) => {
            if (waiting) say(waitingWords(job.comic.title, p.progress));
          },
        );

        // The camera: the panel's picture is brought to the middle of the screen, covering it. The
        // drift of the stage may have turned it a little (under a degree) where it stopped: the box
        // is measured as it is without that turn, and the panel is turned upright on the way in.
        const inner = job.img.closest<HTMLElement>("[data-part] > div > div");
        const turn = inner ? Number.parseFloat(getComputedStyle(inner).rotate) || 0 : 0;
        const held = job.img.getBoundingClientRect();
        const size = unturnedSize(held.width, held.height, turn);
        const picture: Box = {
          x: held.left + (held.width - size.w) / 2,
          y: held.top + (held.height - size.h) / 2,
          w: size.w,
          h: size.h,
        };
        const fit: PanelFit = {
          box: picture,
          cut: { w: job.panel.w, h: job.panel.h },
          at: { x: at.x, y: at.y },
        };
        const { k, pivot } = coverCamera(picture, view);
        const end = pageAfterZoom(fit, pivot, k);

        // The page's picture, as large as the panel's picture makes it at the end of the dive.
        box.style.width = `${page.w * end.scale}px`;
        box.style.height = `${page.h * end.scale}px`;
        box.style.transform = `translate(${end.x}px, ${end.y}px)`;

        const parts = Array.from(job.stage.querySelectorAll<HTMLElement>("[data-part]")).filter(
          (el) => !el.parentElement?.closest("[data-part]"),
        );
        const first = parts.find((el) => el.dataset.part === "first");
        const depthOf = (el: HTMLElement | undefined) =>
          el ? Number.parseFloat(getComputedStyle(el).getPropertyValue("--d")) || 0 : 0;
        const firstDepth = depthOf(first);
        for (const el of parts) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) continue;
          const style = getComputedStyle(el);
          const rotation = Number.parseFloat(style.rotate) || 0;
          const centre = centreOf(boxOf(r));
          const isFirst = el === first;
          const kPart = isFirst ? k : k ** zoomExponent(depthOf(el), firstDepth);
          const samples = zoomSamples(kPart, STEPS);
          const keyframes: Keyframe[] = samples.map((ki, i) => {
            const move = partShift(centre, pivot, ki, rotation);
            const upright = isFirst ? ` rotate(${-turn * easeInOut(i / STEPS)}deg)` : "";
            const frame: Keyframe = {
              offset: i / STEPS,
              transform: `translate(${move.x}px, ${move.y}px)${upright} scale(${ki})`,
            };
            if (!isFirst) frame.opacity = fadeAt(i / STEPS);
            return frame;
          });
          animations.push(
            el.animate(keyframes, { duration: DIVE_MS, easing: "linear", fill: "forwards" }),
          );
        }
        // The button and its line let go first.
        const row = job.section.querySelector<HTMLElement>('[data-dive="row"]');
        if (row) {
          animations.push(
            row.animate(
              [
                { opacity: 1, transform: "translateY(0)" },
                { opacity: 0, transform: "translateY(24px)", offset: 0.3 },
                { opacity: 0, transform: "translateY(24px)" },
              ],
              { duration: DIVE_MS, easing: "ease-out", fill: "forwards" },
            ),
          );
        }

        await Promise.all(animations.map((a) => a.finished));
        if (over) return;

        // The picture of the page has to be there before it takes over.
        let loaded = false;
        void assets.then(() => {
          loaded = true;
        });
        await Promise.race([assets, sleep(1)]);
        if (!loaded) {
          waiting = true;
          waitingNow = true;
          say(waitingWords(job.comic.title));
        }
        await assets;
        waiting = false;
        waitingNow = false;
        say(null);
        await Promise.all(
          Array.from(box.querySelectorAll("img")).map((img) => img.decode().catch(() => undefined)),
        );

        // The page's picture fades in exactly over the panel's.
        await layer.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: 260,
          easing: "linear",
          fill: "forwards",
        }).finished;

        await goto(job.href);
        arrive(scrollTo);
        await whenPageReady();
        const reader = await readerFirst(page.n);

        if (reader.rect) {
          const r = reader.rect;
          const dist = Math.hypot(r.left - end.x, r.top - end.y);
          audio.blip("star");
          await box.animate(
            [
              { transform: `translate(${end.x}px, ${end.y}px) scale(1)` },
              {
                transform: `translate(${r.left}px, ${r.top}px) scale(${r.width / (page.w * end.scale)})`,
              },
            ],
            {
              duration: settleMs(dist),
              easing: "cubic-bezier(0.65, 0, 0.35, 1)",
              fill: "forwards",
            },
          ).finished;
        }

        // The reader is under it and is the same picture: the layer goes.
        await layer.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: 320,
          easing: "linear",
          fill: "forwards",
        }).finished;
        finish(true);
      } catch (error) {
        if (!over)
          console.warn("The dive into the comic stopped; opening it the plain way.", error);
        finish(false);
      }
    })();
    // No cleanup: strict mode's second mount must not stop the run; the run ends the job itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={styles.dive} aria-hidden="true" data-comic-dive="true">
      <div ref={finale} className={styles.finale} data-theme="storm">
        <div ref={sheet} className={styles.sheet}>
          {pieces.map((s, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={s.f}
              className={styles.piece}
              src={libUrl(s.f)}
              alt=""
              draggable={false}
              decoding="async"
              style={
                sliced && page
                  ? {
                      top: `${((tops[i] ?? 0) / page.h) * 100}%`,
                      height: `calc(${(s.h / page.h) * 100}% + 1px)`,
                    }
                  : { top: 0, height: "100%" }
              }
            />
          ))}
        </div>
      </div>
      <p ref={wait} className={`${styles.wait} hud-label`} data-on="false" />
    </div>
  );
}
