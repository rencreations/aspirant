"use client";

import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";

import { cn } from "@aspirant/ui/lib/utils";

import { EmberField } from "@/components/ember-field";
import { useGLReady } from "@/components/gl/use-gl-ready";
import { useLenis } from "@/components/smooth-scroll";
import { StarGlyph } from "@/components/star-glyph";
import { StarButton } from "@/components/ui/star-button";
import { asset } from "@/lib/asset";
import { audio } from "@/lib/audio";
import {
  requestTiltPermission,
  useInView,
  useIsTouch,
  usePointer,
  useRafLoop,
  useReducedMotion,
  useVoiceState,
} from "@/lib/hooks";
import { routes } from "@/lib/site";
import { useSiteStore } from "@/lib/stores";

import type { PortalFigure, PortalPair, VoiceRef } from "../types";
import styles from "./hero.module.css";
import { HeroTitle } from "./HeroTitle";
import { PortalController } from "./portalController";

const GLStage = dynamic(() => import("@/components/gl/gl-stage"), { ssr: false });
const PortalScene = dynamic(() => import("./PortalScene"), { ssr: false });

const TITLE_ID = "home-title";
const PANEL_ID = "portal-panel";
const tabId = (i: number) => `portal-tab-${i}`;

function speak(voice: VoiceRef) {
  audio.unlock();
  void audio.playVoice(asset(voice.file));
}

function isControl(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest("a, button, [role='tab'], h1") !== null;
}

function FigureImages({
  pair,
  view,
  labelled,
}: {
  pair: PortalPair;
  view: "base" | "alt";
  labelled: boolean;
}) {
  const outer: PortalFigure = view === "base" ? pair.base : pair.alt;
  const inner: PortalFigure = view === "base" ? pair.alt : pair.base;
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- static export, plain img */}
      <img
        className={styles.figImg}
        src={asset(outer.image)}
        alt={labelled ? outer.alt : ""}
        aria-hidden={labelled ? undefined : true}
        width={1100}
        height={1375}
        decoding="async"
        fetchPriority={labelled ? "high" : "low"}
        draggable={false}
      />
      <div className={styles.figPortal}>
        {/* eslint-disable-next-line @next/next/no-img-element -- static export, plain img */}
        <img
          className={cn(styles.figImg, styles.figShift)}
          src={asset(inner.image)}
          alt={labelled ? inner.alt : ""}
          aria-hidden={labelled ? undefined : true}
          width={1100}
          height={1375}
          decoding="async"
          loading={labelled ? "eager" : "lazy"}
          draggable={false}
        />
      </div>
    </>
  );
}

/**
 * Home hero: a character lifted into pseudo 3D (WebGL, lazy) with a pointer-driven portal to
 * her other form. The static images underneath are the LCP, the no-WebGL fallback (with a CSS
 * mask portal) and the reduced-motion view (crossfade). Controls: three pair tabs, Toggle
 * form, Hold portal open. Tap the figure to toggle; drag to open the portal.
 */
export function PortalHero({ pairs }: { pairs: readonly PortalPair[] }) {
  const heroRef = useRef<HTMLElement>(null);
  const figureRef = useRef<HTMLDivElement>(null);
  const readoutRef = useRef<HTMLSpanElement>(null);
  const tabsRef = useRef<Array<HTMLButtonElement | null>>([]);
  const tap = useRef<{ id: number; x: number; y: number; t: number } | null>(null);
  const [controller] = useState(() => new PortalController());
  const [selected, setSelected] = useState(0);
  const [shown, setShown] = useState(0);
  const [alt, setAlt] = useState(false);
  const [hold, setHold] = useState(false);
  const [glOn, setGlOn] = useState(false);
  const [intro, setIntro] = useState(false);
  const [tilt, setTilt] = useState(false);
  const [touched, setTouched] = useState(false);

  const reduced = useReducedMotion();
  const touch = useIsTouch();
  const { ready: glReady, tier } = useGLReady();
  const entered = useSiteStore((s) => s.entered);
  const inView = useInView(heroRef, { rootMargin: "120px" });
  const { ref: pointer } = usePointer({ tilt });
  const voice = useVoiceState();
  const { scrollTo } = useLenis();

  const pair = pairs[shown] ?? pairs[0];
  const figure = pair ? (alt ? pair.alt : pair.base) : undefined;

  useEffect(() => {
    const hero = heroRef.current;
    const fig = figureRef.current;
    if (!hero || !fig) return;
    return controller.attach(hero, fig, readoutRef.current);
  }, [controller]);

  useEffect(() => {
    controller.usePointerSource(pointer);
  }, [controller, pointer]);

  useEffect(() => {
    controller.setReduced(reduced);
  }, [controller, reduced]);

  useEffect(() => {
    controller.setSwapHandler((index) => {
      setShown(index);
      setAlt(false);
    });
    return () => controller.setSwapHandler(null);
  }, [controller]);

  useEffect(() => {
    if (pair) controller.setHold(hold, pair.hold, pair.align);
  }, [controller, hold, pair]);

  // Play the intro once the loader has gone (or straight away for a returning visitor).
  useEffect(() => {
    if (!entered || intro) return;
    const t = window.setTimeout(
      () => {
        controller.playIntro();
        setIntro(true);
      },
      reduced ? 0 : 420,
    );
    return () => window.clearTimeout(t);
  }, [entered, intro, reduced, controller]);

  useRafLoop((_, t) => controller.tick(t), inView);

  const onGLReady = useCallback(() => setGlOn(true), []);

  const select = (index: number, opts: { focus?: boolean } = {}) => {
    const next = pairs[index];
    if (!next) return;
    if (opts.focus) tabsRef.current[index]?.focus();
    setTouched(true);
    speak(next.base.voice);
    if (index === selected) return;
    setSelected(index);
    controller.setPair(index);
  };

  const toggleForm = (origin?: { x: number; y: number }) => {
    if (!pair) return;
    const next = !alt;
    setTouched(true);
    setAlt(next);
    controller.setForm(next, origin);
    speak(next ? pair.alt.voice : pair.base.voice);
  };

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = pairs.length - 1;
    let to = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") to = index === last ? 0 : index + 1;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") to = index === 0 ? last : index - 1;
    else if (e.key === "Home") to = 0;
    else if (e.key === "End") to = last;
    if (to < 0) return;
    e.preventDefault();
    select(to, { focus: true });
  };

  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    if (isControl(e.target)) return;
    tap.current = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() };
  };

  const onPointerUp = (e: PointerEvent<HTMLElement>) => {
    const start = tap.current;
    tap.current = null;
    if (start?.id !== e.pointerId || isControl(e.target)) return;
    const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y);
    if (moved > 10 || performance.now() - start.t > 320) return;
    const hero = heroRef.current;
    const fig = figureRef.current;
    if (!hero || !fig) return;
    const fr = fig.getBoundingClientRect();
    const inFigure =
      e.clientX >= fr.left &&
      e.clientX <= fr.right &&
      e.clientY >= fr.top &&
      e.clientY <= fr.bottom;
    if (!inFigure) return;
    const hr = hero.getBoundingClientRect();
    toggleForm({ x: e.clientX - hr.left, y: e.clientY - hr.top });
    if (e.pointerType === "touch" && !tilt) {
      void requestTiltPermission().then((ok) => {
        if (ok) setTilt(true);
      });
    }
  };

  if (!pair || !figure) return null;

  const speaking = [pair.base, pair.alt].find(
    (f) => voice.playing && voice.url === asset(f.voice.file),
  );
  const vars = {
    "--hero-glow": figure.glow,
    "--hero-glow-2": figure.glow2,
    "--hero-tint": figure.tint,
    "--accent": figure.glow,
    "--glow": figure.glow,
    "--sx": pair.align[0],
    "--sy": pair.align[1],
  } as CSSProperties;
  const dpr = tier === "low" ? 1 : tier === "mid" || touch ? 1.4 : 1.75;

  return (
    <section
      ref={heroRef}
      className={styles.hero}
      aria-labelledby={TITLE_ID}
      style={vars}
      data-intro={intro ? "play" : "pending"}
      data-form={alt ? "alt" : "base"}
      data-pair={pair.id}
      data-gl={glOn ? "on" : "off"}
      data-hold={hold ? "on" : "off"}
      data-portal-radius="0"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        tap.current = null;
      }}
    >
      <div className={styles.backdrop} aria-hidden="true" key={`bg-${pair.id}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- decorative backdrop */}
        <img className={styles.backdropBase} src={asset(pair.base.backdrop)} alt="" />
        {/* eslint-disable-next-line @next/next/no-img-element -- decorative backdrop */}
        <img className={styles.backdropAlt} src={asset(pair.alt.backdrop)} alt="" loading="lazy" />
      </div>
      <div className={styles.embers} data-theme={figure.world} aria-hidden="true">
        <EmberField contained density={touch ? 0.5 : 0.85} />
      </div>
      <div className={styles.halo} aria-hidden="true" />

      <div className={styles.stage} data-cursor={reduced ? undefined : "FORM"}>
        <div ref={figureRef} className={styles.figure}>
          <div className={styles.view} data-view="base">
            <FigureImages pair={pair} view="base" labelled />
          </div>
          <div className={styles.view} data-view="alt">
            <FigureImages pair={pair} view="alt" labelled={false} />
          </div>
        </div>
      </div>

      {glReady && (
        <div className={styles.gl} data-on={glOn ? "true" : "false"}>
          <GLStage dpr={dpr}>
            <PortalScene controller={controller} pairs={pairs} onReady={onGLReady} />
          </GLStage>
        </div>
      )}

      <div className={styles.scrim} aria-hidden="true" />

      <div className={cn(styles.fg, "shell")}>
        <div className={cn(styles.hud, styles.rise)} aria-hidden="true">
          <span className={styles.hudCode}>
            <StarGlyph className={styles.hudStar} />
            01 / Home
          </span>
          <span className={styles.hudRule} />
          <span className={styles.hudLabel}>Resonance portal</span>
          <span className={styles.hudReadout}>
            R <span ref={readoutRef}>000</span>
          </span>
        </div>

        <div className={styles.titleBlock}>
          <HeroTitle id={TITLE_ID} play={intro} />
          <p className={cn(styles.line, styles.rise)}>Someone is always waiting.</p>
          <div className={cn(styles.cta, styles.rise)}>
            <StarButton pulse size="lg" href={routes.experience} transitionLabel="Experience">
              Begin the story
            </StarButton>
          </div>
        </div>

        <div className={cn(styles.console, styles.rise)}>
          <div
            role="tabpanel"
            id={PANEL_ID}
            aria-labelledby={tabId(selected)}
            className={styles.caption}
          >
            <p className={styles.captionCode}>
              <span>{figure.formLabel}</span>
              <span aria-hidden="true" className={styles.captionDot} />
              <span>{figure.world === "storm" ? "Storm" : "Daybreak"}</span>
            </p>
            <p className={styles.captionName}>{figure.aspirantName}</p>
            <p className={styles.captionWho}>
              <span>{figure.name}</span>
              <span className={styles.captionJp} lang="ja">
                {figure.jp}
              </span>
            </p>
            {speaking && (
              <p className={styles.captionVoice}>
                <span lang="ja" className={styles.captionVoiceJp}>
                  {speaking.voice.jp}
                </span>
                <span>&ldquo;{speaking.voice.en}&rdquo;</span>
              </p>
            )}
          </div>

          <div role="tablist" aria-label="Portal pairs" className={styles.tabs}>
            {pairs.map((p, i) => (
              <button
                key={p.id}
                ref={(el) => {
                  tabsRef.current[i] = el;
                }}
                type="button"
                role="tab"
                id={tabId(i)}
                aria-selected={i === selected}
                aria-controls={PANEL_ID}
                tabIndex={i === selected ? 0 : -1}
                className={styles.tab}
                style={{ "--tab-glow": p.base.glow } as CSSProperties}
                onClick={() => select(i)}
                onKeyDown={(e) => onTabKey(e, i)}
                onPointerEnter={(e) => {
                  if (e.pointerType === "mouse") audio.blip("hover");
                }}
              >
                <span className={styles.tabIndex} aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className={styles.tabName}>{p.tab}</span>
                <span className={styles.tabNote}>{p.tabNote}</span>
              </button>
            ))}
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.chip}
              aria-pressed={alt}
              onClick={() => {
                audio.blip("click");
                toggleForm();
              }}
            >
              <span className={styles.chipIcon} aria-hidden="true" />
              Toggle form
            </button>
            <button
              type="button"
              className={styles.chip}
              aria-pressed={hold}
              onClick={() => {
                audio.unlock();
                audio.blip(hold ? "click" : "star");
                setHold((h) => !h);
              }}
            >
              <span className={styles.chipRing} aria-hidden="true" />
              Hold portal open
            </button>
          </div>
        </div>

        <button
          type="button"
          className={cn(styles.cue, styles.rise)}
          onClick={() => scrollTo("#what-is", { offset: 0 })}
        >
          <span className={styles.cueLine} aria-hidden="true" />
          Scroll<span className="sr-only"> to what Aspirant is</span>
        </button>
      </div>

      <p className="sr-only" aria-live="polite">
        {touched ? `Showing ${figure.name}, ${figure.formLabel}.` : ""}
      </p>
    </section>
  );
}
