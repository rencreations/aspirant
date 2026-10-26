"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from "react";

import { audio, type VoiceState } from "./audio";
import { clamp, damp } from "./math";
import { useSiteStore } from "./stores";

/** useLayoutEffect on the client, useEffect on the server (no SSR warning). @public */
export const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

// Media queries ---------------------------------------------------------------------------

/** Subscribe to a CSS media query. Returns `serverValue` during SSR and the first render. */
export function useMediaQuery(query: string, serverValue = false): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}

/** True when the OS asks for reduced motion OR the visitor turned on "Reduce motion". */
export function useReducedMotion(): boolean {
  const os = useMediaQuery("(prefers-reduced-motion: reduce)");
  const pref = useSiteStore((s) => s.motion);
  return os || pref === "reduced";
}

/** Non-hook check for event handlers and effects. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return (
    document.documentElement.dataset.motion === "reduced" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** True on touch-first devices (no hover, coarse pointer). */
export function useIsTouch(): boolean {
  return useMediaQuery("(hover: none) and (pointer: coarse)");
}

// Viewport ----------------------------------------------------------------------------------

/** @public */
export interface Viewport {
  w: number;
  h: number;
  aspect: number;
  orientation: "landscape" | "portrait";
  /** 21:9 and wider. */
  isUltrawide: boolean;
  /** 9:19 and taller (most phones in portrait). */
  isTall: boolean;
}

const SERVER_VIEWPORT: Viewport = makeViewport(1440, 900);
let viewportCache: Viewport = SERVER_VIEWPORT;

function makeViewport(w: number, h: number): Viewport {
  const aspect = w / Math.max(1, h);
  return {
    w,
    h,
    aspect,
    orientation: aspect >= 1 ? "landscape" : "portrait",
    isUltrawide: aspect >= 2.1,
    isTall: aspect <= 0.5,
  };
}

function readViewport(): Viewport {
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (viewportCache.w !== w || viewportCache.h !== h) viewportCache = makeViewport(w, h);
  return viewportCache;
}

function subscribeViewport(onChange: () => void): () => void {
  window.addEventListener("resize", onChange, { passive: true });
  window.addEventListener("orientationchange", onChange, { passive: true });
  return () => {
    window.removeEventListener("resize", onChange);
    window.removeEventListener("orientationchange", onChange);
  };
}

/** Viewport size and shape. Re-renders on resize only. SSR value is 1440 x 900. @public */
export function useViewport(): Viewport {
  return useSyncExternalStore(subscribeViewport, readViewport, () => SERVER_VIEWPORT);
}

// In view ------------------------------------------------------------------------------------

/** @public */
export interface InViewOptions {
  rootMargin?: string;
  threshold?: number | number[];
  /** Stop observing after the first time it enters. */
  once?: boolean;
}

/** IntersectionObserver as state. @public */
export function useInView<T extends Element>(
  ref: RefObject<T | null>,
  { rootMargin = "0px", threshold = 0, once = false }: InViewOptions = {},
): boolean {
  const [inView, setInView] = useState(false);
  const thresholdKey = Array.isArray(threshold) ? threshold.join(",") : String(threshold);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        // Several entries can be queued when the page was busy: the last one is how it is now.
        const entry = entries[entries.length - 1];
        const visible = entry?.isIntersecting ?? false;
        setInView(visible);
        if (visible && once) observer.disconnect();
      },
      { rootMargin, threshold: thresholdKey.split(",").map(Number) },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, rootMargin, thresholdKey, once]);
  return inView;
}

// Animation loop -----------------------------------------------------------------------------

/** Document visibility as state. */
export function usePageVisible(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      document.addEventListener("visibilitychange", onChange);
      return () => document.removeEventListener("visibilitychange", onChange);
    },
    () => !document.hidden,
    () => true,
  );
}

/**
 * Run `callback(dt, time)` every animation frame while `enabled`. Pauses while the tab is
 * hidden. `dt` is in seconds and capped at 0.1 so a resumed tab does not jump.
 * @public
 */
export function useRafLoop(callback: (dt: number, time: number) => void, enabled = true): void {
  const cb = useRef(callback);
  useIsoLayoutEffect(() => {
    cb.current = callback;
  });
  const visible = usePageVisible();
  useEffect(() => {
    if (!enabled || !visible) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      cb.current(dt, now / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [enabled, visible]);
}

// Pointer ------------------------------------------------------------------------------------

/** @public */
export interface PointerState {
  /** Smoothed position, -1 (left/top) to 1 (right/bottom). */
  x: number;
  y: number;
  /** Raw target position, -1 to 1. */
  targetX: number;
  targetY: number;
  /** Last client position in px. */
  clientX: number;
  clientY: number;
  /** Smoothed speed in px per second. */
  speed: number;
  type: "mouse" | "touch" | "pen";
  /** True while a touch or pen is down, or a mouse is over the page. */
  active: boolean;
  /** Device tilt mapped to -1..1 when tilt is enabled and allowed. */
  tiltX: number;
  tiltY: number;
}

type PointerListener = (state: PointerState) => void;

const pointer: PointerState = {
  x: 0,
  y: 0,
  targetX: 0,
  targetY: 0,
  clientX: 0,
  clientY: 0,
  speed: 0,
  type: "mouse",
  active: false,
  tiltX: 0,
  tiltY: 0,
};
const pointerListeners = new Set<PointerListener>();
let pointerUsers = 0;
let tiltUsers = 0;
let pointerRaf = 0;
let pointerLast = 0;
let rawSpeed = 0;

function pointerTick(now: number) {
  const dt = Math.min(0.1, (now - pointerLast) / 1000 || 0.016);
  pointerLast = now;
  const tx = clamp(pointer.targetX + pointer.tiltX, -1, 1);
  const ty = clamp(pointer.targetY + pointer.tiltY, -1, 1);
  pointer.x = damp(pointer.x, tx, 9, dt);
  pointer.y = damp(pointer.y, ty, 9, dt);
  pointer.speed = damp(pointer.speed, rawSpeed, 6, dt);
  rawSpeed = damp(rawSpeed, 0, 10, dt);
  for (const l of pointerListeners) l(pointer);
  const settled =
    Math.abs(pointer.x - tx) < 0.0005 && Math.abs(pointer.y - ty) < 0.0005 && pointer.speed < 1;
  pointerRaf = settled ? 0 : requestAnimationFrame(pointerTick);
}

function wakePointer() {
  if (!pointerRaf && !document.hidden) {
    pointerLast = performance.now();
    pointerRaf = requestAnimationFrame(pointerTick);
  }
}

let lastMoveT = 0;
function onPointerMove(e: PointerEvent) {
  const now = performance.now();
  const dtMs = Math.max(1, now - lastMoveT);
  lastMoveT = now;
  const dx = e.clientX - pointer.clientX;
  const dy = e.clientY - pointer.clientY;
  rawSpeed = Math.min(6000, (Math.hypot(dx, dy) / dtMs) * 1000);
  pointer.clientX = e.clientX;
  pointer.clientY = e.clientY;
  pointer.targetX = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.targetY = (e.clientY / window.innerHeight) * 2 - 1;
  pointer.type = e.pointerType === "touch" || e.pointerType === "pen" ? e.pointerType : "mouse";
  pointer.active = true;
  wakePointer();
}

function onPointerDown(e: PointerEvent) {
  pointer.type = e.pointerType === "touch" || e.pointerType === "pen" ? e.pointerType : "mouse";
  pointer.clientX = e.clientX;
  pointer.clientY = e.clientY;
  pointer.active = true;
  wakePointer();
}

function onPointerEnd(e: PointerEvent) {
  if (e.pointerType !== "mouse") pointer.active = false;
  wakePointer();
}

function onPointerLeave() {
  pointer.active = false;
  pointer.targetX = 0;
  pointer.targetY = 0;
  wakePointer();
}

function onOrientation(e: DeviceOrientationEvent) {
  if (e.beta == null || e.gamma == null) return;
  pointer.tiltX = clamp(e.gamma / 35, -1, 1);
  pointer.tiltY = clamp((e.beta - 45) / 35, -1, 1);
  wakePointer();
}

function attachPointer() {
  if (pointerUsers++ > 0) return;
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("pointerdown", onPointerDown, { passive: true });
  window.addEventListener("pointerup", onPointerEnd, { passive: true });
  window.addEventListener("pointercancel", onPointerEnd, { passive: true });
  document.documentElement.addEventListener("pointerleave", onPointerLeave, { passive: true });
}

function detachPointer() {
  if (--pointerUsers > 0) return;
  window.removeEventListener("pointermove", onPointerMove);
  window.removeEventListener("pointerdown", onPointerDown);
  window.removeEventListener("pointerup", onPointerEnd);
  window.removeEventListener("pointercancel", onPointerEnd);
  document.documentElement.removeEventListener("pointerleave", onPointerLeave);
  cancelAnimationFrame(pointerRaf);
  pointerRaf = 0;
}

type OrientationCtor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

/**
 * Ask for device tilt access (iOS needs this inside a tap handler). Resolves true if tilt
 * events will arrive.
 * @public
 */
export async function requestTiltPermission(): Promise<boolean> {
  if (typeof window === "undefined" || typeof DeviceOrientationEvent === "undefined") return false;
  const ctor = DeviceOrientationEvent as OrientationCtor;
  if (typeof ctor.requestPermission !== "function") return true;
  try {
    return (await ctor.requestPermission()) === "granted";
  } catch {
    return false;
  }
}

export interface UsePointer {
  /** Live, mutable pointer state. Read it inside rAF loops; it never triggers renders. */
  ref: RefObject<PointerState>;
  /** Called on every smoothed frame while the pointer is moving. Returns unsubscribe. */
  subscribe: (listener: PointerListener) => () => void;
}

/**
 * Shared, smoothed pointer vector for mouse, touch and pen (one set of window listeners for
 * the whole app, one rAF that sleeps when the pointer is still). Pass `{ tilt: true }` to blend
 * in device orientation on phones (call `requestTiltPermission()` from a tap first on iOS).
 */
export function usePointer({ tilt = false }: { tilt?: boolean } = {}): UsePointer {
  const ref = useRef<PointerState>(pointer);
  useEffect(() => {
    attachPointer();
    return detachPointer;
  }, []);
  useEffect(() => {
    if (!tilt) return;
    if (tiltUsers++ === 0) window.addEventListener("deviceorientation", onOrientation);
    return () => {
      if (--tiltUsers === 0) {
        window.removeEventListener("deviceorientation", onOrientation);
        pointer.tiltX = 0;
        pointer.tiltY = 0;
      }
    };
  }, [tilt]);
  const subscribe = useCallback((listener: PointerListener) => {
    pointerListeners.add(listener);
    return () => {
      pointerListeners.delete(listener);
    };
  }, []);
  return { ref, subscribe };
}

// Keyboard -----------------------------------------------------------------------------------

/** True when focus is in a text field, where single-key shortcuts must not fire. @public */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") {
    const type = (target as HTMLInputElement).type;
    return !["button", "checkbox", "radio", "range", "submit", "reset", "color"].includes(type);
  }
  return false;
}

/**
 * Single-key shortcut (for example "n" or "m"). Ignored while typing, with modifier keys, on
 * key repeat, or when `enabled` is false.
 */
export function useHotkey(key: string, handler: (e: KeyboardEvent) => void, enabled = true): void {
  const cb = useRef(handler);
  useIsoLayoutEffect(() => {
    cb.current = handler;
  });
  useEffect(() => {
    if (!enabled) return;
    const lower = key.toLowerCase();
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.toLowerCase() !== lower || isTypingTarget(e.target)) return;
      cb.current(e);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [key, enabled]);
}

// Audio --------------------------------------------------------------------------------------

/** The voice line that is playing (re-renders on start and end only). */
export function useVoiceState(): VoiceState {
  return useSyncExternalStore(
    (onChange) => audio.onVoiceChange(onChange),
    () => audio.getVoiceState(),
    () => SERVER_VOICE,
  );
}
const SERVER_VOICE: VoiceState = { url: null, playing: false };

/** True after the first client render (use to gate client-only UI without mismatches). */
export function useMounted(): boolean {
  return useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
}

// Scroll -------------------------------------------------------------------------------------

/** Page scroll progress 0..1 (no re-render). Calls `onProgress` on scroll and resize. */
export function useScrollProgress(onProgress: (progress: number) => void): void {
  const cb = useRef(onProgress);
  useIsoLayoutEffect(() => {
    cb.current = onProgress;
  });
  useEffect(() => {
    let raf = 0;
    const read = () => {
      raf = 0;
      const el = document.scrollingElement ?? document.documentElement;
      const max = el.scrollHeight - window.innerHeight;
      cb.current(max > 0 ? clamp(window.scrollY / max) : 0);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    window.addEventListener(NAVIGATED_EVENT, schedule);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener(NAVIGATED_EVENT, schedule);
    };
  }, []);
}

/** Fired on window after a page transition reveals the new page. */
export const NAVIGATED_EVENT = "aspirants:navigated";

type ThemeName = "storm" | "daybreak";

/**
 * The theme of the page content under a viewport point, ignoring fixed UI marked with
 * `data-overlay`. Fixed chrome (nav, HUD) uses it to stay legible over Daybreak sections.
 */
export function useThemeAt(point: (w: number, h: number) => { x: number; y: number }): ThemeName {
  const [theme, setTheme] = useState<ThemeName>("storm");
  const pointRef = useRef(point);
  useIsoLayoutEffect(() => {
    pointRef.current = point;
  });
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const sample = () => {
      raf = 0;
      last = performance.now();
      const { x, y } = pointRef.current(window.innerWidth, window.innerHeight);
      const stack = document.elementsFromPoint(x, y);
      const hit = stack.find((el) => !el.closest("[data-overlay]"));
      const zone = hit?.closest<HTMLElement>("[data-theme]") ?? document.documentElement;
      const next = zone.dataset.theme === "daybreak" ? "daybreak" : "storm";
      setTheme((prev) => (prev === next ? prev : next));
    };
    const schedule = () => {
      if (raf) return;
      const wait = Math.max(0, 120 - (performance.now() - last));
      raf = window.setTimeout(() => requestAnimationFrame(sample), wait);
    };
    sample();
    const observer = new MutationObserver(schedule);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    window.addEventListener(NAVIGATED_EVENT, schedule);
    return () => {
      window.clearTimeout(raf);
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener(NAVIGATED_EVENT, schedule);
    };
  }, []);
  return theme;
}
