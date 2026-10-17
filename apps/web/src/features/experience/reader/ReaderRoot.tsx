"use client";

/**
 * The reader's client shell around the server-rendered book: the fixed page tint and the scene
 * layer behind the text, the reading engine, the shared entity card, the chrome (mini-bar,
 * chapter rail, contents, settings) and `jumpTo`, which loads a Part before it scrolls there.
 */
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, type CSSProperties, type ReactNode } from "react";

import { useLenis } from "@/components/smooth-scroll";
import { prefersReducedMotion } from "@/lib/hooks";

import { ensurePart } from "./book-store";
import { ChapterRail } from "./ChapterRail";
import { useReadingEngine } from "./engine";
import { EntityCards } from "./EntityCards";
import { MiniBar } from "./MiniBar";
import { READING_LINE } from "./observers";
import { loadReaderPrefs, useReaderPrefs, writePrefs } from "./prefs";
import { ReaderContext, type JumpOptions, type ReaderApi } from "./reader-context";
import s from "./reader.module.css";
import { getUnit } from "./story-data";

const ScenesLayer = dynamic(() => import("../scenes/ScenesLayer"), { ssr: false });

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

const ID = /^(?:part-\d{2}|c\d{2}|i-far-above-\d)(?:-p\d{3})?$|^setpiece-|^the-end$/u;

/** Which Part holds an element id, and whether the whole Part must be mounted for it. */
function partFor(id: string): { part: number; all: boolean } | null {
  const partMatch = /^part-(\d{2})$/u.exec(id);
  if (partMatch) return { part: Number(partMatch[1]), all: false };
  const unitId = /^(c\d{2}|i-far-above-\d)/u.exec(id)?.[1];
  const unit = unitId ? getUnit(unitId) : undefined;
  if (unit) return { part: unit.part, all: true };
  const host = document.getElementById(id)?.closest<HTMLElement>("[data-part]");
  return host ? { part: Number(host.dataset.part), all: false } : null;
}

/**
 * Keep a jump target in place while late layout lands (chapters rendering for the first time
 * above it, fonts, neighbouring Parts). Stops at the first wheel, touch, key or press, or after
 * 1.6 s. Resolves after a few frames so the veil can lift while it keeps watching.
 */
function settle(el: HTMLElement, offset: number, fix: (offset: number) => void): Promise<void> {
  return new Promise((resolve) => {
    const start = performance.now();
    let user = false;
    let resolved = false;
    const stop = () => {
      user = true;
    };
    const events = ["wheel", "touchstart", "keydown", "pointerdown"] as const;
    for (const type of events) window.addEventListener(type, stop, { passive: true, once: true });
    const done = () => {
      for (const type of events) window.removeEventListener(type, stop);
      if (!resolved) resolve();
    };
    const tick = () => {
      if (user) return done();
      const drift = el.getBoundingClientRect().top + offset;
      if (Math.abs(drift) > 3) fix(offset);
      const t = performance.now() - start;
      if (!resolved && t > 140) {
        resolved = true;
        resolve();
      }
      if (t < 1600) requestAnimationFrame(tick);
      else done();
    };
    requestAnimationFrame(tick);
  });
}

function chromeHeight(): number {
  const nav = document.querySelector<HTMLElement>('header[data-overlay="nav"]')?.offsetHeight ?? 56;
  const bar = document.querySelector<HTMLElement>("[data-minibar]")?.offsetHeight ?? 44;
  return nav + bar + 12;
}

export function ReaderRoot({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLParagraphElement>(null);
  const veilRef = useRef<HTMLDivElement>(null);
  const { scrollTo } = useLenis();
  const textScale = useReaderPrefs((st) => st.textScale);
  const calm = useReaderPrefs((st) => st.calm);
  const resume = useReaderPrefs((st) => st.resume);

  useReadingEngine(rootRef, probeRef);

  const jumpTo = useCallback(
    async (id: string, { smooth = false, focus = true }: JumpOptions = {}) => {
      const target = partFor(id);
      if (target) await ensurePart(target.part, { all: target.all });
      await nextFrame();
      await nextFrame();
      const el = document.getElementById(id);
      if (!el) return;
      const isParagraph = el.hasAttribute("data-p");
      const isPart = /^part-\d{2}$/u.test(id);
      const offset = isPart
        ? 0
        : isParagraph
          ? -Math.round(window.innerHeight * READING_LINE) + 6
          : -chromeHeight();
      const distance = Math.abs(el.getBoundingClientRect().top + offset);
      const reduced = prefersReducedMotion();
      if (smooth && !reduced && distance < window.innerHeight * 3) {
        scrollTo(el, { offset, duration: Math.min(1.6, 0.6 + distance / 4000) });
      } else {
        const veil = veilRef.current;
        if (veil && !reduced) {
          veil.dataset.on = "true";
          await wait(150);
        }
        scrollTo(el, { offset, immediate: true });
        await settle(el, offset, (y) => scrollTo(el, { offset: y, immediate: true }));
        if (veil) delete veil.dataset.on;
      }
      if (focus) {
        const heading = isPart
          ? document.getElementById(`${id}-title`)
          : (el.querySelector<HTMLElement>("h3[tabindex]") ??
            (el.matches("a, button, [tabindex]") ? el : null));
        heading?.focus({ preventScroll: true });
      }
    },
    [scrollTo],
  );

  const setTextScale = useCallback((value: number) => {
    // Keep the lit paragraph where it is while the text reflows.
    const lit = document.querySelector<HTMLElement>("[data-lit]");
    const before = lit?.getBoundingClientRect().top;
    useReaderPrefs.setState({ textScale: value });
    writePrefs({ textScale: value });
    if (lit && before !== undefined) {
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          const after = lit.getBoundingClientRect().top;
          window.scrollBy(0, after - before);
        }),
      );
    }
  }, []);

  const setCalm = useCallback((value: boolean) => {
    useReaderPrefs.setState({ calm: value });
    writePrefs({ calm: value });
  }, []);

  // Saved preferences, the first Part, and deep links (#c30, #part-06, #c30-p012).
  useEffect(() => {
    loadReaderPrefs();
    void ensurePart(1);
    const fromHash = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (ID.test(id)) void jumpTo(id, { focus: false });
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [jumpTo]);

  // In-page links (skip links, "Part One begins") go through jumpTo so Parts load first.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const link = (e.target as Element | null)?.closest<HTMLAnchorElement>('a[href^="#"]');
      const id = link?.getAttribute("href")?.slice(1);
      if (!link || !id || !document.getElementById(id)) return;
      e.preventDefault();
      void jumpTo(id, { smooth: true });
    };
    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, [jumpTo]);

  const api = useMemo<ReaderApi>(
    () => ({ jumpTo, resume, textScale, setTextScale, calm, setCalm }),
    [jumpTo, resume, textScale, setTextScale, calm, setCalm],
  );

  return (
    <ReaderContext.Provider value={api}>
      <div
        ref={rootRef}
        className={s.reader}
        data-calm={calm ? "true" : undefined}
        style={{ "--rd-scale": textScale } as CSSProperties}
      >
        <div className={s.tint} aria-hidden="true" />
        {!calm && <ScenesLayer />}
        <div className={s.probeWrap} aria-hidden="true">
          <div className={s.column}>
            <p ref={probeRef} className={s.p}>
              Probe
            </p>
          </div>
        </div>
        {children}
        <EntityCards rootRef={rootRef} />
      </div>
      <MiniBar />
      <ChapterRail />
      <div ref={veilRef} className={s.veil} aria-hidden="true" />
    </ReaderContext.Provider>
  );
}
