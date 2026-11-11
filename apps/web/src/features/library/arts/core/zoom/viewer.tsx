"use client";

/**
 * The viewer layer: a modal dialog over the page that holds the open picture (`slide.tsx`, moved by
 * `run.ts`) and the chrome around it. While it is open the page behind is inert and held still
 * (`guard.ts`), focus stays inside and goes back to the tile on close. Every way out ends in one
 * place: the slide says it has closed, and the cleanup below puts back `inert`, the keys and the
 * focus, once, whatever way the viewer went.
 *
 * Touch: a tap on the picture closes it, a swipe down closes it from where the finger is, a swipe
 * sideways moves to the neighbour. Mouse: a press on the picture or the dark ground closes it, and
 * the side buttons and the arrow keys move.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type MutableRefObject,
} from "react";
import { createPortal } from "react-dom";

import { SHELL_ID } from "@/components/loader-gate";
import { useLenis } from "@/components/smooth-scroll";
import { useIsoLayoutEffect } from "@/lib/hooks";
import { libUrl } from "@/lib/library";

import { recheckZoomCursor } from "./cursor";
import { installGuard } from "./guard";
import { Slide, type SlideEvents, type SlideStatus } from "./slide";
import type { RunHandle, ViewerHandle, ZoomPhase, ZoomPicture, ZoomTone, ZoomView } from "./types";
import styles from "./viewer.module.css";
import { STEP_MS, dragOffset, neighbourIndexes, shouldDismiss } from "./zoom-math";

export interface ViewerProps {
  view: ZoomView;
  tone?: ZoomTone | undefined;
  /** The pictures of the room, read when the neighbours are warmed. */
  list: () => readonly ZoomPicture[];
  /** The provider asks the viewer to close through this. */
  handleRef: MutableRefObject<ViewerHandle | null>;
  onStep: (delta: 1 | -1) => void;
  /** The closing move has begun (a press, Esc, or a swipe). */
  onCloseStart: () => void;
  /** The picture has landed and the viewer can go. */
  onClosed: () => void;
}

const IDLE: SlideStatus = { p: false, f: false, failed: false };

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
    </svg>
  );
}

const two = (n: number) => String(n).padStart(2, "0");

export function Viewer({
  view,
  tone,
  list,
  handleRef,
  onStep,
  onCloseStart,
  onClosed,
}: ViewerProps) {
  const root = useRef<HTMLDivElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  const progress = useRef<HTMLElement>(null);
  const handle = useRef<RunHandle | null>(null);
  const newest = useRef(0);
  const { getLenis } = useLenis();

  const [phase, setPhase] = useState<ZoomPhase>("opening");
  const [status, setStatus] = useState<SlideStatus>(IDLE);
  const [scrollable, setScrollable] = useState(false);
  const [retry, setRetry] = useState(0);

  // A neighbour replaces the picture: the old one stays on for a moment, fading out.
  const [shown, setShown] = useState(view);
  const [leaving, setLeaving] = useState<ZoomView[]>([]);
  if (view.seq !== shown.seq) {
    setLeaving((l) => [...l.slice(-1), shown]);
    setShown(view);
  }
  useEffect(() => {
    if (leaving.length === 0) return;
    const id = window.setTimeout(() => {
      setLeaving([]);
    }, STEP_MS + 160);
    return () => {
      window.clearTimeout(id);
    };
  }, [leaving]);

  const latest = useRef({ view, onStep, onCloseStart, onClosed, list });
  useIsoLayoutEffect(() => {
    latest.current = { view, onStep, onCloseStart, onClosed, list };
  });

  const events = useMemo<SlideEvents>(() => {
    // The newest slide is the highest `seq` heard from (its moves start in its own layout effect,
    // before this component's effects have seen the new view).
    const current = (seq: number) => {
      if (seq > newest.current) newest.current = seq;
      return seq === newest.current;
    };
    return {
      status: (seq, next) => {
        if (current(seq)) setStatus(next);
      },
      phase: (seq, next) => {
        if (!current(seq)) return;
        setPhase(next);
      },
      closeStart: (seq) => {
        if (current(seq)) latest.current.onCloseStart();
      },
      closed: (seq) => {
        if (current(seq)) latest.current.onClosed();
      },
      scrolled: (seq, value) => {
        if (!current(seq)) return;
        const bar = progress.current;
        if (bar) bar.style.transform = `scaleY(${Math.min(1, Math.max(0, value)).toFixed(4)})`;
      },
      handle: (seq, next) => {
        if (!current(seq)) return;
        handle.current = next;
        // A strip shows its read line; the layout is known as soon as the slide has started.
        setScrollable(next?.scroller() != null);
      },
    };
  }, []);

  const close = useCallback((force = false) => handle.current?.close(force) ?? false, []);

  useEffect(() => {
    handleRef.current = { close };
    return () => {
      handleRef.current = null;
    };
  }, [handleRef, close]);

  // The page behind: inert, held still, and focus kept here. One place puts it all back.
  useEffect(() => {
    const shell = document.getElementById(SHELL_ID);
    const inertWas = shell?.inert ?? false;
    if (shell) shell.inert = true;
    const back = document.activeElement;
    root.current?.focus({ preventScroll: true });
    // A smooth scroll that is still running would carry the page on behind the viewer.
    const lenis = getLenis();
    if (lenis) lenis.scrollTo(lenis.animatedScroll, { immediate: true, force: true });
    const release = installGuard({
      scroller: () => handle.current?.scroller() ?? null,
      onEscape: () => {
        close(true);
      },
      onStep: (delta) => {
        latest.current.onStep(delta);
      },
    });
    return () => {
      release();
      if (shell) shell.inert = inertWas;
      // The tile may have gone with its room, or be the one that is hidden: focus what can take it.
      const target = latest.current.view.source?.isConnected
        ? latest.current.view.source
        : back instanceof HTMLElement && back.isConnected
          ? back
          : null;
      target?.focus({ preventScroll: true });
    };
    // Once: the viewer's life is one mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The buttons take a press only once the chrome shows: look under a resting pointer again then.
  useEffect(() => {
    if (phase !== "open") return;
    const id = requestAnimationFrame(recheckZoomCursor);
    return () => {
      cancelAnimationFrame(id);
    };
  }, [phase]);

  // The neighbours' previews, once this picture's own preview is in.
  const warmIndex = view.index;
  const warmTotal = view.total;
  const previewIn = status.p || status.failed;
  useEffect(() => {
    if (!previewIn) return;
    const pictures = latest.current.list();
    for (const i of neighbourIndexes(warmIndex, warmTotal)) {
      const near = pictures[i];
      if (near) new Image().src = libUrl(near.img.p);
    }
  }, [previewIn, warmIndex, warmTotal, view.seq]);

  // Touch: a swipe down closes from where the finger is, a swipe sideways moves on.
  const suppressClick = useRef(0);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let g: {
      x: number;
      y: number;
      t: number;
      mode: "none" | "drag" | "swipe" | "skip";
      dx: number;
      dy: number;
    } | null = null;
    const down = (e: TouchEvent) => {
      if (e.touches.length !== 1 || (e.target as Element).closest("[data-ui]")) {
        g = null;
        return;
      }
      const t = e.touches[0]!;
      g = { x: t.clientX, y: t.clientY, t: performance.now(), mode: "none", dx: 0, dy: 0 };
    };
    const move = (e: TouchEvent) => {
      if (!g) return;
      if (e.touches.length !== 1) {
        if (g.mode === "drag") handle.current?.release(g.dy, false);
        g = null;
        return;
      }
      const t = e.touches[0]!;
      const dx = t.clientX - g.x;
      const dy = t.clientY - g.y;
      if (g.mode === "none") {
        if (Math.abs(dy) > 10 && Math.abs(dy) >= Math.abs(dx)) {
          g.mode = dy > 0 && (handle.current?.atTop() ?? false) ? "drag" : "skip";
        } else if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
          g.mode = "swipe";
        }
      }
      g.dx = dx;
      if (g.mode === "drag") {
        g.dy = dragOffset(dy);
        handle.current?.drag(g.dy);
        if (e.cancelable) e.preventDefault();
      }
    };
    const up = () => {
      const was = g;
      g = null;
      if (!was) return;
      if (was.mode === "drag") {
        const velocity = was.dy / Math.max(1, performance.now() - was.t);
        handle.current?.release(was.dy, shouldDismiss(was.dy, velocity));
        suppressClick.current = performance.now() + 500;
      } else if (was.mode === "swipe" && Math.abs(was.dx) > 60) {
        latest.current.onStep(was.dx < 0 ? 1 : -1);
        suppressClick.current = performance.now() + 500;
      }
    };
    el.addEventListener("touchstart", down, { passive: true });
    el.addEventListener("touchmove", move, { passive: false });
    el.addEventListener("touchend", up, { passive: true });
    el.addEventListener("touchcancel", up, { passive: true });
    return () => {
      el.removeEventListener("touchstart", down);
      el.removeEventListener("touchmove", move);
      el.removeEventListener("touchend", up);
      el.removeEventListener("touchcancel", up);
    };
  }, []);

  // A press on the picture or the dark ground closes. A drag with the mouse does not.
  const pressAt = useRef<{ x: number; y: number } | null>(null);
  const onClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (performance.now() < suppressClick.current) return;
    const at = pressAt.current;
    if (at && Math.hypot(e.clientX - at.x, e.clientY - at.y) > 6) return;
    const target = e.target as Element;
    if (target.closest("[data-ui]")) return;
    if (target.closest('[data-zoom="out"]')) close();
  };

  // Tab stays inside the viewer.
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab") return;
    const items = Array.from(
      e.currentTarget.querySelectorAll<HTMLElement>(
        "button:not([disabled]), a[href], [tabindex='0']",
      ),
    );
    if (items.length === 0) {
      e.preventDefault();
      return;
    }
    const first = items[0]!;
    const last = items[items.length - 1]!;
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === e.currentTarget)) {
      e.preventDefault();
      last.focus({ preventScroll: true });
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus({ preventScroll: true });
    }
  };

  const picture = view.picture;
  const slides = [...leaving, view];
  const hasPrev = view.index > 0;
  const hasNext = view.index < view.total - 1;

  return createPortal(
    <div
      ref={root}
      className={styles.root}
      role="dialog"
      aria-modal="true"
      aria-label={picture.alt}
      tabIndex={-1}
      data-tone={tone}
      data-phase={phase}
      data-zoom-viewer=""
      data-lenis-prevent=""
      onClick={onClick}
      onPointerDown={(e) => {
        pressAt.current = { x: e.clientX, y: e.clientY };
      }}
      onKeyDown={onKeyDown}
    >
      <div ref={backdrop} className={styles.backdrop} data-zoom="out" />
      {slides.map((v) => (
        <Slide
          key={v.seq}
          view={v}
          leaving={v.seq !== view.seq}
          backdrop={backdrop}
          retry={retry}
          events={events}
        />
      ))}
      <div className={styles.chrome}>
        <div className={styles.loading} data-on={!status.f && !status.failed} aria-hidden="true">
          <i />
        </div>
        <div className={styles.progress} data-on={scrollable} aria-hidden="true">
          <i ref={progress} />
        </div>
        <div className={styles.top} data-ui="">
          {picture.title || view.total > 1 ? (
            <p className={styles.meta}>
              {picture.title ? <span className={styles.title}>{picture.title}</span> : null}
              {view.total > 1 ? (
                <span
                  className={styles.count}
                  aria-label={`Picture ${view.index + 1} of ${view.total}`}
                >
                  {two(view.index + 1)} / {two(view.total)}
                </span>
              ) : (
                <span />
              )}
            </p>
          ) : (
            <span />
          )}
          <button
            type="button"
            className={styles.square}
            aria-label="Close the picture"
            data-ui=""
            onClick={() => {
              close(true);
            }}
          >
            <Icon d="M5 5l14 14M19 5L5 19" />
          </button>
        </div>
        {view.total > 1 ? (
          <>
            <button
              type="button"
              className={`${styles.square} ${styles.nav}`}
              data-side="prev"
              data-ui=""
              aria-label="Previous picture"
              disabled={!hasPrev}
              onClick={() => {
                onStep(-1);
              }}
            >
              <Icon d="M15 5l-7 7 7 7" />
            </button>
            <button
              type="button"
              className={`${styles.square} ${styles.nav}`}
              data-side="next"
              data-ui=""
              aria-label="Next picture"
              disabled={!hasNext}
              onClick={() => {
                onStep(1);
              }}
            >
              <Icon d="M9 5l7 7-7 7" />
            </button>
          </>
        ) : null}
        {picture.caption ? (
          <div className={styles.caption} data-ui="">
            {picture.caption}
          </div>
        ) : null}
        {status.failed ? (
          <p className={styles.note} role="status" data-ui="">
            <span>The picture could not be loaded.</span>
            <button
              type="button"
              onClick={() => {
                setRetry((n) => n + 1);
              }}
            >
              Try again
            </button>
          </p>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
