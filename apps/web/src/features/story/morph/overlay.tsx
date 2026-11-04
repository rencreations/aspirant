"use client";

/**
 * The layer that draws a chapter morph. It is built from the data of the chapter it shows (the
 * title card's picture or loop, its shade, a copy of its text laid out by the title card's own
 * rules), lives in the root layout so it survives the change of page, and is removed the frame
 * after the new page is identical under it. It is hidden from assistive technology and lets every
 * press through. Any failure takes it away and opens the page the plain way (the logo transition).
 */
import { cn } from "@aspirant/ui/lib/utils";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, type CSSProperties, type Ref } from "react";

import { useLenis } from "@/components/smooth-scroll";
import { useTransitionRouter } from "@/components/transition/transition-provider";
import { actOf, chapterLabel } from "@/content/story";
import type { ChapterEntry } from "@/content/story-types";
import { asset } from "@/lib/asset";
import { useNavLock } from "@/lib/nav-lock";

import { END_KICKER, END_LEAD, END_TITLE } from "../reader/end-copy";
import rs from "../reader/reader.module.css";
import {
  holdLanding,
  holdScroll,
  probeHolds,
  pathOf,
  resetProbe,
  runBack,
  runBlind,
  runForward,
  showAgain,
  Timeline,
  type After,
  type Env,
  type Parts,
} from "./choreo";
import m from "./morph.module.css";
import { endMorph, type MorphJob } from "./morph-store";
import { Words } from "./words";

/** Jobs whose run has started (React's strict mode mounts a component twice). */
const started = new Set<number>();

/** A morph that has not ended after this long is taken away (it never should be). */
const WATCHDOG_MS = 40_000;

function TitleCopy({ entry, ref }: { entry: ChapterEntry; ref: Ref<HTMLDivElement> }) {
  const act = actOf(entry);
  return (
    <div ref={ref} className={m.text}>
      <div className={cn(rs.card, m.cardCopy)}>
        <div className={cn(rs.cardText, m.cardTextCopy)}>
          <p className={rs.cardKicker}>
            {act && <span data-m="act">{`Act ${act.roman}, ${act.title}`}</span>}
            <span data-m="slash">/</span>
            <span data-m="label">
              <Words text={chapterLabel(entry)} block />
            </span>
          </p>
          <p className={cn(rs.cardTitle, m.h1)} data-m="title">
            <Words text={entry.title} block />
          </p>
          {entry.dateline && (
            <p className={rs.cardDateline} data-m="date">
              <Words text={entry.dateline} block />
            </p>
          )}
          {entry.mood && (
            <p className={rs.cardMood} data-m="mood">
              {entry.mood}
            </p>
          )}
        </div>
        <p className={rs.cardCue} data-m="cue">
          <span>Scroll</span>
        </p>
      </div>
    </div>
  );
}

function EndCopy({
  theme,
  textScale,
  light = false,
  ref,
}: {
  theme: string;
  textScale: number;
  light?: boolean;
  ref: Ref<HTMLDivElement>;
}) {
  return (
    <div ref={ref} className={cn(m.text, light && m.light)}>
      <div
        className={cn(rs.reader, m.readerCopy)}
        data-theme={theme}
        style={{ "--rd-scale": textScale } as CSSProperties}
      >
        <div className={rs.finish}>
          <p className={rs.finishKicker} data-m="label">
            <Words text={END_KICKER} block />
          </p>
          <p className={cn(rs.finishTitle, m.h1)} data-m="title">
            <Words text={END_TITLE} block />
          </p>
          <p className={rs.finishLead} data-m="mood">
            {END_LEAD}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Overlay({ job }: { job: MorphJob }) {
  const router = useRouter();
  const transition = useTransitionRouter();
  const lenis = useLenis();
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  const startPath = useRef(pathOf(pathname));
  const waiters = useRef(new Set<() => void>());
  const elsewhere = useRef(false);

  const root = useRef<HTMLDivElement>(null);
  const scrim = useRef<HTMLDivElement>(null);
  const glow = useRef<HTMLDivElement>(null);
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const counter = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const poster = useRef<HTMLImageElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const sealed = useRef<HTMLImageElement>(null);
  const fill = useRef<HTMLDivElement>(null);
  const shade = useRef<HTMLDivElement>(null);
  const text = useRef<HTMLDivElement>(null);
  const light = useRef<HTMLDivElement>(null);
  const clones = useRef<HTMLDivElement>(null);
  const edge = useRef<HTMLDivElement>(null);
  const edgeShade = useRef<HTMLDivElement>(null);

  // The address, for the waits of the run; a move to a third page (the browser's back button)
  // stops the morph.
  useEffect(() => {
    pathRef.current = pathname;
    const path = pathOf(pathname);
    if (path !== startPath.current && path !== pathOf(job.href)) elsewhere.current = true;
    for (const fn of Array.from(waiters.current)) fn();
  }, [pathname, job.href]);

  useEffect(() => {
    if (started.has(job.id)) return;
    const need = [root, scrim, glow, outer, inner, counter, content, text, clones];
    if (need.some((r) => !r.current)) return;
    started.add(job.id);
    const parts = {
      root: root.current,
      scrim: scrim.current,
      glow: glow.current,
      outer: outer.current,
      inner: inner.current,
      counter: counter.current,
      content: content.current,
      poster: poster.current,
      canvas: canvas.current,
      video: video.current,
      sealed: sealed.current,
      fill: fill.current,
      shade: shade.current,
      text: text.current,
      light: light.current,
      clones: clones.current,
      edge: edge.current,
      edgeShade: edgeShade.current,
    } as Parts;
    /** The watchdog took the layer away: the run stops at its next step. */
    let stopped = false;
    const env: Env = {
      push: (href) => router.push(href, { scroll: false }),
      lenis,
      waitPath: (target, ms) =>
        new Promise<void>((resolve, reject) => {
          const look = () => {
            if (elsewhere.current) {
              finish();
              reject(new Error("left"));
            } else if (pathOf(pathRef.current) === target) {
              finish();
              resolve();
            }
          };
          const timer = window.setTimeout(() => {
            finish();
            reject(new Error("the page did not change"));
          }, ms);
          const finish = () => {
            window.clearTimeout(timer);
            waiters.current.delete(look);
          };
          waiters.current.add(look);
          look();
        }),
      aborted: () => elsewhere.current || stopped,
    };

    const release = transition.claim();
    if (!release) {
      started.delete(job.id);
      endMorph(job.id);
      return;
    }
    const letGo = holdScroll();
    const tl = new Timeline();
    const door = job.kind === "forward" || job.kind === "end" ? job.door : null;

    let over = false;
    const finish = (ok: boolean, after: After) => {
      if (over) return;
      over = true;
      window.clearTimeout(watchdog);
      // The page's own look comes back (on success that page is already gone).
      if (ok) tl.releasePage();
      else tl.cancel();
      showAgain(door);
      resetProbe();
      endMorph(job.id);
      started.delete(job.id);
      requestAnimationFrame(() => after());
      release();
      void letGo();
      if (ok) return;
      // Never left under a layer: what is on screen now is the page itself, then the plain way.
      const card = document.querySelector("main [data-card]");
      const navH =
        document.querySelector<HTMLElement>('header[data-overlay="nav"]')?.offsetHeight ?? 64;
      useNavLock.setState({ bare: card ? card.getBoundingClientRect().bottom > navH : false });
      if (!elsewhere.current && pathOf(pathRef.current) !== pathOf(job.href))
        transition.push(job.href);
    };
    // The last safety: whatever happens, the layer is gone after this long (the files are in
    // memory before a morph starts, so a morph takes about two seconds).
    const watchdog = window.setTimeout(() => {
      if (probeHolds()) return;
      stopped = true;
      finish(false, () => undefined);
    }, WATCHDOG_MS);

    void (async () => {
      try {
        let after: After;
        if (job.kind === "back") after = await runBack(job, parts, env, tl);
        else if (job.kind === "blind") after = await runBlind(job, parts, env, tl);
        else after = await runForward(job, parts, env, tl);
        await holdLanding();
        finish(true, after);
      } catch (error) {
        if (!over)
          console.warn("The chapter morph stopped; opening the page the plain way.", error);
        finish(false, () => undefined);
      }
    })();
    // No cleanup: strict mode's second mount must not stop the run; the run ends the job itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const entry = job.kind === "end" ? null : job.entry;
  const tint = job.kind === "end" ? job.from.color : job.entry.color;
  const first = entry?.first[0];
  const still = first ? (first.kind === "clip" ? first.poster : first.src) : undefined;
  const position = { objectPosition: entry?.focus ?? "50% 50%" };
  const textCopy =
    job.kind === "end" ? (
      <>
        <EndCopy ref={light} theme={job.theme} textScale={job.textScale} light />
        <EndCopy ref={text} theme={job.theme} textScale={job.textScale} />
      </>
    ) : entry ? (
      <TitleCopy ref={text} entry={entry} />
    ) : null;

  return (
    <div
      ref={root}
      className={m.root}
      data-morph={job.kind}
      aria-hidden="true"
      style={
        {
          "--tint": tint,
          "--m-bg": job.theme === "storm" ? "var(--ink)" : "#fff",
        } as CSSProperties
      }
    >
      <div ref={scrim} className={m.scrim} />
      <div ref={glow} className={m.glow} />
      {job.kind === "blind" && <div ref={edgeShade} className={m.edgeShade} />}
      <div ref={outer} className={m.outer}>
        <div ref={inner} className={m.inner}>
          <div ref={counter} className={m.counter}>
            <div ref={content} className={m.content}>
              <div className={m.contentCard}>
                {still && (
                  <>
                    {/* Plain <img>: static export, the same file the title card shows. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      ref={poster}
                      className={m.media}
                      src={asset(`/${still}`)}
                      alt=""
                      style={position}
                      draggable={false}
                    />
                  </>
                )}
                {first?.kind === "clip" && (
                  <>
                    <canvas ref={canvas} className={m.media} style={{ ...position, opacity: 0 }} />
                    <video
                      ref={video}
                      className={m.media}
                      style={{ ...position, opacity: 0 }}
                      muted
                      loop
                      playsInline
                      preload="auto"
                    />
                  </>
                )}
                {job.kind === "forward" && entry?.sealed && (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      ref={sealed}
                      className={m.media}
                      src={asset(`/${entry.sealed}`)}
                      alt=""
                      draggable={false}
                    />
                  </>
                )}
                {entry && <div className={rs.cardShade} />}
                {job.kind === "end" && <div ref={fill} className={m.fill} />}
              </div>
            </div>
            {job.kind === "blind" && textCopy}
          </div>
          {job.kind === "blind" && <div ref={edge} className={m.edge} />}
        </div>
      </div>
      {job.kind !== "blind" && <div ref={shade} className={m.shadeCopy} />}
      {job.kind !== "blind" && textCopy}
      <div ref={clones} className={m.clones} />
    </div>
  );
}
