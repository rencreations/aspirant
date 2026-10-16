"use client";

import {
  useEffect,
  useEffectEvent,
  useImperativeHandle,
  useRef,
  type Ref,
  type RefObject,
} from "react";

import { canvasDpr, particleBudget } from "./budget";
import { ParticleEngine } from "./engine";
import { createRng } from "./random";
import { maskScale, renderMask, sampleMask } from "./textMask";

export interface ParticleTitleHandle {
  setProgress: (progress: number) => void;
  setInteractive: () => void;
  burst: () => void;
}

interface ParticleTitleProps {
  ref: Ref<ParticleTitleHandle>;
  /** The element whose box the wordmark fills. Its computed font-family is used for the mask. */
  boxRef: RefObject<HTMLElement | null>;
  /** Full-screen element that receives pointer input and sizes the canvas. */
  surfaceRef: RefObject<HTMLElement | null>;
  fontsReady: boolean;
  onFail: () => void;
  className?: string;
}

const INTERACTIVE = "button, a, [role='button']";

/** Canvas host for the particle engine. All per-frame work stays inside the engine. */
export function ParticleTitle({
  ref,
  boxRef,
  surfaceRef,
  fontsReady,
  onFail,
  className,
}: ParticleTitleProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<ParticleEngine | null>(null);
  const syncRef = useRef<(() => void) | null>(null);
  const fail = useEffectEvent(onFail);

  useImperativeHandle(
    ref,
    () => ({
      setProgress: (p) => engineRef.current?.setProgress(p),
      setInteractive: () => engineRef.current?.setInteractive(),
      burst: () => engineRef.current?.burst(),
    }),
    [],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const surface = surfaceRef.current;
    const boxEl = boxRef.current;
    if (!canvas || !surface || !boxEl) return;

    const cores = navigator.hardwareConcurrency || 0;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const width = surface.clientWidth;
    const height = surface.clientHeight;
    const engine = ParticleEngine.create(canvas, {
      count: particleBudget({ width, height, coarse, cores }),
      width,
      height,
      dpr: canvasDpr(window.devicePixelRatio, cores, width, height),
      onLost: () => fail(),
    });
    if (!engine) {
      fail();
      return;
    }
    engineRef.current = engine;

    const sync = () => {
      const rect = boxEl.getBoundingClientRect();
      const origin = surface.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      const scale = maskScale(rect.width);
      const mask = renderMask(rect.width, rect.height, getComputedStyle(boxEl).fontFamily, scale);
      if (!mask) return;
      engine.setWordmark(
        sampleMask(mask, engine.wordCount, createRng(7)),
        { x: rect.left - origin.left, y: rect.top - origin.top, w: rect.width, h: rect.height },
        scale,
      );
    };
    syncRef.current = sync;

    let resizeTimer = 0;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        const w = surface.clientWidth;
        const h = surface.clientHeight;
        engine.resize(w, h, canvasDpr(window.devicePixelRatio, cores, w, h));
        sync();
      }, 120);
    };
    const observer = new ResizeObserver(onResize);
    observer.observe(surface);
    observer.observe(boxEl);
    document.fonts.addEventListener("loadingdone", sync);

    const local = (e: PointerEvent) => {
      const r = surface.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top] as const;
    };
    const onMove = (e: PointerEvent) => {
      const [x, y] = local(e);
      engine.pointerMove(x, y, e.pointerType !== "mouse");
    };
    let touchPress = false;
    const onDown = (e: PointerEvent) => {
      touchPress = e.pointerType !== "mouse";
      const [x, y] = local(e);
      const onControl = e.target instanceof Element && e.target.closest(INTERACTIVE) !== null;
      if (onControl || e.button !== 0) engine.pointerMove(x, y, e.pointerType !== "mouse");
      else engine.pointerDown(x, y, e.pointerType !== "mouse");
    };
    const onUp = (e: PointerEvent) => {
      const [x, y] = local(e);
      engine.pointerUp(x, y);
    };
    const onLeave = () => engine.pointerLeave();
    // A long press gathers the star; keep the phone's context menu out of the way.
    const onContextMenu = (e: Event) => {
      if (touchPress) e.preventDefault();
    };
    surface.addEventListener("pointermove", onMove);
    surface.addEventListener("pointerdown", onDown);
    surface.addEventListener("pointerup", onUp);
    surface.addEventListener("pointercancel", onLeave);
    surface.addEventListener("pointerleave", onLeave);
    surface.addEventListener("contextmenu", onContextMenu);

    sync();
    engine.start();

    return () => {
      window.clearTimeout(resizeTimer);
      observer.disconnect();
      document.fonts.removeEventListener("loadingdone", sync);
      surface.removeEventListener("pointermove", onMove);
      surface.removeEventListener("pointerdown", onDown);
      surface.removeEventListener("pointerup", onUp);
      surface.removeEventListener("pointercancel", onLeave);
      surface.removeEventListener("pointerleave", onLeave);
      surface.removeEventListener("contextmenu", onContextMenu);
      engine.destroy();
      engineRef.current = null;
      syncRef.current = null;
    };
  }, [boxRef, surfaceRef]);

  useEffect(() => {
    if (fontsReady) syncRef.current?.();
  }, [fontsReady]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
