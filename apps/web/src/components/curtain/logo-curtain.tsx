"use client";

import gsap from "gsap";
import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from "react";

import { LogoLayers } from "@/components/logo/logo-art";
import {
  cameraAt,
  cameraTransform,
  layoutFor,
  outsideRectPath,
  type Layout,
} from "@/components/logo/logo-geometry";
import {
  idleLoop,
  queryLogoParts,
  waitingLoop,
  type LogoParts,
} from "@/components/logo/logo-motion";

import styles from "./curtain.module.css";

/** Imperative controls for the curtain. The transition provider drives it. */
export interface CurtainHandle {
  /** Show the overlay (it blocks input while shown). */
  show: () => void;
  hide: () => void;
  /** 0: logo at rest. 1: a letter window fills the screen (the page is fully visible). */
  setZoom: (u: number) => void;
  tweenZoom: (to: number, duration: number, ease?: string) => Promise<void>;
  /** 1: white letters. 0: letters are windows. */
  setFill: (f: number) => void;
  tweenFill: (to: number, duration: number) => Promise<void>;
  /** The boot loop (letters ripple, light sweeps, spark runs the outline). */
  startIdle: () => void;
  /** The page-transition loading loop (a different, quieter animation). */
  startWaiting: (label: string) => void;
  stopLoops: () => void;
  setMode: (mode: "boot" | "transition") => void;
  showBoot: (on: boolean) => void;
  setBoot: (progress: number, label: string) => void;
  zoom: () => number;
  /** A plain light fade layer for reduced motion. */
  fade: (to: number, duration: number) => Promise<void>;
  /** Fade the whole curtain out (reduced-motion boot), then restore it. */
  fadeOut: (duration: number) => Promise<void>;
}

/**
 * The curtain overlay. It draws the Aspirant logo over a light screen. The letters are cut out
 * of the plate, so with the letters hidden the page shows through them; zooming into a letter
 * opens the whole page. It is both the loading screen and the page transition.
 */
export const LogoCurtain = forwardRef<CurtainHandle>(function LogoCurtain(_props, ref) {
  const uid = `curtain${useId().replace(/[^a-z0-9]/gi, "")}`;
  const rootRef = useRef<HTMLDivElement>(null);
  const camRef = useRef<SVGGElement>(null);
  const bgRef = useRef<SVGPathElement>(null);
  const partsRef = useRef<LogoParts | null>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const pctRef = useRef<HTMLSpanElement>(null);
  const waitRef = useRef<HTMLSpanElement>(null);
  const fadeRef = useRef<HTMLDivElement>(null);
  const state = useRef({
    u: 1,
    f: 0,
    vw: 0,
    vh: 0,
    layout: null as Layout | null,
    stop: null as (() => void) | null,
    zoomTween: null as gsap.core.Tween | null,
    fillTween: null as gsap.core.Tween | null,
    bar: 0,
  });

  const render = useCallback(() => {
    const s = state.current;
    if (!s.layout) return;
    const cam = cameraAt(s.u, s.layout, s.vw, s.vh);
    camRef.current?.setAttribute("transform", cameraTransform(cam));
    bgRef.current?.setAttribute("d", outsideRectPath(cam, s.vw, s.vh));
    const letters = partsRef.current?.letterGroup;
    if (letters) letters.style.opacity = String(s.f);
  }, []);

  const measure = useCallback(() => {
    const s = state.current;
    s.vw = window.innerWidth;
    s.vh = window.innerHeight;
    s.layout = layoutFor(s.vw, s.vh);
    const root = rootRef.current;
    if (root) {
      const l = s.layout;
      root.style.setProperty("--logo-w", `${l.width.toFixed(1)}px`);
      root.style.setProperty("--logo-h", `${l.height.toFixed(1)}px`);
      root.style.setProperty("--logo-cy", `${l.centre.y.toFixed(1)}px`);
      root.style.setProperty("--boot-top", `${(l.centre.y + l.height / 2 + 52).toFixed(1)}px`);
    }
    render();
  }, [render]);

  useLayoutEffect(() => {
    if (camRef.current) partsRef.current = queryLogoParts(camRef.current);
    measure();
    window.addEventListener("resize", measure);
    const s = state.current;
    return () => {
      window.removeEventListener("resize", measure);
      s.stop?.();
      s.zoomTween?.kill();
      s.fillTween?.kill();
    };
  }, [measure]);

  useEffect(() => {
    const root = rootRef.current;
    if (root) root.dataset.mode = "transition";
  }, []);

  useImperativeHandle(
    ref,
    (): CurtainHandle => ({
      show: () => {
        const root = rootRef.current;
        if (root) root.dataset.active = "true";
      },
      hide: () => {
        const root = rootRef.current;
        if (root) {
          root.dataset.active = "false";
          root.dataset.boot = "off";
          root.dataset.wait = "off";
        }
      },
      setZoom: (u) => {
        state.current.u = u;
        render();
      },
      tweenZoom: (to, duration, ease = "power3.inOut") => {
        const s = state.current;
        s.zoomTween?.kill();
        return new Promise<void>((resolve) => {
          s.zoomTween = gsap.to(s, {
            u: to,
            duration,
            ease,
            onUpdate: render,
            onComplete: () => {
              s.u = to;
              render();
              resolve();
            },
          });
        });
      },
      setFill: (f) => {
        state.current.f = f;
        render();
      },
      tweenFill: (to, duration) => {
        const s = state.current;
        s.fillTween?.kill();
        return new Promise<void>((resolve) => {
          s.fillTween = gsap.to(s, {
            f: to,
            duration,
            ease: "power2.inOut",
            onUpdate: render,
            onComplete: () => {
              s.f = to;
              render();
              resolve();
            },
          });
        });
      },
      startIdle: () => {
        const s = state.current;
        s.stop?.();
        if (partsRef.current) s.stop = idleLoop(partsRef.current);
      },
      startWaiting: (label) => {
        const s = state.current;
        s.stop?.();
        if (waitRef.current) waitRef.current.textContent = label;
        if (partsRef.current) s.stop = waitingLoop(partsRef.current);
        const root = rootRef.current;
        if (root) root.dataset.wait = "on";
      },
      stopLoops: () => {
        const s = state.current;
        s.stop?.();
        s.stop = null;
        const root = rootRef.current;
        if (root) root.dataset.wait = "off";
      },
      setMode: (mode) => {
        const root = rootRef.current;
        if (root) root.dataset.mode = mode;
      },
      showBoot: (on) => {
        const root = rootRef.current;
        if (root) root.dataset.boot = on ? "on" : "off";
      },
      setBoot: (progress, label) => {
        const s = state.current;
        const next = Math.min(1, Math.max(0, progress));
        gsap.to(s, {
          bar: next,
          duration: 0.35,
          ease: "power2.out",
          overwrite: true,
          onUpdate: () => {
            if (fillRef.current) fillRef.current.style.transform = `scaleX(${s.bar.toFixed(4)})`;
            if (pctRef.current) pctRef.current.textContent = `${Math.round(s.bar * 100)}%`;
          },
        });
        if (labelRef.current) labelRef.current.textContent = label;
        barRef.current?.setAttribute("aria-valuenow", String(Math.round(next * 100)));
      },
      zoom: () => state.current.u,
      fade: (to, duration) => {
        const el = fadeRef.current;
        if (!el) return Promise.resolve();
        return new Promise<void>((resolve) => {
          gsap.to(el, { opacity: to, duration, ease: "none", onComplete: () => resolve() });
        });
      },
      fadeOut: (duration) => {
        const el = rootRef.current;
        if (!el) return Promise.resolve();
        return new Promise<void>((resolve) => {
          gsap.to(el, {
            opacity: 0,
            duration,
            ease: "none",
            onComplete: () => {
              el.style.opacity = "";
              resolve();
            },
          });
        });
      },
    }),
    [render],
  );

  return (
    <div
      ref={rootRef}
      className={styles.curtain}
      data-active="false"
      data-boot="off"
      data-wait="off"
      data-overlay="transition"
      aria-hidden="true"
    >
      <div ref={fadeRef} className={styles.fade} />
      <svg className={styles.svg} width="100%" height="100%" focusable="false">
        <g ref={camRef}>
          <path ref={bgRef} className={styles.bg} fillRule="evenodd" d="" />
          <LogoLayers uid={uid} />
        </g>
      </svg>
      <div className={styles.decor}>
        <span className={styles.hline} data-side="l" />
        <span className={styles.hline} data-side="r" />
        <span className={styles.vline} data-side="t" />
        <span className={styles.vline} data-side="b" />
        <span className={styles.corner} data-pos="tl" />
        <span className={styles.corner} data-pos="tr" />
        <span className={styles.corner} data-pos="bl" />
        <span className={styles.corner} data-pos="br" />
        <span className={styles.caption} data-pos="l">
          Selrick Academy archive
        </span>
        <span className={styles.caption} data-pos="r">
          A5-01
        </span>
      </div>
      <div className={styles.boot}>
        <div
          ref={barRef}
          className={styles.bar}
          role="progressbar"
          aria-label="Loading the site"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={0}
        >
          <div ref={fillRef} className={styles.fill} />
          <div className={styles.notches} />
        </div>
        <div className={styles.meta}>
          <span ref={labelRef} className={styles.label}>
            Starting
          </span>
          <span ref={pctRef} className={styles.pct}>
            0%
          </span>
        </div>
      </div>
      <div className={styles.wait}>
        <span ref={waitRef}>Loading</span>
        <span className={styles.scan} />
      </div>
    </div>
  );
});
